import 'dotenv/config';
import { Worker } from 'bullmq';
import { handleGithubCrawlJob } from './crawler-worker';
import { redisConnection, githubUpdaterQueue } from './queue';
import { setupQueueAutoRecovery } from './recovery';

console.log('[GitHub Updater Worker] Starting...');

const githubUpdaterWorker = new Worker(
  'github-updater',
  handleGithubCrawlJob,
  {
    connection: redisConnection as unknown as Worker['opts']['connection'],
    concurrency: 5, 
    stalledInterval: 15000,
    maxStalledCount: 2,
  }
);

githubUpdaterWorker.on('completed', async (job) => {
  console.log(`[GitHub Updater] Job ${job.id} completed`);
  try {
    await redisConnection.incr('crawler:stats:github-updater:completed');
  } catch (err) {
    console.error('[GitHub Updater] Failed to increment completed stats in Redis:', err);
  }
});

githubUpdaterWorker.on('failed', async (job, err) => {
  if (err.message.includes('[RateLimitError]')) {
    console.log(`[GitHub Updater] Job ${job?.id} paused/delayed due to rate limit (will retry later).`);
  } else {
    console.error(`[GitHub Updater] Job ${job?.id} failed with error:`, err.message);
    try {
      await redisConnection.incr('crawler:stats:github-updater:failed');
    } catch (redisErr) {
      console.error('[GitHub Updater] Failed to increment failed stats in Redis:', redisErr);
    }
  }
});

console.log('[GitHub Updater] Worker started and waiting for jobs...');

// On worker startup, run auto-recovery checks
setupQueueAutoRecovery('github-updater', githubUpdaterQueue, redisConnection);

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('[GitHub Updater Worker] Gracefully shutting down...');
  await githubUpdaterWorker.close();
  await redisConnection.quit();
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Global error handling for unhandled exceptions
process.on('unhandledRejection', (reason, promise) => {
  console.error('[GitHub Updater Worker] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[GitHub Updater Worker] Uncaught Exception:', error);
});
