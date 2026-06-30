import Redis from 'ioredis';

/**
 * Periodically reports memory and basic process performance stats of a worker to Redis.
 * Updates are written to a Redis hash 'system:worker:memory'.
 */
export function startMemoryReporting(workerName: string, redis: Redis, intervalMs = 15000) {
  const report = async () => {
    try {
      const memory = process.memoryUsage();
      const cpu = process.cpuUsage();
      const load = {
        rss: memory.rss,
        heapUsed: memory.heapUsed,
        heapTotal: memory.heapTotal,
        external: memory.external,
        cpuUser: cpu.user,
        cpuSystem: cpu.system,
        timestamp: Date.now()
      };
      
      await redis.hset('system:worker:memory', workerName, JSON.stringify(load));
    } catch (err) {
      console.error(`[Metrics] Failed to report memory usage for ${workerName}:`, err);
    }
  };

  // Run first update immediately
  report().catch((err) => {
    console.error(`[Metrics] Initial memory report failed for ${workerName}:`, err);
  });

  const timer = setInterval(() => {
    report().catch((err) => {
      console.error(`[Metrics] Intermittent memory report failed for ${workerName}:`, err);
    });
  }, intervalMs);

  // Return a cleanup function to clear the interval
  return () => {
    clearInterval(timer);
  };
}

/**
 * Starts a job active heartbeat in Redis.
 * Sets the key 'job:active:${jobName}' with 30s TTL every 10 seconds.
 */
export function startJobHeartbeat(jobName: string, redis: Redis, intervalMs = 10000) {
  const key = `job:active:${jobName}`;
  const pid = process.pid.toString();
  
  const tick = async () => {
    try {
      await redis.set(key, pid, 'EX', 30);
    } catch (err) {
      console.error(`[Metrics] Failed to write heartbeat for job ${jobName}:`, err);
    }
  };

  // Run immediately
  tick().catch((err) => {
    console.error(`[Metrics] Initial heartbeat failed for job ${jobName}:`, err);
  });

  const timer = setInterval(() => {
    tick().catch((err) => {
      console.error(`[Metrics] Intermittent heartbeat failed for job ${jobName}:`, err);
    });
  }, intervalMs);

  return {
    stop: async () => {
      clearInterval(timer);
      try {
        await redis.del(key);
      } catch (err) {
        console.error(`[Metrics] Failed to clean heartbeat for job ${jobName}:`, err);
      }
    }
  };
}

