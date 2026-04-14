// ─── Trial Pass Service ──────────────────────────────────────
// 7-day streak-triggered Pro trial pass using Redis TTL keys.
// Duration is admin-configurable via platform_config.
// Free users who hit a 7-day streak get temporary Pro access.

import { getRedisClient } from '../lib/database.js';
import { configRepository } from '../repositories/config.repository.js';
import { subscriptionService } from './subscription.service.js';
import { createServiceLogger } from '../lib/logger.js';

const log = createServiceLogger('TrialPassService');

const TRIAL_PASS_KEY_PREFIX = 'trial_pass:';
const DEFAULT_DURATION_DAYS = 7;

export interface TrialPassStatus {
  active: boolean;
  expiresAt: string | null;
  remainingSeconds: number;
  durationDays: number;
}

class TrialPassService {
  private get redis() {
    return getRedisClient();
  }

  private key(userId: string): string {
    return `${TRIAL_PASS_KEY_PREFIX}${userId}`;
  }

  /** Get the admin-configured trial pass duration in days. */
  private async getDurationDays(): Promise<number> {
    return configRepository.getNumber('trial_pass_duration_days', DEFAULT_DURATION_DAYS);
  }

  // ─── Check Trial Pass Status ──────────────────────────────

  async getStatus(userId: string): Promise<TrialPassStatus> {
    const key = this.key(userId);
    const ttl = await this.redis.ttl(key);
    const durationDays = await this.getDurationDays();

    if (ttl <= 0) {
      return { active: false, expiresAt: null, remainingSeconds: 0, durationDays };
    }

    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
    return { active: true, expiresAt, remainingSeconds: ttl, durationDays };
  }

  /** Check if user has an active trial pass. Fast Redis TTL check. */
  async isActive(userId: string): Promise<boolean> {
    const ttl = await this.redis.ttl(this.key(userId));
    return ttl > 0;
  }

  // ─── Grant Trial Pass ─────────────────────────────────────

  /**
   * Grants a trial pass if the user is eligible:
   * 1. Must NOT have an active subscription.
   * 2. Must NOT already have an active trial pass.
   * 3. Must NOT have used a trial pass before (cooldown: once per 90 days).
   *
   * Called by the streak handler when a free user hits a 7-day streak.
   */
  async grantIfEligible(userId: string): Promise<{ granted: boolean; reason?: string }> {
    // 1. Check existing subscription
    const subCtx = await subscriptionService.getContext(userId);
    if (subCtx && ['active', 'trialing'].includes(subCtx.status)) {
      return { granted: false, reason: 'already_subscribed' };
    }

    // 2. Check existing active trial pass
    const existing = await this.redis.ttl(this.key(userId));
    if (existing > 0) {
      return { granted: false, reason: 'trial_pass_active' };
    }

    // 3. Check cooldown (once per 90 days)
    const cooldownKey = `trial_pass_used:${userId}`;
    const usedRecently = await this.redis.exists(cooldownKey);
    if (usedRecently) {
      return { granted: false, reason: 'cooldown_active' };
    }

    // 4. Grant the trial pass
    const durationDays = await this.getDurationDays();
    const ttlSeconds = durationDays * 24 * 60 * 60;

    await this.redis.setex(this.key(userId), ttlSeconds, 'active');
    // Set cooldown (90 days — prevents abuse)
    await this.redis.setex(cooldownKey, 90 * 24 * 60 * 60, '1');

    log.info({ userId, durationDays }, 'Trial pass granted');
    return { granted: true };
  }

  // ─── Revoke (admin override) ──────────────────────────────

  async revoke(userId: string): Promise<boolean> {
    const deleted = await this.redis.del(this.key(userId));
    if (deleted > 0) {
      log.info({ userId }, 'Trial pass revoked by admin');
    }
    return deleted > 0;
  }
}

export const trialPassService = new TrialPassService();
