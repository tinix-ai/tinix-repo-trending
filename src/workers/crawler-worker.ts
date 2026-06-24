import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { db } from '../lib/db';
import { projects, projectSnapshots, projectTrends, projectMentions, githubUsers } from '../lib/db/schema';
import { crawlHNMentions } from '../lib/crawlers/hn';
import { crawlRedditMentions } from '../lib/crawlers/reddit';
import { crawlTwitterMentions } from '../lib/crawlers/twitter';
import * as zlib from 'zlib';
import { sql, eq, and, isNotNull } from 'drizzle-orm';
import { categorizeProject } from '../lib/categorizer';
import { parseCountryFromProfile } from '../lib/location-parser';
import { updateProjectCrawlSchedule } from '../lib/crawlers/scheduler';
import { githubPool } from '../lib/crawlers/github-pool';
import { proxyManager } from '../lib/crawlers/proxy';
import { fetchSingleGitHubRepo } from '../lib/crawlers/github-graphql';
import { setTimeout } from 'timers/promises';
import { crawlerQueue, githubUpdaterQueue, socialCrawlerQueue } from './queue';
import { setupQueueAutoRecovery } from './recovery';
import { startMemoryReporting } from './metrics';



const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
};

const redisConnection = new Redis(redisConfig);

redisConnection.on('error', (err) => {
  console.error('[Crawler Worker] Redis connection error:', err.message);
});
const pauseScheduledMap: Record<string, boolean> = {};

interface CrawlJobData {
  owner: string;
  repo: string;
  projectId?: string;
}

export async function handleGithubCrawlJob(job: Job<CrawlJobData>) {
  let { owner, repo } = job.data;
  const currentQueue = job.queueName === 'github-updater' ? githubUpdaterQueue : crawlerQueue;
  const logPrefix = job.queueName === 'github-updater' ? '[GitHub Updater]' : '[Crawler]';
  console.log(`${logPrefix} Starting crawl for ${owner}/${repo}`);

  try {
    let existingProject: {
      id: string;
      sourceUpdatedAt: Date | null;
      readme: Buffer | string | null;
      readmeSha: string | null;
      description: string | null;
      etag: string | null;
      stars: number | null;
      forks: number | null;
      openIssues: number | null;
      watchers: number | null;
      downloads: number | null;
    } | undefined = undefined;
    if (job.data.projectId) {
      const [res] = await db.select({
        id: projects.id,
        sourceUpdatedAt: projects.sourceUpdatedAt,
        readme: projects.readme,
        readmeSha: projects.readmeSha,
        description: projects.description,
        etag: projects.etag,
        stars: projects.stars,
        forks: projects.forks,
        openIssues: projects.openIssues,
        watchers: projects.watchers,
        downloads: projects.downloads
      })
      .from(projects)
      .where(eq(projects.id, job.data.projectId))
      .limit(1);
      existingProject = res;
    }

    if (!existingProject) {
      const targetSlug = `${owner.toLowerCase()}-${repo.toLowerCase()}`;
      const [res] = await db.select({
        id: projects.id,
        sourceUpdatedAt: projects.sourceUpdatedAt,
        readme: projects.readme,
        readmeSha: projects.readmeSha,
        description: projects.description,
        etag: projects.etag,
        stars: projects.stars,
        forks: projects.forks,
        openIssues: projects.openIssues,
        watchers: projects.watchers,
        downloads: projects.downloads
      })
      .from(projects)
      .where(eq(projects.slug, targetSlug))
      .limit(1);
      existingProject = res;
    }


    // 1. Fetch data from GitHub API via GraphQL
    const result = await fetchSingleGitHubRepo(owner, repo);
    
    if (!result.exists) {
      console.warn(`${logPrefix} Project ${owner}/${repo} not found on GitHub. Removing from database.`);
      if (job.data.projectId) {
        await db.delete(projectTrends).where(eq(projectTrends.projectId, job.data.projectId));
        await db.delete(projectSnapshots).where(eq(projectSnapshots.projectId, job.data.projectId));
        await db.delete(projects).where(eq(projects.id, job.data.projectId));
      }
      return;
    }

    const data = result.data!;

    // Detect if the repository has been renamed or transferred
    const actualFullName = data.fullName;
    const [actualOwner, actualRepo] = actualFullName.split('/');
    const isRenamed = actualFullName.toLowerCase() !== `${owner.toLowerCase()}/${repo.toLowerCase()}`;

    let projectId = job.data.projectId;

    if (isRenamed) {
      console.log(`${logPrefix} Rename detected for ${owner}/${repo} -> ${actualFullName}`);
      const newSlug = `${actualOwner.toLowerCase()}-${actualRepo.toLowerCase()}`;

      // Check if the target (new) project record already exists in the database
      const existingNewProject = await db.select({ id: projects.id })
        .from(projects)
        .where(eq(projects.slug, newSlug))
        .limit(1);

      if (existingNewProject.length > 0) {
        const targetId = existingNewProject[0].id;
        console.log(`${logPrefix} Target project ${actualFullName} already exists with ID ${targetId}. Merging...`);

        if (projectId && projectId !== targetId) {
          // Reassign mentions
          await db.execute(sql`
            UPDATE project_mentions 
            SET project_id = ${targetId}::uuid 
            WHERE project_id = ${projectId}::uuid
          `);

          // Reassign snapshots (deleting duplicates first)
          await db.execute(sql`
            DELETE FROM project_snapshots 
            WHERE project_id = ${projectId}::uuid 
              AND snapshot_date IN (
                SELECT snapshot_date 
                FROM project_snapshots 
                WHERE project_id = ${targetId}::uuid
              )
          `);
          await db.execute(sql`
            UPDATE project_snapshots 
            SET project_id = ${targetId}::uuid 
            WHERE project_id = ${projectId}::uuid
          `);

          // Delete old trends record
          await db.execute(sql`
            DELETE FROM project_trends 
            WHERE project_id = ${projectId}::uuid
          `);

          // Delete old project record
          await db.execute(sql`
            DELETE FROM projects 
            WHERE id = ${projectId}::uuid
          `);
        }

        projectId = targetId;
      } else {
        // Case B: The new record does not exist yet. We can rename the old record in place!
        if (projectId) {
          console.log(`${logPrefix} Renaming database record ${projectId} from ${owner}/${repo} to ${actualFullName}`);
          await db.update(projects)
            .set({
              sourceId: actualFullName,
              slug: newSlug,
              name: data.name,
              fullName: actualFullName,
              ownerName: actualOwner,
              updatedAt: new Date()
            })
            .where(eq(projects.id, projectId));
        }
      }

      // Update owner and repo variables for the rest of this crawl job execution
      owner = actualOwner;
      repo = actualRepo;
    }

    // 2. Process data and update database
    const slug = `${owner.toLowerCase()}-${repo.toLowerCase()}`;
    
    let readme: Buffer | string | null = existingProject?.readme || null;
    let readmeSha: string | null = existingProject?.readmeSha || null;
    let finalDescription = data.description || existingProject?.description || '';

    const apiPushedAt = data.sourceUpdatedAt.getTime();
    const dbPushedAt = existingProject?.sourceUpdatedAt ? new Date(existingProject.sourceUpdatedAt).getTime() : 0;
    const canSkipReadmeCompress = apiPushedAt > 0 && dbPushedAt > 0 && apiPushedAt === dbPushedAt && existingProject?.readme !== null;

    if (canSkipReadmeCompress) {
      console.log(`${logPrefix} pushed_at unchanged (${data.sourceUpdatedAt.toISOString()}). Skipping README compression.`);
      readme = existingProject.readme;
      readmeSha = existingProject.readmeSha;
    } else {
      if (data.readmeText) {
        readme = zlib.gzipSync(Buffer.from(data.readmeText, 'utf-8'));
        readmeSha = data.readmeSha;

        if (!finalDescription && data.readmeText) {
          let clean = data.readmeText.trim();
          if (clean.startsWith('---')) {
            const secondIndex = clean.indexOf('---', 3);
            if (secondIndex !== -1) {
              clean = clean.substring(secondIndex + 3).trim();
            }
          }
          clean = clean.replace(/<[^>]*>/g, '').replace(/[#*`_>\[\]]/g, '').replace(/\s+/g, ' ');
          finalDescription = clean.substring(0, 250).trim() + '...';
        }
      }
    }

    // Use Categorizer for GitHub repos
    const rawTags = data.topics;
    const canonicalCategories = await categorizeProject(rawTags, 'repository');

    // Retrieve owner's profile location to identify country
    let ownerLocation: string | null = null;
    let ownerCountryCode: string | null = null;

    try {
      // 1. Check in github_users table (the new owner cache table)
      const [cachedUser] = await db.select({
        location: githubUsers.location,
        countryCode: githubUsers.countryCode
      })
      .from(githubUsers)
      .where(eq(githubUsers.username, owner))
      .limit(1);

      if (cachedUser) {
        if (cachedUser.countryCode === 'UNKNOWN') {
          console.log(`${logPrefix} Found cached owner ${owner} in githubUsers but has UNKNOWN country (negative cached)`);
          ownerLocation = cachedUser.location;
          ownerCountryCode = null;
        } else {
          ownerLocation = cachedUser.location;
          ownerCountryCode = cachedUser.countryCode;
          console.log(`${logPrefix} Found cached location for owner ${owner} in githubUsers: ${ownerLocation} (${ownerCountryCode})`);
        }
      } else {
        // Fallback to legacy projects table search just in case
        const existingOwner = await db.select({
          location: projects.location,
          countryCode: projects.countryCode
        })
        .from(projects)
        .where(and(eq(projects.ownerName, owner), isNotNull(projects.countryCode)))
        .limit(1);

        if (existingOwner.length > 0 && existingOwner[0].countryCode) {
          ownerLocation = existingOwner[0].location;
          ownerCountryCode = existingOwner[0].countryCode;
          console.log(`${logPrefix} Found cached location for owner ${owner} in legacy projects search: ${ownerLocation} (${ownerCountryCode})`);
          
          // Backport to github_users
          await db.insert(githubUsers)
            .values({
              username: owner,
              location: ownerLocation,
              countryCode: ownerCountryCode
            })
            .onConflictDoNothing();
        }
      }
    } catch (dbErr) {
      console.warn(`${logPrefix} Failed to check cached owner location in DB:`, dbErr);
    }

    // 2. Fallback to parse location from retrieved GraphQL data if not cached
    if (!ownerCountryCode) {
      ownerLocation = data.location;
      const parsedCountry = parseCountryFromProfile({
        location: data.location,
        email: data.email,
        blog: data.blog,
        company: data.company
      });
      ownerCountryCode = parsedCountry || null;

      console.log(`${logPrefix} Detected location for owner ${owner} from GraphQL payload: location="${ownerLocation || ''}", email="${data.email || ''}", blog="${data.blog || ''}", company="${data.company || ''}" -> countryCode=${ownerCountryCode || 'unknown'}`);
      
      // Insert or update into cache table
      try {
        await db.insert(githubUsers)
          .values({
            username: owner,
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
        console.warn(`${logPrefix} Failed to cache owner info:`, cacheErr);
      }
    }
    
    // Upsert into projects
    const [project] = await db.insert(projects)
      .values({
        source: 'github',
        projectType: 'repository',
        sourceId: `${owner}/${repo}`,
        slug,
        name: data.name,
        fullName: data.fullName,
        description: finalDescription,
        readme: readme,
        readmeSha: readmeSha,
        homepageUrl: data.homepageUrl,
        sourceUrl: data.sourceUrl,
        primaryLanguage: data.primaryLanguage,
        license: data.license,
        ownerName: owner,
        ownerAvatarUrl: data.ownerAvatarUrl,
        ownerType: data.ownerType,
        topics: rawTags,
        categories: canonicalCategories,
        location: ownerLocation,
        countryCode: ownerCountryCode,
        etag: null,
        stars: data.stars,
        forks: data.forks,
        watchers: data.watchers,
        openIssues: data.openIssues,
        sourceCreatedAt: data.sourceCreatedAt,
        sourceUpdatedAt: data.sourceUpdatedAt,
        lastCrawledAt: new Date(),
      })
      .onConflictDoUpdate({
        target: projects.slug,
        set: {
          description: finalDescription,
          readme: readme,
          readmeSha: readmeSha,
          homepageUrl: data.homepageUrl,
          primaryLanguage: data.primaryLanguage,
          topics: rawTags,
          categories: canonicalCategories,
          location: ownerLocation,
          countryCode: ownerCountryCode,
          etag: null,
          stars: data.stars,
          forks: data.forks,
          watchers: data.watchers,
          openIssues: data.openIssues,
          sourceUpdatedAt: data.sourceUpdatedAt,
          lastCrawledAt: new Date(),
        }
      })
      .returning({ id: projects.id });

    // Insert snapshot
    const snapshotDate = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];
    const existing = await db.select({ id: projectSnapshots.id })
      .from(projectSnapshots)
      .where(sql`${projectSnapshots.projectId} = ${project.id} AND ${projectSnapshots.snapshotDate} = ${snapshotDate}`)
      .limit(1);
    
    if (existing.length > 0) {
      await db.update(projectSnapshots)
        .set({
          stars: data.stars,
          forks: data.forks,
          openIssues: data.openIssues,
          watchers: data.watchers,
        })
        .where(eq(projectSnapshots.id, existing[0].id));
    } else {
      await db.insert(projectSnapshots).values({
        projectId: project.id,
        stars: data.stars,
        forks: data.forks,
        openIssues: data.openIssues,
        watchers: data.watchers,
        snapshotDate,
      });
    }

    // Recalculate and update the next crawl schedule
    await updateProjectCrawlSchedule(project.id, 'github');

    console.log(`${logPrefix} Successfully fetched & saved ${owner}/${repo}: ${data.stars} stars`);

    return { 
      status: 'success', 
      projectId: project.id,
      stars: data.stars,
      forks: data.forks 
    };

  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    if (error.message?.includes('[RateLimitError]')) {
      console.log(`${logPrefix} Rate limit reached for ${owner}/${repo}. Will retry when tokens reset.`);
    } else {
      console.error(`${logPrefix} Error processing ${owner}/${repo}:`, error);
    }
    throw err; // Re-throw to trigger BullMQ retries
  }
}

export const crawlerWorker = new Worker<CrawlJobData>(
  'github-crawler',
  handleGithubCrawlJob,
  {
    connection: redisConnection as unknown as Worker['opts']['connection'],
    concurrency: 2, // Reduced from 5 to prevent OOM
    stalledInterval: 15000,
    maxStalledCount: 2,
  }
);

// Merged: GitHub Updater worker runs in the same process
export const githubUpdaterWorker = new Worker<CrawlJobData>(
  'github-updater',
  handleGithubCrawlJob,
  {
    connection: redisConnection as unknown as Worker['opts']['connection'],
    concurrency: 2,
    stalledInterval: 15000,
    maxStalledCount: 2,
  }
);

interface SocialCrawlJobData {
  projectId: string;
}

export async function handleSocialCrawlJob(job: Job<SocialCrawlJobData>) {
  const { projectId } = job.data;
  console.log(`[Social Crawler] Starting social crawl for project ID: ${projectId}`);

  try {
    // 1. Fetch project details
    const [project] = await db.select({
      id: projects.id,
      fullName: projects.fullName,
      name: projects.name,
      ownerName: projects.ownerName,
      primaryLanguage: projects.primaryLanguage,
      topics: projects.topics,
      description: projects.description,
      homepageUrl: projects.homepageUrl,
      sourceUrl: projects.sourceUrl,
      source: projects.source,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

    if (!project) {
      console.warn(`[Social Crawler] Project ${projectId} not found in DB.`);
      return { status: 'ignored', reason: 'project_not_found' };
    }

    const topicsArray = Array.isArray(project.topics) ? (project.topics as string[]) : [];

    // 2. Run crawlers in parallel
    const [hnMentions, redditMentions, twitterMentions] = await Promise.all([
      crawlHNMentions(project.fullName, project.name, project.sourceUrl, project.homepageUrl),
      crawlRedditMentions(project.fullName, project.name, project.sourceUrl, project.homepageUrl),
      crawlTwitterMentions(
        project.fullName,
        project.name,
        project.ownerName,
        project.primaryLanguage,
        topicsArray,
        project.description
      )
    ]);

    const allMentions = [...hnMentions, ...redditMentions, ...twitterMentions];
    if (allMentions.length > 0) {
      console.log(`[Social Crawler] Inserting ${allMentions.length} mentions for ${project.fullName}`);
      for (const mention of allMentions) {
        // Enforce strict 500 characters limit on content
        let content = mention.content;
        if (content.length > 500) {
          content = content.substring(0, 497) + '...';
        }

        try {
          await db.insert(projectMentions)
            .values({
              projectId: project.id,
              source: mention.source,
              author: mention.author,
              content: content,
              url: mention.url,
              score: mention.score,
              commentsCount: mention.commentsCount,
              mentionedAt: mention.mentionedAt,
            })
            .onConflictDoNothing();
        } catch (insertErr) {
          console.error(`[Social Crawler] Failed to insert mention for ${project.fullName} (URL: ${mention.url}):`, insertErr);
        }
      }
    }

    return { status: 'success', mentionsCount: allMentions.length };
  } catch (error) {
    console.error(`[Social Crawler] Error crawling social mentions for project ${projectId}:`, error);
    throw error;
  }
}

export const socialCrawlerWorker = new Worker<SocialCrawlJobData>(
  'social-crawler',
  handleSocialCrawlJob,
  {
    connection: redisConnection as unknown as Worker['opts']['connection'],
    concurrency: 1, // Process 1 job at a time per worker instance
    stalledInterval: 15000,
    maxStalledCount: 2,
    limiter: {
      max: 1,
      duration: 3000, // 3 seconds delay between jobs per worker
    }
  }
);

crawlerWorker.on('completed', async (job) => {
  console.log(`[Crawler] Job ${job.id} completed with result`, job.returnvalue);
  try {
    await redisConnection.incr('crawler:stats:github-crawler:completed');
  } catch (err) {
    console.error('[Crawler] Failed to increment completed stats in Redis:', err);
  }
});

crawlerWorker.on('failed', async (job, err) => {
  if (err.message.includes('[RateLimitError]')) {
    console.log(`[Crawler] Job ${job?.id} paused/delayed due to rate limit (will retry later).`);
  } else {
    console.error(`[Crawler] Job ${job?.id} failed with error:`, err.message);
    try {
      await redisConnection.incr('crawler:stats:github-crawler:failed');
    } catch (redisErr) {
      console.error('[Crawler] Failed to increment failed stats in Redis:', redisErr);
    }
  }
});

githubUpdaterWorker.on('completed', async (job) => {
  console.log(`[GitHub Updater] Job ${job.id} completed`);
  try {
    await redisConnection.incr('crawler:stats:github-updater:completed');
  } catch (err) {
    console.error('[GitHub Updater] Failed to increment completed stats in Redis:', err);
  }
});

githubUpdaterWorker.on('failed', async (job, err) => {
  if (err.message.includes('[RateLimitError]')) {
    console.log(`[GitHub Updater] Job ${job?.id} paused/delayed due to rate limit (will retry later).`);
  } else {
    console.error(`[GitHub Updater] Job ${job?.id} failed with error:`, err.message);
    try {
      await redisConnection.incr('crawler:stats:github-updater:failed');
    } catch (redisErr) {
      console.error('[GitHub Updater] Failed to increment failed stats in Redis:', redisErr);
    }
  }
});

socialCrawlerWorker.on('completed', async (job) => {
  console.log(`[Social Crawler] Job ${job.id} completed with result`, job.returnvalue);
  try {
    await redisConnection.incr('crawler:stats:social-crawler:completed');
  } catch (err) {
    console.error('[Social Crawler] Failed to increment completed stats in Redis:', err);
  }
});

socialCrawlerWorker.on('failed', async (job, err) => {
  console.error(`[Social Crawler] Job ${job?.id} failed with error:`, err.message);
  try {
    await redisConnection.incr('crawler:stats:social-crawler:failed');
  } catch (redisErr) {
    console.error('[Social Crawler] Failed to increment failed stats in Redis:', redisErr);
  }
});

console.log('[Crawler] Worker started (github-crawler + github-updater + social-crawler merged).');

// On worker startup, run auto-recovery checks and start metrics reporting
setupQueueAutoRecovery('github-crawler', crawlerQueue, redisConnection);
setupQueueAutoRecovery('github-updater', githubUpdaterQueue, redisConnection);
setupQueueAutoRecovery('social-crawler', socialCrawlerQueue, redisConnection);
const stopReporting = startMemoryReporting('crawler-worker', redisConnection);

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('[Crawler Worker] Gracefully shutting down...');
  stopReporting();
  await Promise.allSettled([crawlerWorker.close(), githubUpdaterWorker.close(), socialCrawlerWorker.close()]);
  await redisConnection.quit();
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Global error handling for unhandled exceptions
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Crawler Worker] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[Crawler Worker] Uncaught Exception:', error);
});
