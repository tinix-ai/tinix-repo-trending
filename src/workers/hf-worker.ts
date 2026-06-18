import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { db } from '../lib/db';
import { projects, projectSnapshots, projectTrends } from '../lib/db/schema';
import { sql, eq, and } from 'drizzle-orm';
import { categorizeProject } from '../lib/categorizer';
import { updateProjectCrawlSchedule } from '../lib/crawlers/scheduler';
import { calculateProjectTrendInline } from './cron';
import { proxyManager } from '../lib/crawlers/proxy';
import { setTimeout } from 'timers/promises';

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

interface HFCrawlJobData {
  id: string; // e.g., 'meta-llama/Llama-2-7b'
  type: 'models' | 'datasets';
}

export const hfWorker = new Worker<HFCrawlJobData>(
  'hf-crawler',
  async (job: Job<HFCrawlJobData>) => {
    const { id, type } = job.data;
    console.log(`[HF Crawler] Starting crawl for ${type}: ${id}`);

    try {
      // Helper function to fetch from HuggingFace with Proxy Rotation and Rate Limit Recovery
      const fetchHFWithRetry = async (url: string, isText = false) => {
        let maxRetries = 5;
        const hasProxies = (process.env.PROXY_URLS || '').split(',').map(p => p.trim()).filter(Boolean).length > 0;

        while (maxRetries > 0) {
          const headers: Record<string, string> = {
            'Accept': isText ? 'text/plain' : 'application/json',
          };
          if (process.env.HF_TOKEN) {
            headers['Authorization'] = `Bearer ${process.env.HF_TOKEN}`;
          }

          const dispatcher = proxyManager.getRandomDispatcher();
          const fetchOptions: RequestInit & { dispatcher?: unknown } = { headers };
          if (dispatcher) {
            fetchOptions.dispatcher = dispatcher;
          }

          const response = await fetch(url, fetchOptions);

          const remaining = response.headers.get('x-rate-limit-remaining') || response.headers.get('ratelimit-remaining');
          const reset = response.headers.get('x-rate-limit-reset') || response.headers.get('ratelimit-reset');

          if (remaining && parseInt(remaining) < 20) {
            console.warn(`[HF Crawler] HF API rate limit is low: ${remaining} remaining. Resets in ${reset || 'unknown'}s`);
          }

          if (!response.ok) {
            if (response.status === 429) {
              if (hasProxies) {
                console.warn(`[HF Crawler] 429 caught on proxy/direct connection. Rotating proxy. Retries left: ${maxRetries - 1}`);
                maxRetries--;
                await setTimeout(2000); // Wait 2s before retry
                continue;
              } else {
                // No proxies -> throw error to let BullMQ handle exponential backoff retry
                console.warn(`[HF Crawler] Rate limited by HuggingFace API with no proxies. Throwing RateLimitError...`);
                throw new Error(`[RateLimitError] Rate limited by HuggingFace API. No proxies configured.`);
              }
            }
            if (response.status === 404) {
              return { status: 404, data: null };
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
        console.warn(`[HF Crawler] Not found: ${id}. Removing from database.`);
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
      
      const canonicalCategories = categorizeProject(rawTags, projectType);

      let readme = null;
      let finalDescription = data.cardData?.summary || data.description || '';
      try {
        const prefix = type === 'datasets' ? 'datasets/' : '';
        const readmeRes = await fetchHFWithRetry(`https://huggingface.co/${prefix}${id}/resolve/main/README.md`, true);
        if (readmeRes.status === 200 && readmeRes.data) {
          readme = readmeRes.data;
          if (!finalDescription && readme) {
            let clean = readme.trim();
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
        console.warn(`[HF Crawler] Failed to fetch README for ${id}`);
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

      // Calculate project trends inline immediately
      await calculateProjectTrendInline(project.id);

      console.log(`[HF Crawler] Successfully fetched & saved ${id}: ${likes} likes, ${downloads} downloads`);

      return { 
        status: 'success', 
        projectId: project.id,
        likes,
        downloads 
      };

    } catch (error) {
      console.error(`[HF Crawler] Error processing ${id}:`, error);
      throw error; // Re-throw to trigger BullMQ retries
    }
  },
  {
    connection: redisConnection as unknown as Worker['opts']['connection'],
    concurrency: 5, 
    limiter: {
      // If HF_TOKEN or PROXY_URLS is present, allow up to 5000 requests per hour
      // Otherwise, restrict to 1500 requests per hour (2 requests per project, so 750 projects/hr)
      max: (process.env.HF_TOKEN || process.env.PROXY_URLS) ? 5000 : 1500,
      duration: 3600000,
    },
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
  console.error(`[HF Crawler] Job ${job?.id} failed with error`, err.message);
  try {
    await redisConnection.incr('crawler:stats:hf-crawler:failed');
  } catch (err) {
    console.error('[HF Crawler] Failed to increment failed stats in Redis:', err);
  }
});

console.log('[HF Crawler] Worker started and waiting for jobs...');

// Global error handling for unhandled exceptions
process.on('unhandledRejection', (reason, promise) => {
  console.error('[HF Worker] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[HF Worker] Uncaught Exception:', error);
});
