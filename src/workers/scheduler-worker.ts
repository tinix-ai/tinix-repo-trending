import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { schedulerQueue, redisConnection } from './queue';
import { runDailyDiscovery, runDailyUpdate, runTrendCalculation, runDailySocialMentions } from './cron';
import { startMemoryReporting } from './metrics';


console.log('[Scheduler Worker] Starting...');

const schedulerWorker = new Worker('scheduler-queue', async (job: Job) => {
  console.log(`[Scheduler Worker] Processing scheduled job: ${job.name} (ID: ${job.id})`);
  
  try {
    if (job.name === 'daily-discovery') {
      const source = job.data?.source as 'github' | 'huggingface' | undefined;
      
      // Set sync-running flags for admin UI status
      if (source === 'github' || !source) {
        await redisConnection.set('crawler:sync:github:running', 'true');
      }
      if (source === 'huggingface' || !source) {
        await redisConnection.set('crawler:sync:huggingface:running', 'true');
      }

      try {
        await runDailyDiscovery(source);
      } finally {
        // Always clear sync-running flags
        if (source === 'github' || !source) {
          await redisConnection.del('crawler:sync:github:running');
        }
        if (source === 'huggingface' || !source) {
          await redisConnection.del('crawler:sync:huggingface:running');
        }
      }
    } else if (job.name === 'daily-update') {
      await runDailyUpdate(!!job.data?.force);
    } else if (job.name === 'trend-calculation') {
      await runTrendCalculation();
    } else if (job.name === 'social-mentions') {
      await runDailySocialMentions();
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
  concurrency: 1, // Sequential: scheduled tasks are heavyweight batch operations
});

schedulerWorker.on('completed', async (job) => {
  console.log(`[Scheduler Worker] Job ${job.name} completed successfully.`);
  try {
    await redisConnection.incr('crawler:stats:scheduler-queue:completed');
  } catch (err) {
    console.error('[Scheduler Worker] Failed to increment completed stats in Redis:', err);
  }
});

schedulerWorker.on('failed', async (job, err) => {
  console.error(`[Scheduler Worker] Job ${job?.name} failed with error:`, err);
  try {
    await redisConnection.incr('crawler:stats:scheduler-queue:failed');
  } catch (err) {
    console.error('[Scheduler Worker] Failed to increment failed stats in Redis:', err);
  }
});

async function setupRepeatableJobs() {
  if (!schedulerQueue) {
    console.error('[Scheduler Worker] Error: schedulerQueue is not initialized.');
    return;
  }

  console.log('[Scheduler Worker] Syncing repeatable cron jobs...');

  // Clean up existing repeatable jobs to avoid stale/removed configs in Redis
  try {
    const repeatableJobs = await schedulerQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      await schedulerQueue.removeRepeatableByKey(job.key);
    }
  } catch (error) {
    console.error('[Scheduler Worker] Error cleaning up repeatable jobs:', error);
  }

  // 1. Daily Discovery: Run at 00:00 every day GMT+7
  await schedulerQueue.add('daily-discovery', {}, {
    repeat: { pattern: '0 0 * * *', tz: 'Asia/Ho_Chi_Minh' },
    jobId: 'repeat-daily-discovery'
  });

  // 2. Daily Update: Run at 00:30 every day GMT+7
  await schedulerQueue.add('daily-update', {}, {
    repeat: { pattern: '30 0 * * *', tz: 'Asia/Ho_Chi_Minh' },
    jobId: 'repeat-daily-update'
  });

  // 3. Social Mentions Update: Run at 01:00 every day GMT+7
  await schedulerQueue.add('social-mentions', {}, {
    repeat: { pattern: '0 1 * * *', tz: 'Asia/Ho_Chi_Minh' },
    jobId: 'repeat-social-mentions'
  });

  console.log('[Scheduler Worker] Repeatable jobs synced successfully.');
}

// Initialize repeatable jobs on startup and start memory reporting
setupRepeatableJobs().catch(console.error);
const stopReporting = startMemoryReporting('scheduler-worker', redisConnection);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Scheduler Worker] Shutting down...');
  stopReporting();
  await schedulerWorker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Scheduler Worker] Shutting down...');
  stopReporting();
  await schedulerWorker.close();
  process.exit(0);
});

// Global error handling for unhandled exceptions
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Scheduler Worker] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[Scheduler Worker] Uncaught Exception:', error);
});
