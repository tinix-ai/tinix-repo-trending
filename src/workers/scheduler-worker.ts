import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { redisConnection, schedulerQueue } from './queue';
import { runDailyDiscovery, runDailyUpdate } from './cron';

console.log('[Scheduler Worker] Starting...');

const schedulerWorker = new Worker('scheduler-queue', async (job: Job) => {
  console.log(`[Scheduler Worker] Processing scheduled job: ${job.name} (ID: ${job.id})`);
  
  try {
    if (job.name === 'daily-discovery') {
      await runDailyDiscovery();
    } else if (job.name === 'daily-update') {
      await runDailyUpdate();
    } else {
      console.warn(`[Scheduler Worker] Unknown job name: ${job.name}`);
    }
  } catch (error) {
    console.error(`[Scheduler Worker] Job ${job.name} failed:`, error);
    throw error;
  }
}, {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  concurrency: 1, // Process one scheduled task at a time
});

schedulerWorker.on('completed', (job) => {
  console.log(`[Scheduler Worker] Job ${job.name} completed successfully.`);
});

schedulerWorker.on('failed', (job, err) => {
  console.error(`[Scheduler Worker] Job ${job?.name} failed with error:`, err);
});

async function setupRepeatableJobs() {
  if (!schedulerQueue) {
    console.error('[Scheduler Worker] Error: schedulerQueue is not initialized.');
    return;
  }

  console.log('[Scheduler Worker] Registering repeatable cron jobs...');

  // 1. Daily Discovery: Run at 00:00 every day
  await schedulerQueue.add('daily-discovery', {}, {
    repeat: { pattern: '0 0 * * *' },
    jobId: 'repeat-daily-discovery' // Ensure uniqueness
  });

  // 2. Daily Update: Run at 00:30 every day (give discovery some head start)
  await schedulerQueue.add('daily-update', {}, {
    repeat: { pattern: '30 0 * * *' },
    jobId: 'repeat-daily-update'
  });

  console.log('[Scheduler Worker] Repeatable jobs registered successfully.');
}

// Initialize repeatable jobs on startup
setupRepeatableJobs().catch(console.error);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Scheduler Worker] Shutting down...');
  await schedulerWorker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Scheduler Worker] Shutting down...');
  await schedulerWorker.close();
  process.exit(0);
});
