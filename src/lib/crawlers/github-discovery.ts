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
 * Tracks checkpoint in Redis via { topicIndex, page } to support multi-process resume.
 */
export async function discoverNewRepos(maxPages: number = 10): Promise<DiscoveredRepo[]> {
  const checkpointKey = "crawler:checkpoint:github-discovery";
  const sort = "updated"; // Get most recently active
  const order = "desc";
  
  const topics = [
    // Existing AI/ML topics
    'ai', 'machine-learning', 'llm', 'deep-learning',
    // Vibe Coding & AI Coding Tools
    'vibe-coding', 'cursor-rules', 'mcp', 'mcp-server', 'ai-agent', 'ai-coding', 'copilot',
    // Speech & Audio
    'text-to-speech', 'speech-to-text', 'tts', 'asr', 'whisper', 'voice-clone',
    // Data & Databases
    'data-science', 'database', 'vector-database', 'data-engineering', 'data-analysis', 'analytics', 'vector-search',
    // Developer Tools & Utilities
    'developer-tools', 'self-hosted', 'productivity',
    // General Tech, Web, Languages & Infrastructure (Expanded for 50k scaling)
    'react', 'vue', 'nextjs', 'typescript', 'nodejs', 'deno', 'bun',
    'rust', 'go', 'webassembly', 'docker', 'kubernetes', 'terraform',
    'redis', 'postgresql', 'sqlite', 'security', 'linux'
  ];

  let startTopicIndex = 0;
  let startPage = 1;
  
  try {
    const lastSavedCheckpoint = await redisConnection.get(checkpointKey);
    if (lastSavedCheckpoint) {
      const parsed = JSON.parse(lastSavedCheckpoint);
      const savedTopic = parsed.topic;
      const savedTopicIndex = savedTopic ? topics.indexOf(savedTopic) : parsed.topicIndex;
      
      if (savedTopicIndex !== -1 && savedTopicIndex !== undefined) {
        startTopicIndex = savedTopicIndex;
        startPage = (parsed.page || 0) + 1; // Resume from the next page
        console.log(`[Discovery] Resuming GitHub Discovery from checkpoint. TopicIndex: ${startTopicIndex} (${topics[startTopicIndex]}), Start page: ${startPage}`);
      } else {
        console.log(`[Discovery] Saved checkpoint topic "${savedTopic || parsed.topicIndex}" not found in current topics. Starting from beginning.`);
      }
    }
  } catch (err) {
    console.warn("[Discovery] Failed to read Redis checkpoint, starting from beginning.", err);
  }

  // If startPage has already exceeded maxPages, or topicIndex is out of bounds, reset checkpoint
  if (startTopicIndex >= topics.length || startPage > maxPages) {
    console.log(`[Discovery] Checkpoint state exceeds max bounds (Topic: ${startTopicIndex}/${topics.length}, Page: ${startPage}/${maxPages}). Resetting.`);
    startTopicIndex = 0;
    startPage = 1;
    try {
      await redisConnection.del(checkpointKey);
    } catch {}
  }

  const discoveredMap = new Map<string, DiscoveredRepo>();
  let completedAll = true;

  // Helper for Token Rotation (shared across all pages)
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
            await githubPool.markTokenExhausted(currentToken, reset);
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

  for (let t = startTopicIndex; t < topics.length; t++) {
    const topic = topics[t];
    let completedTopic = false;
    
    // Determine page to start for this specific topic
    const pageStart = (t === startTopicIndex) ? startPage : 1;

    for (let page = pageStart; page <= maxPages; page++) {
      console.log(`[Discovery] Fetching page ${page} of GitHub Search for topic:${topic}...`);
      
      try {
        const query = encodeURIComponent(`topic:${topic} stars:>100`);
        const data = await fetchWithTokenRotation(
          `https://api.github.com/search/repositories?q=${query}&sort=${sort}&order=${order}&per_page=100&page=${page}`
        );
        const items = data.items || [];
        
        if (items.length === 0) {
          completedTopic = true;
          break; // No more results for this topic
        }

        for (const item of items) {
          const key = `${item.owner.login}/${item.name}`;
          discoveredMap.set(key, {
            owner: item.owner.login,
            repo: item.name,
            stars: item.stargazers_count,
          });
        }

        // Save checkpoint page, topicIndex and topic to Redis
        try {
          await redisConnection.set(checkpointKey, JSON.stringify({ topicIndex: t, topic, page }));
        } catch (err) {
          console.warn(`[Discovery] Failed to save checkpoint {topicIndex:${t}, topic:${topic}, page:${page}} in Redis`, err);
        }

        if (page === maxPages) {
          completedTopic = true;
        }

        // Safe delay (2.5 seconds) to avoid hitting 30 req/min rate limit (which is 1 req every 2s)
        if (page < maxPages) {
          await setTimeout(2500);
        }

      } catch (error) {
        console.error(`[Discovery] Error during GitHub Search for topic:${topic} page:${page}:`, error);
        break; // Safe exit on error for this topic
      }
    }
    if (!completedTopic) {
      completedAll = false;
      break; // Stop loop and preserve checkpoint
    }
  }

  // Clear checkpoint only on complete success
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
      console.log(`[Discovery] GitHub discovery interrupted. Checkpoint preserved: ${currentVal || "unknown"}.`);
    } catch {}
  }

  return Array.from(discoveredMap.values());
}
