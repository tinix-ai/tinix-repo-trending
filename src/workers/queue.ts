import { Queue, ConnectionOptions } from 'bullmq';
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
  githubUpdaterQueue: Queue | undefined;
  hfUpdaterQueue: Queue | undefined;
  schedulerQueue: Queue | undefined;
  socialCrawlerQueue: Queue | undefined;
};

const isNewConnection = !globalForRedis.redisConnection;
export const redisConnection = globalForRedis.redisConnection ?? new Redis(redisConfig);

if (isNewConnection) {
  redisConnection.on('error', (err) => {
    console.error('[Redis Connection] Global Redis connection error:', err.message);
  });
}

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
    removeOnFail: { count: 500 },
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
    removeOnFail: { count: 500 },
  },
});

// Create the updater queues
export const githubUpdaterQueue = globalForRedis.githubUpdaterQueue ?? new Queue('github-updater', {
  connection: redisConnection as unknown as ConnectionOptions,
  defaultJobOptions: {
    attempts: 8,
    backoff: {
      type: 'exponential',
      delay: 30000,
    },
    removeOnComplete: { count: 20 },
    removeOnFail: { count: 500 },
  },
});

export const hfUpdaterQueue = globalForRedis.hfUpdaterQueue ?? new Queue('hf-updater', {
  connection: redisConnection as unknown as ConnectionOptions,
  defaultJobOptions: {
    attempts: 8,
    backoff: {
      type: 'exponential',
      delay: 30000,
    },
    removeOnComplete: { count: 20 },
    removeOnFail: { count: 500 },
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

export const socialCrawlerQueue = globalForRedis.socialCrawlerQueue ?? new Queue('social-crawler', {
  connection: redisConnection as unknown as ConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 10000,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.crawlerQueue = crawlerQueue;
  globalForRedis.hfQueue = hfQueue;
  globalForRedis.githubUpdaterQueue = githubUpdaterQueue;
  globalForRedis.hfUpdaterQueue = hfUpdaterQueue;
  globalForRedis.schedulerQueue = schedulerQueue;
  globalForRedis.socialCrawlerQueue = socialCrawlerQueue;
}

