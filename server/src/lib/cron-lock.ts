// ─── Distributed Cron Lock ─────────────────────────────────
// Prevents concurrent execution of the same cron job across
// multiple server instances using Redis SET NX EX (atomic).
//
// How it works:
//   1. Before a cron fires, `withCronLock` attempts to acquire
//      a Redis key with a TTL (the lock).
//   2. If SET NX returns 'OK', this instance "owns" the job and
//      runs it. The TTL auto-releases the lock even if the job
//      crashes, so no manual cleanup is needed.
//   3. If SET NX returns null, another instance already holds the
//      lock — this instance silently skips.
//
// This is safe for Render's zero-downtime deploys where old and
// new containers overlap, and future multi-instance scaling.

import { getRedisClient } from './database.js';

const LOCK_PREFIX = 'cron:lock:';

/**
 * Attempt to run `job` under a distributed Redis lock.
 *
 * @param name   - Unique job name (e.g. 'expire-subscriptions')
 * @param ttlSec - Lock TTL in seconds. Should be slightly longer
 *                 than the expected max runtime of the job so the
 *                 lock doesn't expire mid-execution.
 * @param job    - Async function to execute if the lock is acquired.
 * @param logger - Optional logger for skip / error telemetry.
 */
export async function withCronLock(
  name: string,
  ttlSec: number,
  job: () => Promise<void>,
  logger?: { info: (msg: string) => void; error: (obj: unknown, msg: string) => void },
): Promise<void> {
  const redis = getRedisClient();
  const key = `${LOCK_PREFIX}${name}`;

  // SET key value NX EX ttl — atomic "acquire lock if absent"
  const acquired = await redis.set(key, Date.now().toString(), 'EX', ttlSec, 'NX');

  if (acquired !== 'OK') {
    logger?.info(`[cron-lock] Skipping "${name}" — another instance holds the lock`);
    return;
  }

  try {
    await job();
  } catch (err) {
    logger?.error(err, `[cron-lock] Job "${name}" failed`);
  }
  // Lock auto-expires via TTL — no DEL needed.
  // This also means if the job crashes, the lock self-heals.
}
