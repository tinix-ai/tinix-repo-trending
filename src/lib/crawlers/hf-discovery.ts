import { db } from '../db';
import { projects, projectSnapshots } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { hfQueue } from '../../workers/queue';
import { updateProjectCrawlSchedule } from './scheduler';
import { calculateProjectTrendInline } from '../db/trends';

/**
 * Helper function to update HF project metrics directly in the DB when no full crawl is needed
 */
export async function updateHFProjectMetricsInline(
  projectId: string,
  likes: number,
  downloads: number
) {
  // 1. Update basic metrics in projects table
  await db.update(projects)
    .set({
      likes,
      downloads,
      lastCrawledAt: new Date(),
    })
    .where(eq(projects.id, projectId));

  // 2. Insert or update snapshot
  const snapshotDate = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];
  const existingSnapshot = await db.select({ id: projectSnapshots.id })
    .from(projectSnapshots)
    .where(and(eq(projectSnapshots.projectId, projectId), eq(projectSnapshots.snapshotDate, snapshotDate)))
    .limit(1);

  if (existingSnapshot.length > 0) {
    await db.update(projectSnapshots)
      .set({ likes, downloads })
      .where(eq(projectSnapshots.id, existingSnapshot[0].id));
  } else {
    await db.insert(projectSnapshots).values({
      projectId: projectId,
      stars: 0,
      watchers: 0,
      forks: 0,
      openIssues: 0,
      likes,
      downloads,
      snapshotDate,
    });
  }

  // 3. Recalculate scheduler
  await updateProjectCrawlSchedule(projectId, 'huggingface');

  // 4. Recalculate trends inline
  await calculateProjectTrendInline(projectId);
}

/**
 * Fetches models or datasets in pages using the Link header up to a certain page count
 */
export async function fetchHFTopList(baseUrl: string, maxPages = 5): Promise<any[]> {
  const items: any[] = [];
  let url: string | null = baseUrl;
  let page = 0;

  const hfToken = (process.env.HF_TOKEN || '').replace(/^["']|["']$/g, '').trim();

  while (url && page < maxPages) {
    try {
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'User-Agent': 'TiniX-Repo-Trending/1.0'
      };
      if (hfToken) {
        headers['Authorization'] = `Bearer ${hfToken}`;
      }

      const res = await fetch(url, { headers });

      // Extract telemetry headers
      let remVal = 0, limitVal = 1000, resetVal = 60;
      let rateLimitFound = false;

      const rateLimitHeader = res.headers.get('RateLimit');
      const rateLimitPolicyHeader = res.headers.get('RateLimit-Policy');

      if (rateLimitHeader) {
        const rMatch = rateLimitHeader.match(/r=(\d+)/);
        const tMatch = rateLimitHeader.match(/t=(\d+)/);
        if (rMatch) remVal = parseInt(rMatch[1], 10);
        if (tMatch) resetVal = parseInt(tMatch[1], 10);
        rateLimitFound = true;
      }

      if (rateLimitPolicyHeader) {
        const qMatch = rateLimitPolicyHeader.match(/q=(\d+)/);
        if (qMatch) limitVal = parseInt(qMatch[1], 10);
      }

      // Fallback for legacy headers
      if (!rateLimitFound) {
        const remaining = res.headers.get('x-rate-limit-remaining') || res.headers.get('ratelimit-remaining');
        const reset = res.headers.get('x-rate-limit-reset') || res.headers.get('ratelimit-reset');
        const limitHeader = res.headers.get('x-rate-limit-limit') || res.headers.get('ratelimit-limit');
        
        if (remaining) {
          remVal = parseInt(remaining, 10);
          if (limitHeader) limitVal = parseInt(limitHeader, 10);
          if (reset) resetVal = parseInt(reset, 10);
          rateLimitFound = true;
        }
      }

      if (rateLimitFound) {
        // Import and use redisConnection (needs to be available in this file)
        const { redisConnection } = require('../../workers/queue');
        redisConnection.hset('system:hf:token', 'info', JSON.stringify({
          remaining: remVal,
          limit: limitVal,
          resetTime: Date.now() + resetVal * 1000,
          timestamp: Date.now(),
          status: remVal === 0 ? 'exhausted' : 'active'
        })).catch((err: any) => console.error('Failed to write HF telemetry', err));
      }

      if (!res.ok) {
        console.error(`[HF Discovery] Fetch failed for page ${page + 1}: ${res.statusText}`);
        break;
      }

      const data = await res.json();
      if (Array.isArray(data)) {
        items.push(...data);
      }
      page++;

      const linkHeader = res.headers.get('link');
      if (linkHeader) {
        const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
        url = match ? match[1] : null;
      } else {
        url = null;
      }
    } catch (err) {
      console.error(`[HF Discovery] Error fetching page ${page + 1}:`, err);
      break;
    }
  }

  return items;
}

/**
 * Discovers trending/popular models and datasets from HuggingFace.
 * Fetches top 5000 items without any thresholds or keyword restrictions.
 */
