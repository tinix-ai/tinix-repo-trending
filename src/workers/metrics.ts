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
