import { hfQueue } from '../../workers/queue';

/**
 * Discovers trending models and datasets from HuggingFace and adds them to the BullMQ queue
 */
export async function discoverHFTrending() {
  console.log('[HF Discovery] Starting trending discovery for Models and Datasets...');

  try {
    // 1. Fetch trending models
    console.log('[HF Discovery] Fetching top 100 trending models...');
    const modelsResponse = await fetch('https://huggingface.co/api/models?sort=trending&limit=100', {
      headers: { 'Accept': 'application/json' }
    });
    
    if (modelsResponse.ok) {
      const models = await modelsResponse.json();
      let queuedModels = 0;
      for (const model of models) {
        await hfQueue.add('crawl-hf-model', {
          id: model.id,
          type: 'models'
        }, {
          jobId: `hf-model-${model.id}`
        });
        queuedModels++;
      }
      console.log(`[HF Discovery] Queued ${queuedModels} trending models.`);
    } else {
      console.error(`[HF Discovery] Failed to fetch models: ${modelsResponse.statusText}`);
    }

    // 2. Fetch trending datasets
    console.log('[HF Discovery] Fetching top 100 trending datasets...');
    const datasetsResponse = await fetch('https://huggingface.co/api/datasets?sort=trending&limit=100', {
      headers: { 'Accept': 'application/json' }
    });
    
    if (datasetsResponse.ok) {
      const datasets = await datasetsResponse.json();
      let queuedDatasets = 0;
      for (const dataset of datasets) {
        await hfQueue.add('crawl-hf-dataset', {
          id: dataset.id,
          type: 'datasets'
        }, {
          jobId: `hf-dataset-${dataset.id}`
        });
        queuedDatasets++;
      }
      console.log(`[HF Discovery] Queued ${queuedDatasets} trending datasets.`);
    } else {
      console.error(`[HF Discovery] Failed to fetch datasets: ${datasetsResponse.statusText}`);
    }

  } catch (error) {
    console.error('[HF Discovery] Error during discovery:', error);
  }
}
