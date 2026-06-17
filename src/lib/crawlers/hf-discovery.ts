import { db } from '../db';
import { projects } from '../db/schema';
import { eq } from 'drizzle-orm';
import { hfQueue } from '../../workers/queue';

/**
 * Discovers trending models and datasets from HuggingFace and adds them to the BullMQ queue
 */
export async function discoverHFTrending() {
  console.log('[HF Discovery] Starting trending discovery for Models and Datasets...');

  try {
    // Fetch all existing HuggingFace projects to match against
    const existingHF = await db.select({ id: projects.id, sourceId: projects.sourceId })
      .from(projects)
      .where(eq(projects.source, 'huggingface'));
    const existingHFMap = new Map(existingHF.map(p => [p.sourceId, p.id]));

    // 1. Fetch trending models
    console.log('[HF Discovery] Fetching top 100 trending models...');
    const modelsResponse = await fetch('https://huggingface.co/api/trending?limit=100', {
      headers: { 
        'Accept': 'application/json',
        'User-Agent': 'TiniX-Repo-Trending/1.0'
      }
    });
    
    if (modelsResponse.ok) {
      const models = await modelsResponse.json();
      let queuedModels = 0;
      for (const model of models) {
        const existingId = existingHFMap.get(model.id);
        if (existingId) {
          // Reset scheduling priority to daily and crawl NOW
          await db.update(projects)
            .set({
              crawlInterval: 1,
              nextCrawlAt: new Date(),
            })
            .where(eq(projects.id, existingId));
        }

        await hfQueue.add('crawl-hf-model', {
          id: model.id,
          type: 'models'
        }, {
          jobId: `hf-model-${model.id}`
        });
        queuedModels++;
      }
      console.log(`[HF Discovery] Queued/Updated ${queuedModels} trending models.`);
    } else {
      console.error(`[HF Discovery] Failed to fetch models: ${modelsResponse.statusText}`);
    }

    // 2. Fetch trending datasets
    console.log('[HF Discovery] Fetching top 100 trending datasets...');
    const datasetsResponse = await fetch('https://huggingface.co/api/trending?type=dataset&limit=100', {
      headers: { 
        'Accept': 'application/json',
        'User-Agent': 'TiniX-Repo-Trending/1.0'
      }
    });
    
    if (datasetsResponse.ok) {
      const datasets = await datasetsResponse.json();
      let queuedDatasets = 0;
      for (const dataset of datasets) {
        const existingId = existingHFMap.get(dataset.id);
        if (existingId) {
          // Reset scheduling priority to daily and crawl NOW
          await db.update(projects)
            .set({
              crawlInterval: 1,
              nextCrawlAt: new Date(),
            })
            .where(eq(projects.id, existingId));
        }

        await hfQueue.add('crawl-hf-dataset', {
          id: dataset.id,
          type: 'datasets'
        }, {
          jobId: `hf-dataset-${dataset.id}`
        });
        queuedDatasets++;
      }
      console.log(`[HF Discovery] Queued/Updated ${queuedDatasets} trending datasets.`);
    } else {
      console.error(`[HF Discovery] Failed to fetch datasets: ${datasetsResponse.statusText}`);
    }

  } catch (error) {
    console.error('[HF Discovery] Error during discovery:', error);
  }
}
