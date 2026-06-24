import { setTimeout } from "timers/promises";
import { proxyManager } from "./proxy";

export interface DiscoveredRepo {
  owner: string;
  repo: string;
  stars: number;
}

/**
 * Fetches the HTML content of a page using the Proxy Pool.
 */
async function fetchHtmlWithProxy(url: string): Promise<string> {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache"
  };

  const dispatcher = proxyManager.getRandomDispatcher();
  const fetchOptions: RequestInit & { dispatcher?: unknown } = { headers };
  if (dispatcher) {
    fetchOptions.dispatcher = dispatcher;
  }

  const response = await fetch(url, fetchOptions);
  if (!response.ok) {
    throw new Error(`Failed to fetch HTML from ${url}: ${response.status} ${response.statusText}`);
  }
  return await response.text();
}

/**
 * Fetches HTML with a retry loop and exponential backoff.
 */
async function fetchHtmlWithRetry(url: string, retries = 3): Promise<string> {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fetchHtmlWithProxy(url);
    } catch (err) {
      attempt++;
      console.warn(`[GitHub Trending Scraper] Attempt ${attempt} failed for ${url}:`, err);
      if (attempt >= retries) throw err;
      await setTimeout(2000 * attempt); // Exponential backoff
    }
  }
  throw new Error(`Failed to fetch HTML from ${url} after ${retries} attempts`);
}

/**
 * Extracts owner and repo from GitHub Trending HTML.
 */
function parseTrendingHtml(html: string): DiscoveredRepo[] {
  const repos: DiscoveredRepo[] = [];
  
  // Regex matches <h2 class="...">...</h2> and captures classes and content inside
  const h2Regex = /<h2\s+class="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/gi;
  let match;
  
  while ((match = h2Regex.exec(html)) !== null) {
    const classAttr = match[1];
    const content = match[2];
    
    // Support class order: both "h3" and "lh-condensed" should be present
    if (classAttr.includes("h3") && classAttr.includes("lh-condensed")) {
      // Extract the first href link under this h2
      const hrefMatch = /href="\/([a-zA-Z0-9-._]+)\/([a-zA-Z0-9-._]+)"/i.exec(content);
      if (hrefMatch) {
        const owner = hrefMatch[1];
        const repo = hrefMatch[2];
        
        // Exclude reserved/common top-level path pages on GitHub
        const reservedKeywords = ["trending", "features", "explore", "topics", "collections", "events", "sponsors"];
        if (reservedKeywords.includes(owner.toLowerCase())) {
          continue;
        }

        repos.push({
          owner,
          repo,
          stars: 0 // Placeholder: actual details will be crawled by crawler worker
        });
      }
    }
  }
  return repos;
}

/**
 * Discovers trending repositories by scraping the official HTML GitHub Trending pages.
 * Supports multiple programming languages.
 */
export async function discoverGithubTrendingRepos(): Promise<DiscoveredRepo[]> {
  console.log("[GitHub Trending Scraper] Starting HTML scraping from GitHub Trending...");
  const languages = ["", "typescript", "javascript", "rust", "go", "python"];
  const discoveredMap = new Map<string, DiscoveredRepo>();

  for (const lang of languages) {
    const langLabel = lang || "all languages";
    const url = lang ? `https://github.com/trending/${lang}` : "https://github.com/trending";
    console.log(`[GitHub Trending Scraper] Fetching trending repositories for ${langLabel}...`);

    try {
      const html = await fetchHtmlWithRetry(url);
      const items = parseTrendingHtml(html);
      console.log(`[GitHub Trending Scraper] Discovered ${items.length} repositories for ${langLabel}`);
      
      for (const item of items) {
        const key = `${item.owner.toLowerCase()}/${item.repo.toLowerCase()}`;
        // Preserve case of the first discovery
        if (!discoveredMap.has(key)) {
          discoveredMap.set(key, item);
        }
      }

      // Add a politeness delay to avoid hitting rate limits or blocking
      await setTimeout(2000);
    } catch (err) {
      console.error(`[GitHub Trending Scraper] Error crawling trending for ${langLabel}:`, err);
    }
  }

  const results = Array.from(discoveredMap.values());
  console.log(`[GitHub Trending Scraper] Finished trending HTML discovery. Total unique repositories: ${results.length}`);
  return results;
}
