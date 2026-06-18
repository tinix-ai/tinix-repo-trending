import 'dotenv/config';
import Redis from 'ioredis';

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
};

async function main() {
  const redis = new Redis(redisConfig);
  try {
    const keys = await redis.keys('crawler:token:exhausted:*');
    console.log('--- Redis Token Locks ---');
    console.log(`Found ${keys.length} locked token keys in Redis:`);
    for (const key of keys) {
      const val = await redis.get(key);
      const ttl = await redis.ttl(key);
      console.log(`- Key: ${key}`);
      console.log(`  Value (Reset Timestamp): ${val} (${new Date(parseInt(val || '0')).toLocaleString()})`);
      console.log(`  TTL (Seconds remaining): ${ttl}s`);
    }
  } catch (err) {
    console.error(err);
  }
  redis.disconnect();
  process.exit(0);
}

main();
