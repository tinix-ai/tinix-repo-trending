import 'dotenv/config';
import { hfQueue } from './queue';
import { setTimeout } from 'timers/promises';

async function runBootstrapHF() {
  console.log('[Bootstrap HF] Starting mass crawl initialization for HuggingFace...');
  let totalModelsQueued = 0;
  let totalDatasetsQueued = 0;

  // HuggingFace API doesn't have the strict 1000 limit per query like GitHub Search.
  // We can just paginate through the top models sorted by likes.
  // We will limit to 50,000 models and 50,000 datasets to make up 100,000 total.

  console.log('\n[Bootstrap HF] Fetching top 50,000 Models...');
  // The HF API limit parameter seems to have a max (often 100). We paginate by using the `limit` and `cursor` or just sort and rely on standard endpoints.
  // Actually, HF doesn't use standard `page`. It uses Link headers for cursor-based pagination.
  // We can fetch in batches.
  let url: string | null = 'https://huggingface.co/api/models?sort=likes&direction=-1&limit=100';
  
  while (url && totalModelsQueued < 50000) {
    try {
      const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!response.ok) {
        if (response.status === 429) {
          console.log('[Bootstrap HF] Rate limited! Sleeping for 60 seconds...');
          await setTimeout(60000);
          continue;
        }
        throw new Error(`HF API Error: ${response.statusText}`);
      }
      
      const models = await response.json();
      if (!models || models.length === 0) break;

      for (const model of models) {
        await hfQueue.add('crawl-hf-model', {
          id: model.id,
          type: 'models'
        }, {
          jobId: `bootstrap-hf-model-${model.id}`
        });
        totalModelsQueued++;
        if (totalModelsQueued >= 50000) break;
      }

      console.log(`[Bootstrap HF] Queued ${totalModelsQueued} models so far...`);

      // Get next page URL from Link header
      const linkHeader = response.headers.get('link');
      if (linkHeader && linkHeader.includes('rel="next"')) {
        const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
        url = match ? match[1] : null;
      } else {
        url = null;
      }

      await setTimeout(1000); // polite delay

    } catch (e) {
      console.error('[Bootstrap HF] Error fetching models:', e);
      break;
    }
  }

  console.log('\n[Bootstrap HF] Fetching top 50,000 Datasets...');
  url = 'https://huggingface.co/api/datasets?sort=likes&direction=-1&limit=100';

  while (url && totalDatasetsQueued < 50000) {
    try {
      const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!response.ok) {
        if (response.status === 429) {
          console.log('[Bootstrap HF] Rate limited! Sleeping for 60 seconds...');
          await setTimeout(60000);
          continue;
        }
        throw new Error(`HF API Error: ${response.statusText}`);
      }
      
      const datasets = await response.json();
      if (!datasets || datasets.length === 0) break;

      for (const dataset of datasets) {
        await hfQueue.add('crawl-hf-dataset', {
          id: dataset.id,
          type: 'datasets'
        }, {
          jobId: `bootstrap-hf-dataset-${dataset.id}`
        });
        totalDatasetsQueued++;
        if (totalDatasetsQueued >= 50000) break;
      }

      console.log(`[Bootstrap HF] Queued ${totalDatasetsQueued} datasets so far...`);

      // Get next page URL from Link header
      const linkHeader = response.headers.get('link');
      if (linkHeader && linkHeader.includes('rel="next"')) {
        const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
        url = match ? match[1] : null;
      } else {
        url = null;
      }

      await setTimeout(1000); // polite delay

    } catch (e) {
      console.error('[Bootstrap HF] Error fetching datasets:', e);
      break;
    }
  }

  console.log(`\n[Bootstrap HF] Mass crawl initialization completed!`);
  console.log(`[Bootstrap HF] Successfully queued ${totalModelsQueued} models and ${totalDatasetsQueued} datasets.`);
  console.log(`[Bootstrap HF] Please run 'npm run worker:hf' to process them.`);
  process.exit(0);
}

runBootstrapHF();
