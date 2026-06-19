import 'dotenv/config';
import { crawlerQueue, hfQueue, githubUpdaterQueue, hfUpdaterQueue, schedulerQueue } from '../src/workers/queue';
import { Queue } from 'bullmq';

async function main() {
  const queues = [
    { name: 'github-crawler', queue: crawlerQueue },
    { name: 'hf-crawler', queue: hfQueue },
    { name: 'github-updater', queue: githubUpdaterQueue },
    { name: 'hf-updater', queue: hfUpdaterQueue },
    { name: 'scheduler-queue', queue: schedulerQueue }
  ];

  console.log("=== Active Jobs in Queues ===");
  for (const { name, queue } of queues) {
    if (!queue) continue;
    const active = await queue.getActive();
    console.log(`Queue: ${name} (${active.length} active)`);
    for (const job of active) {
      console.log(`  - Job ID: ${job.id}`);
      console.log(`    Name:   ${job.name}`);
      console.log(`    Data:   `, job.data);
      console.log(`    Opts:   `, job.opts);
    }
  }
  process.exit(0);
}

main().catch(console.error);
