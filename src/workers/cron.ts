import 'dotenv/config';
import { crawlerQueue, githubUpdaterQueue, hfUpdaterQueue, socialCrawlerQueue } from './queue';
import { db } from '../lib/db';
import { projects, projectSnapshots, projectTrends, githubUsers, projectMentions } from '../lib/db/schema';
import { discoverNewRepos } from '../lib/crawlers/github-discovery';
import { discoverGithubTrendingRepos } from '../lib/crawlers/github-trending-scraper';
import { discoverHFTrending } from '../lib/crawlers/hf-discovery';
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
  console.log(`[Cron] Running Daily Discovery${source ? ` for ${source}` : ''}...`);
  
  // 1. GitHub Discovery
  if (!source || source === 'github') {
    const searchRepos = await discoverNewRepos();
    console.log(`[Cron] Discovered ${searchRepos.length} trending repos from Search API.`);

    let htmlRepos: { owner: string; repo: string; stars: number }[] = [];
    try {
      htmlRepos = await discoverGithubTrendingRepos();
      console.log(`[Cron] Discovered ${htmlRepos.length} trending repos from HTML Trending Scraper.`);
    } catch (htmlErr) {
      console.error(`[Cron] HTML Trending Scraper failed, falling back to Search API only:`, htmlErr);
    }

    // Combine and deduplicate
    const combinedReposMap = new Map<string, { owner: string; repo: string; stars: number }>();
    
    // Add Search API results
    for (const repo of searchRepos) {
      const key = `${repo.owner.toLowerCase()}/${repo.repo.toLowerCase()}`;
      combinedReposMap.set(key, repo);
    }

    // Add HTML Scraper results
    for (const repo of htmlRepos) {
      const key = `${repo.owner.toLowerCase()}/${repo.repo.toLowerCase()}`;
      if (!combinedReposMap.has(key)) {
        combinedReposMap.set(key, repo);
      }
    }

    const newRepos = Array.from(combinedReposMap.values());
    console.log(`[Cron] Combined unique GitHub repositories for crawling: ${newRepos.length}`);

    const existingGitHub = await db.select({ 
      id: projects.id, 
      sourceId: projects.sourceId, 
      crawlInterval: projects.crawlInterval 
    }).from(projects).where(eq(projects.source, 'github'));
    const existingGHMap = new Map(existingGitHub.map(p => [
      p.sourceId, 
      { id: p.id, crawlInterval: p.crawlInterval }
    ]));

    let queuedCount = 0;
    for (const repo of newRepos) {
      const sourceId = `${repo.owner}/${repo.repo}`;
      const existing = existingGHMap.get(sourceId);
      
      if (!existing) {
        // New repo: crawl immediately
        await crawlerQueue.add('crawl-repo', {
          owner: repo.owner,
          repo: repo.repo,
        }, {
          jobId: `discovery-${sourceId}`,
        });
        queuedCount++;
      } else {
        // Existing repo but discovered as trending: reset crawl interval to daily and schedule NOW.
        // We only update crawlInterval and nextCrawlAt in the DB, and let runDailyUpdate
        // (running 30 mins later) naturally select and enqueue it in githubUpdaterQueue to avoid double-queueing.
        // Crucial optimization: If it's currently under 30-day backoff due to SAML SSO/permission denied,
        // do not reset it so we do not flood the logs with SSO errors repeatedly.
        if (existing.crawlInterval !== 30) {
          await db.update(projects)
            .set({
              crawlInterval: 1,
              nextCrawlAt: new Date(),
            })
            .where(eq(projects.id, existing.id));
          queuedCount++;
        }
      }
    }
    console.log(`[Cron] Queued ${queuedCount} GitHub repos for crawling/update (new/trending reset).`);
  }

  // 2. HuggingFace Discovery
  if (!source || source === 'huggingface') {
    await discoverHFTrending();
  }
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

export async function runDailyUpdate(force = false) {
  console.log(`[Cron] Running Daily Update for tracked repos (force: ${force})...`);

  const selectFields = {
    id: projects.id,
    sourceId: projects.sourceId,
    source: projects.source,
    sourceUrl: projects.sourceUrl,
    crawlInterval: projects.crawlInterval,
    nextCrawlAt: projects.nextCrawlAt,
    countryCode: projects.countryCode,
  };

  // Order by crawlInterval ASC so hot projects are enqueued/updated first,
  // then by nextCrawlAt ASC so the most overdue come before the just-due.
  const trackedProjects = force
    ? await db.select(selectFields).from(projects)
        .orderBy(asc(projects.crawlInterval), asc(projects.nextCrawlAt))
    : await db.select(selectFields).from(projects)
        .where(or(
          isNull(projects.nextCrawlAt),
          lte(projects.nextCrawlAt, new Date())
        ))
        .orderBy(asc(projects.crawlInterval), asc(projects.nextCrawlAt));

  const githubProjects = trackedProjects.filter(p => p.source === 'github');
  const huggingFaceProjects = trackedProjects.filter(p => p.source === 'huggingface');

  let ghCount = 0;
  let hfCount = 0;

  // 1. Process GitHub projects using GraphQL batching (50 repos per request)
  const GITHUB_BATCH_SIZE = 50;
  for (let i = 0; i < githubProjects.length; i += GITHUB_BATCH_SIZE) {
    const batch = githubProjects.slice(i, i + GITHUB_BATCH_SIZE);
    console.log(`[Cron Batch] Updating GitHub repositories batch ${Math.floor(i / GITHUB_BATCH_SIZE) + 1}/${Math.ceil(githubProjects.length / GITHUB_BATCH_SIZE)} (size: ${batch.length})...`);
    
    const repoCoords = batch.map(p => {
      const [owner, name] = p.sourceId.split('/');
      return { owner, name };
    });

    try {
      const batchResults = await fetchGitHubBatch(repoCoords);
      
      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
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
            continue;
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
          continue;
        }

        const data = result.data;
        if (!data) continue;

        // Check rename
        const isRenamed = data.fullName.toLowerCase() !== project.sourceId.toLowerCase();
        if (isRenamed) {
          // If renamed, fall back to single job in githubUpdaterQueue to handle rename merges properly
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
          continue;
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
          await updateProjectCrawlSchedule(project.id, 'github');
          await calculateProjectTrendInline(project.id);
          ghCount++;
        } catch (dbErr) {
          console.error(`[Cron Batch] Failed to update project db for ${project.sourceId}:`, dbErr);
        }
      }
    } catch (batchErr: unknown) {
      const err = batchErr instanceof Error ? batchErr : new Error(String(batchErr));
      if (err.message?.includes('[RateLimitError]')) {
        console.warn('[Cron Batch] GitHub Rate Limit reached. Stopping subsequent GitHub update batches.');
        break;
      }
      console.error(`[Cron Batch] Failed to process batch for ${repoCoords.map(r => `${r.owner}/${r.name}`).join(', ')}:`, batchErr);
    }
  }

  // 2. Process HuggingFace projects using batched REST fallback in cron.ts directly
  const HF_BATCH_SIZE = 50;
  for (let i = 0; i < huggingFaceProjects.length; i += HF_BATCH_SIZE) {
    const batch = huggingFaceProjects.slice(i, i + HF_BATCH_SIZE);
    console.log(`[Cron Batch] Updating HuggingFace repositories batch ${Math.floor(i / HF_BATCH_SIZE) + 1}/${Math.ceil(huggingFaceProjects.length / HF_BATCH_SIZE)} (size: ${batch.length})...`);
    
    const hfTargets = batch.map(p => {
      const isDataset = p.sourceUrl?.includes('huggingface.co/datasets/');
      return { id: p.sourceId, type: isDataset ? 'datasets' : 'models' as 'datasets' | 'models' };
    });

    try {
      const batchResults = await fetchHFBatch(hfTargets);
      
      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        const project = batch[j];

        if (!result.exists) {
          console.warn(`[Cron Batch] HF Project ${project.sourceId} not found. Removing from database.`);
          try {
            await db.delete(projectTrends).where(eq(projectTrends.projectId, project.id));
            await db.delete(projectSnapshots).where(eq(projectSnapshots.projectId, project.id));
            await db.delete(projects).where(eq(projects.id, project.id));
          } catch (delErr) {
            console.error(`[Cron Batch] Failed to delete non-existent HF project ${project.sourceId}:`, delErr);
          }
          continue;
        }

        const data = result.data;
        if (!data) continue;

        const likes = data.likes || 0;
        const downloads = data.downloads || 0;
        const rawTags = data.tags || [];
        if (data.pipeline_tag) rawTags.push(data.pipeline_tag);
        if (result.type === 'datasets' && data.task_categories) rawTags.push(...data.task_categories);

        const canonicalCategories = await categorizeProject(rawTags, result.type === 'models' ? 'model' : 'dataset');

        try {
          await db.update(projects)
            .set({
              topics: rawTags,
              categories: canonicalCategories,
              primaryLanguage: data.pipeline_tag || (result.type === 'datasets' ? data.task_categories?.[0] : '') || '',
              likes: likes,
              downloads: downloads,
              sourceUpdatedAt: data.lastModified ? new Date(data.lastModified) : undefined,
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
                likes: likes,
                downloads: downloads,
              })
              .where(eq(projectSnapshots.id, existingSnap.id));
          } else {
            await db.insert(projectSnapshots).values({
              projectId: project.id,
              stars: 0,
              watchers: 0,
              forks: 0,
              openIssues: 0,
              likes: likes,
              downloads: downloads,
              snapshotDate: snapshotDateStr,
            });
          }

          // Recalculate schedule
          await updateProjectCrawlSchedule(project.id, 'huggingface');
          await calculateProjectTrendInline(project.id);
          hfCount++;
        } catch (dbErr) {
          console.error(`[Cron Batch] Failed to update project db for HF ${project.sourceId}:`, dbErr);
        }
      }
    } catch (batchErr: unknown) {
      const err = batchErr instanceof Error ? batchErr : new Error(String(batchErr));
      if (err.message?.includes('[RateLimitError]')) {
        console.warn('[Cron Batch] HuggingFace Rate Limit reached. Stopping subsequent HuggingFace update batches.');
        break;
      }
      console.error(`[Cron Batch] Failed to process HF batch for ${hfTargets.map(r => r.id).join(', ')}:`, batchErr);
    }
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
      SELECT DISTINCT p.id, p.full_name as "fullName", p.source
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
          OR COALESCE(pt.weekly_likes, 0) >= 5
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

    // Enqueue jobs in bulk (500 items per chunk)
    const CHUNK_SIZE = 500;
    for (let i = 0; i < jobs.length; i += CHUNK_SIZE) {
      const chunk = jobs.slice(i, i + CHUNK_SIZE);
      await socialCrawlerQueue.addBulk(chunk);
    }

    console.log(`[Cron] Bulk enqueued ${jobs.length} social crawler jobs in queue for HN/Reddit.`);
  } catch (error) {
    console.error('[Cron] Error enqueuing daily social mentions:', error);
  }
}

