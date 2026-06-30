import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { db } from '../lib/db';
import { projects, projectSnapshots, projectTrends } from '../lib/db/schema';
import * as zlib from 'zlib';
import { sql, eq, and } from 'drizzle-orm';
import { categorizeProject } from '../lib/categorizer';
import { updateProjectCrawlSchedule } from '../lib/crawlers/scheduler';
import { proxyManager } from '../lib/crawlers/proxy';
import { calculateProjectTrendInline } from '../lib/db/trends';
import { setTimeout } from 'timers/promises';
import { hfQueue, hfUpdaterQueue } from './queue';
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
  console.error('[HF Worker] Redis connection error:', err.message);
});
const pauseScheduledMap: Record<string, boolean> = {};

interface HFCrawlJobData {
  id: string; // e.g., 'meta-llama/Llama-2-7b'
  type: 'models' | 'datasets';
  overrideDescription?: string;
}

export async function handleHFCrawlJob(job: Job<HFCrawlJobData>) {
  const { id, type } = job.data;
  const currentQueue = job.queueName === 'hf-updater' ? hfUpdaterQueue : hfQueue;
  const logPrefix = job.queueName === 'hf-updater' ? '[HF Updater]' : '[HF Crawler]';
  console.log(`${logPrefix} Starting crawl for ${type}: ${id}`);

  try {
    // Helper function to fetch from HuggingFace with Proxy Rotation and Rate Limit Recovery
    const fetchHFWithRetry = async (url: string, isText = false) => {
      let maxRetries = 5;
      const hasProxies = (process.env.PROXY_URLS || '').split(',').map(p => p.trim()).filter(Boolean).length > 0;

      while (maxRetries > 0) {
        const headers: Record<string, string> = {
          'Accept': isText ? 'text/plain' : 'application/json',
        };
        const hfToken = (process.env.HF_TOKEN || '').replace(/^["']|["']$/g, '').trim();
        if (hfToken) {
          headers['Authorization'] = `Bearer ${hfToken}`;
        }

        const dispatcher = proxyManager.getRandomDispatcher();
        const fetchOptions: RequestInit & { dispatcher?: unknown } = { headers };
        if (dispatcher) {
          fetchOptions.dispatcher = dispatcher;
        }

        const response = await fetch(url, fetchOptions);

        let remVal = 0, limitVal = 1000, resetVal = 60;
        let rateLimitFound = false;

        const rateLimitHeader = response.headers.get('RateLimit');
        const rateLimitPolicyHeader = response.headers.get('RateLimit-Policy');

        if (rateLimitHeader) {
          const rMatch = rateLimitHeader.match(/r=(\d+)/);
          const tMatch = rateLimitHeader.match(/t=(\d+)/);
          if (rMatch) remVal = parseInt(rMatch[1], 10);
          if (tMatch) resetVal = parseInt(tMatch[1], 10);
          rateLimitFound = true;
        }

        if (rateLimitPolicyHeader) {
          const qMatch = rateLimitPolicyHeader.match(/q=(\d+)/);
          if (qMatch) limitVal = parseInt(qMatch[1], 10);
        }

        // Fallback for legacy headers
        if (!rateLimitFound) {
          const remaining = response.headers.get('x-rate-limit-remaining') || response.headers.get('ratelimit-remaining');
          const reset = response.headers.get('x-rate-limit-reset') || response.headers.get('ratelimit-reset');
          const limitHeader = response.headers.get('x-rate-limit-limit') || response.headers.get('ratelimit-limit');
          
          if (remaining) {
            remVal = parseInt(remaining, 10);
            if (limitHeader) limitVal = parseInt(limitHeader, 10);
            if (reset) resetVal = parseInt(reset, 10);
            rateLimitFound = true;
          }
        }

        if (rateLimitFound) {
          redisConnection.hset('system:hf:token', 'info', JSON.stringify({
            remaining: remVal,
            limit: limitVal,
            resetTime: Date.now() + resetVal * 1000,
            timestamp: Date.now(),
            status: remVal === 0 ? 'exhausted' : 'active'
          })).catch(err => {
            console.error(`${logPrefix} Failed to write HF token status to Redis:`, err);
          });

          if (remVal < 20) {
            console.log(`${logPrefix} HF API rate limit is low: ${remVal} remaining. Resets in ${resetVal}s`);
          }
        }

        if (!response.ok) {
          if (response.status === 429) {
            if (hasProxies) {
              console.log(`${logPrefix} 429 caught on proxy/direct connection. Rotating proxy. Retries left: ${maxRetries - 1}`);
              maxRetries--;
              await setTimeout(2000); // Wait 2s before retry
              continue;
            } else {
              const resetSeconds = resetVal;
              const sleepMs = (resetSeconds + 5) * 1000;
              
              if (!pauseScheduledMap[job.queueName]) {
                pauseScheduledMap[job.queueName] = true;
                console.log(`${logPrefix} HuggingFace API rate limited. Automatically pausing queue...`);
                try {
                  await redisConnection.set(`crawler:rate-limit-reset:${job.queueName}`, 'true', 'PX', sleepMs);
                  await currentQueue.pause();
                  console.log(`${logPrefix} Queue paused successfully. Will resume in ${resetSeconds} second(s).`);
                  
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

              throw new Error(`[RateLimitError] Rate limited by HuggingFace API. Resets in ${resetSeconds} seconds.`);
            }
          }
          if (response.status === 404) {
            return { status: 404, data: null };
          }
          if (response.status >= 500) {
            console.warn(`${logPrefix} HuggingFace API ${response.status} error. Retries left: ${maxRetries - 1}`);
            maxRetries--;
            await setTimeout(5000); // Wait 5s before retry
            continue;
          }
          throw new Error(`HuggingFace API error: ${response.status} ${response.statusText}`);
        }

        return { status: 200, data: isText ? await response.text() : await response.json() };
      }
      throw new Error('Failed to fetch HF data after max retries due to rate limiting.');
    };

    // 1. Fetch data from HuggingFace API
    const result = await fetchHFWithRetry(`https://huggingface.co/api/${type}/${id}`);

    if (result.status === 404) {
      console.warn(`${logPrefix} Not found: ${id}. Removing from database.`);
      const [existing] = await db.select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.sourceId, id), eq(projects.source, 'huggingface')));
      if (existing) {
        await db.delete(projectTrends).where(eq(projectTrends.projectId, existing.id));
        await db.delete(projectSnapshots).where(eq(projectSnapshots.projectId, existing.id));
        await db.delete(projects).where(eq(projects.id, existing.id));
      }
      return { status: 'not_found' };
    }

    const data = result.data;

    // 2. Process data and update database
    // HF IDs often contain slashes (e.g., meta-llama/Llama-2). We slugify it safely.
    const slug = `hf-${id.toLowerCase().replace(/\//g, '-')}`;
    
    // Determine owner from ID (usually author/name, if no author, owner is 'huggingface')
    const parts = id.split('/');
    const owner = parts.length > 1 ? parts[0] : 'huggingface';
    const name = parts.length > 1 ? parts.slice(1).join('/') : id;

    // Map HF 'likes' to 'stars' and 'downloads' to 'watchers'
    const likes = data.likes || 0;
    const downloads = data.downloads || 0;
    
    // Determine projectType from ID type ('models' -> 'model')
    const projectType = type === 'models' ? 'model' : 'dataset';

    const rawTags = data.tags || [];
    if (data.pipeline_tag) rawTags.push(data.pipeline_tag);
    if (type === 'datasets' && data.task_categories) rawTags.push(...data.task_categories);
    
    const canonicalCategories = await categorizeProject(rawTags, projectType);

    let readme: Buffer | null = null;
    let finalDescription = job.data.overrideDescription || data.cardData?.summary || data.description || '';
    try {
      const prefix = type === 'datasets' ? 'datasets/' : '';
      const readmeRes = await fetchHFWithRetry(`https://huggingface.co/${prefix}${id}/resolve/main/README.md`, true);
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
      console.warn(`${logPrefix} Failed to fetch README for ${id}`);
    }

    // Upsert into projects
    const [project] = await db.insert(projects)
      .values({
        source: 'huggingface',
        projectType,
        sourceId: id,
        slug,
        name: name,
        fullName: id,
        description: finalDescription,
        readme: readme,
        homepageUrl: `https://huggingface.co/${type === 'datasets' ? 'datasets/' : ''}${id}`,
        sourceUrl: `https://huggingface.co/${type === 'datasets' ? 'datasets/' : ''}${id}`,
        primaryLanguage: data.pipeline_tag || (type === 'datasets' ? data.task_categories?.[0] : '') || '', 
        license: data.cardData?.license || '',
        ownerName: owner,
        ownerAvatarUrl: `https://huggingface.co/avatars/${owner}.png`,
        ownerType: 'organization', 
        topics: rawTags,
        categories: canonicalCategories,
        likes: likes,
        downloads: downloads,
        sourceCreatedAt: data.createdAt ? new Date(data.createdAt) : new Date(),
        sourceUpdatedAt: data.lastModified ? new Date(data.lastModified) : (data.createdAt ? new Date(data.createdAt) : new Date()),
        lastCrawledAt: new Date(),
      })
      .onConflictDoUpdate({
        target: projects.slug,
        set: {
          description: finalDescription,
          readme: readme,
          topics: rawTags,
          categories: canonicalCategories,
          primaryLanguage: data.pipeline_tag || (type === 'datasets' ? data.task_categories?.[0] : '') || '',
          likes: likes,
          downloads: downloads,
          lastCrawledAt: new Date(),
        }
      })
      .returning({ id: projects.id });

    // Insert snapshot (deduplicate: update if same project+date already exists today, else insert)
    const snapshotDate = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];
    const existing = await db.select({ id: projectSnapshots.id })
      .from(projectSnapshots)
      .where(sql`${projectSnapshots.projectId} = ${project.id} AND ${projectSnapshots.snapshotDate} = ${snapshotDate}`)
      .limit(1);
    
    if (existing.length > 0) {
      await db.update(projectSnapshots)
        .set({
          likes: likes,
          downloads: downloads,
        })
        .where(eq(projectSnapshots.id, existing[0].id));
    } else {
      await db.insert(projectSnapshots).values({
        projectId: project.id,
        stars: 0,
        watchers: 0,
        forks: 0,
        openIssues: 0,
        likes: likes,
        downloads: downloads,
        snapshotDate,
      });
    }

    // Recalculate and update the next crawl schedule
    await updateProjectCrawlSchedule(project.id, 'huggingface');

    // Calculate trends inline
    await calculateProjectTrendInline(project.id);

    console.log(`${logPrefix} Successfully fetched & saved ${id}: ${likes} likes, ${downloads} downloads`);

    return { 
      status: 'success', 
      projectId: project.id,
      likes,
      downloads 
    };

  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    if (error.message?.includes('[RateLimitError]')) {
      console.log(`${logPrefix} Rate limit reached for ${id}. Will retry when API resets.`);
    } else {
      console.error(`${logPrefix} Error processing ${id}:`, error);
    }
    throw err; // Re-throw to trigger BullMQ retries
  }
}

export const hfWorker = new Worker<HFCrawlJobData>(
  'hf-crawler',
  handleHFCrawlJob,
  {
     connection: redisConnection as unknown as Worker['opts']['connection'],
     concurrency: 2, // Reduced from 5 to prevent OOM
     stalledInterval: 15000,
     maxStalledCount: 2,
  }
);

// Merged: HF Updater worker runs in the same process
export const hfUpdaterWorker = new Worker<HFCrawlJobData>(
  'hf-updater',
  handleHFCrawlJob,
  {
     connection: redisConnection as unknown as Worker['opts']['connection'],
     concurrency: 2,
     stalledInterval: 15000,
     maxStalledCount: 2,
  }
);

hfWorker.on('completed', async (job) => {
  console.log(`[HF Crawler] Job ${job.id} completed`);
  try {
    await redisConnection.incr('crawler:stats:hf-crawler:completed');
  } catch (err) {
    console.error('[HF Crawler] Failed to increment completed stats in Redis:', err);
  }
});

hfWorker.on('failed', async (job, err) => {
  if (err.message.includes('[RateLimitError]')) {
    console.log(`[HF Crawler] Job ${job?.id} paused/delayed due to rate limit (will retry later).`);
  } else {
    console.error(`[HF Crawler] Job ${job?.id} failed with error:`, err.message);
    try {
      await redisConnection.incr('crawler:stats:hf-crawler:failed');
    } catch (redisErr) {
      console.error('[HF Crawler] Failed to increment failed stats in Redis:', redisErr);
    }
  }
});

hfUpdaterWorker.on('completed', async (job) => {
  console.log(`[HF Updater] Job ${job.id} completed`);
  try {
    await redisConnection.incr('crawler:stats:hf-updater:completed');
  } catch (err) {
    console.error('[HF Updater] Failed to increment completed stats in Redis:', err);
  }
});

hfUpdaterWorker.on('failed', async (job, err) => {
  if (err.message.includes('[RateLimitError]')) {
    console.log(`[HF Updater] Job ${job?.id} paused/delayed due to rate limit (will retry later).`);
  } else {
    console.error(`[HF Updater] Job ${job?.id} failed with error:`, err.message);
    try {
      await redisConnection.incr('crawler:stats:hf-updater:failed');
    } catch (redisErr) {
      console.error('[HF Updater] Failed to increment failed stats in Redis:', redisErr);
    }
  }
});

console.log('[HF Crawler] Worker started (hf-crawler + hf-updater merged).');

// On worker startup, run auto-recovery checks and start memory reporting
setupQueueAutoRecovery('hf-crawler', hfQueue, redisConnection);
setupQueueAutoRecovery('hf-updater', hfUpdaterQueue, redisConnection);
const stopReporting = startMemoryReporting('hf-worker', redisConnection);

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('[HF Worker] Gracefully shutting down...');
  stopReporting();
  await Promise.allSettled([hfWorker.close(), hfUpdaterWorker.close()]);
  await redisConnection.quit();
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Global error handling for unhandled exceptions
process.on('unhandledRejection', (reason, promise) => {
  console.error('[HF Worker] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[HF Worker] Uncaught Exception:', error);
});
