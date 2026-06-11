import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { db } from '../lib/db';
import { projects, projectSnapshots } from '../lib/db/schema';
import { categorizeProject } from '../lib/categorizer';
import { updateProjectCrawlSchedule } from '../lib/crawlers/scheduler';

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
};

const redisConnection = new Redis(redisConfig);

interface CrawlJobData {
  owner: string;
  repo: string;
  projectId?: string;
}

export const crawlerWorker = new Worker<CrawlJobData>(
  'github-crawler',
  async (job: Job<CrawlJobData>) => {
    const { owner, repo } = job.data;
    console.log(`[Crawler] Starting crawl for ${owner}/${repo}`);

    try {
      // 1. Fetch data from GitHub API
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          ...(process.env.GITHUB_TOKEN && {
            'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
          }),
        },
      });

      const remaining = response.headers.get('x-ratelimit-remaining');
      const reset = response.headers.get('x-ratelimit-reset');
      if (remaining && parseInt(remaining) < 20) {
        const resetDate = reset ? new Date(parseInt(reset) * 1000).toISOString() : 'unknown';
        console.warn(`[Crawler] GitHub API rate limit is low: ${remaining} remaining. Resets at ${resetDate}`);
      }

      if (!response.ok) {
        if (response.status === 403 || response.status === 429) {
          let delayMsg = '';
          if (reset) {
            const resetMs = parseInt(reset) * 1000;
            const diffMs = resetMs - Date.now();
            if (diffMs > 0) {
              delayMsg = ` Resets in ${Math.ceil(diffMs / 1000)}s.`;
            }
          }
          throw new Error(`Rate limited by GitHub API for ${owner}/${repo}.${delayMsg}`);
        }
        if (response.status === 404) {
          console.warn(`[Crawler] Repository not found: ${owner}/${repo}`);
          return { status: 'not_found' };
        }
        throw new Error(`GitHub API error: ${response.statusText}`);
      }

      const data = await response.json();

      // 2. Process data and update database
      const slug = `${owner.toLowerCase()}-${repo.toLowerCase()}`;
      
      let readme = null;
      let finalDescription = data.description || '';
      try {
        const readmeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
          headers: {
            'Accept': 'application/vnd.github.v3.raw',
            ...(process.env.GITHUB_TOKEN && {
              'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
            }),
          },
        });
        if (readmeRes.status === 403 || readmeRes.status === 429) {
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
          throw new Error(`Rate limited by GitHub API during README fetch for ${owner}/${repo}`);
        }
        console.warn(`[Crawler] Failed to fetch README for ${owner}/${repo}`);
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

      // Insert snapshot
      const snapshotDate = new Date().toISOString().split('T')[0];
      await db.insert(projectSnapshots).values({
        projectId: project.id,
        stars: data.stargazers_count,
        forks: data.forks_count,
        openIssues: data.open_issues_count,
        watchers: data.subscribers_count, // GitHub API returns watchers as subscribers_count
        snapshotDate,
      });

      // Recalculate and update the next crawl schedule
      await updateProjectCrawlSchedule(project.id, 'github');

      console.log(`[Crawler] Successfully fetched & saved ${owner}/${repo}: ${data.stargazers_count} stars`);

      return { 
        status: 'success', 
        projectId: project.id,
        stars: data.stargazers_count,
        forks: data.forks_count 
      };

    } catch (error) {
      console.error(`[Crawler] Error processing ${owner}/${repo}:`, error);
      throw error; // Re-throw to trigger BullMQ retries
    }
  },
  {
    connection: redisConnection as unknown as Worker['opts']['connection'],
    concurrency: 2, 
    limiter: {
      // If GITHUB_TOKEN is present, allow up to 2000 requests per hour (since each project has ~2 requests, so 1000 projects/hr)
      // Otherwise, restrict to 30 requests per hour (15 projects/hr) to avoid getting blocked.
      max: process.env.GITHUB_TOKEN ? 2000 : 30,
      duration: 3600000,
    },
    stalledInterval: 15000,
    maxStalledCount: 2,
  }
);

crawlerWorker.on('completed', (job) => {
  console.log(`[Crawler] Job ${job.id} completed with result`, job.returnvalue);
});

crawlerWorker.on('failed', (job, err) => {
  console.error(`[Crawler] Job ${job?.id} failed with error`, err.message);
});

console.log('[Crawler] Worker started and waiting for jobs...');
