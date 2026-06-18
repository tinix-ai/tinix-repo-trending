import { Queue, QueueEvents, ConnectionOptions } from 'bullmq';
import Redis from 'ioredis';

// Redis connection configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
};

// Prevent multiple connections in development (Next.js hot reloads)
const globalForRedis = globalThis as unknown as {
  redisConnection: Redis | undefined;
  crawlerQueue: Queue | undefined;
  hfQueue: Queue | undefined;
  schedulerQueue: Queue | undefined;
  crawlerQueueEvents: QueueEvents | undefined;
};

export const redisConnection = globalForRedis.redisConnection ?? new Redis(redisConfig);

redisConnection.on('error', (err) => {
  console.error('[Redis Connection] Global Redis connection error:', err.message);
});

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redisConnection = redisConnection;
}

// Create the crawler queue
export const crawlerQueue = globalForRedis.crawlerQueue ?? new Queue('github-crawler', {
  connection: redisConnection as unknown as ConnectionOptions,
  defaultJobOptions: {
    attempts: 8,
    backoff: {
      type: 'exponential',
      delay: 30000,
    },
    removeOnComplete: { count: 200 }, // Keep 200 recent completed jobs for admin UI
    removeOnFail: 5000,
  },
});

export const hfQueue = globalForRedis.hfQueue ?? new Queue('hf-crawler', {
  connection: redisConnection as unknown as ConnectionOptions,
  defaultJobOptions: {
    attempts: 8,
    backoff: {
      type: 'exponential',
      delay: 30000,
    },
    removeOnComplete: { count: 200 }, // Keep 200 recent completed jobs for admin UI
  },
});

export const schedulerQueue = globalForRedis.schedulerQueue ?? new Queue('scheduler-queue', {
  connection: redisConnection as unknown as ConnectionOptions,
  defaultJobOptions: {
    attempts: 1, // Repeatable jobs shouldn't retry infinitely if they fail
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 100 },
  },
});

export const crawlerQueueEvents = globalForRedis.crawlerQueueEvents ?? new QueueEvents('github-crawler', {
  connection: redisConnection as unknown as ConnectionOptions,
});

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.crawlerQueue = crawlerQueue;
  globalForRedis.hfQueue = hfQueue;
  globalForRedis.schedulerQueue = schedulerQueue;
  globalForRedis.crawlerQueueEvents = crawlerQueueEvents;
}

