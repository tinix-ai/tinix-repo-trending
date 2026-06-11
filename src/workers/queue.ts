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
  crawlerQueueEvents: QueueEvents | undefined;
};

export const redisConnection = globalForRedis.redisConnection ?? new Redis(redisConfig);

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redisConnection = redisConnection;
}

// Create the crawler queue
export const crawlerQueue = globalForRedis.crawlerQueue ?? new Queue('github-crawler', {
  connection: redisConnection as unknown as ConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: 5000,
  },
});

export const hfQueue = globalForRedis.hfQueue ?? new Queue('hf-crawler', {
  connection: redisConnection as unknown as ConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
  },
});

export const crawlerQueueEvents = globalForRedis.crawlerQueueEvents ?? new QueueEvents('github-crawler', {
  connection: redisConnection as unknown as ConnectionOptions,
});

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.crawlerQueue = crawlerQueue;
  globalForRedis.hfQueue = hfQueue;
  globalForRedis.crawlerQueueEvents = crawlerQueueEvents;
}

