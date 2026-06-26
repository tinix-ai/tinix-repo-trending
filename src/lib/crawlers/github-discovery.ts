import { setTimeout } from "timers/promises";
import { sql } from "drizzle-orm";
import { redisConnection } from "../../workers/queue";
import { db } from "../db";
import { searchGitHubRepos } from "./github-graphql";

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
 * Discovers new AI/ML repositories using GitHub GraphQL Search API.
 * Tracks checkpoint in Redis via { topicIndex, page, endCursor } to support multi-process resume.
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
    'note-taking', 'knowledge-base', 'ai-agent', 'llm-agent'
  ];

  const dbTopics = await getPopularDatabaseTopics(30);
  const topics = Array.from(new Set([...staticTopics, ...dbTopics]));

  let startTopicIndex = 0;
  let startPage = 1;
  let startCursor: string | null = null;
  
  try {
    const lastSavedCheckpoint = await redisConnection.get(checkpointKey);
    if (lastSavedCheckpoint) {
      const parsed = JSON.parse(lastSavedCheckpoint);
      const savedTopic = parsed.topic;
      const savedTopicIndex = savedTopic ? topics.indexOf(savedTopic) : parsed.topicIndex;
      
      if (savedTopicIndex !== -1 && savedTopicIndex !== undefined) {
        startTopicIndex = savedTopicIndex;
        startPage = (parsed.page || 0) + 1; // Resume from the next page
        startCursor = parsed.endCursor || null;
        console.log(`[Discovery] Resuming GitHub Discovery from checkpoint. TopicIndex: ${startTopicIndex} (${topics[startTopicIndex]}), page: ${startPage}, cursor: ${startCursor}`);
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
    startCursor = null;
    try {
      await redisConnection.del(checkpointKey);
    } catch {}
  }

  const discoveredMap = new Map<string, DiscoveredRepo>();
  let completedAll = true;

  for (let t = startTopicIndex; t < topics.length; t++) {
    const topic = topics[t];
    let completedTopic = false;
    
    // Determine page and cursor to start for this specific topic
    const pageStart = (t === startTopicIndex) ? startPage : 1;
    let cursor: string | null = (t === startTopicIndex) ? startCursor : null;

    for (let page = pageStart; page <= maxPages; page++) {
      console.log(`[Discovery] Fetching page ${page} of GitHub GraphQL Search for topic:${topic} using cursor: ${cursor || 'null'}...`);
      
      try {
        const query = `topic:${topic} stars:>100 sort:updated-desc`;
        const data = await searchGitHubRepos(query, 100, cursor);
        const items = data.nodes || [];
        
        if (items.length === 0) {
          completedTopic = true;
          break; // No more results for this topic
        }

        for (const item of items) {
          const key = `${item.owner}/${item.name}`;
          discoveredMap.set(key, {
            owner: item.owner,
            repo: item.name,
            stars: item.stars,
          });
        }

        cursor = data.endCursor;
        const hasNextPage = data.hasNextPage;

        // Save checkpoint page, topicIndex, topic, and cursor to Redis
        try {
          await redisConnection.set(checkpointKey, JSON.stringify({ 
            topicIndex: t, 
            topic, 
            page, 
            endCursor: cursor 
          }));
        } catch (err) {
          console.warn(`[Discovery] Failed to save checkpoint in Redis`, err);
        }

        if (!hasNextPage || page === maxPages) {
          completedTopic = true;
          break;
        }

        // Safe delay to respect API guidelines/courtesy
        await setTimeout(2500);

      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        if (err.message?.includes('[RateLimitError]')) {
          console.warn(`[Discovery] GitHub API rate limit reached (all tokens exhausted). Stopping discovery and saving checkpoint.`);
        } else {
          console.error(`[Discovery] Error during GitHub Search for topic:${topic} page:${page}:`, error);
        }
        completedTopic = false;
        break; // Safe exit on error for this topic
      }
    }
    if (completedTopic) {
      try {
        if (t + 1 < topics.length) {
          await redisConnection.set(checkpointKey, JSON.stringify({ 
            topicIndex: t + 1, 
            topic: topics[t + 1], 
            page: 0, 
            endCursor: null 
          }));
        }
      } catch (err) {
        console.warn(`[Discovery] Failed to save next topic checkpoint in Redis`, err);
      }
    } else {
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
