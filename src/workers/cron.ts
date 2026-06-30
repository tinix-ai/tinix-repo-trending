import 'dotenv/config';
import { Job } from 'bullmq';
import { crawlerQueue, githubUpdaterQueue, socialCrawlerQueue, hfQueue, redisConnection } from './queue';
import { db } from '../lib/db';
import { projects, projectSnapshots, projectTrends, githubUsers, projectMentions } from '../lib/db/schema';
import { discoverNewRepos } from '../lib/crawlers/github-discovery';
import { discoverGithubTrendingRepos } from '../lib/crawlers/github-trending-scraper';
import { fetchHFTopList, updateHFProjectMetricsInline } from '../lib/crawlers/hf-discovery';
import { eq, lte, or, and, isNull, sql, asc } from 'drizzle-orm';
import { fetchGitHubBatch, fetchPublicRepoREST } from '../lib/crawlers/github-graphql';
import { fetchHFBatch } from '../lib/crawlers/hf-batch';
import { parseCountryFromProfile } from '../lib/location-parser';
import { updateProjectCrawlSchedule } from '../lib/crawlers/scheduler';
import { categorizeProject } from '../lib/categorizer';
import { crawlTwitterMentionsBatched, TwitterProjectTarget } from '../lib/crawlers/twitter';
import { calculateProjectTrendInline } from '../lib/db/trends';


/**
 * Job 1: Daily Discovery
 * Scans GitHub and HuggingFace for new AI/ML repos/models and adds them to the crawler queue.
 */
export async function runDailyDiscovery(source?: 'github' | 'huggingface') {
  console.log(`[Cron] Running Discovery (source: ${source || 'all'})...`);
  await redisConnection.del('cancel_signal:daily-discovery'); // Clear any orphaned signals

  // --- 1. FETCH ALL DISCOVERY ITEMS ---
  let newRepos: any[] = [];
  let hfModels: any[] = [];
  let hfDatasets: any[] = [];

  if (!source || source === 'github') {
    let searchRepos: any[] = [];
    try {
      searchRepos = await discoverNewRepos();
      console.log(`[Cron] Discovered ${searchRepos.length} trending repos from GitHub Search API.`);
    } catch (searchErr) {
      console.error(`[Cron] GitHub Search API Discovery failed:`, searchErr);
    }

    let htmlRepos: any[] = [];
    try {
      htmlRepos = await discoverGithubTrendingRepos();
      console.log(`[Cron] Discovered ${htmlRepos.length} trending repos from HTML Trending Scraper.`);
    } catch (htmlErr) {
      console.error(`[Cron] HTML Trending Scraper failed, falling back to Search API only:`, htmlErr);
    }

    const combinedReposMap = new Map<string, { owner: string; repo: string; stars: number }>();
    for (const repo of searchRepos) combinedReposMap.set(`${repo.owner.toLowerCase()}/${repo.repo.toLowerCase()}`, repo);
    for (const repo of htmlRepos) {
      const key = `${repo.owner.toLowerCase()}/${repo.repo.toLowerCase()}`;
      if (!combinedReposMap.has(key)) combinedReposMap.set(key, repo);
    }

    newRepos = Array.from(combinedReposMap.values());
    console.log(`[Cron] Combined unique GitHub repositories for crawling: ${newRepos.length}`);
  }

  if (!source || source === 'huggingface') {
    console.log('[HF Discovery] Fetching top 1000 trending models...');
    hfModels = await fetchHFTopList('https://huggingface.co/api/models?sort=trendingScore&limit=100&direction=-1', 10);
    console.log(`[HF Discovery] Discovered ${hfModels.length} unique models from API.`);

    console.log('[HF Discovery] Fetching top 1000 trending datasets...');
    hfDatasets = await fetchHFTopList('https://huggingface.co/api/datasets?sort=trendingScore&limit=100&direction=-1', 10);
    console.log(`[HF Discovery] Discovered ${hfDatasets.length} unique datasets from API.`);
  }

  // --- 2. PREPARE DB MAPS ---
  const existingGHMap = new Map();
  if (newRepos.length > 0) {
    const existingGitHub = await db.select({ 
      id: projects.id, 
      sourceId: projects.sourceId, 
      crawlInterval: projects.crawlInterval 
    }).from(projects).where(eq(projects.source, 'github'));
    for (const p of existingGitHub) existingGHMap.set(p.sourceId, p);
  }

  const existingHFMap = new Map();
  if (hfModels.length > 0 || hfDatasets.length > 0) {
    const existingHF = await db.select({
      id: projects.id,
      sourceId: projects.sourceId,
      sourceUpdatedAt: projects.sourceUpdatedAt,
      readme: projects.readme
    }).from(projects).where(eq(projects.source, 'huggingface'));
    for (const p of existingHF) existingHFMap.set(p.sourceId, { ...p, hasReadme: !!p.readme });
  }

  // --- 3. INTERLEAVED BATCH PROCESSING ---
  const BATCH_SIZE = 50;
  let ghIndex = 0;
  let hfModelIndex = 0;
  let hfDatasetIndex = 0;

  const todayStr = new Date().toISOString().split('T')[0];
  let ghQueuedCount = 0;
  let hfModelQueued = 0, hfModelInline = 0;
  let hfDatasetQueued = 0, hfDatasetInline = 0;

  console.log(`[Cron] Starting interleaved discovery processing...`);

  while (ghIndex < newRepos.length || hfModelIndex < hfModels.length || hfDatasetIndex < hfDatasets.length) {
    // Check for cancellation signal
    const isCancelled = await redisConnection.get('cancel_signal:daily-discovery');
    if (isCancelled === 'true') {
      console.log('[Cron] Discovery job cancelled by user.');
      await redisConnection.del('cancel_signal:daily-discovery');
      return;
    }
    
    // Process GH batch
    if (ghIndex < newRepos.length) {
      const batch = newRepos.slice(ghIndex, ghIndex + BATCH_SIZE);
      for (const repo of batch) {
        const sourceId = `${repo.owner}/${repo.repo}`;
        const existing = existingGHMap.get(sourceId);
        
        if (!existing) {
          await crawlerQueue.add('crawl-repo', { owner: repo.owner, repo: repo.repo }, { jobId: `discovery-${sourceId}` });
          ghQueuedCount++;
        }
      }
      ghIndex += BATCH_SIZE;
    }

    // Process HF Models batch
    if (hfModelIndex < hfModels.length) {
      const batch = hfModels.slice(hfModelIndex, hfModelIndex + BATCH_SIZE);
      for (const model of batch) {
        const existing = existingHFMap.get(model.id);
        const modelLastModified = model.lastModified ? new Date(model.lastModified) : null;
        const isNew = !existing;
        const isOutdated = !!(existing && modelLastModified && existing.sourceUpdatedAt && (modelLastModified.getTime() > new Date(existing.sourceUpdatedAt).getTime()));
        const needsReadme = !!(existing && !existing.hasReadme);
        const needsFullCrawl = isNew || isOutdated || needsReadme;

        if (!needsFullCrawl && existing) {
          await updateHFProjectMetricsInline(existing.id, model.likes || 0, model.downloads || 0);
          hfModelInline++;
        } else {
          if (existing) await db.update(projects).set({ nextCrawlAt: new Date(Date.now() + 20 * 60 * 60 * 1000) }).where(eq(projects.id, existing.id));
          await hfQueue.add('crawl-hf-model', { id: model.id, type: 'models' }, { jobId: `hf-model-${model.id}-${todayStr}` });
          hfModelQueued++;
        }
      }
      hfModelIndex += BATCH_SIZE;
    }

    // Process HF Datasets batch
    if (hfDatasetIndex < hfDatasets.length) {
      const batch = hfDatasets.slice(hfDatasetIndex, hfDatasetIndex + BATCH_SIZE);
      for (const dataset of batch) {
        const existing = existingHFMap.get(dataset.id);
        const datasetLastModified = dataset.lastModified ? new Date(dataset.lastModified) : null;
        const isNew = !existing;
        const isOutdated = !!(existing && datasetLastModified && existing.sourceUpdatedAt && (datasetLastModified.getTime() > new Date(existing.sourceUpdatedAt).getTime()));
        const needsReadme = !!(existing && !existing.hasReadme);
        const needsFullCrawl = isNew || isOutdated || needsReadme;

        if (!needsFullCrawl && existing) {
          await updateHFProjectMetricsInline(existing.id, dataset.likes || 0, dataset.downloads || 0);
          hfDatasetInline++;
        } else {
          if (existing) await db.update(projects).set({ nextCrawlAt: new Date(Date.now() + 20 * 60 * 60 * 1000) }).where(eq(projects.id, existing.id));
          await hfQueue.add('crawl-hf-dataset', { id: dataset.id, type: 'datasets' }, { jobId: `hf-dataset-${dataset.id}-${todayStr}` });
          hfDatasetQueued++;
        }
      }
      hfDatasetIndex += BATCH_SIZE;
    }
  }

  console.log(`[Cron] Discovery finished.`);
  console.log(`[Cron] GH: Queued ${ghQueuedCount}.`);
  console.log(`[Cron] HF Models: Queued ${hfModelQueued}, Inline ${hfModelInline}.`);
  console.log(`[Cron] HF Datasets: Queued ${hfDatasetQueued}, Inline ${hfDatasetInline}.`);
}

/**
 * Job 2: Daily Update
 * Pulls tracked projects from the DB and adds them to the respective updater queues.
 * Projects are ordered and prioritized by crawlInterval (hot projects first).
 */
/**
 * Maps crawlInterval to BullMQ priority.
 * Lower BullMQ priority number = higher urgency.
 * Projects with shorter intervals (hot/trending) get processed first.
 */
function crawlIntervalToPriority(interval: number | null): number {
  switch (interval) {
    case 1:  return 1;   // Extremely hot — crawl daily
    case 2:  return 2;   // Fast growth
    case 4:  return 3;   // Moderate growth
    case 7:  return 5;   // Slow growth
    case 14: return 7;   // Stale
    case 30: return 10;  // Cold
    default: return 5;   // Unknown → medium
  }
}

export async function runDailyUpdate(force = false, job?: Job) {
  console.log(`[Cron] Running Daily Update for tracked repos (force: ${force})...`);
  await redisConnection.del('cancel_signal:daily-update'); // Clear any orphaned signals

  const selectFields = {
    id: projects.id,
    sourceId: projects.sourceId,
    source: projects.source,
    sourceUrl: projects.sourceUrl,
    crawlInterval: projects.crawlInterval,
    nextCrawlAt: projects.nextCrawlAt,
    lastCrawledAt: projects.lastCrawledAt,
    countryCode: projects.countryCode,
  };

  // Order by crawlInterval ASC so hot projects are enqueued/updated first,
  // then by nextCrawlAt ASC so the most overdue come before the just-due.
  const trackedProjects = force
    ? await db.select(selectFields).from(projects)
        .where(or(
          isNull(projects.lastCrawledAt),
          sql`(NOW() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - (${projects.lastCrawledAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date > 0`,
          sql`COALESCE(${projects.crawlInterval}, 1) <= 1`
        ))
        .orderBy(asc(projects.crawlInterval), asc(projects.nextCrawlAt))
    : await db.select(selectFields).from(projects)
        .where(or(
          isNull(projects.lastCrawledAt),
          sql`(NOW() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - (${projects.lastCrawledAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date >= COALESCE(${projects.crawlInterval}, 1)`
        ))
        .orderBy(asc(projects.crawlInterval), asc(projects.nextCrawlAt));

  const githubProjects = trackedProjects.filter(p => p.source === 'github');
  const huggingFaceProjects = trackedProjects.filter(p => p.source === 'huggingface');

  let ghCount = 0;
  let hfCount = 0;

  // Process GitHub and HuggingFace in interleaved batches
  const GITHUB_BATCH_SIZE = 50;
  const HF_BATCH_SIZE = 50;
  
  let ghIndex = 0;
  let hfIndex = 0;
  let stopGithub = false;
  let stopHF = false;
  
  let ghConsecutiveErrors = 0;
  let hfConsecutiveErrors = 0;

  console.log(`[Cron] Batch updating ${githubProjects.length} GitHub repos, ${huggingFaceProjects.length} HuggingFace projects (force: ${force})...`);

  const now = new Date();
  const todayStr = new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];

  while (ghIndex < githubProjects.length || hfIndex < huggingFaceProjects.length) {
    // Check for cancellation signal
    const isCancelled = await redisConnection.get('cancel_signal:daily-update');
    if (isCancelled === 'true') {
      console.log('[Cron] Update job cancelled by user.');
      await redisConnection.del('cancel_signal:daily-update');
      return;
    }
    
    // --- GitHub Batch ---
    if (!stopGithub && ghIndex < githubProjects.length) {
      const batch = githubProjects.slice(ghIndex, ghIndex + GITHUB_BATCH_SIZE);
      console.log(`[Cron Batch] Updating GitHub repositories batch ${Math.floor(ghIndex / GITHUB_BATCH_SIZE) + 1}/${Math.ceil(githubProjects.length / GITHUB_BATCH_SIZE)} (size: ${batch.length})...`);
      
      const repoCoords = batch.map(p => {
        const [owner, name] = p.sourceId.split('/');
        return { owner, name };
      });

      try {
        const batchResults = await fetchGitHubBatch(repoCoords);
        
        const updatePromises = batchResults.map(async (result, j) => {
          const project = batch[j];
          const [owner, repo] = project.sourceId.split('/');

          if (result.permissionDenied) {
            console.warn(`[Cron Batch] Project ${project.sourceId} returned permission denied/SAML SSO. Attempting anonymous REST fallback...`);
            const restResult = await fetchPublicRepoREST(owner, repo);
            if (restResult.exists && restResult.data) {
              console.log(`[Cron Batch] REST fallback succeeded for public repo ${project.sourceId}.`);
              result.permissionDenied = false;
              result.data = restResult.data;
            } else {
              console.warn(`[Cron Batch] Project ${project.sourceId} REST fallback failed or private. Skipping update, setting 30-day backoff, and keeping database record.`);
              try {
                await db.update(projects)
                  .set({
                    crawlInterval: 30,
                    nextCrawlAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    lastCrawledAt: new Date(),
                  })
                  .where(eq(projects.id, project.id));
              } catch (dbErr) {
                console.error(`[Cron Batch] Failed to update next crawl for restricted project ${project.sourceId}:`, dbErr);
              }
              return;
            }
          }

          if (!result.exists) {
            console.warn(`[Cron Batch] Project ${project.sourceId} not found on GitHub. Removing from database.`);
            try {
              await db.delete(projectTrends).where(eq(projectTrends.projectId, project.id));
              await db.delete(projectSnapshots).where(eq(projectSnapshots.projectId, project.id));
              await db.delete(projects).where(eq(projects.id, project.id));
            } catch (delErr) {
              console.error(`[Cron Batch] Failed to delete non-existent project ${project.sourceId}:`, delErr);
            }
            return;
          }

          const data = result.data;
          if (!data) return;

          // Check rename
          const isRenamed = data.fullName.toLowerCase() !== project.sourceId.toLowerCase();
          if (isRenamed) {
            console.log(`[Cron Batch] Rename detected for ${project.sourceId} -> ${data.fullName}. Enqueuing to single updater queue.`);
            const dateSuffix = force ? `force-${Date.now()}` : new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];
            await githubUpdaterQueue.add('crawl-repo', {
              owner,
              repo,
              projectId: project.id,
            }, {
              jobId: `update-gh-rename-${project.id}-${dateSuffix}`,
              priority: 1, // High priority for renames
            });
            return;
          }

          // Process categories & location
          const canonicalCategories = await categorizeProject(data.topics, 'repository');
          
          const ownerLocation = data.location;
          let ownerCountryCode = null;
          if (ownerLocation) {
            const parsedCountry = parseCountryFromProfile({
              location: ownerLocation,
              email: data.email || undefined,
              blog: data.blog || undefined,
              company: data.company || undefined
            });
            ownerCountryCode = parsedCountry || null;
          }

          // Update cache in github_users
          try {
            await db.insert(githubUsers)
              .values({
                username: data.ownerName,
                location: ownerLocation,
                countryCode: ownerCountryCode || 'UNKNOWN',
                updatedAt: new Date()
              })
              .onConflictDoUpdate({
                target: githubUsers.username,
                set: {
                  location: ownerLocation,
                  countryCode: ownerCountryCode || 'UNKNOWN',
                  updatedAt: new Date()
                }
              });
          } catch (cacheErr) {
            console.warn(`[Cron Batch] Failed to update owner cache for ${data.ownerName}:`, cacheErr);
          }

          // Update project info
          try {
            await db.update(projects)
              .set({
                name: data.name,
                fullName: data.fullName,
                description: data.description || '',
                homepageUrl: data.homepageUrl,
                primaryLanguage: data.primaryLanguage,
                license: data.license,
                topics: data.topics,
                categories: canonicalCategories,
                location: ownerLocation,
                countryCode: ownerCountryCode,
                stars: data.stars,
                forks: data.forks,
                watchers: data.watchers,
                openIssues: data.openIssues,
                sourceUpdatedAt: data.sourceUpdatedAt,
                lastCrawledAt: new Date(),
              })
              .where(eq(projects.id, project.id));

            // Record snapshot
            const snapshotDateStr = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];
            const [existingSnap] = await db
              .select({ id: projectSnapshots.id })
              .from(projectSnapshots)
              .where(
                and(
                  eq(projectSnapshots.projectId, project.id),
                  eq(projectSnapshots.snapshotDate, snapshotDateStr)
                )
              )
              .limit(1);

            if (existingSnap) {
              await db.update(projectSnapshots)
                .set({
                  stars: data.stars,
                  forks: data.forks,
                  openIssues: data.openIssues,
                  watchers: data.watchers,
                })
                .where(eq(projectSnapshots.id, existingSnap.id));
            } else {
              await db.insert(projectSnapshots).values({
                projectId: project.id,
                stars: data.stars,
                forks: data.forks,
                openIssues: data.openIssues,
                watchers: data.watchers,
                snapshotDate: snapshotDateStr,
              });
            }

            // Recalculate schedule
            const isAlreadyCrawledToday = project.lastCrawledAt && new Date(project.lastCrawledAt.getTime() + 7 * 60 * 60 * 1000).toISOString().split('T')[0] === todayStr;
            const skipIntervalIncrement = force || isAlreadyCrawledToday;
            await updateProjectCrawlSchedule(project.id, 'github', skipIntervalIncrement);
            await calculateProjectTrendInline(project.id);
            ghCount++;
          } catch (dbErr) {
            console.error(`[Cron Batch] Failed to update project db for ${project.sourceId}:`, dbErr);
          }
        });

        await Promise.all(updatePromises);
        ghConsecutiveErrors = 0; // Reset consecutive errors on successful batch
      } catch (batchErr: unknown) {
        ghConsecutiveErrors++;
        const err = batchErr instanceof Error ? batchErr : new Error(String(batchErr));
        if (err.message?.includes('[RateLimitError]')) {
          console.warn('[Cron Batch] GitHub Rate Limit reached. Stopping subsequent GitHub update batches.');
          stopGithub = true;
        } else {
          console.error(`[Cron Batch] Failed to process batch for ${repoCoords.map(r => `${r.owner}/${r.name}`).join(', ')}:`, batchErr);
          if (ghConsecutiveErrors >= 5) {
            console.error('[Cron Batch] Too many consecutive GitHub batch errors (5+). Aborting subsequent GitHub updates.');
            stopGithub = true;
          }
        }
      }
      ghIndex += GITHUB_BATCH_SIZE;
    } else if (ghIndex < githubProjects.length) {
      ghIndex = githubProjects.length;
    }

    // --- HuggingFace Batch ---
    if (!stopHF && hfIndex < huggingFaceProjects.length) {
      const batch = huggingFaceProjects.slice(hfIndex, hfIndex + HF_BATCH_SIZE);
      console.log(`[Cron Batch] Updating HuggingFace batch ${Math.floor(hfIndex / HF_BATCH_SIZE) + 1}/${Math.ceil(huggingFaceProjects.length / HF_BATCH_SIZE)} (size: ${batch.length})...`);
      
      const hfQueries = batch.map(p => ({
        id: p.sourceId,
        type: (p.sourceUrl?.includes('huggingface.co/datasets/') ? 'datasets' : 'models') as 'models' | 'datasets',
        project: p
      }));

      try {
        const batchResults = await fetchHFBatch(hfQueries);
        
        const updatePromises = batchResults.map(async (result, j) => {
          const query = hfQueries[j];
          const project = query.project;

          if (!result.exists) {
            console.warn(`[Cron Batch] HF Project ${project.sourceId} not found. Removing from database.`);
            try {
              await db.delete(projectTrends).where(eq(projectTrends.projectId, project.id));
              await db.delete(projectSnapshots).where(eq(projectSnapshots.projectId, project.id));
              await db.delete(projects).where(eq(projects.id, project.id));
            } catch (delErr) {
              console.error(`[Cron Batch] Failed to delete non-existent HF project ${project.sourceId}:`, delErr);
            }
            return;
          }

          const data = result.data;
          if (!data) return; // Rate limited, gated, or empty

          const likes = data.likes || 0;
          const downloads = data.downloads || 0;
          const projectType = query.type === 'models' ? 'model' : 'dataset';

          const rawTags = data.tags || [];
          if (data.pipeline_tag) rawTags.push(data.pipeline_tag);
          if (query.type === 'datasets' && data.task_categories) rawTags.push(...data.task_categories);
          
          const canonicalCategories = await categorizeProject(rawTags, projectType);

          try {
            await db.update(projects)
              .set({
                topics: rawTags,
                categories: canonicalCategories,
                primaryLanguage: data.pipeline_tag || (query.type === 'datasets' ? data.task_categories?.[0] : '') || '',
                likes,
                downloads,
                sourceUpdatedAt: data.lastModified ? new Date(data.lastModified) : new Date(),
                lastCrawledAt: new Date(),
              })
              .where(eq(projects.id, project.id));

            // Record snapshot
            const snapshotDateStr = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];
            const [existingSnap] = await db
              .select({ id: projectSnapshots.id })
              .from(projectSnapshots)
              .where(
                and(
                  eq(projectSnapshots.projectId, project.id),
                  eq(projectSnapshots.snapshotDate, snapshotDateStr)
                )
              )
              .limit(1);

            if (existingSnap) {
              await db.update(projectSnapshots)
                .set({
                  likes,
                  downloads,
                })
                .where(eq(projectSnapshots.id, existingSnap.id));
            } else {
              await db.insert(projectSnapshots).values({
                projectId: project.id,
                stars: 0,
                watchers: 0,
                forks: 0,
                openIssues: 0,
                likes,
                downloads,
                snapshotDate: snapshotDateStr,
              });
            }

            // Recalculate schedule
            const isAlreadyCrawledToday = project.lastCrawledAt && new Date(project.lastCrawledAt.getTime() + 7 * 60 * 60 * 1000).toISOString().split('T')[0] === todayStr;
            const skipIntervalIncrement = force || isAlreadyCrawledToday;
            await updateProjectCrawlSchedule(project.id, 'huggingface', skipIntervalIncrement);
            await calculateProjectTrendInline(project.id);
            hfCount++;
          } catch (dbErr) {
            console.error(`[Cron Batch] Failed to update HF project db for ${project.sourceId}:`, dbErr);
          }
        });

        await Promise.all(updatePromises);
        hfConsecutiveErrors = 0; // Reset consecutive errors on successful batch
      } catch (batchErr: unknown) {
        hfConsecutiveErrors++;
        const err = batchErr instanceof Error ? batchErr : new Error(String(batchErr));
        if (err.message?.includes('[RateLimitError]')) {
          console.warn('[Cron Batch] HuggingFace Rate Limit reached. Stopping subsequent HF update batches.');
          stopHF = true;
        } else {
          console.error(`[Cron Batch] Failed to process HF batch:`, batchErr);
          if (hfConsecutiveErrors >= 5) {
            console.error('[Cron Batch] Too many consecutive HuggingFace batch errors (5+). Aborting subsequent HuggingFace updates.');
            stopHF = true;
          }
        }
      }
      hfIndex += HF_BATCH_SIZE;
    } else if (hfIndex < huggingFaceProjects.length) {
      hfIndex = huggingFaceProjects.length;
    }

    // Report progress to BullMQ (serves as keep-alive/heartbeat to prevent stalled job locks)
    if (job) {
      const totalProjects = githubProjects.length + huggingFaceProjects.length;
      if (totalProjects > 0) {
        const progress = Math.min(100, Math.round(((ghIndex + hfIndex) / totalProjects) * 100));
        await job.updateProgress(progress).catch((err: any) => 
          console.warn(`[Cron] Failed to update BullMQ progress: ${err.message}`)
        );
      }
    }

    // Yield to the event loop to allow BullMQ to renew locks
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`[Cron] Completed Daily Update. Batch updated ${ghCount}/${githubProjects.length} GitHub repos, ${hfCount}/${huggingFaceProjects.length} HuggingFace models (force: ${force}).`);
}

/**
 * Job 4: Daily Social Mentions Fetcher
 * Collects project discussion/mentions from Hacker News, Reddit, and X.
 */
export async function runDailySocialMentions() {
  console.log('[Cron] Enqueuing Daily Social Mentions crawl jobs...');
  try {
    // 1. Fetch actively growing projects using project_trends data.
    // Only crawl projects with meaningful weekly momentum to avoid queue bloat.
    // Criteria: weekly_stars >= 10 (GitHub) OR weekly_downloads >= 50 (HuggingFace)
    // Falls back to top projects by lifetime stars if trends data is missing.
    const result = await db.execute(sql`
      SELECT p.id, p.full_name as "fullName", p.source
      FROM projects p
      LEFT JOIN project_trends pt ON pt.project_id = p.id
      WHERE (
        -- Actively growing GitHub repos
        (p.source = 'github' AND (
          COALESCE(pt.weekly_stars, 0) >= 10
          OR (pt.project_id IS NULL AND COALESCE(p.stars, 0) >= 1000)
        ))
        OR
        -- Actively growing HuggingFace models/datasets
        (p.source = 'huggingface' AND (
          COALESCE(pt.weekly_downloads, 0) >= 50
          OR COALESCE(pt.weekly_stars, 0) >= 5
          OR (pt.project_id IS NULL AND COALESCE(p.likes, 0) >= 500)
        ))
      )
      ORDER BY COALESCE(pt.weekly_stars, 0) + COALESCE(pt.weekly_downloads, 0) DESC
      LIMIT 5000
    `);

    const activeProjects = result as unknown as { id: string; fullName: string; source: string }[];
    console.log(`[Cron] Found ${activeProjects.length} actively growing projects for social mention crawl (limited to 5000).`);

    // 2. Perform batched Twitter (X) crawl first to save API calls
    if (process.env.TWITTER_BEARER_TOKEN) {
      console.log(`[Cron] Fetching Twitter mentions in batch for ${activeProjects.length} projects...`);
      const twitterTargets: TwitterProjectTarget[] = activeProjects.map(p => ({
        projectId: p.id,
        keyword: p.fullName
      }));
      
      const twitterResults = await crawlTwitterMentionsBatched(twitterTargets);
      let totalInserted = 0;

      for (const [projectId, mentions] of twitterResults.entries()) {
        for (const mention of mentions) {
          let content = mention.content || '';
          if (content.length > 500) {
            content = content.substring(0, 497) + '...';
          }
          try {
            await db.insert(projectMentions)
              .values({
                projectId: projectId,
                source: mention.source,
                author: mention.author,
                content: content,
                url: mention.url,
                score: mention.score,
                commentsCount: mention.commentsCount,
                mentionedAt: mention.mentionedAt,
              })
              .onConflictDoNothing();
            totalInserted++;
          } catch (err) {
            console.error(`[Cron] Failed to insert Twitter mention for project ${projectId}:`, err);
          }
        }
      }
      console.log(`[Cron] Inserted ${totalInserted} new Twitter mentions.`);
    } else {
      console.log(`[Cron] Skipping Twitter batch crawl (TWITTER_BEARER_TOKEN not set).`);
    }

    // 3. Enqueue jobs for HN & Reddit
    const dateSuffix = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];
    const jobs = activeProjects.map(project => ({
      name: 'crawl-social',
      data: {
        projectId: project.id,
      },
      opts: {
        jobId: `social-${project.id}-${dateSuffix}`,
      }
    }));

    // Process in chunks
    const CHUNK_SIZE = 50;
    let index = 0;

    while (index < jobs.length) {
      // Check for cancellation signal
      const isCancelled = await redisConnection.get('cancel_signal:social-mentions');
      if (isCancelled === 'true') {
        console.log('[Cron] Social Mentions job cancelled by user.');
        await redisConnection.del('cancel_signal:social-mentions');
        return;
      }

      const chunk = jobs.slice(index, index + CHUNK_SIZE);
      await socialCrawlerQueue.addBulk(chunk);
      index += CHUNK_SIZE;
    }

    console.log(`[Cron] Bulk enqueued ${jobs.length} social crawler jobs in queue for HN/Reddit.`);
  } catch (error) {
    console.error('[Cron] Error enqueuing daily social mentions:', error);
  }
}

