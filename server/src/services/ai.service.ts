// ─── AI Recommendation & Insights Service ───────────────────
// Data-driven study recommendations and Gemini-powered insights.
//
// Data sources:
//   - PostgreSQL: study_sessions (accuracy, recency, timing)
//   - Redis: level_progress (per-topic correct/total ratios)
//   - MongoDB: decks (titles), subjects (names)
//
// Gemini is used to synthesize raw metrics into natural-language
// narrative insights. Falls back to heuristic strings on error
// or when GEMINI_API_KEY is not configured.

import { ObjectId } from 'mongodb';
import { getMongoDb, getPostgresPool, getRedisClient } from '../lib/database.js';
import { geminiGenerateJSON } from '../lib/gemini.js';
import { createServiceLogger } from '../lib/logger.js';

const log = createServiceLogger('AIService');

// ─── Types ──────────────────────────────────────────────────

interface Recommendation {
  deckId: string;
  title: string;
  reason: string;
  priority: number;
  suggestedCards: number;
}

export interface StudyInsights {
  weakTopics: string[];
  strongTopics: string[];
  optimalStudyTime: string;
  retentionRate: number;
  /** AI-generated narrative summary (Gemini). Null if not yet available. */
  aiSummary: string | null;
  /** AI-generated actionable recommendations (Gemini). */
  aiRecommendations: string[];
}

// ─── Service ─────────────────────────────────────────────────

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

    const result = await pg.query<{
      deck_id: string;
      accuracy: number;
      last_studied: Date;
      avg_cards: number;
    }>(`
      SELECT
        ss.deck_id,
        CASE
          WHEN SUM(ss.correct_answers + ss.incorrect_answers) > 0
          THEN (SUM(ss.correct_answers)::float / SUM(ss.correct_answers + ss.incorrect_answers) * 100)
          ELSE 0
        END as accuracy,
        MAX(ss.ended_at) as last_studied,
        COALESCE(AVG(ss.cards_studied), 10) as avg_cards
      FROM study_sessions ss
      WHERE ss.user_id = (SELECT id FROM users WHERE firebase_uid = $1)
      GROUP BY ss.deck_id
      HAVING SUM(ss.correct_answers + ss.incorrect_answers) > 0
      ORDER BY accuracy ASC, last_studied ASC
      LIMIT 10
    `, [userId]);

    if (result.rows.length === 0) return [];

    // Fetch deck titles from MongoDB (not PostgreSQL)
    const deckIds = result.rows
      .map((r) => { try { return new ObjectId(r.deck_id); } catch { return null; } })
      .filter((id): id is ObjectId => id !== null);

    const db = getMongoDb();
    const decks = await db.collection('decks').find({ _id: { $in: deckIds } }).toArray();
    const deckMap = new Map(decks.map((d) => [d._id.toHexString(), d.title as string]));

    const now = Date.now();
    const recommendations: Recommendation[] = [];

    for (const row of result.rows) {
      const daysSinceStudied = Math.floor((now - new Date(row.last_studied).getTime()) / (1000 * 60 * 60 * 24));
      const accuracy = Math.round(row.accuracy);
      const title = deckMap.get(row.deck_id) ?? 'Unknown Deck';

      let priority = 0;
      let reason = '';

      if (accuracy < 70) {
        priority = Math.max(0.5, 1 - accuracy / 100);
        reason = `Weakness detected: Your accuracy is ${accuracy}%. Review to strengthen this area.`;
      } else if (daysSinceStudied >= 3) {
        priority = Math.min(0.9, 0.3 + daysSinceStudied / 14);
        reason = `Spaced repetition: You last studied this ${daysSinceStudied} days ago. Time to review!`;
      } else {
        priority = 0.1;
        reason = `Good performance (${accuracy}%). Keep it up!`;
      }

      recommendations.push({
        deckId: row.deck_id,
        title,
        reason,
        priority,
        suggestedCards: Math.min(20, Math.max(5, Math.round(row.avg_cards))),
      });
    }

    return recommendations.sort((a, b) => b.priority - a.priority).slice(0, 5);
  }

  /**
   * Generates learning insights from real study session data,
   * then enriches them with a Gemini-generated narrative and action items.
   */
  async generateInsights(userId: string): Promise<StudyInsights> {
    const pg = getPostgresPool();
    const redis = getRedisClient();
    const db = getMongoDb();

    // ── 1. Overall retention rate ────────────────────────────
    const retentionResult = await pg.query<{ accuracy: number; total_sessions: number }>(`
      SELECT
        CASE
          WHEN SUM(correct_answers + incorrect_answers) > 0
          THEN (SUM(correct_answers)::float / SUM(correct_answers + incorrect_answers) * 100)
          ELSE 0
        END as accuracy,
        COUNT(*) as total_sessions
      FROM study_sessions
      WHERE user_id = (SELECT id FROM users WHERE firebase_uid = $1)
    `, [userId]);

    const retentionRate = Math.round((retentionResult.rows[0]?.accuracy ?? 0) * 10) / 10;
    const totalSessions = Number(retentionResult.rows[0]?.total_sessions ?? 0);

    // ── 2. Optimal study time ────────────────────────────────
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
        WHERE user_id = (SELECT id FROM users WHERE firebase_uid = $1)
          AND started_at > NOW() - INTERVAL '30 days'
        GROUP BY EXTRACT(HOUR FROM started_at)
        HAVING COUNT(*) >= 2
        ORDER BY hour_accuracy DESC
        LIMIT 1
      `, [userId]);

      if (timeResult.rows.length > 0) {
        const hour = timeResult.rows[0]!.study_hour;
        const fmt = (h: number) => {
          const period = h >= 12 ? 'PM' : 'AM';
          const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
          return `${display}:00 ${period}`;
        };
        optimalStudyTime = `${fmt(hour)} – ${fmt((hour + 2) % 24)}`;
      }
    }

    // ── 3. Weak/strong topics from Redis level_progress ─────
    const weakTopics: string[] = [];
    const strongTopics: string[] = [];
    const subjectStats = new Map<string, { correct: number; total: number }>();

    const trackedKeys = await redis.smembers(`level_progress_keys:${userId}`);

    if (trackedKeys.length > 0) {
      const pipeline = redis.pipeline();
      for (const keyPart of trackedKeys) {
        pipeline.hgetall(`level_progress:${userId}:${keyPart}`);
      }
      const results = await pipeline.exec();

      for (let i = 0; i < trackedKeys.length; i++) {
        const keyPart = trackedKeys[i]!;
        // Format: examId:subjectId:topicSlug:level
        const segments = keyPart.split(':');
        if (segments.length < 4) continue;

        const subjectId = segments[1]!;
        const [err, data] = results?.[i] ?? [new Error('missing'), null];
        if (err || !data) continue;

        const record = data as Record<string, string>;
        const correct = parseInt(record['correct'] ?? '0', 10);
        const total = parseInt(record['total'] ?? '0', 10);

        const existing = subjectStats.get(subjectId) ?? { correct: 0, total: 0 };
        existing.correct += correct;
        existing.total += total;
        subjectStats.set(subjectId, existing);
      }

      // Fetch subject names from MongoDB (not PostgreSQL)
      const subjectIds = [...subjectStats.keys()];
      if (subjectIds.length > 0) {
        const objectIds = subjectIds
          .map((id) => { try { return new ObjectId(id); } catch { return null; } })
          .filter((id): id is ObjectId => id !== null);

        const subjectDocs = await db
          .collection('subjects')
          .find({ _id: { $in: objectIds } }, { projection: { _id: 1, name: 1 } })
          .toArray();

        const nameMap = new Map(subjectDocs.map((s) => [s._id.toHexString(), s.name as string]));

        for (const [subjectId, stats] of subjectStats) {
          if (stats.total < 5) continue;
          const accuracy = (stats.correct / stats.total) * 100;
          const name = nameMap.get(subjectId) ?? subjectId;

          if (accuracy < 60) weakTopics.push(name);
          else if (accuracy >= 80) strongTopics.push(name);
        }
      }
    }

    // ── 4. Gemini AI narrative ────────────────────────────────
    let aiSummary: string | null = null;
    let aiRecommendations: string[] = [];

    if (totalSessions >= 3) {
      try {
        const prompt = buildInsightPrompt({
          retentionRate,
          totalSessions,
          optimalStudyTime,
          weakTopics: weakTopics.slice(0, 5),
          strongTopics: strongTopics.slice(0, 5),
        });

        const aiResult = await geminiGenerateJSON<{ summary: string; recommendations: string[] }>({
          systemPrompt: INSIGHT_SYSTEM_PROMPT,
          userPrompt: prompt,
          maxOutputTokens: 512,
          temperature: 0.5,
        });

        aiSummary = aiResult.summary ?? null;
        aiRecommendations = Array.isArray(aiResult.recommendations) ? aiResult.recommendations.slice(0, 4) : [];
      } catch (err) {
        // Gemini failure is non-fatal — fall back to heuristic data
        log.warn({ err }, 'Gemini insight generation failed — using heuristic fallback');
      }
    }

    return {
      weakTopics: weakTopics.slice(0, 5),
      strongTopics: strongTopics.slice(0, 5),
      optimalStudyTime,
      retentionRate,
      aiSummary,
      aiRecommendations,
    };
  }
}

// ─── Gemini Prompt Builders ─────────────────────────────────

const INSIGHT_SYSTEM_PROMPT = `You are a learning coach for a competitive exam preparation app. 
Analyze the student's study data and respond with ONLY valid JSON — no markdown, no prose outside the JSON.
Respond with exactly this shape:
{
  "summary": "2-3 sentence motivating summary of the student's progress",
  "recommendations": ["actionable tip 1", "actionable tip 2", "actionable tip 3"]
}
Keep recommendations specific, concise (max 15 words each), and actionable.`;

function buildInsightPrompt(data: {
  retentionRate: number;
  totalSessions: number;
  optimalStudyTime: string;
  weakTopics: string[];
  strongTopics: string[];
}): string {
  return `Student study metrics:
- Overall accuracy (retention rate): ${data.retentionRate}%
- Total study sessions completed: ${data.totalSessions}
- Best study window (highest accuracy): ${data.optimalStudyTime}
- Subjects needing improvement (<60%): ${data.weakTopics.join(', ') || 'None identified'}
- Strong subjects (>80%): ${data.strongTopics.join(', ') || 'None identified'}

Generate a personalized insight summary and 3 actionable recommendations.`;
}

// ─── Singleton Export ────────────────────────────────────────

export const recommendationService = new RecommendationService();
