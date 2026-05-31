// ─── Weekly Highlight Reel Service ──────────────────────────
// Automated "year in review"-style weekly summary.
//
// Psychology: Endowment Effect — showing people what they've
// accomplished creates ownership over their progress, making
// them reluctant to abandon the platform.
//
// Also drives sharing behavior: impressive stats are shareable
// content that reinforces the habit loop via social validation.
//
// Delivered: Sunday evening push notification + in-app card.

import { getPostgresPool, getRedisClient } from '../clients/database.js';
import { notificationService } from './notification.service.js';
import { createServiceLogger } from '../lib/logger.js';

const log = createServiceLogger('WeeklyHighlightService');

// ─── Types ──────────────────────────────────────────────────

export interface WeeklyHighlight {
  userId: string;
  weekStarting: string; // ISO date (Monday)
  /** Total questions answered this week */
  totalAnswers: number;
  /** Correct answer count */
  correctAnswers: number;
  /** Accuracy percentage */
  accuracy: number;
  /** Total study sessions */
  totalSessions: number;
  /** Total minutes studied */
  totalMinutes: number;
  /** Coins earned this week */
  coinsEarned: number;
  /** Current streak length */
  currentStreak: number;
  /** Friends beaten on leaderboard this week */
  friendsBeaten: number;
  /** New concepts mastered (BKT p_mastery > 0.8) */
  conceptsMastered: number;
  /** Headline stat for the push notification */
  headlineStat: string;
  /** Fun fact or comparison */
  funFact: string;
  /** Share-worthy summary for social */
  shareText: string;
}

// ─── Weekly Highlight Service ───────────────────────────────

class WeeklyHighlightService {
  private get pg() {
    return getPostgresPool();
  }

  private get redis() {
    return getRedisClient();
  }

  // ─── Generate Weekly Highlights (Cron: Sunday 7 PM) ───────

  /**
   * Generates and sends weekly highlight reels to all active users.
   * Called by a cron job on Sunday evenings.
   */
  async generateAndSendHighlights(): Promise<void> {
    // Get all users who studied this week
    const weekStart = this.getLastMonday();
    const result = await this.pg.query(
      `SELECT DISTINCT u.firebase_uid
       FROM study_sessions ss
       JOIN users u ON u.id = ss.user_id
       WHERE ss.started_at >= $1`,
      [weekStart],
    );

    let sent = 0;
    for (const row of result.rows) {
      const uid = row.firebase_uid as string;
      try {
        const highlight = await this.buildHighlight(uid, weekStart);
        if (highlight.totalAnswers > 0) {
          await this.sendHighlightPush(highlight);
          await this.cacheHighlight(highlight);
          sent++;
        }
      } catch (err) {
        log.error({ err, userId: uid }, 'Failed to generate weekly highlight');
      }
    }

    log.info({ sent, weekStart: weekStart.toISOString() }, 'Weekly highlights sent');
  }

  // ─── Get Cached Highlight for Display ─────────────────────

  /**
   * Retrieve the most recent weekly highlight for a user.
   * Called by the mobile home screen to display the highlight card.
   */
  async getLatestHighlight(firebaseUid: string): Promise<WeeklyHighlight | null> {
    const cached = await this.redis.get(`weekly_highlight:${firebaseUid}`);
    if (cached) {
      return JSON.parse(cached) as WeeklyHighlight;
    }
    return null;
  }

  // ─── Build Highlight ──────────────────────────────────────

  private async buildHighlight(firebaseUid: string, weekStart: Date): Promise<WeeklyHighlight> {
    // Aggregate study stats for the week
    const stats = await this.pg.query(`
      SELECT
        COALESCE(SUM(cards_studied), 0)::int AS total_answers,
        COALESCE(SUM(correct_answers), 0)::int AS correct_answers,
        COUNT(*)::int AS total_sessions,
        COALESCE(SUM(EXTRACT(EPOCH FROM (ended_at - started_at)) / 60), 0)::int AS total_minutes
      FROM study_sessions
      WHERE user_id = (SELECT id FROM users WHERE firebase_uid = $1)
        AND started_at >= $2
    `, [firebaseUid, weekStart]);

    const row = stats.rows[0] ?? {};
    const totalAnswers = parseInt(row.total_answers ?? '0', 10);
    const correctAnswers = parseInt(row.correct_answers ?? '0', 10);
    const totalSessions = parseInt(row.total_sessions ?? '0', 10);
    const totalMinutes = parseInt(row.total_minutes ?? '0', 10);
    const accuracy = totalAnswers > 0
      ? Math.round((correctAnswers / totalAnswers) * 100) : 0;

    // Get coins earned this week
    const coinStats = await this.pg.query(`
      SELECT COALESCE(SUM(amount), 0)::int AS coins_earned
      FROM coin_transactions
      WHERE user_id = (SELECT id FROM users WHERE firebase_uid = $1)
        AND amount > 0
        AND created_at >= $2
    `, [firebaseUid, weekStart]);
    const coinsEarned = parseInt(coinStats.rows[0]?.coins_earned ?? '0', 10);

    // Get streak
    const streakData = await this.redis.hgetall(`streak:${firebaseUid}`);
    const currentStreak = parseInt(streakData['current_streak'] ?? '0', 10);

    // Count friends beaten (leaderboard position improvement)
    const friendsBeaten = await this.countFriendsBeaten(firebaseUid);

    // Count concepts mastered this week
    const conceptsMastered = await this.countConceptsMasteredThisWeek(firebaseUid, weekStart);

    // Build fun fact
    const funFact = this.buildFunFact(totalAnswers, totalMinutes, accuracy);

    // Build headline
    const headlineStat = this.buildHeadline(totalAnswers, accuracy, currentStreak, conceptsMastered);

    // Build shareable text
    const shareText = `📊 My week on Quanti-Pi: ${totalAnswers} questions, ${accuracy}% accuracy, ${currentStreak}-day streak! 🔥`;

    return {
      userId: firebaseUid,
      weekStarting: weekStart.toISOString().slice(0, 10),
      totalAnswers,
      correctAnswers,
      accuracy,
      totalSessions,
      totalMinutes,
      coinsEarned,
      currentStreak,
      friendsBeaten,
      conceptsMastered,
      headlineStat,
      funFact,
      shareText,
    };
  }

  // ─── Push Notification ────────────────────────────────────

  private async sendHighlightPush(highlight: WeeklyHighlight): Promise<void> {
    await notificationService.sendDirectPush({
      userId: highlight.userId,
      title: '📊 Your Weekly Highlight Reel',
      body: highlight.headlineStat,
      data: { action: 'weekly_highlight', screen: 'profile' },
    });
  }

  // ─── Cache ────────────────────────────────────────────────

  private async cacheHighlight(highlight: WeeklyHighlight): Promise<void> {
    await this.redis.setex(
      `weekly_highlight:${highlight.userId}`,
      7 * 86400, // 7-day TTL
      JSON.stringify(highlight),
    );
  }

  // ─── Copy Generators ─────────────────────────────────────

  private buildHeadline(
    totalAnswers: number,
    accuracy: number,
    streak: number,
    concepts: number,
  ): string {
    if (streak >= 7) {
      return `🔥 ${streak}-day streak and ${totalAnswers} questions this week! Unstoppable!`;
    }
    if (accuracy >= 90) {
      return `🎯 ${accuracy}% accuracy across ${totalAnswers} questions — precision master!`;
    }
    if (concepts > 0) {
      return `🧠 ${concepts} new concept${concepts > 1 ? 's' : ''} mastered + ${totalAnswers} questions answered!`;
    }
    return `📚 ${totalAnswers} questions answered, ${accuracy}% accuracy. Keep growing!`;
  }

  private buildFunFact(totalAnswers: number, totalMinutes: number, accuracy: number): string {
    if (totalMinutes > 60) {
      const hours = Math.round(totalMinutes / 60 * 10) / 10;
      return `⏱ You studied ${hours} hours this week — that's more than most students!`;
    }
    if (totalAnswers > 100) {
      return `💪 ${totalAnswers} answers is like reading ${Math.round(totalAnswers / 3)} textbook pages!`;
    }
    if (accuracy > 85) {
      return `🎓 ${accuracy}% accuracy puts you in the top tier of learners!`;
    }
    return `📈 Consistency beats intensity — every session counts!`;
  }

  // ─── Helpers ──────────────────────────────────────────────

  private getLastMonday(): Date {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  private async countFriendsBeaten(firebaseUid: string): Promise<number> {
    try {
      const rank = await this.redis.zrevrank('leaderboard:weekly', firebaseUid);
      if (rank === null) return 0;

      // Friends below you on weekly leaderboard
      const pgId = await (await import('../repositories/challenge.repository.js'))
        .challengeRepository.resolveUserId(firebaseUid);
      if (!pgId) return 0;

      const friends = await (await import('../repositories/challenge.repository.js'))
        .challengeRepository.listFriends(pgId);

      let beaten = 0;
      for (const friend of friends) {
        const friendRank = await this.redis.zrevrank('leaderboard:weekly', friend.firebaseUid);
        if (friendRank !== null && friendRank > rank) {
          beaten++;
        }
      }
      return beaten;
    } catch {
      return 0;
    }
  }

  private async countConceptsMasteredThisWeek(
    firebaseUid: string,
    weekStart: Date,
  ): Promise<number> {
    try {
      const conceptKeys = await this.redis.smembers(`concept_mastery_keys:${firebaseUid}`);
      if (conceptKeys.length === 0) return 0;

      let mastered = 0;
      const weekStartIso = weekStart.toISOString();
      const pipeline = this.redis.pipeline();

      for (const tag of conceptKeys.slice(0, 100)) {
        pipeline.hgetall(`concept_mastery:${firebaseUid}:${tag}`);
      }
      const results = await pipeline.exec();

      for (const [err, raw] of (results ?? [])) {
        if (err || !raw) continue;
        const data = raw as Record<string, string>;
        const pMastery = parseFloat(data['p_mastery'] ?? '0');
        const lastUpdated = data['last_updated_at'] ?? '';
        if (pMastery >= 0.8 && lastUpdated >= weekStartIso) {
          mastered++;
        }
      }

      return mastered;
    } catch {
      return 0;
    }
  }
}

export const weeklyHighlightService = new WeeklyHighlightService();
