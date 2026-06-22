import 'dotenv/config';
import { Worker } from 'bullmq';
import { handleHFCrawlJob } from './hf-worker';
import { redisConnection, hfUpdaterQueue } from './queue';
import { setupQueueAutoRecovery } from './recovery';

console.log('[HF Updater Worker] Starting...');

const hfUpdaterWorker = new Worker(
  'hf-updater',
  handleHFCrawlJob,
  {
    connection: redisConnection as unknown as Worker['opts']['connection'],
    concurrency: 5, 
    stalledInterval: 15000,
    maxStalledCount: 2,
  }
);

hfUpdaterWorker.on('completed', async (job) => {
  console.log(`[HF Updater] Job ${job.id} completed`);
  try {
    await redisConnection.incr('crawler:stats:hf-updater:completed');
  } catch (err) {
    console.error('[HF Updater] Failed to increment completed stats in Redis:', err);
  }
});

hfUpdaterWorker.on('failed', async (job, err) => {
  if (err.message.includes('[RateLimitError]')) {
    console.log(`[HF Updater] Job ${job?.id} paused/delayed due to rate limit (will retry later).`);
  } else {
    console.error(`[HF Updater] Job ${job?.id} failed with error:`, err.message);
    try {
      await redisConnection.incr('crawler:stats:hf-updater:failed');
    } catch (redisErr) {
      console.error('[HF Updater] Failed to increment failed stats in Redis:', redisErr);
    }
  }
});

console.log('[HF Updater] Worker started and waiting for jobs...');

// On worker startup, run auto-recovery checks
setupQueueAutoRecovery('hf-updater', hfUpdaterQueue, redisConnection);

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('[HF Updater Worker] Gracefully shutting down...');
  await hfUpdaterWorker.close();
  await redisConnection.quit();
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Global error handling for unhandled exceptions
process.on('unhandledRejection', (reason, promise) => {
  console.error('[HF Updater Worker] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[HF Updater Worker] Uncaught Exception:', error);
});
