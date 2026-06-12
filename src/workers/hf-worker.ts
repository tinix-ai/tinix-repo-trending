import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { db } from '../lib/db';
import { projects, projectSnapshots } from '../lib/db/schema';
import { sql } from 'drizzle-orm';
import { categorizeProject } from '../lib/categorizer';
import { updateProjectCrawlSchedule } from '../lib/crawlers/scheduler';

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
};

const redisConnection = new Redis(redisConfig);

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
      // 1. Fetch data from HuggingFace API
      const response = await fetch(`https://huggingface.co/api/${type}/${id}`, {
        headers: {
          'Accept': 'application/json',
          ...(process.env.HF_TOKEN && {
            'Authorization': `Bearer ${process.env.HF_TOKEN}`,
          }),
        },
      });

      const remaining = response.headers.get('x-rate-limit-remaining') || response.headers.get('ratelimit-remaining');
      const reset = response.headers.get('x-rate-limit-reset') || response.headers.get('ratelimit-reset');
      if (remaining && parseInt(remaining) < 20) {
        console.warn(`[HF Crawler] HF API rate limit is low: ${remaining} remaining. Resets in ${reset || 'unknown'}s`);
      }

      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`[HF Crawler] Not found: ${id}`);
          return { status: 'not_found' };
        }
        if (response.status === 429) {
          let delayMsg = '';
          if (reset) {
            delayMsg = ` Resets in ${reset}s.`;
          }
          throw new Error(`Rate limited by HuggingFace API for ${id}.${delayMsg}`);
        }
        throw new Error(`HuggingFace API error: ${response.statusText}`);
      }

      const data = await response.json();

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
        const readmeRes = await fetch(`https://huggingface.co/${prefix}${id}/resolve/main/README.md`);
        if (readmeRes.status === 429) {
          throw new Error('Rate limit');
        }
        if (readmeRes.ok) {
          readme = await readmeRes.text();
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
      } catch (e) {
        const err = e as Error;
        if (err.message === 'Rate limit') {
          throw new Error(`Rate limited by HuggingFace API during README fetch for ${id}`);
        }
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

      // Insert snapshot (deduplicate: skip if same project+date already exists today)
      const snapshotDate = new Date().toISOString().split('T')[0];
      const existing = await db.select({ id: projectSnapshots.id })
        .from(projectSnapshots)
        .where(sql`${projectSnapshots.projectId} = ${project.id} AND ${projectSnapshots.snapshotDate} = ${snapshotDate}`)
        .limit(1);
      
      if (existing.length === 0) {
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
      // If HF_TOKEN is present, allow up to 5000 requests per hour (since each project has ~2 requests, so 2500 projects/hr)
      // Otherwise, restrict to 60 requests per hour to avoid getting blocked.
      max: process.env.HF_TOKEN ? 5000 : 60,
      duration: 3600000,
    },
    stalledInterval: 15000,
    maxStalledCount: 2,
  }
);

hfWorker.on('completed', (job) => {
  console.log(`[HF Crawler] Job ${job.id} completed`);
});

hfWorker.on('failed', (job, err) => {
  console.error(`[HF Crawler] Job ${job?.id} failed with error`, err.message);
});

console.log('[HF Crawler] Worker started and waiting for jobs...');
