import 'dotenv/config';
import { schedulerQueue } from '../src/workers/queue';

async function main() {
  console.log("Adding trend-calculation job manually...");
  const job = await schedulerQueue.add('trend-calculation', {}, {
    jobId: `manual-trend-calculation-${Date.now()}`
  });
  console.log(`Job added successfully! Job ID: ${job.id}`);
  process.exit(0);
}

main().catch(console.error);
