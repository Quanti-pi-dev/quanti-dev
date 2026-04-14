// ─── Reward Service ─────────────────────────────────────────
// Central authority for all coin-award logic.
//
// Rules enforced here:
//   1. Daily cap  — admin-configurable via platform_config (default 100).
//   2. Dedup      — correct-answer +1 is only awarded once per
//                   (userId, examId, subjectId, level, cardId).
//   3. Streak     — milestone coins fire only when streak reaches
//                   exactly 3, 7, or 30 (not repeatedly after).
//   4. Audit      — every award is written to coin_transactions.
//
// This service NEVER receives coin amounts from the client.
// All amounts come from platform_config (admin-editable),
// with hardcoded fallbacks for safety.

import { getRedisClient, getPostgresPool } from '../lib/database.js';
import { createServiceLogger } from '../lib/logger.js';

const log = createServiceLogger('RewardService');
import { gamificationRepository } from '../repositories/gamification.repository.js';
import { configRepository } from '../repositories/config.repository.js';
import type { CoinTransactionReason } from '@kd/shared';

// ─── Hardcoded Fallbacks (used if platform_config is unavailable) ─
const DEFAULT_COINS = {
  CORRECT_ANSWER:        1,
  PERFECT_SESSION:       3,
  LEVEL_UNLOCK:          5,
  MASTER_LEVEL:         20,
  STREAK_3:              5,
  STREAK_7:             10,
  STREAK_30:            50,
} as const;

const DEFAULT_DAILY_CAP = 100;

// ─── Award Result ────────────────────────────────────────────
export interface AwardResult {
  coinsAwarded: number;
  newBalance: number;
  cappedBy?: number; // if > 0, the award was clamped to fit the daily cap
}

// ─── Reward Service ─────────────────────────────────────────
class RewardService {
  private get redis() {
    return getRedisClient();
  }

  private get pg() {
    return getPostgresPool();
  }

  // ─── Config Loaders (admin-editable, with safe fallbacks) ──

  private async getCoinValue(key: string, fallback: number): Promise<number> {
    return configRepository.getNumber(key, fallback);
  }

  private async getDailyCap(): Promise<number> {
    return configRepository.getNumber('coin_daily_cap', DEFAULT_DAILY_CAP);
  }

  // ─── Public Award Methods ──────────────────────────────────

  /**
   * Award +1 coin for a correct answer on a card — only on first-time correct.
   * Subsequent correct answers for the same card are silently ignored.
   */
  async awardForCorrectAnswer(
    userId: string,
    cardId: string,
    examId: string,
    subjectId: string,
    level: string,
    topicSlug: string,
  ): Promise<AwardResult | null> {
    const dedupKey = `answered_cards:${userId}:${examId}:${subjectId}:${topicSlug}:${level}`;

    // Atomic dedup: SADD returns 1 if newly added, 0 if already existed (FIX P11)
    const added = await this.redis.sadd(dedupKey, cardId);
    if (added === 0) return null; // Already answered — no double reward

    // Refresh TTL (90-day — long enough to be permanent for practical purposes)
    await this.redis.expire(dedupKey, 60 * 60 * 24 * 90);

    const amount = await this.getCoinValue('coin_correct_answer', DEFAULT_COINS.CORRECT_ANSWER);
    return this.award(userId, amount, 'correct_answer', cardId);
  }

  /**
   * Award +5 coins when a level is freshly unlocked.
   */
  async awardForLevelUnlock(userId: string, level: string): Promise<AwardResult> {
    const amount = await this.getCoinValue('coin_level_unlock', DEFAULT_COINS.LEVEL_UNLOCK);
    return this.award(userId, amount, 'level_unlock', level);
  }

  /**
   * Award +20 coins when the Master level is completed for any subject.
   */
  async awardForMasterCompletion(userId: string, subjectId: string): Promise<AwardResult> {
    const amount = await this.getCoinValue('coin_master_level', DEFAULT_COINS.MASTER_LEVEL);
    return this.award(userId, amount, 'master_level_completed', subjectId);
  }

  /**
   * Award streak milestone coins.
   * Only pays out when streak hits exactly 3, 7, or 30.
   * Returns null if the streak value doesn't match a milestone.
   */
  async awardForStreakMilestone(userId: string, streak: number): Promise<AwardResult | null> {
    let amount: number;
    let reason: CoinTransactionReason;

    if (streak === 3)       { amount = await this.getCoinValue('coin_streak_3', DEFAULT_COINS.STREAK_3);  reason = 'streak_3'; }
    else if (streak === 7)  { amount = await this.getCoinValue('coin_streak_7', DEFAULT_COINS.STREAK_7);  reason = 'streak_7'; }
    else if (streak === 30) { amount = await this.getCoinValue('coin_streak_30', DEFAULT_COINS.STREAK_30); reason = 'streak_30'; }
    else return null;

    return this.award(userId, amount, reason, String(streak));
  }

  /**
   * Award +3 coins for a perfect session (100% correct answers).
   */
  async awardForPerfectSession(userId: string, sessionRef?: string): Promise<AwardResult> {
    const amount = await this.getCoinValue('coin_perfect_session', DEFAULT_COINS.PERFECT_SESSION);
    return this.award(userId, amount, 'perfect_session', sessionRef ?? null);
  }

  // ─── Core Award Engine ────────────────────────────────────

  /**
   * Internal award mechanism.
   * 1. Checks daily cap — clamps award if needed.
   * 2. Calls gamificationRepository.earnCoins() to update Redis balance + leaderboard.
   * 3. Writes a coin_transaction row to PostgreSQL for audit/history.
   */
  private async award(
    userId: string,
    requestedAmount: number,
    reason: CoinTransactionReason | string,
    referenceId: string | null,
  ): Promise<AwardResult> {
    const actual = await this.checkAndApplyDailyCap(userId, requestedAmount);

    if (actual === 0) {
      // Daily cap already reached — get current balance without awarding
      const balance = await gamificationRepository.getCoinBalance(userId);
      return { coinsAwarded: 0, newBalance: balance.balance, cappedBy: requestedAmount };
    }

    const balance = await gamificationRepository.earnCoins(userId, actual, reason);
    await this.recordTransaction(userId, actual, reason, referenceId);

    const result: AwardResult = { coinsAwarded: actual, newBalance: balance.balance };
    if (actual < requestedAmount) result.cappedBy = requestedAmount - actual;
    return result;
  }

  /**
   * Lua script that atomically reads the daily counter, computes allowable
   * award (clamped to remaining cap), increments, and sets a 24h TTL.
   * Eliminates the TOCTOU race between GET and INCRBY.
   */
  private static DAILY_CAP_LUA = `
    local key = KEYS[1]
    local requested = tonumber(ARGV[1])
    local cap = tonumber(ARGV[2])
    local current = tonumber(redis.call('GET', key) or '0')
    local remaining = math.max(0, cap - current)
    local actual = math.min(requested, remaining)
    if actual > 0 then
      redis.call('INCRBY', key, actual)
      redis.call('EXPIRE', key, 86400)
    end
    return actual
  `;

  /**
   * Returns how many coins can actually be awarded without exceeding
   * the daily cap. Atomically increments the daily counter via Lua script.
   */
  private async checkAndApplyDailyCap(userId: string, requested: number): Promise<number> {
    const key = `coins_daily:${userId}:${new Date().toISOString().slice(0, 10)}`; // YYYY-MM-DD

    const dailyCap = await this.getDailyCap();
    const result = await this.redis.eval(
      RewardService.DAILY_CAP_LUA, 1, key, requested, dailyCap,
    );
    return result as number;
  }

  /**
   * Writes one row to coin_transactions (PostgreSQL).
   * Failures are caught and logged — they must never break the main flow.
   */
  private async recordTransaction(
    userId: string,
    amount: number,
    reason: string,
    referenceId: string | null,
  ): Promise<void> {
    try {
      await this.pg.query(
        `INSERT INTO coin_transactions (user_id, amount, reason, reference_id)
         VALUES ((SELECT id FROM users WHERE auth0_id = $1), $2, $3, $4)`,
        [userId, amount, reason, referenceId],
      );
    } catch (err) {
      // Non-critical — balance is already updated in Redis
      log.error({ userId, reason, err }, 'failed to record coin transaction');
    }
  }

  // ─── Spend Record ─────────────────────────────────────────
  /**
   * Record a shop purchase in coin_transactions (negative amount).
   * Called from gamificationRepository after a successful purchase.
   */
  async recordSpend(userId: string, amount: number, itemId: string): Promise<void> {
    await this.recordTransaction(userId, -amount, 'shop_purchase', itemId);
  }
}

export const rewardService = new RewardService();
