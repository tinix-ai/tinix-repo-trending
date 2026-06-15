import { setTimeout } from "timers/promises";
import { redisConnection } from "../../workers/queue";
import { githubPool } from "./github-pool";
import { proxyManager } from "./proxy";

interface DiscoveredRepo {
  owner: string;
  repo: string;
  stars: number;
}

/**
 * Discovers new AI/ML repositories using GitHub Search API.
 * Uses a cautious delay to respect the 30 req/min limit of the Search API.
 */
export async function discoverNewRepos(maxPages: number = 3): Promise<DiscoveredRepo[]> {
  const discovered: DiscoveredRepo[] = [];
  const checkpointKey = "crawler:checkpoint:github-discovery";
  
  // We look for AI/ML topics, with a reasonable star threshold to filter spam
  const query = encodeURIComponent("(topic:ai OR topic:machine-learning OR topic:llm OR topic:deep-learning) stars:>100");
  const sort = "updated"; // Get most recently active
  const order = "desc";
  
  let startPage = 1;
  try {
    const lastSavedPage = await redisConnection.get(checkpointKey);
    if (lastSavedPage) {
      startPage = parseInt(lastSavedPage) + 1;
      console.log(`[Discovery] Resuming GitHub Discovery from checkpoint. Start page: ${startPage}`);
    }
  } catch (err) {
    console.warn("[Discovery] Failed to read Redis checkpoint, starting from page 1.", err);
  }

  // If startPage has already exceeded maxPages, reset to page 1 to allow running a new session
  if (startPage > maxPages) {
    console.log(`[Discovery] Start page ${startPage} exceeds max pages ${maxPages}. Resetting checkpoint.`);
    startPage = 1;
    try {
      await redisConnection.del(checkpointKey);
    } catch {}
  }
  
  let completedAll = false;

  // Helper for Token Rotation (shared across all pages)
  const fetchWithTokenRotation = async (url: string) => {
    let maxRetries = 5;
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

      const hasProxies = (process.env.PROXY_URLS || '').split(',').map(p => p.trim()).filter(Boolean).length > 0;
      if (tokenExhaustedError && !hasProxies) {
        const nextTime = githubPool.getNextAvailableTime();
        const sleepMs = Math.max(5000, nextTime - Date.now() + 5000);
        const resetMinutes = Math.ceil(sleepMs / 60000);
        console.warn(`[Discovery] All tokens exhausted and no proxies configured. Sleeping for ${resetMinutes} minute(s) before retry...`);
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
            githubPool.markTokenExhausted(currentToken, reset);
            console.warn(`[Discovery] Rate limit hit. Rotated token. Retries left: ${maxRetries - 1}`);
            maxRetries--;
            continue;
          } else if (hasProxies) {
            console.warn(`[Discovery] 403/429 caught on proxy/direct connection. Rotating proxy. Retries left: ${maxRetries - 1}`);
            maxRetries--;
            await setTimeout(2000);
            continue;
          } else {
            const sleepMs = reset 
              ? Math.max(5000, (parseInt(reset) * 1000) - Date.now() + 5000)
              : 60000;
            console.warn(`[Discovery] IP rate limited. Sleeping for ${Math.ceil(sleepMs / 1000)}s...`);
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

  for (let page = startPage; page <= maxPages; page++) {
    console.log(`[Discovery] Fetching page ${page} of GitHub Search...`);
    
    try {
      const data = await fetchWithTokenRotation(
        `https://api.github.com/search/repositories?q=${query}&sort=${sort}&order=${order}&per_page=100&page=${page}`
      );
      const items = data.items || [];
      
      if (items.length === 0) {
        completedAll = true;
        break; // No more results
      }

      for (const item of items) {
        discovered.push({
          owner: item.owner.login,
          repo: item.name,
          stars: item.stargazers_count,
        });
      }

      // Save checkpoint page to Redis
      try {
        await redisConnection.set(checkpointKey, page);
      } catch (err) {
        console.warn(`[Discovery] Failed to save page ${page} checkpoint in Redis`, err);
      }

      if (page === maxPages) {
        completedAll = true;
      }

      // Safe delay (2.5 seconds) to avoid hitting 30 req/min rate limit (which is 1 req every 2s)
      if (page < maxPages) {
        await setTimeout(2500);
      }

    } catch (error) {
      console.error("[Discovery] Error during GitHub Search:", error);
      break; // Safe exit on error
    }
  }

  // Clear checkpoint only on complete success or when all results have been processed
  if (completedAll) {
    try {
      await redisConnection.del(checkpointKey);
      console.log("[Discovery] GitHub discovery completed successfully. Cleared Redis checkpoint.");
    } catch (err) {
      console.warn("[Discovery] Failed to clear Redis checkpoint", err);
    }
  } else {
    try {
      const currentVal = await redisConnection.get(checkpointKey);
      console.log(`[Discovery] GitHub discovery interrupted. Checkpoint preserved at page ${currentVal || "unknown"}.`);
    } catch {}
  }

  return discovered;
}
