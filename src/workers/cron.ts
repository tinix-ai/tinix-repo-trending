import 'dotenv/config';
import { crawlerQueue, githubUpdaterQueue, hfUpdaterQueue } from './queue';
import { db } from '../lib/db';
import { projects } from '../lib/db/schema';
import { discoverNewRepos } from '../lib/crawlers/github-discovery';
import { discoverHFTrending } from '../lib/crawlers/hf-discovery';
import { eq, lte, or, isNull, sql, asc } from 'drizzle-orm';

/**
 * Job 1: Daily Discovery
 * Scans GitHub and HuggingFace for new AI/ML repos/models and adds them to the crawler queue.
 */
export async function runDailyDiscovery(source?: 'github' | 'huggingface') {
  console.log(`[Cron] Running Daily Discovery${source ? ` for ${source}` : ''}...`);
  
  // 1. GitHub Discovery
  if (!source || source === 'github') {
    const newRepos = await discoverNewRepos();
    console.log(`[Cron] Discovered ${newRepos.length} trending repos from Search.`);

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
          jobId: `discovery-update-gh-${existingId}-${new Date().toISOString().split('T')[0]}`,
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
  };

  // Order by crawlInterval ASC so hot projects are enqueued first,
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

  let ghCount = 0;
  let hfCount = 0;

  const ghJobs: { name: string; data: Record<string, unknown>; opts: { jobId?: string; priority?: number } }[] = [];
  const hfJobs: { name: string; data: Record<string, unknown>; opts: { jobId?: string; priority?: number } }[] = [];

  for (const project of trackedProjects) {
    if (project.source === 'github') {
      const [owner, repo] = project.sourceId.split('/');
      if (owner && repo) {
        const dateSuffix = force ? `force-${Date.now()}` : new Date().toISOString().split('T')[0];
        ghJobs.push({
          name: 'crawl-repo',
          data: {
            owner,
            repo,
            projectId: project.id,
          },
          opts: {
            jobId: `update-gh-${project.id}-${dateSuffix}`,
            priority: force ? 1 : crawlIntervalToPriority(project.crawlInterval),
          }
        });
        ghCount++;
      }
    } else if (project.source === 'huggingface') {
      const isDataset = project.sourceUrl?.includes('huggingface.co/datasets/');
      const type = isDataset ? 'datasets' : 'models';
      const jobName = isDataset ? 'crawl-hf-dataset' : 'crawl-hf-model';
      
      const dateSuffix = force ? `force-${Date.now()}` : new Date().toISOString().split('T')[0];
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
  }

  // Enqueue in chunks of 500 using addBulk
  const CHUNK_SIZE = 500;

  if (ghJobs.length > 0) {
    console.log(`[Cron] Enqueuing ${ghJobs.length} GitHub updater jobs in bulk...`);
    for (let i = 0; i < ghJobs.length; i += CHUNK_SIZE) {
      const chunk = ghJobs.slice(i, i + CHUNK_SIZE);
      await githubUpdaterQueue.addBulk(chunk);
    }
  }

  if (hfJobs.length > 0) {
    console.log(`[Cron] Enqueuing ${hfJobs.length} HuggingFace updater jobs in bulk...`);
    for (let i = 0; i < hfJobs.length; i += CHUNK_SIZE) {
      const chunk = hfJobs.slice(i, i + CHUNK_SIZE);
      await hfUpdaterQueue.addBulk(chunk);
    }
  }

  console.log(`[Cron] Bulk enqueued ${ghCount} GitHub repos and ${hfCount} HuggingFace models for daily update (force: ${force}).`);
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
        SELECT DISTINCT ON (project_id) project_id, COALESCE(stars, likes, 0) as stars, downloads
        FROM project_snapshots
        WHERE snapshot_date <= CURRENT_DATE
        ORDER BY project_id, snapshot_date DESC
      ),
      daily_snaps AS (
        SELECT DISTINCT ON (project_id) project_id, COALESCE(stars, likes, 0) as stars, downloads
        FROM project_snapshots
        WHERE snapshot_date <= CURRENT_DATE - INTERVAL '1 day'
        ORDER BY project_id, snapshot_date DESC
      ),
      weekly_snaps AS (
        SELECT DISTINCT ON (project_id) project_id, COALESCE(stars, likes, 0) as stars, downloads
        FROM project_snapshots
        WHERE snapshot_date <= CURRENT_DATE - INTERVAL '7 days'
        ORDER BY project_id, snapshot_date DESC
      ),
      monthly_snaps AS (
        SELECT DISTINCT ON (project_id) project_id, COALESCE(stars, likes, 0) as stars, downloads
        FROM project_snapshots
        WHERE snapshot_date <= CURRENT_DATE - INTERVAL '30 days'
        ORDER BY project_id, snapshot_date DESC
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
    const query = sql`
      WITH current_snaps AS (
        SELECT COALESCE(stars, likes, 0) as stars, downloads
        FROM project_snapshots
        WHERE project_id = ${projectId}::uuid AND snapshot_date <= CURRENT_DATE
        ORDER BY snapshot_date DESC
        LIMIT 1
      ),
      daily_snaps AS (
        SELECT COALESCE(stars, likes, 0) as stars, downloads
        FROM project_snapshots
        WHERE project_id = ${projectId}::uuid AND snapshot_date <= CURRENT_DATE - INTERVAL '1 day'
        ORDER BY snapshot_date DESC
        LIMIT 1
      ),
      weekly_snaps AS (
        SELECT COALESCE(stars, likes, 0) as stars, downloads
        FROM project_snapshots
        WHERE project_id = ${projectId}::uuid AND snapshot_date <= CURRENT_DATE - INTERVAL '7 days'
        ORDER BY snapshot_date DESC
        LIMIT 1
      ),
      monthly_snaps AS (
        SELECT COALESCE(stars, likes, 0) as stars, downloads
        FROM project_snapshots
        WHERE project_id = ${projectId}::uuid AND snapshot_date <= CURRENT_DATE - INTERVAL '30 days'
        ORDER BY snapshot_date DESC
        LIMIT 1
      )
      INSERT INTO project_trends (
        project_id, 
        daily_stars, weekly_stars, monthly_stars, 
        daily_downloads, weekly_downloads, monthly_downloads,
        updated_at
      )
      SELECT 
        ${projectId}::uuid as project_id,
        COALESCE(c.stars - d.stars, 0) as daily_stars,
        COALESCE(c.stars - w.stars, 0) as weekly_stars,
        COALESCE(c.stars - m.stars, 0) as monthly_stars,
        COALESCE(c.downloads - d.downloads, 0) as daily_downloads,
        COALESCE(c.downloads - w.downloads, 0) as weekly_downloads,
        COALESCE(c.downloads - m.downloads, 0) as monthly_downloads,
        NOW() as updated_at
      FROM current_snaps c
      LEFT JOIN daily_snaps d ON true
      LEFT JOIN weekly_snaps w ON true
      LEFT JOIN monthly_snaps m ON true
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
    console.log(`[Cron] Inline Trend Calculation completed for project: ${projectId}`);
  } catch (error) {
    console.error(`[Cron] Error running inline trend calculation for ${projectId}:`, error);
  }
}

