// ─── Insight Reveal Service ─────────────────────────────────
// Surfaces personalized "quantified self" insights periodically
// to create the Rewards of the Self hook (Nir Eyal).
//
// Psychology: People are endlessly fascinated by data about
// themselves. Each insight reveal is a mini-dopamine hit that
// reinforces the feeling of investment in the platform.
//
// Insight categories:
//   1. Comparative  — "You learn X faster than average"
//   2. Temporal     — "Your best study time is 8-10 PM"
//   3. Achievement  — "You mastered 3 new concepts this week"
//   4. Predictive   — "At this rate, you'll be exam-ready by June 15"
//   5. Behavioral   — "You've answered 1,247 questions total"
//
// Insights are revealed one-at-a-time every Nth answer (configurable),
// creating anticipation without overwhelming the user.

import { getRedisClient, getPostgresPool } from '../clients/database.js';
import { configRepository } from '../repositories/config.repository.js';
import { createServiceLogger } from '../lib/logger.js';

const log = createServiceLogger('InsightRevealService');

// ─── Insight Types ──────────────────────────────────────────

export type InsightCategory = 'comparative' | 'temporal' | 'achievement' | 'predictive' | 'behavioral';

export interface InsightReveal {
  /** Unique insight ID */
  id: string;
  /** Category determines the UI treatment */
  category: InsightCategory;
  /** Emoji prefix for the notification */
  emoji: string;
  /** Main insight message */
  message: string;
  /** Optional value that changed (for delta display) */
  value?: number;
  /** Optional unit for the value */
  unit?: string;
}

// Default: reveal an insight every 10 answers
const DEFAULT_REVEAL_INTERVAL = 10;

// ─── Insight Reveal Service ─────────────────────────────────

class InsightRevealService {
  private get redis() {
    return getRedisClient();
  }

  private get pg() {
    return getPostgresPool();
  }

  // ─── Check if Insight Should Fire ─────────────────────────

  /**
   * Called after each correct answer. Increments a counter and
   * checks if it's time to reveal a new insight.
   *
   * Returns an InsightReveal if the counter hit the interval,
   * otherwise returns null (most calls).
   */
  async checkAndReveal(userId: string): Promise<InsightReveal | null> {
    const interval = await configRepository.getNumber(
      'insight_reveal_interval', DEFAULT_REVEAL_INTERVAL,
    );

    // Atomic increment + check
    const counterKey = `insight_counter:${userId}`;
    const count = await this.redis.incr(counterKey);
    // Set TTL on first increment (7-day rolling window)
    if (count === 1) {
      await this.redis.expire(counterKey, 7 * 24 * 60 * 60);
    }

    if (count % interval !== 0) return null;

    // Time to reveal! Pick the best insight for this user
    return this.generateInsight(userId, count);
  }

  // ─── Generate Personalized Insight ────────────────────────

  /**
   * Selects the most impactful insight for this user based on
   * their current data. Uses round-robin through categories
   * to ensure variety.
   */
  private async generateInsight(userId: string, totalReveals: number): Promise<InsightReveal> {
    const categoryIndex = totalReveals % 5;
    const categories: InsightCategory[] = [
      'achievement', 'comparative', 'temporal', 'behavioral', 'predictive',
    ];
    const category = categories[categoryIndex]!;

    try {
      switch (category) {
        case 'achievement':
          return await this.achievementInsight(userId);
        case 'comparative':
          return await this.comparativeInsight(userId);
        case 'temporal':
          return await this.temporalInsight(userId);
        case 'behavioral':
          return await this.behavioralInsight(userId);
        case 'predictive':
          return await this.predictiveInsight(userId);
        default:
          return await this.behavioralInsight(userId);
      }
    } catch (err) {
      log.warn({ err, userId, category }, 'Insight generation failed, falling back');
      return this.fallbackInsight(userId);
    }
  }

  // ─── Achievement Insights ─────────────────────────────────

  private async achievementInsight(userId: string): Promise<InsightReveal> {
    // Count concepts mastered this week (BKT p_mastery > 0.8)
    const redis = this.redis;
    const conceptKeys = await redis.smembers(`concept_mastery_keys:${userId}`);

    let masteredThisWeek = 0;
    if (conceptKeys.length > 0) {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const pipeline = redis.pipeline();
      for (const tag of conceptKeys.slice(0, 100)) {
        pipeline.hgetall(`concept_mastery:${userId}:${tag}`);
      }
      const results = await pipeline.exec();

      for (const [err, raw] of (results ?? [])) {
        if (err || !raw) continue;
        const data = raw as Record<string, string>;
        const mastery = parseFloat(data['p_mastery'] ?? '0');
        const updated = data['last_updated_at'] ?? '';
        if (mastery >= 0.8 && updated >= oneWeekAgo) {
          masteredThisWeek++;
        }
      }
    }

    if (masteredThisWeek > 0) {
      return {
        id: `achievement_concepts_${Date.now()}`,
        category: 'achievement',
        emoji: '🧠',
        message: `You mastered ${masteredThisWeek} new concept${masteredThisWeek > 1 ? 's' : ''} this week!`,
        value: masteredThisWeek,
        unit: 'concepts',
      };
    }

    // Fallback: total cards studied
    const totalCards = await redis.scard(`card_memory_keys:${userId}`);
    return {
      id: `achievement_cards_${Date.now()}`,
      category: 'achievement',
      emoji: '📚',
      message: `You've studied ${totalCards} unique cards. That's dedication!`,
      value: totalCards,
      unit: 'cards',
    };
  }

  // ─── Comparative Insights ─────────────────────────────────

  private async comparativeInsight(userId: string): Promise<InsightReveal> {
    // Compare 7-day accuracy to platform average
    const result = await this.pg.query(`
      WITH user_accuracy AS (
        SELECT COALESCE(AVG(correct_answers::float / NULLIF(cards_studied, 0)) * 100, 0) AS acc
        FROM study_sessions
        WHERE user_id = (SELECT id FROM users WHERE firebase_uid = $1)
          AND started_at > NOW() - INTERVAL '7 days'
          AND cards_studied > 0
      ),
      platform_accuracy AS (
        SELECT COALESCE(AVG(correct_answers::float / NULLIF(cards_studied, 0)) * 100, 0) AS acc
        FROM study_sessions
        WHERE started_at > NOW() - INTERVAL '7 days'
          AND cards_studied > 0
      )
      SELECT u.acc AS user_acc, p.acc AS platform_acc
      FROM user_accuracy u, platform_accuracy p
    `, [userId]);

    const row = result.rows[0];
    const userAcc = Math.round(parseFloat(row?.user_acc ?? '0'));
    const platformAcc = Math.round(parseFloat(row?.platform_acc ?? '0'));
    const delta = userAcc - platformAcc;

    if (delta > 0) {
      return {
        id: `comparative_accuracy_${Date.now()}`,
        category: 'comparative',
        emoji: '🎯',
        message: `Your accuracy is ${delta}% higher than the platform average this week!`,
        value: delta,
        unit: '% above average',
      };
    }

    return {
      id: `comparative_studying_${Date.now()}`,
      category: 'comparative',
      emoji: '📊',
      message: `Your accuracy this week: ${userAcc}%. Platform average: ${platformAcc}%. Keep pushing!`,
      value: userAcc,
      unit: '% accuracy',
    };
  }

  // ─── Temporal Insights ────────────────────────────────────

  private async temporalInsight(userId: string): Promise<InsightReveal> {
    // Peak study hour from session data
    const result = await this.pg.query(`
      SELECT EXTRACT(HOUR FROM started_at)::int AS hour,
             AVG(correct_answers::float / NULLIF(cards_studied, 0)) * 100 AS accuracy,
             COUNT(*)::int AS sessions
      FROM study_sessions
      WHERE user_id = (SELECT id FROM users WHERE firebase_uid = $1)
        AND cards_studied > 0
      GROUP BY hour
      HAVING COUNT(*) >= 2
      ORDER BY accuracy DESC
      LIMIT 1
    `, [userId]);

    const row = result.rows[0];
    if (row) {
      const hour = row.hour as number;
      const accuracy = Math.round(parseFloat(row.accuracy));
      const period = hour < 12 ? 'AM' : 'PM';
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;

      return {
        id: `temporal_peak_${Date.now()}`,
        category: 'temporal',
        emoji: '🕐',
        message: `Your brain peaks at ${displayHour} ${period} — ${accuracy}% accuracy! Schedule your study sessions then.`,
        value: accuracy,
        unit: '% at peak',
      };
    }

    return {
      id: `temporal_default_${Date.now()}`,
      category: 'temporal',
      emoji: '🕐',
      message: `Keep studying at different times — we're learning your optimal study window!`,
    };
  }

  // ─── Behavioral Insights ──────────────────────────────────

  private async behavioralInsight(userId: string): Promise<InsightReveal> {
    // Total answers, streak, and response speed
    const result = await this.pg.query(`
      SELECT SUM(cards_studied)::int AS total_answers,
             SUM(correct_answers)::int AS total_correct,
             AVG(avg_response_time_ms)::int AS avg_speed,
             COUNT(*)::int AS total_sessions
      FROM study_sessions
      WHERE user_id = (SELECT id FROM users WHERE firebase_uid = $1)
    `, [userId]);

    const row = result.rows[0];
    const totalAnswers = parseInt(row?.total_answers ?? '0', 10);
    const avgSpeed = parseInt(row?.avg_speed ?? '0', 10);
    const totalSessions = parseInt(row?.total_sessions ?? '0', 10);

    if (totalAnswers >= 100) {
      const speedSeconds = (avgSpeed / 1000).toFixed(1);
      return {
        id: `behavioral_total_${Date.now()}`,
        category: 'behavioral',
        emoji: '⚡',
        message: `${totalAnswers.toLocaleString()} answers across ${totalSessions} sessions, averaging ${speedSeconds}s per question!`,
        value: totalAnswers,
        unit: 'answers',
      };
    }

    return {
      id: `behavioral_milestone_${Date.now()}`,
      category: 'behavioral',
      emoji: '🚀',
      message: `${totalAnswers} answers down, ${100 - totalAnswers} to go until your first century!`,
      value: totalAnswers,
      unit: 'answers',
    };
  }

  // ─── Predictive Insights ──────────────────────────────────

  private async predictiveInsight(userId: string): Promise<InsightReveal> {
    // Predict exam readiness date based on current velocity
    const result = await this.pg.query(`
      WITH daily_counts AS (
        SELECT DATE(started_at) AS study_date,
               SUM(cards_studied) AS cards
        FROM study_sessions
        WHERE user_id = (SELECT id FROM users WHERE firebase_uid = $1)
          AND started_at > NOW() - INTERVAL '14 days'
        GROUP BY study_date
      )
      SELECT AVG(cards) AS avg_daily_cards,
             COUNT(*) AS study_days
      FROM daily_counts
    `, [userId]);

    const row = result.rows[0];
    const avgDaily = Math.round(parseFloat(row?.avg_daily_cards ?? '0'));
    const studyDays = parseInt(row?.study_days ?? '0', 10);

    if (avgDaily > 0 && studyDays >= 3) {
      // Rough forecast: assume 500 cards needed for exam readiness
      const redis = this.redis;
      const totalTracked = await redis.scard(`card_memory_keys:${userId}`);
      const remaining = Math.max(0, 500 - totalTracked);
      const daysNeeded = remaining > 0 ? Math.ceil(remaining / avgDaily) : 0;

      if (daysNeeded > 0) {
        const readyDate = new Date(Date.now() + daysNeeded * 24 * 60 * 60 * 1000);
        const dateStr = readyDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
        return {
          id: `predictive_readiness_${Date.now()}`,
          category: 'predictive',
          emoji: '🔮',
          message: `At ${avgDaily} cards/day, you'll hit full coverage by ${dateStr}!`,
          value: daysNeeded,
          unit: 'days to go',
        };
      }

      return {
        id: `predictive_on_track_${Date.now()}`,
        category: 'predictive',
        emoji: '🔮',
        message: `You're on track! ${avgDaily} cards/day puts you ahead of the curve.`,
        value: avgDaily,
        unit: 'cards/day',
      };
    }

    return {
      id: `predictive_early_${Date.now()}`,
      category: 'predictive',
      emoji: '🔮',
      message: `Study 3 more days and we'll predict your exam readiness date!`,
    };
  }

  // ─── Fallback ─────────────────────────────────────────────

  private async fallbackInsight(userId: string): Promise<InsightReveal> {
    const redis = this.redis;
    const streakData = await redis.hgetall(`streak:${userId}`);
    const streak = parseInt(streakData['current_streak'] ?? '0', 10);

    if (streak > 0) {
      return {
        id: `fallback_streak_${Date.now()}`,
        category: 'achievement',
        emoji: '🔥',
        message: `${streak}-day streak! You're in the habit zone.`,
        value: streak,
        unit: 'day streak',
      };
    }

    return {
      id: `fallback_generic_${Date.now()}`,
      category: 'behavioral',
      emoji: '💡',
      message: `Every question makes your brain stronger. Keep going!`,
    };
  }
}

export const insightRevealService = new InsightRevealService();
