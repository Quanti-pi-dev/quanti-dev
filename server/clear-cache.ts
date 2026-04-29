import { getRedisClient } from './src/lib/database.js';

async function clearCache() {
  const redis = getRedisClient();
  const keys = await redis.keys('sub:*');
  if (keys.length > 0) {
    await redis.del(...keys);
    console.log(`Cleared ${keys.length} subscription caches.`);
  } else {
    console.log('No subscription caches to clear.');
  }
  process.exit(0);
}

clearCache().catch(console.error);
