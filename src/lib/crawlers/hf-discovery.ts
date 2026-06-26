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
 * Discovers trending models and datasets from HuggingFace and adds them to the BullMQ queue
 */
export async function discoverHFTrending() {
  console.log('[HF Discovery] Starting trending discovery for Models and Datasets...');

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

    // 1. Fetch trending models
    console.log('[HF Discovery] Fetching top 100 trending models...');
    const modelsResponse = await fetch('https://huggingface.co/api/models?sort=likes7d&limit=100&direction=-1', {
      headers: { 
        'Accept': 'application/json',
        'User-Agent': 'TiniX-Repo-Trending/1.0'
      }
    });
    
    if (modelsResponse.ok) {
      const models = await modelsResponse.json();
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
            // Set nextCrawlAt to tomorrow to prevent updater from double-queuing
            await db.update(projects)
              .set({ nextCrawlAt: new Date(Date.now() + 24 * 60 * 60 * 1000) })
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
      console.log(`[HF Discovery] Trending models: Queued/Updated ${queuedModels} for full crawl, inline updated ${inlineUpdatedModels} projects.`);
    } else {
      console.error(`[HF Discovery] Failed to fetch models: ${modelsResponse.statusText}`);
    }
 
    // 2. Fetch trending datasets
    console.log('[HF Discovery] Fetching top 100 trending datasets...');
    const datasetsResponse = await fetch('https://huggingface.co/api/datasets?sort=likes7d&limit=100&direction=-1', {
      headers: { 
        'Accept': 'application/json',
        'User-Agent': 'TiniX-Repo-Trending/1.0'
      }
    });
    
    if (datasetsResponse.ok) {
      const datasets = await datasetsResponse.json();
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
            // Set nextCrawlAt to tomorrow to prevent updater from double-queuing
            await db.update(projects)
              .set({ nextCrawlAt: new Date(Date.now() + 24 * 60 * 60 * 1000) })
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
      console.log(`[HF Discovery] Trending datasets: Queued/Updated ${queuedDatasets} for full crawl, inline updated ${inlineUpdatedDatasets} projects.`);
    } else {
      console.error(`[HF Discovery] Failed to fetch datasets: ${datasetsResponse.statusText}`);
    }

  } catch (error) {
    console.error('[HF Discovery] Error during discovery:', error);
  }
}
