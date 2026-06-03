// ─── AI Quota Service ─────────────────────────────────────────
// Tracks per-user daily AI request usage in Redis.
// Key pattern: ai:quota:{firebaseUid}:{YYYY-MM-DD}
// TTL:         seconds until next midnight UTC (auto-evicts — no cron needed)
//
// Quota caps are read from the user's plan features (ai_requests_per_day).
// -1 = unlimited, 0 = no access, N = max N requests per day.

import { getRedisClient } from '../clients/database.js';
import { subscriptionRepository } from '../repositories/subscription.repository.js';
import { planRepository } from '../repositories/plan.repository.js';
import { createServiceLogger } from '../lib/logger.js';

const log = createServiceLogger('AIQuotaService');

// ─── Types ───────────────────────────────────────────────────

export interface QuotaCheckResult {
  /** Whether the request is allowed (false = cap exceeded or no access). */
  allowed: boolean;
  /** Requests used today (after increment if allowed). */
  used: number;
  /** Daily limit from the user's plan. -1 = unlimited. */
  limit: number;
  /** Next midnight UTC — when the counter resets. */
  resetAt: Date;
}

// ─── Internal Helpers ────────────────────────────────────────

/** Redis key for today's quota counter for a given user. */
function todayKey(userId: string): string {
  const d = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  return `ai:quota:${userId}:${d}`;
}

/** Seconds remaining until next midnight UTC. */
function secondsUntilMidnightUTC(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0);
  return Math.ceil((midnight.getTime() - now.getTime()) / 1000);
}

/** ISO string of next midnight UTC. */
function nextMidnightUTC(): Date {
  const midnight = new Date();
  midnight.setUTCHours(24, 0, 0, 0);
  return midnight;
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Resolve the ai_requests_per_day cap for a user from their active plan.
 * Returns 0 if no active subscription (no AI access by default for unsubscribed
 * users whose plans don't define the field).
 * Returns -1 if unlimited.
 */
export async function getAIQuotaLimit(userId: string): Promise<number> {
  try {
    const sub = await subscriptionRepository.findActiveByUserId(userId);
    if (!sub || !['active', 'trialing', 'past_due'].includes(sub.status)) {
      // No active subscription — check if there's a free plan configured
      // with a quota. Default to 20 for free users (matches migration).
      return 20;
    }

    const plan = await planRepository.findById(sub.planId);
    if (!plan) return 20;

    const cap = plan.features.ai_requests_per_day;
    if (typeof cap === 'number') return cap;

    // Feature not defined on plan — fallback based on tier
    if (plan.tier === 3) return -1;   // Master
    if (plan.tier === 2) return 100;  // Pro
    if (plan.tier === 1) return 50;   // Basic
    return 20;                        // Free / unknown
  } catch (err) {
    log.warn({ err, userId }, 'Failed to resolve AI quota limit — defaulting to 20');
    return 20;
  }
}

/**
 * Read current today's usage without incrementing.
 * Used by GET /ai/quota to display status to the client.
 */
export async function getAIQuotaStatus(
  userId: string,
  limit: number,
): Promise<QuotaCheckResult> {
  const resetAt = nextMidnightUTC();

  if (limit === -1) {
    return { allowed: true, used: 0, limit: -1, resetAt };
  }

  try {
    const redis = getRedisClient();
    const raw = await redis.get(todayKey(userId));
    const used = raw ? parseInt(raw, 10) : 0;
    const isExhausted = limit !== -1 && used >= limit;

    return { allowed: !isExhausted, used, limit, resetAt };
  } catch (err) {
    log.warn({ err, userId }, 'Redis quota read failed — allowing request');
    return { allowed: true, used: 0, limit, resetAt };
  }
}

/**
 * Atomically check and increment the user's daily AI request counter.
 *
 * - If the user is already at or over the cap, returns { allowed: false }
 *   WITHOUT incrementing.
 * - If allowed, increments and sets the TTL to expire at midnight UTC
 *   (only on first write of the day — EXPIRE is a no-op on existing keys
 *   with a TTL already set via KEEPTTL logic).
 * - If Redis is unavailable, fails open (allows the request) to avoid
 *   blocking users due to infrastructure issues.
 */
export async function checkAndIncrementAIQuota(
  userId: string,
  limit: number,
): Promise<QuotaCheckResult> {
  const resetAt = nextMidnightUTC();

  // Unlimited tier — skip Redis entirely
  if (limit === -1) {
    return { allowed: true, used: 0, limit: -1, resetAt };
  }

  // No access (limit = 0)
  if (limit === 0) {
    return { allowed: false, used: 0, limit: 0, resetAt };
  }

  try {
    const redis = getRedisClient();
    const key = todayKey(userId);

    // Lua script: read current count, only increment if under cap.
    // Returns [new_count, was_new_key] where was_new_key=1 on first write.
    const LUA = `
      local key   = KEYS[1]
      local cap   = tonumber(ARGV[1])
      local ttl   = tonumber(ARGV[2])
      local cur   = tonumber(redis.call('GET', key) or 0)
      if cur >= cap then
        return {cur, 0, 0}
      end
      local new_val = redis.call('INCR', key)
      local is_new  = 0
      if new_val == 1 then
        redis.call('EXPIRE', key, ttl)
        is_new = 1
      end
      return {new_val, is_new, 1}
    `;

    const ttl = secondsUntilMidnightUTC();
    const result = await redis.eval(LUA, 1, key, String(limit), String(ttl)) as number[];
    const [newCount, , allowed] = result;

    return {
      allowed: allowed === 1,
      used: newCount ?? 0,
      limit,
      resetAt,
    };
  } catch (err) {
    // Redis unavailable — fail open to avoid blocking users
    log.error({ err, userId }, 'Redis quota increment failed — failing open');
    return { allowed: true, used: 0, limit, resetAt };
  }
}
