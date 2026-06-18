import 'dotenv/config';
import { crawlerQueue, hfQueue } from '../src/workers/queue';
import { Queue } from 'bullmq';

async function main() {
  try {
    const ghQ = crawlerQueue as Queue;
    const hfQ = hfQueue as Queue;

    const ghWaiting = await ghQ.getJobs(['waiting'], 0, 100, false);
    const ghForce = ghWaiting.filter(j => j.id && j.id.includes('force'));
    console.log(`GitHub Queue: Found ${ghForce.length} force jobs in the first 100 waiting jobs.`);
    if (ghForce.length > 0) {
      console.log('Sample GitHub force job:', { id: ghForce[0].id, data: ghForce[0].data });
    }

    const hfWaiting = await hfQ.getJobs(['waiting'], 0, 100, false);
    const hfForce = hfWaiting.filter(j => j.id && j.id.includes('force'));
    console.log(`HF Queue: Found ${hfForce.length} force jobs in the first 100 waiting jobs.`);
    if (hfForce.length > 0) {
      console.log('Sample HF force job:', { id: hfForce[0].id, data: hfForce[0].data });
    }

    // Check if there are active force jobs
    const ghActive = await ghQ.getJobs(['active'], 0, 10, false);
    const ghActiveForce = ghActive.filter(j => j.id && j.id.includes('force'));
    console.log(`GitHub Queue: Found ${ghActiveForce.length} active force jobs.`);
    if (ghActiveForce.length > 0) {
      console.log('Sample Active GitHub force job:', { id: ghActiveForce[0].id, data: ghActiveForce[0].data });
    }
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

main();
