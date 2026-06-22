import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { db } from '../lib/db';
import { projects, projectSnapshots, projectTrends } from '../lib/db/schema';
import * as zlib from 'zlib';
import { sql, eq } from 'drizzle-orm';
import { categorizeProject } from '../lib/categorizer';
import { updateProjectCrawlSchedule } from '../lib/crawlers/scheduler';
import { githubPool } from '../lib/crawlers/github-pool';
import { proxyManager } from '../lib/crawlers/proxy';
import { setTimeout } from 'timers/promises';
import { crawlerQueue, githubUpdaterQueue } from './queue';
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
  const { owner, repo } = job.data;
  const currentQueue = job.queueName === 'github-updater' ? githubUpdaterQueue : crawlerQueue;
  const logPrefix = job.queueName === 'github-updater' ? '[GitHub Updater]' : '[Crawler]';
  console.log(`${logPrefix} Starting crawl for ${owner}/${repo}`);

  try {
    // Helper function to fetch from Github with Token Rotation, Proxy Rotation, and Smart Rate-Limit Waiting
    const fetchWithTokenRotation = async (url: string, isReadme = false) => {
      let maxRetries = 5; // Allow more retries to try multiple proxies/tokens
      while (maxRetries > 0) {
        let currentToken: string | null = null;
        let tokenExhaustedError = false;

        try {
          currentToken = await githubPool.getAvailableToken();
        } catch (err: unknown) {
          const error = err as Error;
          if (error.message.includes('ALL tokens are currently exhausted')) {
            tokenExhaustedError = true;
          } else {
            throw err;
          }
        }

        // Case: All tokens exhausted, but we have proxies to fall back on for unauthenticated requests
        const hasProxies = (process.env.PROXY_URLS || '').split(',').map(p => p.trim()).filter(Boolean).length > 0;
        if (tokenExhaustedError && !hasProxies) {
          const nextTime = await githubPool.getNextAvailableTime();
          const sleepMs = Math.max(5000, nextTime - Date.now() + 5000);
          const resetMinutes = Math.ceil(sleepMs / 60000);
          
          if (!pauseScheduledMap[job.queueName]) {
            pauseScheduledMap[job.queueName] = true;
            console.log(`${logPrefix} All GitHub tokens exhausted. Automatically pausing queue...`);
            try {
              await redisConnection.set(`crawler:rate-limit-reset:${job.queueName}`, 'true', 'PX', sleepMs);
              await currentQueue.pause();
              console.log(`${logPrefix} Queue paused successfully. Will resume in ${resetMinutes} minute(s).`);
              
              (async () => {
                await setTimeout(sleepMs);
                try {
                  await currentQueue.resume();
                  await redisConnection.del(`crawler:rate-limit-reset:${job.queueName}`);
                  pauseScheduledMap[job.queueName] = false;
                  console.log(`${logPrefix} Automatically resumed queue after rate limit reset.`);
                } catch (resumeErr) {
                  pauseScheduledMap[job.queueName] = false;
                  console.error(`${logPrefix} Failed to automatically resume queue:`, resumeErr);
                }
              })();
            } catch (pauseErr) {
              pauseScheduledMap[job.queueName] = false;
              console.error(`${logPrefix} Failed to pause queue:`, pauseErr);
            }
          }

          throw new Error(`[RateLimitError] All GitHub tokens exhausted. Next available in ${resetMinutes} minute(s).`);
        }

        const headers: Record<string, string> = {
          'Accept': isReadme ? 'application/vnd.github.v3.raw' : 'application/vnd.github.v3+json',
        };
        if (currentToken) {
          headers['Authorization'] = `Bearer ${currentToken}`;
        }

        const dispatcher = proxyManager.getRandomDispatcher();
        const fetchOptions: RequestInit & { dispatcher?: unknown } = { headers };
        if (dispatcher) {
          fetchOptions.dispatcher = dispatcher;
        }

        const response = await fetch(url, fetchOptions);
        
        // Check limits
        const reset = response.headers.get('x-ratelimit-reset');
        
        if (!response.ok) {
          if (response.status === 403 || response.status === 429) {
            if (currentToken) {
              // Token-based limit
              await githubPool.markTokenExhausted(currentToken, reset);
              console.log(`${logPrefix} 403/429 caught. Rotated token. Retries left: ${maxRetries - 1}`);
              maxRetries--;
              continue; // Retry with next token
            } else if (hasProxies) {
              // IP-based limit when using proxies
              console.log(`${logPrefix} 403/429 caught on proxy/direct connection. Rotating proxy. Retries left: ${maxRetries - 1}`);
              maxRetries--;
              await setTimeout(2000); // 2 seconds delay
              continue; // Retry with next random proxy
            } else {
              // No token and no proxies -> We hit IP rate limit on host.
              console.log(`${logPrefix} IP rate limited on host with no tokens/proxies. Throwing RateLimitError...`);
              throw new Error(`[RateLimitError] IP rate limited on host. No tokens or proxies configured.`);
            }
          }
          if (response.status === 404) {
            return { status: 404, data: null };
          }
          throw new Error(`GitHub API Error: ${response.status} ${response.statusText}`);
        }

        return { status: 200, data: isReadme ? await response.text() : await response.json() };
      }
      throw new Error('Failed to fetch after max retries due to rate limiting.');
    };

    // 1. Fetch data from GitHub API
    const result = await fetchWithTokenRotation(`https://api.github.com/repos/${owner}/${repo}`);
    
    if (result.status === 404) {
      console.warn(`${logPrefix} Project ${owner}/${repo} not found on GitHub. Removing from database.`);
      if (job.data.projectId) {
        await db.delete(projectTrends).where(eq(projectTrends.projectId, job.data.projectId));
        await db.delete(projectSnapshots).where(eq(projectSnapshots.projectId, job.data.projectId));
        await db.delete(projects).where(eq(projects.id, job.data.projectId));
      }
      return;
    }

    const data = result.data;

    // 2. Process data and update database
    const slug = `${owner.toLowerCase()}-${repo.toLowerCase()}`;
    
    let readme: Buffer | null = null;
    let finalDescription = data.description || '';
    try {
      const readmeRes = await fetchWithTokenRotation(`https://api.github.com/repos/${owner}/${repo}/readme`, true);
      if (readmeRes.status === 200 && readmeRes.data) {
        const rawReadme = readmeRes.data;
        readme = zlib.gzipSync(Buffer.from(rawReadme, 'utf-8'));
        if (!finalDescription && rawReadme) {
          let clean = rawReadme.trim();
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
    } catch {
      console.warn(`${logPrefix} Failed to fetch README for ${owner}/${repo}`);
    }

    // Use Categorizer for GitHub repos
    const rawTags = data.topics || [];
    const canonicalCategories = categorizeProject(rawTags, 'repository');
    
    // Upsert into projects
    const [project] = await db.insert(projects)
      .values({
        source: 'github',
        projectType: 'repository',
        sourceId: `${owner}/${repo}`,
        slug,
        name: data.name,
        fullName: data.full_name,
        description: finalDescription,
        readme: readme,
        homepageUrl: data.homepage,
        sourceUrl: data.html_url,
        primaryLanguage: data.language,
        license: data.license?.name,
        ownerName: owner,
        ownerAvatarUrl: data.owner?.avatar_url,
        ownerType: data.owner?.type?.toLowerCase(),
        topics: data.topics || [],
        categories: canonicalCategories,
        sourceCreatedAt: new Date(data.created_at),
        sourceUpdatedAt: new Date(data.pushed_at || data.updated_at || data.created_at),
        lastCrawledAt: new Date(),
      })
      .onConflictDoUpdate({
        target: projects.slug,
        set: {
          description: finalDescription,
          readme: readme,
          homepageUrl: data.homepage,
          primaryLanguage: data.language,
          topics: data.topics || [],
          categories: canonicalCategories,
          lastCrawledAt: new Date(),
        }
      })
      .returning({ id: projects.id });

    // Insert snapshot (deduplicate: update if same project+date already exists today, else insert)
    const snapshotDate = new Date().toISOString().split('T')[0];
    const existing = await db.select({ id: projectSnapshots.id })
      .from(projectSnapshots)
      .where(sql`${projectSnapshots.projectId} = ${project.id} AND ${projectSnapshots.snapshotDate} = ${snapshotDate}`)
      .limit(1);
    
    if (existing.length > 0) {
      await db.update(projectSnapshots)
        .set({
          stars: data.stargazers_count,
          forks: data.forks_count,
          openIssues: data.open_issues_count,
          watchers: data.subscribers_count,
        })
        .where(eq(projectSnapshots.id, existing[0].id));
    } else {
      await db.insert(projectSnapshots).values({
        projectId: project.id,
        stars: data.stargazers_count,
        forks: data.forks_count,
        openIssues: data.open_issues_count,
        watchers: data.subscribers_count,
        snapshotDate,
      });
    }

    // Recalculate and update the next crawl schedule
    await updateProjectCrawlSchedule(project.id, 'github');

    console.log(`${logPrefix} Successfully fetched & saved ${owner}/${repo}: ${data.stargazers_count} stars`);

    return { 
      status: 'success', 
      projectId: project.id,
      stars: data.stargazers_count,
      forks: data.forks_count 
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

console.log('[Crawler] Worker started (github-crawler + github-updater merged).');

// On worker startup, run auto-recovery checks and start metrics reporting
setupQueueAutoRecovery('github-crawler', crawlerQueue, redisConnection);
setupQueueAutoRecovery('github-updater', githubUpdaterQueue, redisConnection);
const stopReporting = startMemoryReporting('crawler-worker', redisConnection);

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('[Crawler Worker] Gracefully shutting down...');
  stopReporting();
  await Promise.allSettled([crawlerWorker.close(), githubUpdaterWorker.close()]);
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
