import { db } from '../db';
import { projects, projectSnapshots } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { hfQueue } from '../../workers/queue';
import { updateProjectCrawlSchedule } from './scheduler';
import { calculateProjectTrendInline } from '../db/trends';

/**
 * Helper function to update HF project metrics directly in the DB when no full crawl is needed
 */
async function updateHFProjectMetricsInline(
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
async function fetchHFTopList(baseUrl: string, maxPages = 5): Promise<any[]> {
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
export async function discoverHFTrending() {
  console.log('[HF Discovery] Starting global discovery of top 5000 Models and Datasets...');

  try {
    // Fetch all existing HuggingFace projects to match against
    const existingHF = await db.select({
      id: projects.id,
      sourceId: projects.sourceId,
      sourceUpdatedAt: projects.sourceUpdatedAt,
      readme: projects.readme
    })
      .from(projects)
      .where(eq(projects.source, 'huggingface'));

    const existingHFMap = new Map(
      existingHF.map(p => [
        p.sourceId,
        {
          id: p.id,
          sourceUpdatedAt: p.sourceUpdatedAt,
          hasReadme: !!p.readme
        }
      ])
    );

    const todayStr = new Date().toISOString().split('T')[0];

    // 1. DISCOVER MODELS (top 1000 by trendingScore)
    console.log('[HF Discovery] Fetching top 1000 trending models...');
    const models = await fetchHFTopList('https://huggingface.co/api/models?sort=trendingScore&limit=100&direction=-1', 10);
    console.log(`[HF Discovery] Discovered ${models.length} unique models from API.`);

    let queuedModels = 0;
    let inlineUpdatedModels = 0;

    for (const model of models) {
      const existing = existingHFMap.get(model.id);
      const modelLastModified = model.lastModified ? new Date(model.lastModified) : null;
      
      const isNew = !existing;
      const isOutdated = !!(existing && modelLastModified && existing.sourceUpdatedAt && 
        (modelLastModified.getTime() > new Date(existing.sourceUpdatedAt).getTime()));
      const needsReadme = !!(existing && !existing.hasReadme);
      
      const needsFullCrawl = isNew || isOutdated || needsReadme;

      if (!needsFullCrawl && existing) {
        await updateHFProjectMetricsInline(existing.id, model.likes || 0, model.downloads || 0);
        inlineUpdatedModels++;
      } else {
        if (existing) {
          await db.update(projects)
            .set({ nextCrawlAt: new Date(Date.now() + 20 * 60 * 60 * 1000) }) // 24h - 4h grace period to prevent cron drift
            .where(eq(projects.id, existing.id));
        }
        await hfQueue.add('crawl-hf-model', {
          id: model.id,
          type: 'models'
        }, {
          jobId: `hf-model-${model.id}-${todayStr}`
        });
        queuedModels++;
      }
    }
    console.log(`[HF Discovery] Models process summary: queued: ${queuedModels}, inline updated: ${inlineUpdatedModels}`);

    // 2. DISCOVER DATASETS (top 1000 by trendingScore)
    console.log('[HF Discovery] Fetching top 1000 trending datasets...');
    const datasets = await fetchHFTopList('https://huggingface.co/api/datasets?sort=trendingScore&limit=100&direction=-1', 10);
    console.log(`[HF Discovery] Discovered ${datasets.length} unique datasets from API.`);

    let queuedDatasets = 0;
    let inlineUpdatedDatasets = 0;

    for (const dataset of datasets) {
      const existing = existingHFMap.get(dataset.id);
      const datasetLastModified = dataset.lastModified ? new Date(dataset.lastModified) : null;

      const isNew = !existing;
      const isOutdated = !!(existing && datasetLastModified && existing.sourceUpdatedAt && 
        (datasetLastModified.getTime() > new Date(existing.sourceUpdatedAt).getTime()));
      const needsReadme = !!(existing && !existing.hasReadme);

      const needsFullCrawl = isNew || isOutdated || needsReadme;

      if (!needsFullCrawl && existing) {
        await updateHFProjectMetricsInline(existing.id, dataset.likes || 0, dataset.downloads || 0);
        inlineUpdatedDatasets++;
      } else {
        if (existing) {
          await db.update(projects)
            .set({ nextCrawlAt: new Date(Date.now() + 20 * 60 * 60 * 1000) }) // 24h - 4h grace period to prevent cron drift
            .where(eq(projects.id, existing.id));
        }
        await hfQueue.add('crawl-hf-dataset', {
          id: dataset.id,
          type: 'datasets'
        }, {
          jobId: `hf-dataset-${dataset.id}-${todayStr}`
        });
        queuedDatasets++;
      }
    }
    console.log(`[HF Discovery] Datasets process summary: queued: ${queuedDatasets}, inline updated: ${inlineUpdatedDatasets}`);

  } catch (error) {
    console.error('[HF Discovery] Error during HF discovery:', error);
  }
}
