// ─── Gamification Repository ────────────────────────────────
// Redis-primary for coins, badges, leaderboards.
// PostgreSQL for badge/shop-item definitions, purchase records,
// coin transaction history, and unlocked deck records.

import { getRedisClient } from '../lib/database.js';
import { getPostgresPool } from '../lib/database.js';
import { publishScoreUpdate } from '../services/realtime.service.js';
import { rewardService } from '../services/reward.service.js';
import type { CoinBalance, CoinTransaction, LeaderboardEntry, Leaderboard, UserBadge, ShopItem, PurchaseEffect } from '@kd/shared';

class GamificationRepository {
  private get redis() {
    return getRedisClient();
  }

  private get pg() {
    return getPostgresPool();
  }

  // ═══════════════════════════════════════════════════════
  // COINS
  // ═══════════════════════════════════════════════════════

  async getCoinBalance(userId: string): Promise<CoinBalance> {
    const [balance, lifetime] = await this.redis.mget(`coins:${userId}`, `coins_lifetime:${userId}`);
    return {
      userId,
      balance: parseInt(balance ?? '0', 10),
      lifetimeEarned: parseInt(lifetime ?? '0', 10),
    };
  }

  async earnCoins(userId: string, amount: number, _reason: string): Promise<CoinBalance> {
    const pipeline = this.redis.pipeline();
    pipeline.incrby(`coins:${userId}`, amount);
    pipeline.incrby(`coins_lifetime:${userId}`, amount);
    await pipeline.exec();

    // Also update leaderboard score
    await this.redis.zincrby('leaderboard:global', amount, userId);
    await this.redis.zincrby('leaderboard:weekly', amount, userId);

    // Broadcast real-time score update via Redis Pub/Sub
    const newGlobalScore = await this.redis.zscore('leaderboard:global', userId);
    if (newGlobalScore) {
      publishScoreUpdate(userId, amount, parseFloat(newGlobalScore), 'global').catch(() => {});
    }

    return this.getCoinBalance(userId);
  }

  /**
   * Atomic spend via Lua script — prevents TOCTOU race condition where
   * two concurrent purchases both pass the balance check and double-spend.
   * Returns -1 if insufficient balance, otherwise the new balance.
   */
  private static SPEND_COINS_LUA = `
    local key = KEYS[1]
    local amount = tonumber(ARGV[1])
    local current = tonumber(redis.call('GET', key) or '0')
    if current < amount then
      return -1
    end
    redis.call('DECRBY', key, amount)
    return current - amount
  `;

  async spendCoins(userId: string, amount: number): Promise<{ success: boolean; balance: CoinBalance }> {
    const result = await this.redis.eval(
      GamificationRepository.SPEND_COINS_LUA, 1, `coins:${userId}`, amount,
    ) as number;

    if (result === -1) {
      return { success: false, balance: await this.getCoinBalance(userId) };
    }

    return { success: true, balance: await this.getCoinBalance(userId) };
  }

  /**
   * Credit coins to a user's spendable balance ONLY.
   * Does NOT update lifetime earned, leaderboard scores, or daily cap.
   * Used exclusively for challenge payouts and refunds — these are
   * coin transfers, not earned rewards.
   */
  async creditCoins(userId: string, amount: number): Promise<CoinBalance> {
    await this.redis.incrby(`coins:${userId}`, amount);
    return this.getCoinBalance(userId);
  }

  // ═══════════════════════════════════════════════════════
  // BADGES
  // ═══════════════════════════════════════════════════════

  async getUserBadges(userId: string): Promise<UserBadge[]> {
    // Get badge IDs from Redis set
    const badgeIds = await this.redis.smembers(`badges:${userId}`);
    if (badgeIds.length === 0) return [];

    // Fetch badge details from PostgreSQL
    const placeholders = badgeIds.map((_, i) => `$${i + 1}`).join(', ');
    const result = await this.pg.query(
      `SELECT b.id, b.name, b.description, b.icon_url, b.criteria, b.created_at,
              ub.earned_at
       FROM badges b
       JOIN user_badges ub ON ub.badge_id = b.id
       WHERE b.id::text IN (${placeholders})
       AND ub.user_id = (SELECT id FROM users WHERE firebase_uid = $${badgeIds.length + 1})
       ORDER BY ub.earned_at DESC`,
      [...badgeIds, userId],
    );

    return result.rows.map((row: Record<string, unknown>) => ({
      badgeId: row.id as string,
      badge: {
        id: row.id as string,
        name: row.name as string,
        description: row.description as string,
        iconUrl: row.icon_url as string,
        criteria: row.criteria as string,
        createdAt: (row.created_at as Date).toISOString(),
      },
      earnedAt: (row.earned_at as Date).toISOString(),
    }));
  }

  async awardBadge(userId: string, badgeId: string): Promise<{ awarded: boolean }> {
    // Check if already earned
    const already = await this.redis.sismember(`badges:${userId}`, badgeId);
    if (already) return { awarded: false };

    // Add to Redis set
    await this.redis.sadd(`badges:${userId}`, badgeId);

    // Record in PostgreSQL
    await this.pg.query(
      `INSERT INTO user_badges (user_id, badge_id)
       VALUES ((SELECT id FROM users WHERE firebase_uid = $1), $2)
       ON CONFLICT (user_id, badge_id) DO NOTHING`,
      [userId, badgeId],
    );

    return { awarded: true };
  }

  // ═══════════════════════════════════════════════════════
  // LEADERBOARD
  // ═══════════════════════════════════════════════════════

  async getLeaderboard(
    userId: string,
    type: 'global' | 'weekly' = 'global',
    limit: number = 50,
  ): Promise<Leaderboard> {
    const key = `leaderboard:${type}`;

    // Get top N with scores
    const results = await this.redis.zrevrange(key, 0, limit - 1, 'WITHSCORES');

    // Collect member IDs and scores
    const memberData: { memberId: string; score: number; rank: number }[] = [];
    for (let i = 0; i < results.length; i += 2) {
      memberData.push({
        memberId: results[i]!,
        score: parseFloat(results[i + 1]!),
        rank: Math.floor(i / 2) + 1,
      });
    }

    // Batch fetch all user display info in a single query (Fix N+1)
    const memberIds = memberData.map(m => m.memberId);
    const userMap = new Map<string, { display_name: string; avatar_url: string | null }>();

    if (memberIds.length > 0) {
      const placeholders = memberIds.map((_, i) => `$${i + 1}`).join(', ');
      const userResult = await this.pg.query(
        `SELECT firebase_uid, display_name, avatar_url FROM users WHERE firebase_uid IN (${placeholders})`,
        memberIds,
      );
      for (const row of userResult.rows) {
        userMap.set(row.firebase_uid as string, {
          display_name: row.display_name as string,
          avatar_url: row.avatar_url as string | null,
        });
      }
    }

    const entries: LeaderboardEntry[] = memberData.map(({ memberId, score, rank }) => {
      const user = userMap.get(memberId);
      return {
        rank,
        userId: memberId,
        displayName: user?.display_name ?? 'Unknown',
        avatarUrl: user?.avatar_url ?? null,
        score,
      };
    });

    // Get user's own rank
    const userRank = await this.redis.zrevrank(key, userId);
    const userScore = await this.redis.zscore(key, userId);
    let userEntry: LeaderboardEntry | null = null;

    if (userRank !== null && userScore !== null) {
      // M3 fix: Check batch results first before making an extra DB query
      const cachedUser = userMap.get(userId);
      let displayName: string;
      let avatarUrl: string | null;

      if (cachedUser) {
        displayName = cachedUser.display_name;
        avatarUrl = cachedUser.avatar_url;
      } else {
        const userResult = await this.pg.query(
          `SELECT display_name, avatar_url FROM users WHERE firebase_uid = $1`,
          [userId],
        );
        const user = userResult.rows[0];
        displayName = (user?.display_name as string) ?? 'Unknown';
        avatarUrl = (user?.avatar_url as string) ?? null;
      }

      userEntry = {
        rank: userRank + 1,
        userId,
        displayName,
        avatarUrl,
        score: parseFloat(userScore),
      };
    }

    const totalParticipants = await this.redis.zcard(key);

    return {
      entries,
      userRank: userEntry,
      totalParticipants,
      updatedAt: new Date().toISOString(),
    };
  }

  // ═══════════════════════════════════════════════════════
  // SHOP
  // ═══════════════════════════════════════════════════════

  async getShopItems(): Promise<ShopItem[]> {
    const result = await this.pg.query(
      `SELECT id, name, description, image_url, price, category,
              is_available, deck_id, card_count, theme_key, created_at
       FROM shop_items WHERE is_available = TRUE ORDER BY price ASC`,
    );

    return result.rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      name: row.name as string,
      description: row.description as string,
      imageUrl: row.image_url as string,
      price: row.price as number,
      category: row.category as ShopItem['category'],
      isAvailable: row.is_available as boolean,
      deckId: (row.deck_id as string | null) ?? null,
      cardCount: (row.card_count as number | null) ?? null,
      themeKey: (row.theme_key as string | null) ?? null,
      createdAt: (row.created_at as Date).toISOString(),
    }));
  }

  async purchaseItem(
    userId: string,
    itemId: string,
  ): Promise<{ success: boolean; message: string; effect?: PurchaseEffect }> {
    // Fetch item details
    const itemResult = await this.pg.query(
      `SELECT price, category, deck_id, theme_key
       FROM shop_items WHERE id = $1 AND is_available = TRUE`,
      [itemId],
    );
    if (itemResult.rows.length === 0) {
      return { success: false, message: 'Item not found or unavailable' };
    }

    const { price, category, deck_id: deckId, theme_key: themeKey } = itemResult.rows[0] as {
      price: number; category: string; deck_id: string | null; theme_key: string | null;
    };

    // Guard: prevent duplicate flashcard_pack purchases (coins would be wasted)
    if (category === 'flashcard_pack' && deckId) {
      const alreadyOwned = await this.pg.query(
        `SELECT 1 FROM user_unlocked_decks
         WHERE user_id = (SELECT id FROM users WHERE firebase_uid = $1) AND deck_id = $2`,
        [userId, deckId],
      );
      if (alreadyOwned.rows.length > 0) {
        return { success: false, message: 'You already own this flashcard pack' };
      }
    }

    // Try to spend coins
    const { success } = await this.spendCoins(userId, price);
    if (!success) {
      return { success: false, message: 'Insufficient coins' };
    }

    // Post-spend: record purchase and apply effects.
    // If ANY of these fail, refund the coins to prevent permanent coin loss.
    try {
      // Record purchase
      await this.pg.query(
        `INSERT INTO user_purchases (user_id, item_id, coins_spent)
         VALUES ((SELECT id FROM users WHERE firebase_uid = $1), $2, $3)`,
        [userId, itemId, price],
      );

      // Record spend in coin_transactions
      await rewardService.recordSpend(userId, price, itemId);

      // ─── Apply effect based on category ───────────────────
      let effect: PurchaseEffect | undefined;

      if (category === 'flashcard_pack' && deckId) {
        // Permanently unlock the deck for the user (idempotent)
        await this.pg.query(
          `INSERT INTO user_unlocked_decks (user_id, deck_id)
           VALUES ((SELECT id FROM users WHERE firebase_uid = $1), $2)
           ON CONFLICT (user_id, deck_id) DO NOTHING`,
          [userId, deckId],
        );
        effect = { type: 'flashcard_pack', value: deckId };
      } else if (category === 'theme' && themeKey) {
        // Save active theme to user preferences
        await this.pg.query(
          `INSERT INTO user_preferences (user_id, active_theme)
           VALUES ((SELECT id FROM users WHERE firebase_uid = $1), $2)
           ON CONFLICT (user_id)
           DO UPDATE SET active_theme = EXCLUDED.active_theme, updated_at = NOW()`,
          [userId, themeKey],
        );
        effect = { type: 'theme', value: themeKey };
      } else if (category === 'power_up') {
        // ─── Streak Freeze: enforce max 3 inventory cap ────────
        const currentFreezes = parseInt(
          await this.redis.hget(`streak:${userId}`, 'freezes') ?? '0', 10,
        );
        if (currentFreezes >= 3) {
          // Cap reached — refund the coins we just spent
          await this.creditCoins(userId, price);
          return { success: false, message: 'Maximum streak freezes reached (3/3)' };
        }
        await this.redis.hincrby(`streak:${userId}`, 'freezes', 1);
        effect = { type: 'power_up', value: 'streak_freeze' };
      }

      return { success: true, message: 'Purchase successful', effect };
    } catch (err) {
      // Compensating transaction: refund coins that were already deducted
      await this.creditCoins(userId, price);
      throw err; // Re-throw so the route handler returns a 500
    }
  }

  // ═══════════════════════════════════════════════════════
  // COIN HISTORY
  // ═══════════════════════════════════════════════════════

  async getCoinHistory(
    userId: string,
    page = 1,
    pageSize = 20,
  ): Promise<{ data: CoinTransaction[]; pagination: Record<string, unknown> }> {
    const offset = (page - 1) * pageSize;

    const result = await this.pg.query(
      `SELECT ct.id, ct.amount, ct.reason, ct.reference_id, ct.created_at
       FROM coin_transactions ct
       JOIN users u ON u.id = ct.user_id
       WHERE u.firebase_uid = $1
       ORDER BY ct.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, pageSize, offset],
    );

    const countResult = await this.pg.query(
      `SELECT COUNT(*) as total FROM coin_transactions ct
       JOIN users u ON u.id = ct.user_id WHERE u.firebase_uid = $1`,
      [userId],
    );

    const total = parseInt(countResult.rows[0]?.total ?? '0', 10);

    return {
      data: result.rows.map((row: Record<string, unknown>) => ({
        id: row.id as string,
        userId,
        amount: row.amount as number,
        reason: row.reason as string,
        referenceId: (row.reference_id as string | null) ?? null,
        createdAt: (row.created_at as Date).toISOString(),
      })),
      pagination: {
        page,
        pageSize,
        totalItems: total,
        totalPages: Math.ceil(total / pageSize),
        hasNextPage: page * pageSize < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  // ═══════════════════════════════════════════════════════
  // UNLOCKED DECKS
  // ═══════════════════════════════════════════════════════

  /** Returns all MongoDB deck IDs the user has permanently unlocked via coin purchases. */
  async getUnlockedDeckIds(userId: string): Promise<string[]> {
    const result = await this.pg.query(
      `SELECT ud.deck_id FROM user_unlocked_decks ud
       JOIN users u ON u.id = ud.user_id
       WHERE u.firebase_uid = $1
       ORDER BY ud.unlocked_at DESC`,
      [userId],
    );
    return result.rows.map((row: Record<string, unknown>) => row.deck_id as string);
  }
}

export const gamificationRepository = new GamificationRepository();
