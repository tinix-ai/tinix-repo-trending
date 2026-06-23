import 'dotenv/config';
import { crawlerQueue, githubUpdaterQueue, hfUpdaterQueue, socialCrawlerQueue } from './queue';
import { db } from '../lib/db';
import { projects, projectMentions } from '../lib/db/schema';
import { discoverNewRepos } from '../lib/crawlers/github-discovery';
import { discoverHFTrending } from '../lib/crawlers/hf-discovery';
import { eq, lte, or, isNull, sql, asc } from 'drizzle-orm';
import { crawlHNMentions } from '../lib/crawlers/hn';
import { crawlRedditMentions } from '../lib/crawlers/reddit';
import { crawlTwitterMentions } from '../lib/crawlers/twitter';

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
        AND snapshot_date >= CURRENT_DATE - INTERVAL '31 days'
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

    const dateSuffix = new Date().toISOString().split('T')[0];
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

