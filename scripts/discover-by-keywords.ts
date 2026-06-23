import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../src/lib/db';
import { projects } from '../src/lib/db/schema';
import { crawlerQueue } from '../src/workers/queue';
import { githubPool } from '../src/lib/crawlers/github-pool';
import { proxyManager } from '../src/lib/crawlers/proxy';
import { setTimeout } from 'timers/promises';
import { eq } from 'drizzle-orm';

const KEYWORDS_FILE = path.join(process.cwd(), 'data', 'top-1000-keywords.json');

// Stopwords/metadata prefix and generic tags to ignore for GitHub discovery
const IGNORED_KEYWORDS = new Set([
  'en', 'zh', 'de', 'ja', 'fr', 'es', 'ru', 'it', 'ko', 'pt', 'vi', 'tr', 'pl', 'nl', 'ar',
  'custom_code', 'hacktoberfest', 'modality', 'modality:text',
  'language:en', 'library:polars', 'library:datasets', 'library:mlcroissant',
  'region:us', 'deploy:azure'
]);

function isLangCode(str: string): boolean {
  return /^[a-z]{2}$/.test(str);
}

function isIgnored(topic: string): boolean {
  const lower = topic.toLowerCase();
  if (IGNORED_KEYWORDS.has(lower)) return true;
  if (isLangCode(lower)) return true;
  if (lower.startsWith('license:')) return true;
  if (lower.startsWith('region:')) return true;
  if (lower.startsWith('library:')) return true;
  if (lower.startsWith('modality:')) return true;
  if (lower.startsWith('language:')) return true;
  if (lower.startsWith('deploy:')) return true;
  if (lower.startsWith('format:')) return true;
  if (lower.startsWith('size_categories:')) return true;
  if (lower.startsWith('arxiv:')) return true;
  if (lower.startsWith('base_model:')) return true;
  if (lower.startsWith('task_categories:')) return true;
  if (lower.startsWith('dataset:')) return true;
  if (lower.startsWith('annotations_creators:')) return true;
  if (lower.startsWith('template:')) return true;
  if (lower.startsWith('diffusers:')) return true;
  if (lower.startsWith('language_creators:')) return true;
  if (lower.startsWith('source_datasets:')) return true;
  if (lower.startsWith('multilinguality:')) return true;
  if (lower.startsWith('pplx:')) return true;
  if (lower.startsWith('has_space:')) return true;
  if (lower.length <= 1) return true;
  return false;
}

// Fetch helper using rotating tokens
async function fetchWithTokenRotation(url: string) {
  let maxRetries = 3;
  while (maxRetries > 0) {
    let currentToken: string | null = null;
    let tokenExhaustedError = false;

    try {
      currentToken = await githubPool.getAvailableToken();
    } catch (err: any) {
      if (err.message.includes('ALL tokens are currently exhausted')) {
        tokenExhaustedError = true;
      } else {
        throw err;
      }
    }

    const hasProxies = (process.env.PROXY_URLS || '').split(',').map(p => p.trim()).filter(Boolean).length > 0;
    if (tokenExhaustedError && !hasProxies) {
      const nextTime = await githubPool.getNextAvailableTime();
      const sleepMs = Math.max(5000, nextTime - Date.now() + 5000);
      console.log(`[Discovery] Rotating tokens exhausted. Sleeping for ${Math.ceil(sleepMs / 1000)}s...`);
      await setTimeout(sleepMs);
      continue;
    }

    const headers: Record<string, string> = {
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "TinixTrendingCrawler/1.0"
    };
    if (currentToken) {
      headers["Authorization"] = `Bearer ${currentToken}`;
    }

    const dispatcher = proxyManager.getRandomDispatcher();
    const fetchOptions: RequestInit & { dispatcher?: unknown } = { headers };
    if (dispatcher) {
      fetchOptions.dispatcher = dispatcher;
    }

    const response = await fetch(url, fetchOptions);
    const reset = response.headers.get('x-ratelimit-reset');

    if (!response.ok) {
      if (response.status === 403 || response.status === 429) {
        console.warn(`[Discovery] Search rate limit hit for token. Retrying in 10s with next rotated token...`);
        await setTimeout(10000);
        maxRetries--;
        continue;
      }
      throw new Error(`GitHub API Error: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  }
  throw new Error('Failed to fetch after rotating token retries.');
}

async function main() {
  console.log('[Discovery] Starting GitHub Discovery based on top keywords...');
  
  if (!fs.existsSync(KEYWORDS_FILE)) {
    console.error(`[Discovery] Keywords list not found at: ${KEYWORDS_FILE}. Please run extract-top-topics.ts first.`);
    process.exit(1);
  }

  try {
    const rawData = fs.readFileSync(KEYWORDS_FILE, 'utf-8');
    const allKeywords = JSON.parse(rawData) as Array<{ topic: string; count: number }>;
    
    // Filter out metadata and generic topics
    const cleanKeywords = allKeywords
      .map(k => k.topic)
      .filter(k => !isIgnored(k));
    
    console.log(`[Discovery] Loaded ${allKeywords.length} keywords. Cleaned down to ${cleanKeywords.length} valid topics.`);
    
    // Limit to top N keywords for this discovery cycle to avoid API exhaustion (configurable, defaults to 300)
    const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
    const limit = limitArg 
      ? parseInt(limitArg.split('=')[1], 10) 
      : (process.env.DISCOVERY_LIMIT ? parseInt(process.env.DISCOVERY_LIMIT, 10) : 300);

    const keywordsToSearch = cleanKeywords.slice(0, limit);
    console.log(`[Discovery] Running search on top ${keywordsToSearch.length} cleaned keywords:`, keywordsToSearch);

    // Fetch existing projects to check duplicates
    console.log('[Discovery] Fetching existing projects from DB...');
    const allDbProjects = await db.select({
      id: projects.id,
      sourceId: projects.sourceId,
    }).from(projects).where(eq(projects.source, 'github'));
    
    const existingGHMap = new Set(allDbProjects.map(p => p.sourceId.toLowerCase()));
    console.log(`[Discovery] Found ${existingGHMap.size} existing GitHub projects in DB.`);

    const newlyDiscovered = new Map<string, { owner: string; name: string }>();
    
    for (let i = 0; i < keywordsToSearch.length; i++) {
      const topic = keywordsToSearch[i];
      console.log(`[Discovery] [${i + 1}/${keywordsToSearch.length}] Searching topic: "${topic}"...`);
      
      try {
        const query = encodeURIComponent(`topic:${topic} stars:>100`);
        const url = `https://api.github.com/search/repositories?q=${query}&sort=stars&order=desc&per_page=50&page=1`;
        
        const data = await fetchWithTokenRotation(url);
        const items = data.items || [];
        
        console.log(`  -> Found ${items.length} popular repos for topic: "${topic}"`);
        
        for (const item of items) {
          const owner = item.owner.login;
          const name = item.name;
          const fullName = `${owner}/${name}`;
          const lowerName = fullName.toLowerCase();
          
          if (!existingGHMap.has(lowerName)) {
            newlyDiscovered.set(lowerName, { owner, name });
          }
        }
        
        // Wait 2.5 seconds to respect the GitHub search rate limit
        await setTimeout(2500);
        
      } catch (err: any) {
        console.error(`  [Discovery] Error searching for topic "${topic}":`, err.message);
        // Wait 5 seconds before next topic to let rate limits cool down
        await setTimeout(5000);
      }
    }
    
    console.log(`\n[Discovery] Total unique new repositories discovered: ${newlyDiscovered.size}`);
    
    if (newlyDiscovered.size > 0) {
      console.log('[Discovery] Enqueuing new repositories to crawlerQueue...');
      const list = Array.from(newlyDiscovered.values());
      
      // Limit enqueuing to first 300 to avoid queue flooding in a single discovery cycle
      const listToEnqueue = list.slice(0, 300);
      
      for (const repo of listToEnqueue) {
        await crawlerQueue.add('crawl-repo', {
          owner: repo.owner,
          repo: repo.name,
        }, {
          jobId: `discovery-kw-${repo.owner.toLowerCase()}-${repo.name.toLowerCase()}-${Date.now()}`
        });
        console.log(`  + Enqueued: ${repo.owner}/${repo.name}`);
      }
      
      console.log(`[Discovery] Enqueued ${listToEnqueue.length} repositories successfully!`);
      if (list.length > 300) {
        console.log(`[Discovery] Note: ${list.length - 300} remaining discovered repos were skipped to avoid overloading.`);
      }
    } else {
      console.log('[Discovery] All discovered repositories are already present in our database.');
    }
    
  } catch (error: any) {
    console.error('[Discovery] Global error in discover-by-keywords script:', error.message);
  } finally {
    process.exit(0);
  }
}

main();
