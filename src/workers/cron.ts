import 'dotenv/config';
import { crawlerQueue, githubUpdaterQueue, hfUpdaterQueue, socialCrawlerQueue } from './queue';
import { db } from '../lib/db';
import { projects, projectSnapshots, projectTrends, githubUsers } from '../lib/db/schema';
import { discoverNewRepos } from '../lib/crawlers/github-discovery';
import { discoverGithubTrendingRepos } from '../lib/crawlers/github-trending-scraper';
import { discoverHFTrending } from '../lib/crawlers/hf-discovery';
import { eq, lte, or, and, isNull, sql, asc } from 'drizzle-orm';
import { fetchGitHubBatch } from '../lib/crawlers/github-graphql';
import { parseCountryFromProfile } from '../lib/location-parser';
import { updateProjectCrawlSchedule } from '../lib/crawlers/scheduler';
import { categorizeProject } from '../lib/categorizer';

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

    const existingGitHub = await db.select({ id: projects.id, sourceId: projects.sourceId }).from(projects).where(eq(projects.source, 'github'));
    const existingGHMap = new Map(existingGitHub.map(p => [p.sourceId, p.id]));

    let queuedCount = 0;
    for (const repo of newRepos) {
      const sourceId = `${repo.owner}/${repo.repo}`;
      const existingId = existingGHMap.get(sourceId);
      
      if (!existingId) {
        // New repo: crawl immediately
        await crawlerQueue.add('crawl-repo', {
          owner: repo.owner,
          repo: repo.repo,
        }, {
          jobId: `discovery-${sourceId}`,
        });
        queuedCount++;
      } else {
        // Existing repo but discovered as trending: reset crawl interval to daily and schedule NOW
        await db.update(projects)
          .set({
            crawlInterval: 1,
            nextCrawlAt: new Date(),
          })
          .where(eq(projects.id, existingId));

        await crawlerQueue.add('crawl-repo', {
          owner: repo.owner,
          repo: repo.repo,
          projectId: existingId,
        }, {
          jobId: `discovery-update-gh-${existingId}-${new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split('T')[0]}`,
        });
        queuedCount++;
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
          lte(projects.nextCrawlAt, new Date()),
          and(eq(projects.source, 'github'), isNull(projects.countryCode))
        ))
        .orderBy(asc(projects.crawlInterval), asc(projects.nextCrawlAt));

  const githubProjects = trackedProjects.filter(p => p.source === 'github');
  const huggingFaceProjects = trackedProjects.filter(p => p.source === 'huggingface');

  let ghCount = 0;
  let hfCount = 0;

  // 1. Process GitHub projects using GraphQL batching (100 repos per request)
  const GITHUB_BATCH_SIZE = 100;
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
          ghCount++;
        } catch (dbErr) {
          console.error(`[Cron Batch] Failed to update project db for ${project.sourceId}:`, dbErr);
        }
      }
    } catch (batchErr) {
      console.error(`[Cron Batch] Failed to process batch for ${repoCoords.map(r => `${r.owner}/${r.name}`).join(', ')}:`, batchErr);
    }
  }

  // 2. Process HuggingFace projects using single jobs enqueued to hfUpdaterQueue
  const hfJobs: { name: string; data: Record<string, unknown>; opts: { jobId?: string; priority?: number } }[] = [];
  for (const project of huggingFaceProjects) {
    const isDataset = project.sourceUrl?.includes('huggingface.co/datasets/');
    const type = isDataset ? 'datasets' : 'models';
    const jobName = isDataset ? 'crawl-hf-dataset' : 'crawl-hf-model';
    
    const dateSuffix = force ? `force-${Date.now()}` : new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];
    hfJobs.push({
      name: jobName,
      data: {
        id: project.sourceId,
        type
      },
      opts: {
        jobId: `update-hf-${project.id}-${dateSuffix}`,
        priority: force ? 1 : crawlIntervalToPriority(project.crawlInterval),
      }
    });
    hfCount++;
  }

  const CHUNK_SIZE = 500;
  if (hfJobs.length > 0) {
    console.log(`[Cron] Enqueuing ${hfJobs.length} HuggingFace updater jobs in bulk...`);
    for (let i = 0; i < hfJobs.length; i += CHUNK_SIZE) {
      const chunk = hfJobs.slice(i, i + CHUNK_SIZE);
      await hfUpdaterQueue.addBulk(chunk);
    }
  }

  console.log(`[Cron] Completed Daily Update. Batch updated ${ghCount}/${githubProjects.length} GitHub repos, bulk enqueued ${hfCount} HuggingFace models (force: ${force}).`);
}

/**
 * Job 3: Daily Trend Calculation
 * Calculates daily, weekly, and monthly growth for stars and downloads.
 */
export async function runTrendCalculation() {
  console.log('[Cron] Running Trend Calculation...');

  try {
    const query = sql`
      WITH current_snaps AS (
        SELECT DISTINCT ON (project_id) project_id, COALESCE(stars, likes, 0) as stars, downloads, snapshot_date
        FROM project_snapshots
        ORDER BY project_id, snapshot_date DESC
      ),
      daily_snaps AS (
        SELECT DISTINCT ON (s.project_id) s.project_id, COALESCE(s.stars, s.likes, 0) as stars, s.downloads
        FROM project_snapshots s
        JOIN current_snaps c ON s.project_id = c.project_id
        WHERE s.snapshot_date = (c.snapshot_date - INTERVAL '1 day')::date
        ORDER BY s.project_id, s.snapshot_date DESC
      ),
      weekly_snaps AS (
        SELECT DISTINCT ON (s.project_id) s.project_id, COALESCE(s.stars, s.likes, 0) as stars, s.downloads
        FROM project_snapshots s
        JOIN current_snaps c ON s.project_id = c.project_id
        WHERE s.snapshot_date = (c.snapshot_date - INTERVAL '7 days')::date
        ORDER BY s.project_id, s.snapshot_date DESC
      ),
      monthly_snaps AS (
        SELECT DISTINCT ON (s.project_id) s.project_id, COALESCE(s.stars, s.likes, 0) as stars, s.downloads
        FROM project_snapshots s
        JOIN current_snaps c ON s.project_id = c.project_id
        WHERE s.snapshot_date = (c.snapshot_date - INTERVAL '30 days')::date
        ORDER BY s.project_id, s.snapshot_date DESC
      )
      INSERT INTO project_trends (
        project_id, 
        daily_stars, weekly_stars, monthly_stars, 
        daily_downloads, weekly_downloads, monthly_downloads,
        updated_at
      )
      SELECT 
        c.project_id,
        COALESCE(c.stars - d.stars, 0) as daily_stars,
        COALESCE(c.stars - w.stars, 0) as weekly_stars,
        COALESCE(c.stars - m.stars, 0) as monthly_stars,
        COALESCE(c.downloads - d.downloads, 0) as daily_downloads,
        COALESCE(c.downloads - w.downloads, 0) as weekly_downloads,
        COALESCE(c.downloads - m.downloads, 0) as monthly_downloads,
        NOW() as updated_at
      FROM current_snaps c
      LEFT JOIN daily_snaps d ON c.project_id = d.project_id
      LEFT JOIN weekly_snaps w ON c.project_id = w.project_id
      LEFT JOIN monthly_snaps m ON c.project_id = m.project_id
      ON CONFLICT (project_id) DO UPDATE SET
        daily_stars = EXCLUDED.daily_stars,
        weekly_stars = EXCLUDED.weekly_stars,
        monthly_stars = EXCLUDED.monthly_stars,
        daily_downloads = EXCLUDED.daily_downloads,
        weekly_downloads = EXCLUDED.weekly_downloads,
        monthly_downloads = EXCLUDED.monthly_downloads,
        updated_at = EXCLUDED.updated_at;
    `;

    await db.execute(query);
    console.log('[Cron] Trend Calculation completed successfully.');
  } catch (error) {
    console.error('[Cron] Error running trend calculation:', error);
  }
}

/**
 * Calculates and updates trends (stars and downloads) inline for a specific project.
 */
export async function calculateProjectTrendInline(projectId: string) {
  try {
    // 1. Fetch snapshots for the project from the last 31 days
    const snapshots = await db.execute(sql`
      SELECT snapshot_date::text, COALESCE(stars, likes, 0) as stars, downloads
      FROM project_snapshots
      WHERE project_id = ${projectId}::uuid
        AND snapshot_date >= (timezone('Asia/Ho_Chi_Minh', now()))::date - INTERVAL '31 days'
      ORDER BY snapshot_date DESC
    `) as unknown as { snapshot_date: string; stars: number; downloads: number }[];

    if (snapshots.length === 0) return;

    // The first snapshot in the sorted list is the latest one
    const latest = snapshots[0];
    const latestDate = new Date(latest.snapshot_date);

    // Helper to format Date back to YYYY-MM-DD
    const formatDate = (date: Date) => {
      return date.toISOString().split('T')[0];
    };

    const targetDate1d = formatDate(new Date(latestDate.getTime() - 1 * 24 * 60 * 60 * 1000));
    const targetDate7d = formatDate(new Date(latestDate.getTime() - 7 * 24 * 60 * 60 * 1000));
    const targetDate30d = formatDate(new Date(latestDate.getTime() - 30 * 24 * 60 * 60 * 1000));

    // Find the closest snapshot on or before the target dates
    const findSnapshot = (targetDateStr: string) => {
      return snapshots.find(s => s.snapshot_date <= targetDateStr) || snapshots[snapshots.length - 1];
    };

    const snap1d = findSnapshot(targetDate1d);
    const snap7d = findSnapshot(targetDate7d);
    const snap30d = findSnapshot(targetDate30d);

    const dailyStars = Math.max(0, latest.stars - (snap1d?.stars ?? latest.stars));
    const weeklyStars = Math.max(0, latest.stars - (snap7d?.stars ?? latest.stars));
    const monthlyStars = Math.max(0, latest.stars - (snap30d?.stars ?? latest.stars));

    const dailyDownloads = Math.max(0, latest.downloads - (snap1d?.downloads ?? latest.downloads));
    const weeklyDownloads = Math.max(0, latest.downloads - (snap7d?.downloads ?? latest.downloads));
    const monthlyDownloads = Math.max(0, latest.downloads - (snap30d?.downloads ?? latest.downloads));

    await db.execute(sql`
      INSERT INTO project_trends (
        project_id, 
        daily_stars, weekly_stars, monthly_stars, 
        daily_downloads, weekly_downloads, monthly_downloads,
        updated_at
      )
      VALUES (
        ${projectId}::uuid,
        ${dailyStars}, ${weeklyStars}, ${monthlyStars},
        ${dailyDownloads}, ${weeklyDownloads}, ${monthlyDownloads},
        NOW()
      )
      ON CONFLICT (project_id) DO UPDATE SET
        daily_stars = EXCLUDED.daily_stars,
        weekly_stars = EXCLUDED.weekly_stars,
        monthly_stars = EXCLUDED.monthly_stars,
        daily_downloads = EXCLUDED.daily_downloads,
        weekly_downloads = EXCLUDED.weekly_downloads,
        monthly_downloads = EXCLUDED.monthly_downloads,
        updated_at = EXCLUDED.updated_at;
    `);

    console.log(`[Cron] Inline Trend Calculation completed for project: ${projectId}`);
  } catch (error) {
    console.error(`[Cron] Error running inline trend calculation for ${projectId}:`, error);
  }
}

/**
 * Job 4: Daily Social Mentions Fetcher
 * Collects project discussion/mentions from Hacker News, Reddit, and X.
 */
export async function runDailySocialMentions() {
  console.log('[Cron] Enqueuing Daily Social Mentions crawl jobs...');
  try {
    // 1. Fetch all projects with stars >= 100 (for GitHub) or likes >= 100 (for Hugging Face) using their latest snapshot
    const result = await db.execute(sql`
      WITH latest_snapshots AS (
        SELECT DISTINCT ON (project_id) project_id, stars, likes
        FROM project_snapshots
        ORDER BY project_id, snapshot_date DESC
      )
      SELECT p.id, p.full_name as "fullName", p.source
      FROM projects p
      JOIN latest_snapshots s ON p.id = s.project_id
      WHERE (p.source = 'github' AND COALESCE(s.stars, 0) >= 100)
         OR (p.source = 'huggingface' AND COALESCE(s.likes, 0) >= 100)
    `);

    const activeProjects = result as unknown as { id: string; fullName: string; source: string }[];
    console.log(`[Cron] Found ${activeProjects.length} projects with >= 100 stars/likes for social update.`);

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

    console.log(`[Cron] Bulk enqueued ${jobs.length} social crawler jobs in queue.`);
  } catch (error) {
    console.error('[Cron] Error enqueuing daily social mentions:', error);
  }
}

