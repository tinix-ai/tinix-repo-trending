import { setTimeout } from "timers/promises";
import { redisConnection } from "../../workers/queue";
import { searchGitHubRepos } from "./github-graphql";
import { db } from "../db";
import { sql } from "drizzle-orm";

interface DiscoveredRepo {
  owner: string;
  repo: string;
  stars: number;
}

/**
 * Fetches popular topics from database and applies a generic term filter.
 */
async function getPopularDatabaseTopics(limit = 30): Promise<string[]> {
  try {
    const rawResult = await db.execute(sql`
      SELECT LOWER(key::text) as topic, COUNT(*) as count 
      FROM projects, jsonb_array_elements_text(topics) as key 
      WHERE source = 'github'
      GROUP BY topic 
      ORDER BY count DESC 
      LIMIT 100
    `) as unknown as { topic: string; count: number }[];

    const blacklist = new Set([
      // Languages
      'javascript', 'typescript', 'python', 'html', 'css', 'rust', 'go', 'golang', 'cpp',
      'c', 'csharp', 'java', 'swift', 'kotlin', 'php', 'ruby', 'objective-c', 'objc',
      'clojure', 'elixir', 'erlang', 'haskell', 'scala', 'perl', 'assembly',
      // Frameworks / Web
      'react', 'vue', 'nextjs', 'angular', 'nodejs', 'laravel', 'django', 'flask',
      // Platforms / OS
      'android', 'ios', 'macos', 'windows', 'linux',
      // Generic terms
      'open-source', 'opensource', 'hacktoberfest', 'awesome', 'git', 'github', 'dev'
    ]);

    const topics: string[] = [];
    for (const row of rawResult) {
      const topic = row.topic.replace(/"/g, '').trim();
      if (topic && !blacklist.has(topic) && topic.length > 2) {
        topics.push(topic);
        if (topics.length >= limit) break;
      }
    }
    return topics;
  } catch (err) {
    console.warn('[Discovery] Failed to fetch popular database topics:', err);
    return [];
  }
}

/**
 * Discovers new AI/ML/Tech repositories using GitHub GraphQL Search API.
 * Uses a hybrid approach:
 * 1. For Low Stars (50..200): Queries using specific topics to target relevant tech/AI projects.
 * 2. For High Stars (>=200): Performs global, keyword-free searches partitioned by star ranges to scan everything.
 * Tracks checkpoint in Redis to support process resume.
 */
export async function discoverNewRepos(maxPages: number = 10): Promise<DiscoveredRepo[]> {
  const checkpointKey = "crawler:checkpoint:github-discovery";

  const staticTopics = [
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
    // General Tech, Web, Languages & Infrastructure
    'react', 'vue', 'nextjs', 'typescript', 'nodejs', 'deno', 'bun',
    'rust', 'go', 'webassembly', 'docker', 'kubernetes', 'terraform',
    'redis', 'postgresql', 'sqlite', 'security', 'linux',
    // Newly added static keywords from missing trending repos
    'tui', 'terminal', 'markdown-editor', 'mesh-network', 'edge-computing',
    'mental-health', 'whatsapp-crm', 'crm-system', 'ide-integration',
    'model-serving', 'inference-engine', 'git-client', 'nlp', 'sandboxing',
    'note-taking', 'knowledge-base', 'llm-agent'
  ];

  const dbTopics = await getPopularDatabaseTopics(30);
  const topics = Array.from(new Set([...staticTopics, ...dbTopics]));

  // Define global high-star ranges (no topic limits)
  const highStarRanges = [
    { min: 200, max: 500 },
    { min: 501, max: 1500 },
    { min: 1501, max: 5000 },
    { min: 5001, max: 20000 },
    { min: 20001, max: 10000000 }
  ];

  // Default checkpoint state
  let phase: "low-stars" | "high-stars" = "low-stars";
  let topicIndex = 0;
  let rangeIndex = 0;
  let page = 1;
  let cursor: string | null = null;

  try {
    const lastSavedCheckpoint = await redisConnection.get(checkpointKey);
    if (lastSavedCheckpoint) {
      const parsed = JSON.parse(lastSavedCheckpoint);
      phase = parsed.phase || "low-stars";
      topicIndex = parsed.topicIndex || 0;
      rangeIndex = parsed.rangeIndex || 0;
      page = (parsed.page || 0) + 1;
      cursor = parsed.endCursor || null;
      console.log(`[Discovery] Resuming GitHub Discovery. Phase: ${phase}, TopicIndex: ${topicIndex}, RangeIndex: ${rangeIndex}, Page: ${page}`);
    }
  } catch (err) {
    console.warn("[Discovery] Failed to read Redis checkpoint, starting from beginning.", err);
  }

  const discoveredMap = new Map<string, DiscoveredRepo>();
  let completedAll = true;

  // --- PHASE 1: LOW STARS (50..200) WITH TOPICS ---
  if (phase === "low-stars") {
    for (let t = topicIndex; t < topics.length; t++) {
      const topic = topics[t];
      let completedTopic = false;
      const pageStart = (t === topicIndex) ? page : 1;
      let topicCursor = (t === topicIndex) ? cursor : null;

      // Fetch up to maxPages per topic inside the 50..200 range
      const topicMaxPages = maxPages;

      for (let p = pageStart; p <= topicMaxPages; p++) {
        console.log(`[Discovery] Low Stars (50..200) - Topic: ${topic} (${t + 1}/${topics.length}), Page: ${p}/${topicMaxPages} using cursor: ${topicCursor || 'null'}...`);

        try {
          const query = `("${topic}" in:name,description OR topic:${topic}) stars:50..200 sort:updated-desc`;
          const data = await searchGitHubRepos(query, 100, topicCursor);
          const items = data.nodes || [];

          if (items.length === 0) {
            completedTopic = true;
            break;
          }

          for (const item of items) {
            const key = `${item.owner}/${item.name}`;
            discoveredMap.set(key, {
              owner: item.owner,
              repo: item.name,
              stars: item.stars,
            });
          }

          topicCursor = data.endCursor;
          const hasNextPage = data.hasNextPage;

          // Save checkpoint
          try {
            await redisConnection.set(checkpointKey, JSON.stringify({
              phase: "low-stars",
              topicIndex: t,
              page: p,
              endCursor: topicCursor
            }));
          } catch (err) {
            console.warn(`[Discovery] Failed to save checkpoint in Redis`, err);
          }

          if (!hasNextPage || p === topicMaxPages) {
            completedTopic = true;
            break;
          }

          await setTimeout(2500);
        } catch (error: unknown) {
          const err = error instanceof Error ? error : new Error(String(error));
          if (err.message?.includes('[RateLimitError]')) {
            console.warn(`[Discovery] GitHub API rate limit reached. Stopping and saving checkpoint.`);
          } else {
            console.error(`[Discovery] Error during Low Stars search (topic:${topic}, page:${p}):`, error);
          }
          completedAll = false;
          break;
        }
      }

      if (!completedTopic) {
        completedAll = false;
        break;
      }

      // Prepare next topic checkpoint
      if (t + 1 < topics.length) {
        page = 1;
        cursor = null;
        try {
          await redisConnection.set(checkpointKey, JSON.stringify({
            phase: "low-stars",
            topicIndex: t + 1,
            page: 0,
            endCursor: null
          }));
        } catch {}
      } else {
        // Transition to Phase 2: High Stars
        phase = "high-stars";
        rangeIndex = 0;
        page = 1;
        cursor = null;
        try {
          await redisConnection.set(checkpointKey, JSON.stringify({
            phase: "high-stars",
            rangeIndex: 0,
            page: 0,
            endCursor: null
          }));
        } catch {}
      }
    }
  }

  // --- PHASE 2: HIGH STARS (>=200) GLOBAL RANGES ---
  if (completedAll && phase === "high-stars") {
    for (let r = rangeIndex; r < highStarRanges.length; r++) {
      const range = highStarRanges[r];
      let completedRange = false;
      const pageStart = (r === rangeIndex) ? page : 1;
      let rangeCursor = (r === rangeIndex) ? cursor : null;

      for (let p = pageStart; p <= maxPages; p++) {
        console.log(`[Discovery] High Stars (${range.min}..${range.max}) - Range: ${r + 1}/${highStarRanges.length}, Page: ${p}/${maxPages} using cursor: ${rangeCursor || 'null'}...`);

        try {
          const query = `stars:${range.min}..${range.max} sort:updated-desc`;
          const data = await searchGitHubRepos(query, 100, rangeCursor);
          const items = data.nodes || [];

          if (items.length === 0) {
            completedRange = true;
            break;
          }

          for (const item of items) {
            const key = `${item.owner}/${item.name}`;
            discoveredMap.set(key, {
              owner: item.owner,
              repo: item.name,
              stars: item.stars,
            });
          }

          rangeCursor = data.endCursor;
          const hasNextPage = data.hasNextPage;

          // Save checkpoint
          try {
            await redisConnection.set(checkpointKey, JSON.stringify({
              phase: "high-stars",
              rangeIndex: r,
              page: p,
              endCursor: rangeCursor
            }));
          } catch (err) {
            console.warn(`[Discovery] Failed to save checkpoint in Redis`, err);
          }

          if (!hasNextPage || p === maxPages) {
            completedRange = true;
            break;
          }

          await setTimeout(2500);
        } catch (error: unknown) {
          const err = error instanceof Error ? error : new Error(String(error));
          if (err.message?.includes('[RateLimitError]')) {
            console.warn(`[Discovery] GitHub API rate limit reached. Stopping and saving checkpoint.`);
          } else {
            console.error(`[Discovery] Error during High Stars search (${range.min}..${range.max}, page:${p}):`, error);
          }
          completedAll = false;
          break;
        }
      }

      if (!completedRange) {
        completedAll = false;
        break;
      }

      if (r + 1 < highStarRanges.length) {
        page = 1;
        cursor = null;
        try {
          await redisConnection.set(checkpointKey, JSON.stringify({
            phase: "high-stars",
            rangeIndex: r + 1,
            page: 0,
            endCursor: null
          }));
        } catch {}
      }
    }
  }

  // Clear checkpoint only on complete success
  if (completedAll) {
    try {
      await redisConnection.del(checkpointKey);
      console.log("[Discovery] GitHub Hybrid discovery completed successfully. Cleared checkpoint.");
    } catch (err) {
      console.warn("[Discovery] Failed to clear Redis checkpoint", err);
    }
  } else {
    try {
      const currentVal = await redisConnection.get(checkpointKey);
      console.log(`[Discovery] GitHub Hybrid discovery interrupted. Checkpoint preserved: ${currentVal || "unknown"}.`);
    } catch {}
  }

  return Array.from(discoveredMap.values());
}
