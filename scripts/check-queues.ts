import 'dotenv/config';
import { Queue } from 'bullmq';
import { crawlerQueue, hfQueue, schedulerQueue } from '../src/workers/queue';

async function main() {
  console.log("--- BullMQ Queue Status Check ---");
  
  const printQueueInfo = async (name: string, queue: Queue) => {
    const counts = await queue.getJobCounts();
    const isPaused = await queue.isPaused();
    const workers = await queue.getWorkers();
    
    console.log(`Queue: ${name}`);
    console.log(`  Paused: ${isPaused}`);
    console.log(`  Jobs counts:`, counts);
    console.log(`  Active Workers count: ${workers.length}`);
    for (const w of workers) {
      console.log(`    - Worker ID: ${w.id}`);
    }
    console.log();
  };

  try {
    await printQueueInfo('github-crawler', crawlerQueue as Queue);
    await printQueueInfo('hf-crawler', hfQueue as Queue);
    await printQueueInfo('scheduler-queue', schedulerQueue as Queue);
  } catch (error) {
    console.error("Failed to inspect queues:", error);
  }
  
  process.exit(0);
}

main().catch(console.error);
