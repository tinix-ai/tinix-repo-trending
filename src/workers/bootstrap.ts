import 'dotenv/config';
import { crawlerQueue } from './queue';
import { setTimeout } from 'timers/promises';

const BASE_QUERY = "ai OR \"machine learning\" OR llm";

// Generate fine-grained slices to ensure we don't hit the 1000 items per query limit
const STAR_SLICES: string[] = [
  "stars:>50000",
  "stars:20000..50000",
  "stars:10000..20000",
  "stars:8000..10000",
  "stars:6000..8000",
  "stars:4000..6000",
  "stars:3000..4000",
  "stars:2000..3000",
  "stars:1500..2000",
  "stars:1000..1500"
];

for (let i = 900; i >= 100; i -= 100) {
  STAR_SLICES.push(`stars:${i}..${i + 100}`);
}
for (let i = 90; i >= 10; i -= 10) {
  STAR_SLICES.push(`stars:${i}..${i + 10}`);
}
for (let i = 8; i >= 0; i -= 2) {
  STAR_SLICES.push(`stars:${i}..${i + 2}`);
}

async function runBootstrap() {
  console.log('[Bootstrap] Starting 100,000 repo mass crawl initialization...');
  let totalQueued = 0;

  for (const slice of STAR_SLICES) {
    console.log(`\n[Bootstrap] Fetching slice: ${slice}`);
    const query = encodeURIComponent(`${BASE_QUERY} ${slice}`);
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 10) { // GitHub API max is 10 pages of 100 items
      try {
        const response = await fetch(
          `https://api.github.com/search/repositories?q=${query}&sort=stars&order=desc&per_page=100&page=${page}`,
          {
            headers: {
              "Accept": "application/vnd.github.v3+json",
              ...(process.env.GITHUB_TOKEN && {
                "Authorization": `Bearer ${process.env.GITHUB_TOKEN}`,
              }),
            },
          }
        );

        if (!response.ok) {
          if (response.status === 403 || response.status === 429) {
            console.log(`[Bootstrap] Rate limited! Sleeping for 60 seconds...`);
            await setTimeout(60000); // Sleep for 1 minute on rate limit
            continue; // Retry the same page
          }
          throw new Error(`GitHub Search API error: ${response.statusText}`);
        }

        const data = await response.json();
        const items = data.items || [];
        
        if (items.length === 0) {
          hasMore = false;
          break;
        }

        let sliceQueued = 0;
        for (const item of items) {
          await crawlerQueue.add('crawl-repo', {
            owner: item.owner.login,
            repo: item.name,
          }, {
            jobId: `bootstrap-${item.owner.login}-${item.name}`,
          });
          sliceQueued++;
          totalQueued++;
        }

        console.log(`[Bootstrap] Slice ${slice} Page ${page}: Queued ${sliceQueued} repos.`);
        
        if (items.length < 100) {
          hasMore = false; // Last page reached
        } else {
          page++;
        }

        // Delay to avoid secondary rate limits (30 req / min) -> 1 req every 2.5s
        await setTimeout(2500);

      } catch (error) {
        console.error("[Bootstrap] Error fetching page:", error);
        hasMore = false;
      }
    }
    
    console.log(`[Bootstrap] Total queued so far: ${totalQueued}`);
    if (totalQueued >= 100000) {
      console.log(`[Bootstrap] Reached 100,000 threshold! Stopping.`);
      break;
    }
  }

  console.log(`\n[Bootstrap] Mass crawl initialization completed!`);
  console.log(`[Bootstrap] Successfully queued ${totalQueued} jobs into BullMQ.`);
  console.log(`[Bootstrap] Please run 'npm run worker' to process them over the next few hours.`);
  process.exit(0);
}

runBootstrap();
