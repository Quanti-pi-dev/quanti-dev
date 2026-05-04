// ─── Learning Intelligence Service ───────────────────────────
// Computes the full LearningProfile by aggregating SM-2 card memory
// data from Redis, session history from PostgreSQL, and subject/topic
// metadata from MongoDB.

import { getRedisClient, getPostgresPool, getMongoDb } from '../lib/database.js';
import { ObjectId } from 'mongodb';
import { createServiceLogger } from '../lib/logger.js';
import { INITIAL_EASE_FACTOR, estimateRetention, responseToQuality, sm2 } from './sm2.js';
import type {
  LearningProfile, SubjectMemoryState, TopicMemoryState,
  ExamReadiness, LearningVelocity, DailyStudyPlan, PlannedStudySession,
  TopicForecast, CardMemoryState, SM2Quality,
} from '@kd/shared';

const log = createServiceLogger('LearningIntelligence');

/** Redis key for the cached learning profile. TTL: 5 minutes. */
const PROFILE_CACHE_KEY = (userId: string) => `learning_profile_cache:${userId}`;
const PROFILE_CACHE_TTL = 300; // 5 minutes

// ─── Card Memory Redis Operations ────────────────────────────

/**
 * Update a card's SM-2 memory state after an answer.
 * Called from recordLevelAnswer() in progress.repository.ts.
 */
export async function updateCardMemory(
  userId: string,
  cardId: string,
  correct: boolean,
  responseTimeMs: number,
  topicSlug: string,
  subjectId: string,
): Promise<void> {
  const redis = getRedisClient();
  const memKey = `card_memory:${userId}:${cardId}`;

  // Read current state
  const data = await redis.hgetall(memKey);
  const repetitions = parseInt(data['repetitions'] ?? '0', 10);
  const intervalDays = parseFloat(data['interval_days'] ?? '1');
  const easeFactor = parseFloat(data['ease_factor'] ?? String(INITIAL_EASE_FACTOR));
  const totalReviews = parseInt(data['total_reviews'] ?? '0', 10);

  // Compute SM-2
  const quality: SM2Quality = responseToQuality(correct, responseTimeMs);
  const result = sm2({ repetitions, intervalDays, easeFactor }, quality);

  const now = new Date().toISOString();

  // Write updated state
  const pipeline = redis.pipeline();
  pipeline.hset(memKey, {
    repetitions: String(result.repetitions),
    interval_days: String(result.intervalDays),
    ease_factor: String(result.easeFactor),
    last_reviewed_at: now,
    next_review_at: result.nextReviewAt,
    total_reviews: String(totalReviews + 1),
    topic_slug: topicSlug,
    subject_id: subjectId,
  });
  // Track in the user's card memory SET for O(1) enumeration
  pipeline.sadd(`card_memory_keys:${userId}`, cardId);
  // Invalidate the cached learning profile so next fetch recomputes
  pipeline.del(PROFILE_CACHE_KEY(userId));
  await pipeline.exec();
}

// ─── Learning Profile Builder ────────────────────────────────

export async function buildLearningProfile(userId: string): Promise<LearningProfile> {
  const redis = getRedisClient();
  const cacheKey = PROFILE_CACHE_KEY(userId);

  // ── Cache hit: return immediately (turns 500ms+ → ~5ms) ──
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as LearningProfile;
    }
  } catch (err) {
    log.warn({ err }, 'Learning profile cache read failed, recomputing');
  }

  // ── Cache miss: full computation ──
  const [knowledgeHealth, velocity, cardStates] = await Promise.all([
    buildKnowledgeHealth(userId),
    buildLearningVelocity(userId),
    getAllCardMemoryStates(userId),
  ]);

  const topicForecasts = buildTopicForecasts(knowledgeHealth);
  const examReadiness = buildExamReadiness(knowledgeHealth, velocity);
  const studyPlan = buildStudyPlan(knowledgeHealth, topicForecasts, userId);

  const totalOverdueCards = knowledgeHealth.reduce((s, sub) => s + sub.totalOverdue, 0);

  const profile: LearningProfile = {
    studyPlan,
    knowledgeHealth,
    examReadiness,
    velocity,
    topicForecasts,
    totalTrackedCards: cardStates.length,
    totalOverdueCards,
  };

  // ── Write to cache (best-effort, don't block response) ──
  redis.setex(cacheKey, PROFILE_CACHE_TTL, JSON.stringify(profile)).catch((err) => {
    log.warn({ err }, 'Learning profile cache write failed');
  });

  return profile;
}

// ─── Card Memory States ──────────────────────────────────────

async function getAllCardMemoryStates(userId: string): Promise<CardMemoryState[]> {
  const redis = getRedisClient();
  const cardIds = await redis.smembers(`card_memory_keys:${userId}`);
  if (cardIds.length === 0) return [];

  const pipeline = redis.pipeline();
  for (const id of cardIds) {
    pipeline.hgetall(`card_memory:${userId}:${id}`);
  }
  const results = await pipeline.exec();

  const states: CardMemoryState[] = [];
  for (let i = 0; i < cardIds.length; i++) {
    const [err, raw] = results?.[i] ?? [null, {}];
    const data = (!err && raw ? raw : {}) as Record<string, string>;
    if (!data['last_reviewed_at']) continue;

    states.push({
      cardId: cardIds[i]!,
      repetitions: parseInt(data['repetitions'] ?? '0', 10),
      intervalDays: parseFloat(data['interval_days'] ?? '1'),
      easeFactor: parseFloat(data['ease_factor'] ?? String(INITIAL_EASE_FACTOR)),
      lastReviewedAt: data['last_reviewed_at']!,
      nextReviewAt: data['next_review_at'] ?? new Date().toISOString(),
      totalReviews: parseInt(data['total_reviews'] ?? '0', 10),
    });
  }
  return states;
}

// ─── Knowledge Health ────────────────────────────────────────

async function buildKnowledgeHealth(userId: string): Promise<SubjectMemoryState[]> {
  const redis = getRedisClient();
  const cardIds = await redis.smembers(`card_memory_keys:${userId}`);
  if (cardIds.length === 0) return [];

  // Pipeline all card memory reads
  const pipeline = redis.pipeline();
  for (const id of cardIds) {
    pipeline.hgetall(`card_memory:${userId}:${id}`);
  }
  const results = await pipeline.exec();

  const now = new Date();

  // Group cards by subject → topic
  type CardData = {
    cardId: string; subjectId: string; topicSlug: string;
    easeFactor: number; intervalDays: number; lastReviewedAt: string;
    nextReviewAt: string; repetitions: number;
  };

  const subjectTopicMap = new Map<string, Map<string, CardData[]>>();

  for (let i = 0; i < cardIds.length; i++) {
    const [err, raw] = results?.[i] ?? [null, {}];
    const data = (!err && raw ? raw : {}) as Record<string, string>;
    if (!data['subject_id'] || !data['topic_slug'] || !data['last_reviewed_at']) continue;

    const card: CardData = {
      cardId: cardIds[i]!,
      subjectId: data['subject_id']!,
      topicSlug: data['topic_slug']!,
      easeFactor: parseFloat(data['ease_factor'] ?? String(INITIAL_EASE_FACTOR)),
      intervalDays: parseFloat(data['interval_days'] ?? '1'),
      lastReviewedAt: data['last_reviewed_at']!,
      nextReviewAt: data['next_review_at'] ?? now.toISOString(),
      repetitions: parseInt(data['repetitions'] ?? '0', 10),
    };

    if (!subjectTopicMap.has(card.subjectId)) {
      subjectTopicMap.set(card.subjectId, new Map());
    }
    const topicMap = subjectTopicMap.get(card.subjectId)!;
    if (!topicMap.has(card.topicSlug)) {
      topicMap.set(card.topicSlug, []);
    }
    topicMap.get(card.topicSlug)!.push(card);
  }

  // Enrich subject names from MongoDB
  const subjectIds = [...subjectTopicMap.keys()];
  const nameMap = await enrichSubjectNames(subjectIds);

  // Build SubjectMemoryState[]
  const subjects: SubjectMemoryState[] = [];

  for (const [subjectId, topicMap] of subjectTopicMap) {
    const topics: TopicMemoryState[] = [];
    let subjectOverdue = 0;
    let subjectDueSoon = 0;

    for (const [topicSlug, cards] of topicMap) {
      let totalRetention = 0;
      let overdue = 0;
      let dueSoon = 0;
      let totalEase = 0;
      let latestReview = new Date(0);

      for (const card of cards) {
        const lastReview = new Date(card.lastReviewedAt);
        const daysSince = (now.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24);
        const retention = estimateRetention(daysSince, card.intervalDays, card.easeFactor);
        totalRetention += retention;
        totalEase += card.easeFactor;

        const nextReview = new Date(card.nextReviewAt);
        if (nextReview < now) overdue++;
        else if ((nextReview.getTime() - now.getTime()) < 48 * 60 * 60 * 1000) dueSoon++;

        if (lastReview > latestReview) latestReview = lastReview;
      }

      const avgRetention = cards.length > 0 ? Math.round(totalRetention / cards.length) : 0;
      const avgEase = cards.length > 0 ? Math.round((totalEase / cards.length) * 100) / 100 : INITIAL_EASE_FACTOR;
      const daysSinceLast = Math.round((now.getTime() - latestReview.getTime()) / (1000 * 60 * 60 * 24));

      // Classify urgency
      let urgency: TopicMemoryState['urgency'] = 'stable';
      if (avgRetention >= 90 && overdue === 0) urgency = 'mastered';
      else if (avgRetention < 50 || overdue > cards.length * 0.5) urgency = 'critical';
      else if (avgRetention < 70 || overdue > 0) urgency = 'review-soon';

      // Simple trend: based on ease factor average vs 2.5 baseline
      let trend: TopicMemoryState['trend'] = 'stable';
      if (avgEase > 2.6) trend = 'improving';
      else if (avgEase < 2.2) trend = 'declining';

      const topicName = topicSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

      topics.push({
        topicSlug,
        topicName,
        subjectId,
        subjectName: nameMap.get(subjectId) ?? subjectId,
        retentionEstimate: avgRetention,
        daysSinceLastReview: daysSinceLast,
        cardsOverdue: overdue,
        cardsDueSoon: dueSoon,
        totalCards: cards.length,
        avgEaseFactor: avgEase,
        urgency,
        trend,
      });

      subjectOverdue += overdue;
      subjectDueSoon += dueSoon;
    }

    // Sort topics: critical first, then by retention ascending
    topics.sort((a, b) => {
      const urgencyOrder = { critical: 0, 'review-soon': 1, stable: 2, mastered: 3 };
      if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
        return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      }
      return a.retentionEstimate - b.retentionEstimate;
    });

    const subjectRetention = topics.length > 0
      ? Math.round(topics.reduce((s, t) => s + t.retentionEstimate * t.totalCards, 0) / topics.reduce((s, t) => s + t.totalCards, 0))
      : 0;

    subjects.push({
      subjectId,
      subjectName: nameMap.get(subjectId) ?? subjectId,
      retentionEstimate: subjectRetention,
      topics,
      totalOverdue: subjectOverdue,
      totalDueSoon: subjectDueSoon,
    });
  }

  subjects.sort((a, b) => a.retentionEstimate - b.retentionEstimate);
  return subjects;
}

// ─── Learning Velocity ───────────────────────────────────────

async function buildLearningVelocity(userId: string): Promise<LearningVelocity> {
  const pg = getPostgresPool();

  // Get last 28 days of session data, grouped by week
  const result = await pg.query(
    `SELECT
       EXTRACT(WEEK FROM started_at) AS week_num,
       MIN(started_at::date)::text AS week_start,
       COUNT(*) AS sessions,
       SUM(cards_studied) AS cards,
       SUM(correct_answers)::float / NULLIF(SUM(cards_studied), 0) * 100 AS accuracy,
       AVG(avg_response_time_ms) AS avg_speed
     FROM study_sessions
     WHERE user_id = (SELECT id FROM users WHERE firebase_uid = $1)
       AND started_at >= NOW() - INTERVAL '28 days'
     GROUP BY week_num
     ORDER BY week_num`,
    [userId],
  );

  const weeks = result.rows as { week_num: number; week_start: string; sessions: string; cards: string; accuracy: string; avg_speed: string }[];

  // Build weekly trend
  const weeklyTrend = weeks.map(w => ({
    week: w.week_start,
    cardsPerDay: Math.round(parseInt(w.cards ?? '0', 10) / 7),
    accuracy: Math.round(parseFloat(w.accuracy ?? '0')),
  }));

  // Current vs previous period (last 7 days vs 7 days before that)
  const velocityResult = await pg.query(
    `SELECT
       period,
       SUM(cards_studied) AS cards,
       SUM(correct_answers)::float / NULLIF(SUM(cards_studied), 0) * 100 AS accuracy,
       AVG(avg_response_time_ms) AS avg_speed
     FROM (
       SELECT *,
         CASE
           WHEN started_at >= NOW() - INTERVAL '7 days' THEN 'current'
           WHEN started_at >= NOW() - INTERVAL '14 days' THEN 'previous'
         END AS period
       FROM study_sessions
       WHERE user_id = (SELECT id FROM users WHERE firebase_uid = $1)
         AND started_at >= NOW() - INTERVAL '14 days'
     ) sub
     WHERE period IS NOT NULL
     GROUP BY period`,
    [userId],
  );

  const periods = new Map<string, { cards: number; accuracy: number; speed: number }>();
  for (const row of velocityResult.rows as { period: string; cards: string; accuracy: string; avg_speed: string }[]) {
    periods.set(row.period, {
      cards: parseInt(row.cards ?? '0', 10),
      accuracy: Math.round(parseFloat(row.accuracy ?? '0')),
      speed: Math.round(parseFloat(row.avg_speed ?? '0')),
    });
  }

  const current = periods.get('current') ?? { cards: 0, accuracy: 0, speed: 0 };
  const previous = periods.get('previous') ?? { cards: 0, accuracy: 0, speed: 0 };

  const cardsDelta = previous.cards > 0 ? Math.round(((current.cards - previous.cards) / previous.cards) * 100) : 0;
  const accDelta = current.accuracy - previous.accuracy;
  const speedDelta = previous.speed > 0 ? Math.round(((current.speed - previous.speed) / previous.speed) * 100) : 0;

  return {
    cardsPerDay: Math.round(current.cards / 7),
    cardsPerDayDelta: cardsDelta,
    accuracy7d: current.accuracy,
    accuracyDelta: accDelta,
    avgSpeedMs: current.speed,
    speedDelta,
    retentionEstimate: 0,  // Filled below after knowledge health is built
    retentionDelta: 0,
    weeklyTrend,
  };
}

// ─── Topic Forecasts ─────────────────────────────────────────

function buildTopicForecasts(health: SubjectMemoryState[]): TopicForecast[] {
  const forecasts: TopicForecast[] = [];

  for (const subject of health) {
    for (const topic of subject.topics) {
      // Predict retention in 7 days using Ebbinghaus
      const futureRetention = estimateRetention(
        topic.daysSinceLastReview + 7,
        topic.totalCards > 0 ? topic.avgEaseFactor * 2 : 1, // rough stability proxy
        topic.avgEaseFactor,
      );

      let riskLevel: TopicForecast['riskLevel'] = 'low';
      if (futureRetention < 40) riskLevel = 'high';
      else if (futureRetention < 65) riskLevel = 'medium';

      forecasts.push({
        topicSlug: topic.topicSlug,
        topicName: topic.topicName,
        subjectName: topic.subjectName,
        currentAccuracy: topic.retentionEstimate,
        predictedAccuracyIn7Days: futureRetention,
        riskLevel,
        recommendedReviewCards: topic.cardsOverdue + Math.ceil(topic.cardsDueSoon * 0.5),
      });
    }
  }

  // Sort by risk: high first
  const riskOrder = { high: 0, medium: 1, low: 2 };
  forecasts.sort((a, b) => riskOrder[a.riskLevel] - riskOrder[b.riskLevel]);

  return forecasts;
}

// ─── Exam Readiness ──────────────────────────────────────────

function buildExamReadiness(health: SubjectMemoryState[], velocity: LearningVelocity): ExamReadiness {
  if (health.length === 0) {
    return { overallScore: 0, strongAreas: [], vulnerableAreas: [], daysToTargetReadiness: 0, weeklyDelta: 0 };
  }

  // Weighted average retention across all subjects
  let totalCards = 0;
  let weightedRetention = 0;
  const strong: string[] = [];
  const vulnerable: string[] = [];

  for (const subject of health) {
    const cards = subject.topics.reduce((s, t) => s + t.totalCards, 0);
    totalCards += cards;
    weightedRetention += subject.retentionEstimate * cards;

    if (subject.retentionEstimate >= 75) {
      strong.push(subject.subjectName);
    } else if (subject.retentionEstimate < 60) {
      vulnerable.push(subject.subjectName);
    }
  }

  const overallScore = totalCards > 0 ? Math.round(weightedRetention / totalCards) : 0;

  // Rough estimate: how many study days to reach 85%
  const deficit = Math.max(0, 85 - overallScore);
  const dailyGain = velocity.cardsPerDay > 0 ? Math.max(1, Math.round(deficit / 3)) : 0;
  const daysToTarget = dailyGain > 0 ? Math.ceil(deficit / dailyGain) : 0;

  return {
    overallScore,
    strongAreas: strong,
    vulnerableAreas: vulnerable,
    daysToTargetReadiness: daysToTarget,
    weeklyDelta: velocity.accuracyDelta,
  };
}

// ─── Study Plan ──────────────────────────────────────────────

function buildStudyPlan(
  health: SubjectMemoryState[],
  forecasts: TopicForecast[],
  _userId: string,
): DailyStudyPlan {
  const sessions: PlannedStudySession[] = [];
  const today = new Date().toISOString().split('T')[0]!;

  // Priority 1: Overdue cards (critical urgency)
  for (const subject of health) {
    for (const topic of subject.topics) {
      if (topic.cardsOverdue > 0) {
        sessions.push({
          topicSlug: topic.topicSlug,
          topicName: topic.topicName,
          subjectId: topic.subjectId,
          subjectName: topic.subjectName,
          reason: 'overdue',
          cardCount: topic.cardsOverdue,
          estimatedMinutes: Math.ceil(topic.cardsOverdue * 0.5),
          priority: sessions.length + 1,
          difficulty: topic.retentionEstimate < 50 ? 'challenging' : 'moderate',
        });
      }
    }
  }

  // Priority 2: Declining topics from forecasts
  for (const forecast of forecasts) {
    if (forecast.riskLevel === 'high' && !sessions.find(s => s.topicSlug === forecast.topicSlug)) {
      const topic = health.flatMap(s => s.topics).find(t => t.topicSlug === forecast.topicSlug);
      if (topic) {
        sessions.push({
          topicSlug: topic.topicSlug,
          topicName: topic.topicName,
          subjectId: topic.subjectId,
          subjectName: topic.subjectName,
          reason: 'declining',
          cardCount: forecast.recommendedReviewCards || 5,
          estimatedMinutes: Math.ceil((forecast.recommendedReviewCards || 5) * 0.5),
          priority: sessions.length + 1,
          difficulty: 'moderate',
        });
      }
    }
  }

  // Priority 3: Due-soon reinforcement
  for (const subject of health) {
    for (const topic of subject.topics) {
      if (topic.cardsDueSoon > 0 && !sessions.find(s => s.topicSlug === topic.topicSlug)) {
        sessions.push({
          topicSlug: topic.topicSlug,
          topicName: topic.topicName,
          subjectId: topic.subjectId,
          subjectName: topic.subjectName,
          reason: 'reinforcement',
          cardCount: topic.cardsDueSoon,
          estimatedMinutes: Math.ceil(topic.cardsDueSoon * 0.4),
          priority: sessions.length + 1,
          difficulty: 'easy_review',
        });
      }
    }
  }

  // Cap at 5 sessions for focus
  const capped = sessions.slice(0, 5);
  const totalMinutes = capped.reduce((s, sess) => s + sess.estimatedMinutes, 0);

  // Generate insight
  let insight = 'Start studying to build your learning profile!';
  if (capped.length > 0) {
    const overdueCount = capped.filter(s => s.reason === 'overdue').length;
    if (overdueCount > 0) {
      insight = `You have ${overdueCount} topic${overdueCount > 1 ? 's' : ''} with overdue cards. Reviewing them today will significantly boost your retention.`;
    } else {
      insight = `Your knowledge is in good shape. Today's plan focuses on reinforcement to keep your retention high.`;
    }
  }

  return {
    date: today,
    totalMinutes,
    sessions: capped,
    insight,
    optimalWindow: null, // Enhanced later with chronotype data
  };
}

// ─── Helpers ─────────────────────────────────────────────────

async function enrichSubjectNames(subjectIds: string[]): Promise<Map<string, string>> {
  const nameMap = new Map<string, string>();
  if (subjectIds.length === 0) return nameMap;

  try {
    const validIds = subjectIds.filter(id => /^[0-9a-fA-F]{24}$/.test(id));
    if (validIds.length === 0) return nameMap;

    const subjects = await getMongoDb()
      .collection('subjects')
      .find({ _id: { $in: validIds.map(id => new ObjectId(id)) } })
      .project({ name: 1 })
      .toArray();

    for (const sub of subjects) {
      nameMap.set(sub._id.toString(), sub.name as string);
    }
  } catch (err) {
    log.warn({ err }, 'Failed to enrich subject names');
  }
  return nameMap;
}

// ─── Backfill: Populate card memory from existing level progress ─

/**
 * One-time backfill: reads all tracked level_progress keys for a user
 * and seeds card_memory entries with reasonable SM-2 defaults.
 * Should be called once per user migration.
 */
export async function backfillCardMemory(userId: string): Promise<number> {
  const redis = getRedisClient();
  const trackedMembers = await redis.smembers(`level_progress_keys:${userId}`);
  if (trackedMembers.length === 0) return 0;

  let seeded = 0;

  for (const member of trackedMembers) {
    const seg = member.split(':');
    if (seg.length !== 4) continue;
    const [examId, subjectId, topicSlug, level] = seg as [string, string, string, string];

    const progressKey = `level_progress:${userId}:${examId}:${subjectId}:${topicSlug}:${level}`;
    const data = await redis.hgetall(progressKey);
    const correct = parseInt(data['correct'] ?? '0', 10);
    const total = parseInt(data['total'] ?? '0', 10);

    if (total === 0) continue;

    // Create a synthetic card memory entry per topic:level combination
    const syntheticCardId = `${examId}:${subjectId}:${topicSlug}:${level}`;
    const exists = await redis.exists(`card_memory:${userId}:${syntheticCardId}`);
    if (exists) continue;

    // Derive SM-2 state from historical accuracy
    const accuracy = correct / total;
    const easeFactor = Math.max(1.3, 2.5 + (accuracy - 0.6) * 2);
    const repetitions = Math.min(correct, 10);
    const intervalDays = Math.round(repetitions * easeFactor);

    const now = new Date();
    const nextReview = new Date(now);
    nextReview.setDate(nextReview.getDate() + Math.max(1, intervalDays));

    const pipeline = redis.pipeline();
    pipeline.hset(`card_memory:${userId}:${syntheticCardId}`, {
      repetitions: String(repetitions),
      interval_days: String(intervalDays),
      ease_factor: String(Math.round(easeFactor * 100) / 100),
      last_reviewed_at: now.toISOString(),
      next_review_at: nextReview.toISOString(),
      total_reviews: String(total),
      topic_slug: topicSlug,
      subject_id: subjectId,
    });
    pipeline.sadd(`card_memory_keys:${userId}`, syntheticCardId);
    await pipeline.exec();
    seeded++;
  }

  return seeded;
}
