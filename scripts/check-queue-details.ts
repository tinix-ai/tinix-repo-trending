import 'dotenv/config';
import { crawlerQueue, hfQueue, githubUpdaterQueue, hfUpdaterQueue, schedulerQueue, redisConnection, socialCrawlerQueue } from '../src/workers/queue';
import { Queue } from 'bullmq';

async function main() {
  console.log("=== Detailed Queue Stats ===");

  const printQueueInfo = async (name: string, queue: Queue) => {
    if (!queue) {
      console.log(`Queue ${name} is NOT initialized.\n`);
      return;
    }
    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.isPaused(),
    ]);

    let redisCompleted: string | null = null;
    let redisFailed: string | null = null;
    try {
      [redisCompleted, redisFailed] = await Promise.all([
        redisConnection.get(`crawler:stats:${name}:completed`),
        redisConnection.get(`crawler:stats:${name}:failed`),
      ]);
    } catch (err) {
      console.warn(`Failed to fetch Redis stats for ${name}`);
    }

    console.log(`Queue: ${name}`);
    console.log(`  Paused: ${paused}`);
    console.log(`  Jobs in memory:`);
    console.log(`    Active:    ${active}`);
    console.log(`    Waiting:   ${waiting}`);
    console.log(`    Delayed:   ${delayed}`);
    console.log(`    Completed: ${completed}`);
    console.log(`    Failed:    ${failed}`);
    console.log(`  All-time Redis Counters:`);
    console.log(`    Completed (all-time): ${redisCompleted ?? 'N/A'}`);
    console.log(`    Failed (all-time):    ${redisFailed ?? 'N/A'}`);
    console.log();
  };

  try {
    await printQueueInfo('github-crawler', crawlerQueue as Queue);
    await printQueueInfo('hf-crawler', hfQueue as Queue);
    await printQueueInfo('github-updater', githubUpdaterQueue as Queue);
    await printQueueInfo('hf-updater', hfUpdaterQueue as Queue);
    await printQueueInfo('social-crawler', socialCrawlerQueue as Queue);
    if (schedulerQueue) {
      await printQueueInfo('scheduler-queue', schedulerQueue as Queue);
    }
  } catch (error) {
    console.error("Failed to inspect queues:", error);
  }
  process.exit(0);
}

main().catch(console.error);
