import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { db } from '../lib/db';
import { projects, projectSnapshots } from '../lib/db/schema';
import { sql } from 'drizzle-orm';
import { categorizeProject } from '../lib/categorizer';
import { updateProjectCrawlSchedule } from '../lib/crawlers/scheduler';
import { calculateProjectTrendInline } from './cron';
import { githubPool } from '../lib/crawlers/github-pool';
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
  console.error('[Crawler Worker] Redis connection error:', err.message);
});

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
      // Helper function to fetch from Github with Token Rotation, Proxy Rotation, and Smart Rate-Limit Waiting
      const fetchWithTokenRotation = async (url: string, isReadme = false) => {
        let maxRetries = 5; // Allow more retries to try multiple proxies/tokens
        while (maxRetries > 0) {
          let currentToken: string | null = null;
          let tokenExhaustedError = false;

          try {
            currentToken = githubPool.getAvailableToken();
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
            // No proxies configured, so we must sleep until the next token availability
            const nextTime = githubPool.getNextAvailableTime();
            const sleepMs = Math.max(5000, nextTime - Date.now() + 5000);
            const resetMinutes = Math.ceil(sleepMs / 60000);
            console.warn(`[Crawler] All tokens exhausted and no proxies configured. Sleeping for ${resetMinutes} minute(s) before retry...`);
            await setTimeout(sleepMs);
            continue; // retry
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
                githubPool.markTokenExhausted(currentToken, reset);
                console.warn(`[Crawler] 403/429 caught. Rotated token. Retries left: ${maxRetries - 1}`);
                maxRetries--;
                continue; // Retry with next token
              } else if (hasProxies) {
                // IP-based limit when using proxies
                console.warn(`[Crawler] 403/429 caught on proxy/direct connection. Rotating proxy. Retries left: ${maxRetries - 1}`);
                maxRetries--;
                await setTimeout(2000); // 2 seconds delay
                continue; // Retry with next random proxy
              } else {
                // No token and no proxies -> We hit IP rate limit on host. Must wait for reset.
                const sleepMs = reset 
                  ? Math.max(5000, (parseInt(reset) * 1000) - Date.now() + 5000)
                  : 60000; // Default to 60s sleep
                console.warn(`[Crawler] IP rate limited. No tokens or proxies available. Sleeping for ${Math.ceil(sleepMs / 1000)}s...`);
                await setTimeout(sleepMs);
                maxRetries--;
                continue;
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
        console.warn(`[Crawler] Project ${owner}/${repo} not found on GitHub. Marking as deleted/invalid.`);
        await updateProjectCrawlSchedule(job.data.projectId || owner+'/'+repo, 'github');
        return;
      }

      const data = result.data;

      // 2. Process data and update database
      const slug = `${owner.toLowerCase()}-${repo.toLowerCase()}`;
      
      let readme = null;
      let finalDescription = data.description || '';
      try {
        const readmeRes = await fetchWithTokenRotation(`https://api.github.com/repos/${owner}/${repo}/readme`, true);
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
      } catch (e) {
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

      // Insert snapshot (deduplicate: skip if same project+date already exists today)
      const snapshotDate = new Date().toISOString().split('T')[0];
      const existing = await db.select({ id: projectSnapshots.id })
        .from(projectSnapshots)
        .where(sql`${projectSnapshots.projectId} = ${project.id} AND ${projectSnapshots.snapshotDate} = ${snapshotDate}`)
        .limit(1);
      
      if (existing.length === 0) {
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

      // Calculate project trends inline immediately
      await calculateProjectTrendInline(project.id);

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
      // Scale limit based on available tokens. Each token gives ~5000 req/hr.
      // With Token Pool, multiply by number of tokens for fair throughput.
      max: (process.env.GITHUB_TOKENS || process.env.GITHUB_TOKEN) ? 2000 : 30,
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

// Global error handling for unhandled exceptions
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Crawler Worker] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[Crawler Worker] Uncaught Exception:', error);
});
