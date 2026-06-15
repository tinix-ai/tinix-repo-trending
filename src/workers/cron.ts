import 'dotenv/config';
import { crawlerQueue, hfQueue } from './queue';
import { db } from '../lib/db';
import { projects, projectTrends } from '../lib/db/schema';
import { discoverNewRepos } from '../lib/crawlers/github-discovery';
import { discoverHFTrending } from '../lib/crawlers/hf-discovery';
import { eq, lte, or, isNull, sql } from 'drizzle-orm';

/**
 * Job 1: Daily Discovery
 * Scans GitHub and HuggingFace for new AI/ML repos/models and adds them to the crawler queue.
 */
export async function runDailyDiscovery() {
  console.log('[Cron] Running Daily Discovery...');
  
  // 1. GitHub Discovery
  const newRepos = await discoverNewRepos();
  console.log(`[Cron] Discovered ${newRepos.length} trending repos from Search.`);

  const existingGitHub = await db.select({ sourceId: projects.sourceId }).from(projects).where(eq(projects.source, 'github'));
  const existingGHSet = new Set(existingGitHub.map(p => p.sourceId));

  let queuedCount = 0;
  for (const repo of newRepos) {
    const sourceId = `${repo.owner}/${repo.repo}`;
    if (!existingGHSet.has(sourceId)) {
      await crawlerQueue.add('crawl-repo', {
        owner: repo.owner,
        repo: repo.repo,
      }, {
        jobId: `discovery-${sourceId}`,
      });
      queuedCount++;
    }
  }
  console.log(`[Cron] Queued ${queuedCount} NEW GitHub repos for initial crawling.`);

  // 2. HuggingFace Discovery
  await discoverHFTrending();
}

/**
 * Job 2: Daily Update
 * Pulls ALL tracked projects from the DB and adds them to the respective queues for metric updates.
 */
export async function runDailyUpdate() {
  console.log('[Cron] Running Daily Update for tracked repos...');

  const trackedProjects = await db.select({ 
    id: projects.id,
    sourceId: projects.sourceId,
    source: projects.source,
    sourceUrl: projects.sourceUrl
  }).from(projects)
    .where(or(
      isNull(projects.nextCrawlAt),
      lte(projects.nextCrawlAt, new Date())
    ));

  let ghCount = 0;
  let hfCount = 0;

  for (const project of trackedProjects) {
    if (project.source === 'github') {
      const [owner, repo] = project.sourceId.split('/');
      if (owner && repo) {
        await crawlerQueue.add('crawl-repo', {
          owner,
          repo,
          projectId: project.id,
        }, {
          jobId: `update-gh-${project.id}-${new Date().toISOString().split('T')[0]}`, 
        });
        ghCount++;
      }
    } else if (project.source === 'huggingface') {
      const isDataset = project.sourceUrl?.includes('huggingface.co/datasets/');
      const type = isDataset ? 'datasets' : 'models';
      const jobName = isDataset ? 'crawl-hf-dataset' : 'crawl-hf-model';
      
      await hfQueue.add(jobName, {
        id: project.sourceId,
        type
      }, {
        jobId: `update-hf-${project.id}-${new Date().toISOString().split('T')[0]}`,
      });
      hfCount++;
    }
  }

  console.log(`[Cron] Queued ${ghCount} GitHub repos and ${hfCount} HuggingFace models for daily update.`);
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
        SELECT project_id, stars, downloads
        FROM project_snapshots
        WHERE snapshot_date = CURRENT_DATE
      ),
      daily_snaps AS (
        SELECT project_id, stars, downloads
        FROM project_snapshots
        WHERE snapshot_date = CURRENT_DATE - INTERVAL '1 day'
      ),
      weekly_snaps AS (
        SELECT project_id, stars, downloads
        FROM project_snapshots
        WHERE snapshot_date = CURRENT_DATE - INTERVAL '7 days'
      ),
      monthly_snaps AS (
        SELECT project_id, stars, downloads
        FROM project_snapshots
        WHERE snapshot_date = CURRENT_DATE - INTERVAL '30 days'
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
