// ─── AI Recommendation Service ──────────────────────────────
// Data-driven heuristics: weak subjects, spaced repetition, study insights.
// Queries PostgreSQL (study_sessions) and Redis (level_progress) for real data.

import { getPostgresPool } from '../lib/database.js';
import { getRedisClient } from '../lib/database.js';


interface Recommendation {
  deckId: string;
  title: string;
  reason: string;
  priority: number;
  suggestedCards: number;
}

interface StudyInsights {
  weakTopics: string[];
  strongTopics: string[];
  optimalStudyTime: string;
  retentionRate: number;
}

export class RecommendationService {
  /**
   * Generates a personalized study plan based on real study session data.
   * Heuristics:
   *   1. Decks with <70% accuracy (weakness detection)
   *   2. Decks not studied in >3 days (spaced repetition reminder)
   * Falls back to empty array for new users with no data.
   */
  async generateRecommendations(userId: string): Promise<Recommendation[]> {
    const pg = getPostgresPool();

    // Find decks the user has studied, ordered by accuracy (lowest first)
    // and recency (oldest first) — these are the most needed reviews.
    const result = await pg.query<{
      deck_id: string;
      title: string;
      accuracy: number;
      last_studied: Date;
      avg_cards: number;
    }>(`
      SELECT
        ss.deck_id,
        COALESCE(d.title, 'Unknown Deck') as title,
        CASE
          WHEN SUM(ss.correct_answers + ss.incorrect_answers) > 0
          THEN (SUM(ss.correct_answers)::float / SUM(ss.correct_answers + ss.incorrect_answers) * 100)
          ELSE 0
        END as accuracy,
        MAX(ss.ended_at) as last_studied,
        COALESCE(AVG(ss.cards_studied), 10) as avg_cards
      FROM study_sessions ss
      LEFT JOIN decks d ON ss.deck_id = d.id::text
      WHERE ss.user_id = (SELECT id FROM users WHERE auth0_id = $1)
      GROUP BY ss.deck_id, d.title
      HAVING SUM(ss.correct_answers + ss.incorrect_answers) > 0
      ORDER BY accuracy ASC, last_studied ASC
      LIMIT 10
    `, [userId]);

    if (result.rows.length === 0) {
      return [];
    }

    const now = Date.now();
    const recommendations: Recommendation[] = [];

    for (const row of result.rows) {
      const daysSinceStudied = Math.floor((now - new Date(row.last_studied).getTime()) / (1000 * 60 * 60 * 24));
      const accuracy = Math.round(row.accuracy);

      // Build priority: lower accuracy and older study date = higher priority
      let priority = 0;
      let reason = '';

      if (accuracy < 70) {
        // Weakness-based recommendation
        priority = Math.max(0.5, 1 - (accuracy / 100));
        reason = `Weakness detected: Your accuracy is ${accuracy}%. Review to strengthen this area.`;
      } else if (daysSinceStudied >= 3) {
        // Spaced repetition recommendation
        priority = Math.min(0.9, 0.3 + (daysSinceStudied / 14)); // Caps at 0.9 after 2 weeks
        reason = `Spaced repetition: You last studied this ${daysSinceStudied} days ago. Time to review!`;
      } else {
        // Recent and high accuracy — low priority
        priority = 0.1;
        reason = `Good performance (${accuracy}%). Keep it up!`;
      }

      recommendations.push({
        deckId: row.deck_id,
        title: row.title,
        reason,
        priority,
        suggestedCards: Math.min(20, Math.max(5, Math.round(row.avg_cards))),
      });
    }

    // Return top 5 by priority
    return recommendations
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 5);
  }

  /**
   * Generates learning insights from real study session data.
   * - Weak/strong topics: based on level_progress correct/total ratios in Redis.
   * - Optimal study time: hour-of-day with highest accuracy from PostgreSQL.
   * - Retention rate: overall accuracy across all sessions.
   * Falls back to neutral values for new users.
   */
  async generateInsights(userId: string): Promise<StudyInsights> {
    const pg = getPostgresPool();
    const redis = getRedisClient();

    // 1. Overall retention rate from PostgreSQL
    const retentionResult = await pg.query<{ accuracy: number; total_sessions: number }>(`
      SELECT
        CASE
          WHEN SUM(correct_answers + incorrect_answers) > 0
          THEN (SUM(correct_answers)::float / SUM(correct_answers + incorrect_answers) * 100)
          ELSE 0
        END as accuracy,
        COUNT(*) as total_sessions
      FROM study_sessions
      WHERE user_id = (SELECT id FROM users WHERE auth0_id = $1)
    `, [userId]);

    const retentionRate = Math.round((retentionResult.rows[0]?.accuracy ?? 0) * 10) / 10;
    const totalSessions = retentionResult.rows[0]?.total_sessions ?? 0;

    // 2. Optimal study time: hour-of-day with highest accuracy
    let optimalStudyTime = 'Not enough data yet';
    if (totalSessions >= 3) {
      const timeResult = await pg.query<{ study_hour: number; hour_accuracy: number }>(`
        SELECT
          EXTRACT(HOUR FROM started_at) as study_hour,
          CASE
            WHEN SUM(correct_answers + incorrect_answers) > 0
            THEN (SUM(correct_answers)::float / SUM(correct_answers + incorrect_answers) * 100)
            ELSE 0
          END as hour_accuracy
        FROM study_sessions
        WHERE user_id = (SELECT id FROM users WHERE auth0_id = $1)
          AND started_at > NOW() - INTERVAL '30 days'
        GROUP BY EXTRACT(HOUR FROM started_at)
        HAVING COUNT(*) >= 2
        ORDER BY hour_accuracy DESC
        LIMIT 1
      `, [userId]);

      if (timeResult.rows.length > 0) {
        const hour = timeResult.rows[0]!.study_hour;
        const startHour = hour;
        const endHour = (hour + 2) % 24;
        const formatHour = (h: number) => {
          const period = h >= 12 ? 'PM' : 'AM';
          const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
          return `${displayHour}:00 ${period}`;
        };
        optimalStudyTime = `${formatHour(startHour)} - ${formatHour(endHour)}`;
      }
    }

    // 3. Weak/strong topics from Redis level_progress keys
    const weakTopics: string[] = [];
    const strongTopics: string[] = [];

    // Use the tracking SET instead of SCAN for O(1) key lookup
    const trackedKeys = await redis.smembers(`level_progress_keys:${userId}`);

    if (trackedKeys.length > 0) {
      // Aggregate accuracy per subject
      const subjectStats = new Map<string, { correct: number; total: number; subjectId: string }>();

      // Pipeline all HGETALL calls for efficiency
      const pipeline = redis.pipeline();
      for (const keyPart of trackedKeys) {
        pipeline.hgetall(`level_progress:${userId}:${keyPart}`);
      }
      const results = await pipeline.exec();

      for (let i = 0; i < trackedKeys.length; i++) {
        const keyPart = trackedKeys[i]!;
        const segments = keyPart.split(':');
        // Format: examId:subjectId:level
        if (segments.length !== 3) continue;

        const [, subjectId] = segments as [string, string, string];
        const [err, data] = results?.[i] ?? [new Error('missing'), null];
        if (err || !data) continue;

        const record = data as Record<string, string>;
        const correct = parseInt(record['correct'] ?? '0', 10);
        const total = parseInt(record['total'] ?? '0', 10);

        const existing = subjectStats.get(subjectId!) ?? { correct: 0, total: 0, subjectId: subjectId! };
        existing.correct += correct;
        existing.total += total;
        subjectStats.set(subjectId!, existing);
      }

      // Look up subject names from PostgreSQL
      const subjectIds = [...subjectStats.keys()];
      if (subjectIds.length > 0) {
        const nameResult = await pg.query<{ id: string; name: string }>(
          `SELECT id, name FROM subjects WHERE id = ANY($1)`, [subjectIds],
        );
        const nameMap = new Map(nameResult.rows.map(r => [r.id, r.name]));

        for (const [subjectId, stats] of subjectStats) {
          if (stats.total < 5) continue; // Need minimum data
          const accuracy = (stats.correct / stats.total) * 100;
          const name = nameMap.get(subjectId) ?? subjectId;

          if (accuracy < 60) {
            weakTopics.push(name);
          } else if (accuracy >= 80) {
            strongTopics.push(name);
          }
        }
      }
    }

    return {
      weakTopics: weakTopics.slice(0, 5),
      strongTopics: strongTopics.slice(0, 5),
      optimalStudyTime,
      retentionRate,
    };
  }
}

export const recommendationService = new RecommendationService();
