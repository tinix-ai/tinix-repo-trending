import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { db } from '../lib/db';
import { projects, projectSnapshots } from '../lib/db/schema';
import { eq } from 'drizzle-orm';
import { categorizeProject } from '../lib/categorizer';

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

      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`[HF Crawler] Not found: ${id}`);
          return { status: 'not_found' };
        }
        if (response.status === 429) {
          throw new Error(`Rate limited by HuggingFace API for ${id}`);
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
        if (readmeRes.ok) {
          readme = await readmeRes.text();
          if (!finalDescription && readme) {
            finalDescription = readme.replace(/[#*`_>\[\]]/g, '').substring(0, 300).trim() + '...';
          }
        }
      } catch (e) {
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

      // Insert snapshot
      const snapshotDate = new Date().toISOString().split('T')[0];
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
    connection: redisConnection,
    concurrency: 5, 
    limiter: {
      max: 100000, 
      duration: 3600000,
    },
  }
);

hfWorker.on('completed', (job) => {
  console.log(`[HF Crawler] Job ${job.id} completed`);
});

hfWorker.on('failed', (job, err) => {
  console.error(`[HF Crawler] Job ${job?.id} failed with error`, err.message);
});

console.log('[HF Crawler] Worker started and waiting for jobs...');
