// ─── Variable Reward Service ────────────────────────────────
// Wraps reward.service.ts with a probability layer to implement
// variable-ratio reinforcement (the "slot machine" of learning).
//
// Psychology: Deterministic rewards (always +1) create habituation.
// Variable rewards activate dopamine prediction-error signals,
// making each correct answer feel like a potential jackpot.
//
// Expected value per correct answer: ~1.7 coins (higher than flat +1),
// but the VARIANCE is what drives engagement.
//
// Rarity system:
//   common    (70%) → base coins (1)
//   rare      (20%) → 3× base
//   epic      ( 8%) → 5× base
//   legendary ( 2%) → 10× base

import { getRedisClient } from '../clients/database.js';
import { gamificationRepository } from '../repositories/gamification.repository.js';
import { configRepository } from '../repositories/config.repository.js';
import { createServiceLogger } from '../lib/logger.js';

const log = createServiceLogger('VariableRewardService');

// ─── Rarity Tiers ───────────────────────────────────────────

export type CoinDropRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface VariableRewardResult {
  /** Total coins awarded (after daily cap) */
  coinsAwarded: number;
  /** Updated wallet balance */
  newBalance: number;
  /** Drop rarity tier — controls client celebration intensity */
  rarity: CoinDropRarity;
  /** Multiplier applied to base coin value */
  multiplier: number;
  /** True if an active multiplier (daily chest, flash event) boosted this drop */
  boosted: boolean;
  /** If > 0, some coins were clamped by the daily cap */
  cappedBy?: number;
}

interface RarityTier {
  rarity: CoinDropRarity;
  weight: number;       // cumulative probability threshold (0-1)
  multiplier: number;   // coin multiplier vs base
}

// Cumulative distribution — roll a random [0, 1) and pick the first tier
// whose weight is >= the roll.
const RARITY_TIERS: RarityTier[] = [
  { rarity: 'common',    weight: 0.70, multiplier: 1 },
  { rarity: 'rare',      weight: 0.90, multiplier: 3 },
  { rarity: 'epic',      weight: 0.98, multiplier: 5 },
  { rarity: 'legendary', weight: 1.00, multiplier: 10 },
];

// ─── Daily Cap Lua Script (same as reward.service.ts) ───────
// Atomically checks + increments the daily coin counter.
const DAILY_CAP_LUA = `
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

// ─── Daily Bonus Chest ──────────────────────────────────────

export type ChestTier = 'bronze' | 'silver' | 'gold';

export interface DailyChestResult {
  /** Whether the chest was opened (false if already opened today) */
  opened: boolean;
  /** Tier determines animation intensity on the client */
  tier: ChestTier;
  /** Coins from the chest */
  coinsAwarded: number;
  /** Optional temporary multiplier (e.g. "2x coins for 30 min") */
  multiplierGranted: number | null;
  multiplierDurationMinutes: number | null;
}

// ─── Near-Miss Type ─────────────────────────────────────────

export interface NearMiss {
  type: 'level_unlock' | 'streak_milestone' | 'perfect_accuracy';
  /** Human-readable celebration message (with emoji) */
  message: string;
  /** How close to the goal (0-100%) — controls animation intensity */
  proximity: number;
}

// ─── Variable Reward Service ────────────────────────────────

class VariableRewardService {
  private get redis() {
    return getRedisClient();
  }

  // ─── Variable Coin Drop ──────────────────────────────────

  /**
   * Roll a variable reward for a correct answer.
   * Replaces the flat +1 coin from reward.service with a weighted random drop.
   *
   * The dedup logic (first-time per card) is handled by the caller in
   * progress.routes.ts (same SADD pattern as the original).
   *
   * @returns VariableRewardResult with rarity info, or null if daily cap reached.
   */
  async rollCorrectAnswerReward(
    userId: string,
    referenceId: string,
  ): Promise<VariableRewardResult> {
    // Roll rarity
    const { rarity, multiplier } = this.rollRarity();

    // Check for active multiplier boost (daily chest / flash event)
    const boostMultiplier = await this.getActiveBoost(userId);
    const effectiveMultiplier = multiplier * boostMultiplier;
    const boosted = boostMultiplier > 1;

    // Compute coin amount
    const base = await configRepository.getNumber('coin_correct_answer', 1);
    const requestedCoins = Math.round(base * effectiveMultiplier);

    // Apply daily cap atomically
    const dailyCap = await configRepository.getNumber('coin_daily_cap', 100);
    const capKey = `coins_daily:${userId}:${new Date().toISOString().slice(0, 10)}`;
    const actualCoins = await this.redis.eval(
      DAILY_CAP_LUA, 1, capKey, requestedCoins, dailyCap,
    ) as number;

    // Award coins (balance + leaderboard)
    let newBalance = 0;
    if (actualCoins > 0) {
      const balance = await gamificationRepository.earnCoins(userId, actualCoins, 'correct_answer');
      newBalance = balance.balance;

      // Record in PostgreSQL audit trail (fire-and-forget)
      void this.recordTransaction(userId, actualCoins, 'correct_answer', referenceId)
        .catch(() => {});
    } else {
      const balance = await gamificationRepository.getCoinBalance(userId);
      newBalance = balance.balance;
    }

    // Track rarity stats for analytics (fire-and-forget)
    void this.trackDropStats(userId, rarity).catch(() => {});

    const result: VariableRewardResult = {
      coinsAwarded: actualCoins,
      newBalance,
      rarity,
      multiplier: effectiveMultiplier,
      boosted,
    };
    if (actualCoins < requestedCoins) result.cappedBy = requestedCoins - actualCoins;
    return result;
  }

  // ─── Rarity Roll ─────────────────────────────────────────

  private rollRarity(): { rarity: CoinDropRarity; multiplier: number } {
    const roll = Math.random();
    for (const tier of RARITY_TIERS) {
      if (roll < tier.weight) {
        return { rarity: tier.rarity, multiplier: tier.multiplier };
      }
    }
    // Fallback (should never reach)
    return { rarity: 'common', multiplier: 1 };
  }

  // ─── Active Boost Check ──────────────────────────────────

  /**
   * Checks if the user has an active coin multiplier from:
   * 1. Daily bonus chest (coin_boost:{userId} with TTL)
   * 2. Flash events (flash_event_boost:{userId} with TTL)
   *
   * Returns the multiplier (1.0 if no boost active).
   */
  private async getActiveBoost(userId: string): Promise<number> {
    const pipeline = this.redis.pipeline();
    pipeline.get(`coin_boost:${userId}`);
    pipeline.get(`flash_event_boost:${userId}`);
    const results = await pipeline.exec();

    const chestBoost = parseFloat((results?.[0]?.[1] as string) || '1');
    const flashBoost = parseFloat((results?.[1]?.[1] as string) || '1');

    // Stack: multiply both boosts (e.g. 2x chest × 1.5x flash = 3x)
    return Math.max(1, chestBoost * flashBoost);
  }

  // ─── Daily Bonus Chest ────────────────────────────────────

  /**
   * Opens the daily bonus chest for the user.
   * Called once per day on the first study session.
   *
   * Chest tiers (random):
   *   bronze (60%) — 5-10 coins
   *   silver (30%) — 10-25 coins + 2x boost for 15 min
   *   gold   (10%) — 25-50 coins + 2x boost for 30 min
   */
  async openDailyChest(userId: string): Promise<DailyChestResult> {
    const today = new Date().toISOString().slice(0, 10);
    const chestKey = `daily_chest:${userId}:${today}`;

    // Atomic: only allow one chest per day
    const claimed = await this.redis.setnx(chestKey, '1');
    if (!claimed) {
      return {
        opened: false,
        tier: 'bronze',
        coinsAwarded: 0,
        multiplierGranted: null,
        multiplierDurationMinutes: null,
      };
    }
    // Expire at end of day + buffer
    await this.redis.expire(chestKey, 86400 + 3600);

    // Roll chest tier
    const roll = Math.random();
    let tier: ChestTier;
    let minCoins: number;
    let maxCoins: number;
    let boostMultiplier: number | null = null;
    let boostMinutes: number | null = null;

    if (roll < 0.60) {
      tier = 'bronze';
      minCoins = 5;
      maxCoins = 10;
    } else if (roll < 0.90) {
      tier = 'silver';
      minCoins = 10;
      maxCoins = 25;
      boostMultiplier = 2;
      boostMinutes = 15;
    } else {
      tier = 'gold';
      minCoins = 25;
      maxCoins = 50;
      boostMultiplier = 2;
      boostMinutes = 30;
    }

    const coinsAwarded = Math.floor(Math.random() * (maxCoins - minCoins + 1)) + minCoins;

    // Award coins (balance + leaderboard)
    await gamificationRepository.earnCoins(userId, coinsAwarded, 'daily_chest');
    void this.recordTransaction(userId, coinsAwarded, 'daily_chest', today).catch(() => {});

    // Grant temporary coin boost if applicable
    if (boostMultiplier && boostMinutes) {
      const boostKey = `coin_boost:${userId}`;
      const ttlSeconds = boostMinutes * 60;
      await this.redis.setex(boostKey, ttlSeconds, String(boostMultiplier));
    }

    log.info({ userId, tier, coinsAwarded, boostMultiplier }, 'Daily chest opened');

    return {
      opened: true,
      tier,
      coinsAwarded,
      multiplierGranted: boostMultiplier,
      multiplierDurationMinutes: boostMinutes,
    };
  }

  /**
   * Check if the user has already opened today's chest.
   * Used by the mobile client to show/hide the chest icon.
   */
  async hasOpenedChestToday(userId: string): Promise<boolean> {
    const today = new Date().toISOString().slice(0, 10);
    const exists = await this.redis.exists(`daily_chest:${userId}:${today}`);
    return exists === 1;
  }

  // ─── Near-Miss Detection ──────────────────────────────────

  /**
   * Analyse current progress state and return near-miss celebration data.
   * Called after each level-answer to surface "so close!" moments.
   *
   * Near-miss triggers:
   *   1. Level unlock: within 3 correct answers of threshold (30)
   *   2. Perfect session: high accuracy (>= 90%) but not quite 100%
   *   3. Streak milestone: 1-2 days from 3, 7, or 30
   */
  detectNearMisses(
    correctAnswers: number,
    totalAnswers: number,
    currentStreak: number,
    sessionAccuracy?: number,
  ): NearMiss[] {
    const nearMisses: NearMiss[] = [];

    // 1. Near level unlock (within 3 of threshold)
    const THRESHOLD = 30;
    const remaining = THRESHOLD - correctAnswers;
    if (remaining > 0 && remaining <= 3) {
      nearMisses.push({
        type: 'level_unlock',
        message: `🔓 ${remaining} more correct answer${remaining > 1 ? 's' : ''} to unlock the next level!`,
        proximity: Math.round(((THRESHOLD - remaining) / THRESHOLD) * 100),
      });
    }

    // 2. Near streak milestone
    const streakMilestones = [3, 7, 30];
    for (const milestone of streakMilestones) {
      const daysTo = milestone - currentStreak;
      if (daysTo > 0 && daysTo <= 2) {
        nearMisses.push({
          type: 'streak_milestone',
          message: `🔥 ${daysTo} more day${daysTo > 1 ? 's' : ''} to reach a ${milestone}-day streak!`,
          proximity: Math.round((currentStreak / milestone) * 100),
        });
        break; // Only show the nearest milestone
      }
    }

    // 3. Near perfect accuracy in this session
    if (sessionAccuracy !== undefined && totalAnswers >= 5) {
      if (sessionAccuracy >= 90 && sessionAccuracy < 100) {
        nearMisses.push({
          type: 'perfect_accuracy',
          message: `🎯 ${sessionAccuracy}% accuracy — SO close to perfect!`,
          proximity: sessionAccuracy,
        });
      }
    }

    return nearMisses;
  }

  // ─── Drop Stats (Analytics) ───────────────────────────────

  /**
   * Track rarity distribution for admin analytics.
   * Stored as a Redis hash: `drop_stats:{YYYY-MM-DD}`
   */
  private async trackDropStats(_userId: string, rarity: CoinDropRarity): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const key = `drop_stats:${today}`;
    await this.redis.hincrby(key, rarity, 1);
    await this.redis.hincrby(key, 'total', 1);
    await this.redis.expire(key, 86400 * 30); // 30-day retention
  }

  // ─── Audit Trail ──────────────────────────────────────────

  /**
   * Writes one row to coin_transactions (PostgreSQL).
   * Mirrors reward.service.ts recordTransaction for consistency.
   */
  private async recordTransaction(
    userId: string,
    amount: number,
    reason: string,
    referenceId: string | null,
  ): Promise<void> {
    try {
      const { getPostgresPool } = await import('../clients/database.js');
      const pg = getPostgresPool();
      await pg.query(
        `INSERT INTO coin_transactions (user_id, amount, reason, reference_id)
         SELECT id, $2, $3, $4 FROM users WHERE firebase_uid = $1`,
        [userId, amount, reason, referenceId],
      );
    } catch (err) {
      log.error({ userId, reason, err }, 'failed to record coin transaction');
    }
  }
}

export const variableRewardService = new VariableRewardService();
