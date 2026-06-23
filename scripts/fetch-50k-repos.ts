import 'dotenv/config';
import { db } from '../src/lib/db';
import { projects } from '../src/lib/db/schema';
import { githubPool } from '../src/lib/crawlers/github-pool';
import { proxyManager } from '../src/lib/crawlers/proxy';
import { eq } from 'drizzle-orm';
import { setTimeout } from 'timers/promises';
import crypto from 'crypto';

interface DiscoveredRepo {
  full_name: string;
  name: string;
  owner: {
    login: string;
  };
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
}

const LANGUAGES = [
  'TypeScript', 'JavaScript', 'Python', 'Go', 'Rust',
  'Java', 'C++', 'C', 'C#', 'Ruby',
  'PHP', 'Swift', 'Kotlin', 'Shell', 'HTML'
];

const STAR_RANGES = [
  '100..120', '121..150', '151..200', '201..300', '301..500',
  '501..800', '801..1200', '1201..2000', '2001..5000', '5001..15000',
  '>15000'
];

async function main() {
  const startTime = Date.now();
  console.log('[Seeder] Starting bulk GitHub repository discovery...');

  // 1. Load existing DB records to avoid duplicate inserts and slug collisions
  console.log('[Seeder] Loading existing repositories and slugs from database...');
  const existing = await db.select({ sourceId: projects.sourceId, slug: projects.slug }).from(projects).where(eq(projects.source, 'github'));
  const existingSet = new Set(existing.map(r => r.sourceId.toLowerCase()));
  const existingSlugsSet = new Set(existing.map(r => r.slug.toLowerCase()));
  const usedSlugsSet = new Set<string>();

  console.log(`[Seeder] Loaded ${existingSet.size} existing GitHub repos and ${existingSlugsSet.size} unique slugs.`);

  const newReposMap = new Map<string, typeof projects.$inferInsert>();

  // 2. Token rotated fetch helper
  const fetchWithTokenRotation = async (url: string) => {
    let maxRetries = 5;
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

      const hasProxies = (process.env.PROXY_URLS || '').split(',').map(p => p.trim()).filter(Boolean).length > 0;
      if (tokenExhaustedError && !hasProxies) {
        const nextTime = await githubPool.getNextAvailableTime();
        const sleepMs = Math.max(5000, nextTime - Date.now() + 5000);
        const resetMinutes = Math.ceil(sleepMs / 60000);
        console.warn(`[Seeder] All tokens exhausted. Sleeping for ${resetMinutes} minute(s)...`);
        await setTimeout(sleepMs);
        continue;
      }

      const headers: Record<string, string> = {
        "Accept": "application/vnd.github.v3+json",
      };
      if (currentToken) headers["Authorization"] = `Bearer ${currentToken}`;

      const dispatcher = proxyManager.getRandomDispatcher();
      const fetchOptions: RequestInit & { dispatcher?: unknown } = { headers };
      if (dispatcher) {
        fetchOptions.dispatcher = dispatcher;
      }

      const response = await fetch(url, fetchOptions);
      const reset = response.headers.get('x-ratelimit-reset');

      if (!response.ok) {
        if (response.status === 403 || response.status === 429) {
          if (currentToken) {
            await githubPool.markTokenExhausted(currentToken, reset);
            maxRetries--;
            continue;
          } else if (hasProxies) {
            console.warn(`[Seeder] 403/429 caught on proxy/direct connection. Rotating proxy. Retries left: ${maxRetries - 1}`);
            maxRetries--;
            await setTimeout(2000);
            continue;
          } else {
            const sleepMs = reset 
              ? Math.max(5000, (parseInt(reset) * 1000) - Date.now() + 5000)
              : 60000;
            console.warn(`[Seeder] IP rate limited. Sleeping for ${Math.ceil(sleepMs / 1000)}s...`);
            await setTimeout(sleepMs);
            maxRetries--;
            continue;
          }
        }
        throw new Error(`GitHub API Error: ${response.status} ${response.statusText}`);
      }
      return await response.json();
    }
    throw new Error('Failed to fetch after max retries due to rate limiting.');
  };

  // 3. Execution loop over languages & star ranges
  const totalQueries = LANGUAGES.length * STAR_RANGES.length;
  let currentQueryIndex = 0;

  console.log(`[Seeder] Running ${totalQueries} query segments to discover repos...`);

  for (const lang of LANGUAGES) {
    for (const range of STAR_RANGES) {
      currentQueryIndex++;
      const pct = ((currentQueryIndex / totalQueries) * 100).toFixed(1);
      console.log(`[Seeder] [${pct}%] Querying language:${lang} stars:${range} (${currentQueryIndex}/${totalQueries})...`);

      const query = encodeURIComponent(`language:${lang} stars:${range}`);
      const maxPages = 5; // 5 pages * 100 per_page = 500 repos per segment

      for (let page = 1; page <= maxPages; page++) {
        try {
          const url = `https://api.github.com/search/repositories?q=${query}&sort=stars&order=desc&per_page=100&page=${page}`;
          const data = await fetchWithTokenRotation(url);
          const items = (data.items || []) as DiscoveredRepo[];

          if (items.length === 0) {
            break; // No more results in this slice
          }

          let addedInPage = 0;
          for (const item of items) {
            const fullName = item.full_name;
            const sourceId = fullName.toLowerCase();

            if (existingSet.has(sourceId) || newReposMap.has(sourceId)) {
              continue; // Skip existing or already discovered in this session
            }

            const owner = item.owner.login;
            const repoName = item.name;
            const projectId = crypto.randomUUID();
            
            // Generate base slug
            const baseSlug = `${owner.toLowerCase()}-${repoName.toLowerCase()}`.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
            
            // Check for slug collisions and resolve
            let finalSlug = baseSlug;
            let counter = 1;
            while (existingSlugsSet.has(finalSlug) || usedSlugsSet.has(finalSlug)) {
              finalSlug = `${baseSlug}-${counter}`;
              counter++;
            }
            usedSlugsSet.add(finalSlug);

            // Spread nextCrawlAt randomly over the next 30 days
            const randomDays = Math.random() * 30;
            const nextCrawlAt = new Date(Date.now() + randomDays * 24 * 60 * 60 * 1000);

            newReposMap.set(sourceId, {
              id: projectId,
              source: 'github',
              projectType: 'repository',
              sourceId: fullName,
              slug: finalSlug,
              name: repoName,
              fullName,
              description: item.description ? item.description.substring(0, 1000) : null,
              sourceUrl: item.html_url,
              primaryLanguage: item.language,
              ownerName: owner,
              ownerAvatarUrl: null, // will be updated during crawl
              ownerType: null,
              topics: [],
              categories: [],
              extraMetadata: {},
              createdAt: new Date(),
              updatedAt: new Date(),
              crawlInterval: 30, // default cold interval
              nextCrawlAt,
            });
            addedInPage++;
          }

          console.log(`[Seeder]   Page ${page}: Discovered ${items.length} repos (${addedInPage} new). Total new discovered: ${newReposMap.size}`);

          if (items.length < 100) {
            break; // Last page reached
          }

          // Search API rate limit is 30 req/min (1 request every 2s).
          // We wait 2 seconds between pages to stay safe.
          await setTimeout(2000);

        } catch (error) {
          console.error(`[Seeder]   Error fetching page ${page}:`, error);
          await setTimeout(5000); // Wait longer on error before next query segment
          break;
        }
      }
    }
  }

  // 4. Bulk Insert into Database
  const newRepos = Array.from(newReposMap.values());
  console.log(`[Seeder] Completed discovery phase. Discovered ${newRepos.length} new unique repos.`);

  if (newRepos.length === 0) {
    console.log('[Seeder] No new repositories found to seed. Exiting.');
    process.exit(0);
  }

  console.log('[Seeder] Bulk inserting discovered repositories into database...');
  const CHUNK_SIZE = 500;
  let inserted = 0;

  for (let i = 0; i < newRepos.length; i += CHUNK_SIZE) {
    const chunk = newRepos.slice(i, i + CHUNK_SIZE);
    try {
      await db.insert(projects).values(chunk).onConflictDoNothing();
      inserted += chunk.length;
      if (inserted % 2500 === 0 || inserted === newRepos.length) {
        console.log(`[Seeder] Progress: Inserted ${inserted}/${newRepos.length} repos...`);
      }
    } catch (dbErr) {
      console.error(`[Seeder] Failed to insert chunk starting at index ${i}:`, dbErr);
    }
  }

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
  console.log(`[Seeder] Bulk seeding completed! Successfully processed ${inserted} repositories in ${duration} minutes.`);
  process.exit(0);
}

main();
