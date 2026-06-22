import { Queue } from 'bullmq';
import Redis from 'ioredis';

/**
 * Sets up distributed rate-limit recovery for a BullMQ queue.
 * Checks on startup if the queue was paused due to rate limits and schedules
 * resume once the rate limit reset TTL has expired.
 */
export async function setupQueueAutoRecovery(queueName: string, queue: Queue, redis: Redis) {
  try {
    const isPaused = await queue.isPaused();
    if (!isPaused) {
      // If the queue is not paused in Redis, make sure any leftover local reset key is cleared
      await redis.del(`crawler:rate-limit-reset:${queueName}`);
      return;
    }

    const resetKey = `crawler:rate-limit-reset:${queueName}`;
    const ttl = await redis.pttl(resetKey);

    if (ttl <= 0) {
      // The key has expired or does not exist, which means the rate limit has reset
      // or a crash occurred. We can safely resume the queue.
      console.log(`[Auto-Recovery] Queue "${queueName}" was paused but rate-limit reset key is missing or expired. Resuming queue...`);
      await queue.resume();
      await redis.del(resetKey);
    } else {
      // The key exists and has remaining TTL. Schedule resume when TTL expires.
      const secondsLeft = Math.ceil(ttl / 1000);
      console.log(`[Auto-Recovery] Queue "${queueName}" is paused. Rescheduling auto-resume in ${secondsLeft} second(s)...`);
      
      setTimeout(async () => {
        try {
          // Double check the key hasn't been renewed/extended by another rate limit
          const currentTtl = await redis.pttl(resetKey);
          if (currentTtl <= 0) {
            console.log(`[Auto-Recovery] Rate limit expired for queue "${queueName}". Resuming queue...`);
            await queue.resume();
            await redis.del(resetKey);
          } else {
            console.log(`[Auto-Recovery] Queue "${queueName}" resume deferred as rate limit was extended.`);
          }
        } catch (err) {
          console.error(`[Auto-Recovery] Error during scheduled auto-resume for queue "${queueName}":`, err);
        }
      }, ttl);
    }
  } catch (error) {
    console.error(`[Auto-Recovery] Failed to setup auto-recovery for queue "${queueName}":`, error);
  }
}
