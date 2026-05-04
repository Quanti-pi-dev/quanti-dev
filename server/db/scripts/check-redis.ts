import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

const redis = new Redis(process.env.REDIS_URL || '');

async function run() {
  const keys = await redis.keys('level_progress_keys:*');
  console.log(`Found ${keys.length} level_progress_keys sets.`);
  for (const k of keys) {
    const members = await redis.smembers(k);
    console.log(`${k}:`, members);
  }

  const memoryKeys = await redis.keys('card_memory_keys:*');
  console.log(`Found ${memoryKeys.length} card_memory_keys sets.`);
  for (const k of memoryKeys) {
    const count = await redis.scard(k);
    console.log(`${k}: ${count} items`);
  }

  redis.disconnect();
}

run().catch(console.error);
