/**
 * flush-social-queue.ts
 * One-time script to drain the bloated social-crawler BullMQ queue.
 * After the runDailySocialMentions logic fix (now targets ~5k instead of 100k projects),
 * we need to remove stale waiting jobs from the old cron runs.
 *
 * Usage: npx tsx scripts/flush-social-queue.ts
 */
import 'dotenv/config';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
};

async function main() {
  const redis = new Redis(redisConfig);
  const socialQueue = new Queue('social-crawler', { connection: redis as never });

  const before = await socialQueue.getJobCounts('waiting', 'delayed', 'active', 'completed', 'failed');
  console.log('📊 Queue counts BEFORE flush:', before);

  console.log('🗑️  Draining waiting and delayed jobs from social-crawler queue...');
  await socialQueue.drain(); // Removes all waiting + delayed jobs

  const after = await socialQueue.getJobCounts('waiting', 'delayed', 'active', 'completed', 'failed');
  console.log('✅ Queue counts AFTER flush:', after);

  await socialQueue.close();
  await redis.quit();
  console.log('Done. Queue has been flushed. The next cron run will enqueue only ~5k targeted jobs.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
