import { proxyManager } from './proxy';
import Redis from 'ioredis';
import { setTimeout } from 'timers/promises';

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
};

const redisConnection = new Redis(redisConfig);

redisConnection.on('error', (err) => {
  console.error('[HF Batch] Redis connection error:', err.message);
});

export interface HFBatchResult {
  id: string;
  type: 'models' | 'datasets';
  exists: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
}

export async function fetchHFWithRetry(url: string, logPrefix: string, isText = false) {
  let maxRetries = 5;
  const hasProxies = (process.env.PROXY_URLS || '').split(',').map(p => p.trim()).filter(Boolean).length > 0;

  while (maxRetries > 0) {
    const headers: Record<string, string> = {
      'Accept': isText ? 'text/plain' : 'application/json',
    };
    const hfToken = (process.env.HF_TOKEN || '').replace(/^["']|["']$/g, '').trim();
    if (hfToken) {
      headers['Authorization'] = `Bearer ${hfToken}`;
    }

    const dispatcher = proxyManager.getRandomDispatcher();
    const fetchOptions: RequestInit & { dispatcher?: unknown } = { headers };
    if (dispatcher) {
      fetchOptions.dispatcher = dispatcher;
    }

    const response = await fetch(url, fetchOptions);

    const remaining = response.headers.get('x-rate-limit-remaining') || response.headers.get('ratelimit-remaining');
    const reset = response.headers.get('x-rate-limit-reset') || response.headers.get('ratelimit-reset');
    const limitHeader = response.headers.get('x-rate-limit-limit') || response.headers.get('ratelimit-limit') || '1000';

    if (remaining) {
      const remVal = parseInt(remaining, 10);
      const limitVal = parseInt(limitHeader, 10);
      const resetVal = reset ? parseInt(reset, 10) : 60;
      
      redisConnection.hset('system:hf:token', 'info', JSON.stringify({
        remaining: remVal,
        limit: limitVal,
        resetTime: Date.now() + resetVal * 1000,
        timestamp: Date.now(),
        status: remVal === 0 ? 'exhausted' : 'active'
      })).catch(err => {
        console.error(`${logPrefix} Failed to write HF token status to Redis:`, err);
      });

      if (remVal < 20) {
        console.log(`${logPrefix} HF API rate limit is low: ${remaining} remaining. Resets in ${reset || 'unknown'}s`);
      }
    }

    if (!response.ok) {
      if (response.status === 429) {
        if (hasProxies) {
          console.log(`${logPrefix} 429 caught on proxy/direct connection. Rotating proxy. Retries left: ${maxRetries - 1}`);
          maxRetries--;
          await setTimeout(2000); // Wait 2s before retry
          continue;
        } else {
          const resetHeader = response.headers.get('x-rate-limit-reset') || response.headers.get('ratelimit-reset');
          const resetSeconds = resetHeader ? parseInt(resetHeader, 10) : 60;
          throw new Error(`[RateLimitError] HuggingFace API rate limited. Resets in ${resetSeconds} seconds.`);
        }
      }
      if (response.status === 404) {
        return { status: 404, data: null };
      }
      throw new Error(`HuggingFace API error: ${response.status} ${response.statusText}`);
    }

    return { status: 200, data: isText ? await response.text() : await response.json() };
  }
  throw new Error('[RateLimitError] Failed to fetch HF data after max retries due to rate limiting.');
}

export async function fetchHFBatch(
  projects: { id: string; type: 'models' | 'datasets' }[]
): Promise<HFBatchResult[]> {
  const results: HFBatchResult[] = [];
  const logPrefix = '[HF Batch]';

  // We process them sequentially or with small concurrency to avoid hitting 429 too quickly.
  // Using a chunk size of 5 for Promise.all
  const CHUNK_SIZE = 5;
  for (let i = 0; i < projects.length; i += CHUNK_SIZE) {
    const chunk = projects.slice(i, i + CHUNK_SIZE);
    
    const chunkPromises = chunk.map(async (project) => {
      try {
        const url = `https://huggingface.co/api/${project.type}/${project.id}`;
        const result = await fetchHFWithRetry(url, logPrefix);
        if (result.status === 404) {
          return { id: project.id, type: project.type, exists: false };
        }
        return { id: project.id, type: project.type, exists: true, data: result.data };
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        if (error.message?.includes('[RateLimitError]')) {
          throw error;
        }
        console.error(`${logPrefix} Error fetching ${project.id}:`, err);
        // Treat as exists but no data, so it doesn't get deleted but just skips update
        return { id: project.id, type: project.type, exists: true, data: null };
      }
    });

    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults);
    
    // Add a small delay between chunks to be nice to HF API
    if (i + CHUNK_SIZE < projects.length) {
      await setTimeout(500);
    }
  }

  return results;
}
