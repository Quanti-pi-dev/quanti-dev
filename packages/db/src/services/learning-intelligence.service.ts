// ─── Learning Intelligence Service ───────────────────────────
// Computes the full LearningProfile by aggregating SM-2 card memory
// data from Redis, session history from PostgreSQL, and subject/topic
// metadata from MongoDB.

import { getRedisClient, getPostgresPool, getMongoDb } from '../clients/database.js';
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

// ─── Exam Syllabus Metadata ──────────────────────────────────

/** Topic/card counts per subject for coverage computation. */
interface SyllabusTopic { topicSlug: string; topicName: string; cardCount: number }
interface SyllabusSubject { subjectId: string; subjectName: string; topics: SyllabusTopic[] }

/**
 * Fetches the complete exam syllabus: all subjects → topics → card counts.
 * Cached in Redis for 1 hour (content rarely changes).
 */
async function getExamSyllabus(selectedExams: string[]): Promise<SyllabusSubject[]> {
  if (selectedExams.length === 0) return [];

  const redis = getRedisClient();
  const cacheKey = `exam_syllabus:${selectedExams.sort().join(',')}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as SyllabusSubject[];
  } catch { /* recompute */ }

  const mongo = getMongoDb();
  const validExamIds = selectedExams.filter(id => /^[0-9a-fA-F]{24}$/.test(id));
  if (validExamIds.length === 0) return [];

  // Get all subjects for the exam(s)
  const examSubjectDocs = await mongo.collection('exam_subjects')
    .find({ examId: { $in: validExamIds.map(id => new ObjectId(id)) } })
    .sort({ order: 1 })
    .toArray();

  const subjectIds = [...new Set(examSubjectDocs.map(d => (d['subjectId'] as ObjectId).toHexString()))];
  if (subjectIds.length === 0) return [];

  // Fetch subject names + topics + deck card counts in parallel
  const validSubjectIds = subjectIds.filter(id => /^[0-9a-fA-F]{24}$/.test(id));
  const [subjectDocs, topicDocs, deckAgg] = await Promise.all([
    mongo.collection('subjects')
      .find({ _id: { $in: validSubjectIds.map(id => new ObjectId(id)) } })
      .project({ name: 1 }).toArray(),
    mongo.collection('topics')
      .find({ subjectId: { $in: validSubjectIds.map(id => new ObjectId(id)) } })
      .project({ subjectId: 1, slug: 1, displayName: 1 }).toArray(),
    mongo.collection('decks').aggregate([
      { $match: { subjectId: { $in: validSubjectIds.map(id => new ObjectId(id)) }, isPublished: true } },
      { $group: { _id: { subjectId: '$subjectId', topicSlug: '$topicSlug' }, totalCards: { $sum: '$cardCount' } } },
    ]).toArray(),
  ]);

  const subjectNameMap = new Map(subjectDocs.map(s => [s._id.toString(), s.name as string]));

  // Build deck card count map: subjectId:topicSlug → totalCards
  const deckCardMap = new Map<string, number>();
  for (const agg of deckAgg) {
    const key = `${(agg._id.subjectId as ObjectId).toHexString()}:${agg._id.topicSlug}`;
    deckCardMap.set(key, (agg.totalCards as number) ?? 0);
  }

  // Group topics by subject
  const subjectTopicMap = new Map<string, SyllabusTopic[]>();
  for (const topic of topicDocs) {
    const subId = (topic.subjectId as ObjectId).toHexString();
    if (!subjectTopicMap.has(subId)) subjectTopicMap.set(subId, []);
    const slug = topic.slug as string;
    subjectTopicMap.get(subId)!.push({
      topicSlug: slug,
      topicName: (topic.displayName as string) ?? slug,
      cardCount: deckCardMap.get(`${subId}:${slug}`) ?? 0,
    });
  }

  const result: SyllabusSubject[] = subjectIds.map(subId => ({
    subjectId: subId,
    subjectName: subjectNameMap.get(subId) ?? subId,
    topics: subjectTopicMap.get(subId) ?? [],
  }));

  // Cache for 1 hour
  redis.setex(cacheKey, 3600, JSON.stringify(result)).catch(() => {});
  return result;
}

// ─── Intelligence Data Loaders ───────────────────────────────
// These read data from BKT, IRT, error journal, and level progress
// that already exists in Redis but was previously ignored.

interface ConceptMasteryData {
  tag: string;
  pMastery: number;
  totalAttempts: number;
  correctAttempts: number;
}

/** Load all BKT concept mastery data for a user. */
async function loadConceptMastery(userId: string): Promise<ConceptMasteryData[]> {
  const redis = getRedisClient();
  try {
    const keys = await redis.smembers(`concept_mastery_keys:${userId}`);
    if (keys.length === 0) return [];

    const pipeline = redis.pipeline();
    for (const tag of keys) {
      pipeline.hgetall(`concept_mastery:${userId}:${tag}`);
    }
    const results = await pipeline.exec();

    const data: ConceptMasteryData[] = [];
    for (let i = 0; i < keys.length; i++) {
      const [err, raw] = results?.[i] ?? [null, {}];
      const d = (!err && raw ? raw : {}) as Record<string, string>;
      if (d['p_mastery']) {
        data.push({
          tag: keys[i]!,
          pMastery: parseFloat(d['p_mastery']),
          totalAttempts: parseInt(d['total_attempts'] ?? '0', 10),
          correctAttempts: parseInt(d['correct_attempts'] ?? '0', 10),
        });
      }
    }
    return data;
  } catch (err) {
    log.warn({ err }, 'Failed to load concept mastery');
    return [];
  }
}

/** Load IRT student ability θ. */
async function loadStudentAbilityTheta(userId: string): Promise<number> {
  const redis = getRedisClient();
  try {
    const data = await redis.hgetall(`student_ability:${userId}`);
    if (data['theta']) return parseFloat(data['theta']);
    const correct = parseInt(data['correct'] ?? '0', 10);
    const total = parseInt(data['total'] ?? '0', 10);
    if (total >= 5) {
      const p = Math.max(0.01, Math.min(0.99, correct / total));
      return Math.max(-3, Math.min(3, Math.log(p / (1 - p))));
    }
  } catch (err) {
    log.warn({ err }, 'Failed to load student ability');
  }
  return 0; // average ability
}

/** Load error journal — concepts the student repeatedly gets wrong. */
async function loadErrorPatterns(userId: string): Promise<Map<string, number>> {
  const redis = getRedisClient();
  const errorCounts = new Map<string, number>();
  try {
    const entries = await redis.zrevrange(`error_journal:${userId}`, 0, 99);
    for (const entry of entries) {
      try {
        const data = JSON.parse(entry) as { cardId?: string; topicSlug?: string; tags?: string[] };
        if (data.tags) {
          for (const tag of data.tags) {
            errorCounts.set(tag, (errorCounts.get(tag) ?? 0) + 1);
          }
        }
        if (data.topicSlug) {
          errorCounts.set(`topic:${data.topicSlug}`, (errorCounts.get(`topic:${data.topicSlug}`) ?? 0) + 1);
        }
      } catch { /* skip malformed */ }
    }
  } catch (err) {
    log.warn({ err }, 'Failed to load error patterns');
  }
  return errorCounts;
}

interface LevelDepthData {
  topicSlug: string;
  subjectId: string;
  levels: Map<string, { correct: number; total: number }>;
}

/** Load level progression depth per topic. */
async function loadLevelDepth(userId: string): Promise<Map<string, LevelDepthData>> {
  const redis = getRedisClient();
  const depthMap = new Map<string, LevelDepthData>();
  try {
    const members = await redis.smembers(`level_progress_keys:${userId}`);
    if (members.length === 0) return depthMap;

    const pipeline = redis.pipeline();
    const validMembers: string[] = [];
    for (const member of members) {
      const seg = member.split(':');
      if (seg.length !== 4) continue;
      validMembers.push(member);
      const [examId, subjectId, topicSlug, level] = seg as [string, string, string, string];
      pipeline.hgetall(`level_progress:${userId}:${examId}:${subjectId}:${topicSlug}:${level}`);
    }
    const results = await pipeline.exec();

    for (let i = 0; i < validMembers.length; i++) {
      const seg = validMembers[i]!.split(':');
      const [, subjectId, topicSlug, level] = seg as [string, string, string, string];
      const [err, raw] = results?.[i] ?? [null, {}];
      const d = (!err && raw ? raw : {}) as Record<string, string>;

      const key = `${subjectId}:${topicSlug}`;
      if (!depthMap.has(key)) {
        depthMap.set(key, { topicSlug: topicSlug!, subjectId: subjectId!, levels: new Map() });
      }
      depthMap.get(key)!.levels.set(level!, {
        correct: parseInt(d['correct'] ?? '0', 10),
        total: parseInt(d['total'] ?? '0', 10),
      });
    }
  } catch (err) {
    log.warn({ err }, 'Failed to load level depth');
  }
  return depthMap;
}

/**
 * Compute depth score 0–100 from level completion rates.
 * Level 1 = 15%, Level 2 = 30%, Level 3 = 55% weight.
 */
function computeDepthScore(levels: Map<string, { correct: number; total: number }>): number {
  const LEVEL_WEIGHTS: Record<string, number> = { '1': 0.15, '2': 0.30, '3': 0.55 };
  const UNLOCK_THRESHOLD = 30;
  let score = 0;

  for (const [level, { correct }] of levels) {
    const weight = LEVEL_WEIGHTS[level] ?? 0.1;
    const completion = Math.min(1, correct / UNLOCK_THRESHOLD);
    score += weight * completion;
  }

  return Math.round(score * 100);
}

/** Compute consistency score 0–100 from recent active study days. */
async function computeConsistencyScore(userId: string): Promise<number> {
  const pg = getPostgresPool();
  try {
    const result = await pg.query(
      `SELECT COUNT(DISTINCT started_at::date) AS active_days
       FROM study_sessions
       WHERE user_id = (SELECT id FROM users WHERE firebase_uid = $1)
         AND started_at >= NOW() - INTERVAL '14 days'`,
      [userId],
    );
    const activeDays = parseInt(result.rows[0]?.active_days ?? '0', 10);
    // 14 days window: 10+ days = 100, 7 days = 70, 3 days = 30, 0 = 0
    return Math.min(100, Math.round((activeDays / 10) * 100));
  } catch {
    return 0;
  }
}

// ─── Learning Profile Builder ────────────────────────────────

export async function buildLearningProfile(userId: string, selectedExams?: string[]): Promise<LearningProfile> {
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

  // ── Fetch syllabus for coverage computation ──
  const syllabus = await getExamSyllabus(selectedExams ?? []);

  // ── Load ALL intelligence signals in parallel ──
  const [
    knowledgeHealthBase, velocity, cardStates,
    conceptMasteryAll, studentTheta, errorPatterns, levelDepth, consistency,
  ] = await Promise.all([
    buildKnowledgeHealthBase(userId, syllabus),
    buildLearningVelocity(userId),
    getAllCardMemoryStates(userId),
    loadConceptMastery(userId),
    loadStudentAbilityTheta(userId),
    loadErrorPatterns(userId),
    loadLevelDepth(userId),
    computeConsistencyScore(userId),
  ]);

  // ── Enrich knowledge health with BKT, depth, and error data ──
  const knowledgeHealth = enrichWithIntelligence(
    knowledgeHealthBase, conceptMasteryAll, levelDepth, errorPatterns,
  );

  const topicForecasts = buildTopicForecasts(knowledgeHealth);
  const examReadiness = buildExamReadiness(
    knowledgeHealth, velocity, syllabus, studentTheta, consistency, conceptMasteryAll,
  );
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

async function buildKnowledgeHealthBase(userId: string, syllabus: SyllabusSubject[]): Promise<SubjectMemoryState[]> {
  const redis = getRedisClient();
  const cardIds = await redis.smembers(`card_memory_keys:${userId}`);

  // Pipeline all card memory reads
  const pipeline = redis.pipeline();
  for (const id of cardIds) {
    pipeline.hgetall(`card_memory:${userId}:${id}`);
  }
  const results = cardIds.length > 0 ? await pipeline.exec() : [];

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

  // Build a lookup for syllabus card counts: subjectId:topicSlug → cardCount
  const syllabusCardMap = new Map<string, number>();
  const syllabusTopicNames = new Map<string, string>();
  for (const sub of syllabus) {
    for (const t of sub.topics) {
      syllabusCardMap.set(`${sub.subjectId}:${t.topicSlug}`, t.cardCount);
      syllabusTopicNames.set(`${sub.subjectId}:${t.topicSlug}`, t.topicName);
    }
  }

  // Enrich subject names from MongoDB (for studied subjects not in syllabus)
  const allSubjectIds = [...new Set([...subjectTopicMap.keys(), ...syllabus.map(s => s.subjectId)])];
  const nameMap = await enrichSubjectNames(allSubjectIds);
  // Override with syllabus names
  for (const sub of syllabus) nameMap.set(sub.subjectId, sub.subjectName);

  // Helper: build a TopicMemoryState from studied cards
  function buildStudiedTopic(
    topicSlug: string, subjectId: string, cards: CardData[],
  ): TopicMemoryState {
    let totalRetention = 0, overdue = 0, dueSoon = 0, totalEase = 0;
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
    const syllabusKey = `${subjectId}:${topicSlug}`;

    let urgency: TopicMemoryState['urgency'] = 'stable';
    if (avgRetention >= 90 && overdue === 0) urgency = 'mastered';
    else if (avgRetention < 50 || overdue > cards.length * 0.5) urgency = 'critical';
    else if (avgRetention < 70 || overdue > 0) urgency = 'review-soon';

    let trend: TopicMemoryState['trend'] = 'stable';
    if (avgEase > 2.6) trend = 'improving';
    else if (avgEase < 2.2) trend = 'declining';

    const topicName = syllabusTopicNames.get(syllabusKey)
      ?? topicSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    return {
      topicSlug, topicName, subjectId,
      subjectName: nameMap.get(subjectId) ?? subjectId,
      retentionEstimate: avgRetention,
      conceptMastery: 0,  // filled by enrichWithIntelligence
      depthScore: 0,       // filled by enrichWithIntelligence
      weakConcepts: [],    // filled by enrichWithIntelligence
      daysSinceLastReview: daysSinceLast,
      cardsOverdue: overdue, cardsDueSoon: dueSoon,
      totalCards: cards.length,
      totalCardsAvailable: syllabusCardMap.get(syllabusKey) ?? cards.length,
      avgEaseFactor: avgEase, urgency, trend,
    };
  }

  // Build SubjectMemoryState[] — merge studied data with syllabus
  const subjects: SubjectMemoryState[] = [];
  const processedSubjectIds = new Set<string>();

  // Process all subjects (from syllabus first, then any studied-only subjects)
  const orderedSubjectIds = [
    ...syllabus.map(s => s.subjectId),
    ...[...subjectTopicMap.keys()].filter(id => !syllabus.find(s => s.subjectId === id)),
  ];

  for (const subjectId of orderedSubjectIds) {
    if (processedSubjectIds.has(subjectId)) continue;
    processedSubjectIds.add(subjectId);

    const studiedTopics = subjectTopicMap.get(subjectId) ?? new Map();
    const syllabusSubject = syllabus.find(s => s.subjectId === subjectId);
    const syllabusTopics = syllabusSubject?.topics ?? [];

    const topics: TopicMemoryState[] = [];
    let subjectOverdue = 0, subjectDueSoon = 0;
    const processedTopicSlugs = new Set<string>();

    // 1. Add studied topics
    for (const [topicSlug, cards] of studiedTopics) {
      processedTopicSlugs.add(topicSlug);
      const topic = buildStudiedTopic(topicSlug, subjectId, cards);
      topics.push(topic);
      subjectOverdue += topic.cardsOverdue;
      subjectDueSoon += topic.cardsDueSoon;
    }

    // 2. Add not-started topics from syllabus
    for (const st of syllabusTopics) {
      if (processedTopicSlugs.has(st.topicSlug)) continue;
      topics.push({
        topicSlug: st.topicSlug,
        topicName: st.topicName,
        subjectId,
        subjectName: nameMap.get(subjectId) ?? subjectId,
        retentionEstimate: 0,
        conceptMastery: 0,
        depthScore: 0,
        weakConcepts: [],
        daysSinceLastReview: 0,
        cardsOverdue: 0, cardsDueSoon: 0,
        totalCards: 0,
        totalCardsAvailable: st.cardCount,
        avgEaseFactor: INITIAL_EASE_FACTOR,
        urgency: 'not-started',
        trend: 'stable',
      });
    }

    // Sort topics: not-started last, then critical first, then by retention ascending
    const urgencyOrder: Record<string, number> = { critical: 0, 'review-soon': 1, stable: 2, mastered: 3, 'not-started': 4 };
    topics.sort((a, b) => {
      if (urgencyOrder[a.urgency]! !== urgencyOrder[b.urgency]!) {
        return urgencyOrder[a.urgency]! - urgencyOrder[b.urgency]!;
      }
      return a.retentionEstimate - b.retentionEstimate;
    });

    // Subject retention: weighted by studied cards only (not-started don't inflate)
    const studiedCards = topics.filter(t => t.totalCards > 0);
    const totalStudiedCards = studiedCards.reduce((s, t) => s + t.totalCards, 0);
    const subjectRetention = totalStudiedCards > 0
      ? Math.round(studiedCards.reduce((s, t) => s + t.retentionEstimate * t.totalCards, 0) / totalStudiedCards)
      : 0;

    const studiedCount = topics.filter(t => t.urgency !== 'not-started').length;
    const totalTopicCount = syllabusTopics.length > 0 ? syllabusTopics.length : studiedCount;

    subjects.push({
      subjectId,
      subjectName: nameMap.get(subjectId) ?? subjectId,
      retentionEstimate: subjectRetention,
      conceptMastery: 0,  // filled by enrichWithIntelligence
      depthScore: 0,       // filled by enrichWithIntelligence
      topics,
      totalOverdue: subjectOverdue,
      totalDueSoon: subjectDueSoon,
      studiedTopics: studiedCount,
      totalTopicsInSubject: totalTopicCount,
    });
  }

  subjects.sort((a, b) => a.retentionEstimate - b.retentionEstimate);
  return subjects;
}

// ─── Intelligence Enrichment ─────────────────────────────────
// Overlays BKT concept mastery, level depth, and error patterns
// onto the base knowledge health data. This is the "tutor brain."

function enrichWithIntelligence(
  subjects: SubjectMemoryState[],
  conceptMasteryAll: ConceptMasteryData[],
  levelDepth: Map<string, LevelDepthData>,
  errorPatterns: Map<string, number>,
): SubjectMemoryState[] {

  for (const subject of subjects) {
    let subjectMasterySum = 0;
    let subjectMasteryCount = 0;
    let subjectDepthSum = 0;
    let subjectDepthCount = 0;

    for (const topic of subject.topics) {
      if (topic.urgency === 'not-started') continue;

      // ── BKT Concept Mastery ──
      // Find all concept tags that match this topic (tags often include topic slug)
      const topicConcepts = conceptMasteryAll.filter(c =>
        c.tag.includes(topic.topicSlug) ||
        c.tag.startsWith(`${subject.subjectId}:`) && c.tag.includes(topic.topicSlug)
      );

      if (topicConcepts.length > 0) {
        const avgMastery = topicConcepts.reduce((s, c) => s + c.pMastery, 0) / topicConcepts.length;
        topic.conceptMastery = Math.round(avgMastery * 100);

        // Identify weak concepts: p_mastery < 0.4 with 5+ attempts
        topic.weakConcepts = topicConcepts
          .filter(c => c.pMastery < 0.4 && c.totalAttempts >= 5)
          .map(c => c.tag);
      } else {
        // Fallback: use retention estimate as rough proxy
        topic.conceptMastery = topic.retentionEstimate;
      }

      // ── Level Depth Score ──
      const depthKey = `${subject.subjectId}:${topic.topicSlug}`;
      const depth = levelDepth.get(depthKey);
      if (depth) {
        topic.depthScore = computeDepthScore(depth.levels);
      }

      // ── Error Pattern Enrichment ──
      const topicErrors = errorPatterns.get(`topic:${topic.topicSlug}`) ?? 0;
      if (topicErrors >= 3 && topic.urgency !== 'critical') {
        // Promote urgency if student keeps failing this topic
        topic.urgency = 'review-soon';
      }

      // ── Refine urgency using concept mastery (tutor-grade) ──
      // A tutor wouldn't call something "mastered" if BKT says < 0.7
      if (topic.urgency === 'mastered' && topic.conceptMastery < 70) {
        topic.urgency = 'stable'; // downgrade: they can recall but don't deeply understand
      }
      // A tutor wouldn't call something "stable" if depth is very low
      if (topic.urgency === 'stable' && topic.depthScore < 20 && topic.totalCards > 5) {
        topic.urgency = 'review-soon'; // they only did easy questions
      }

      subjectMasterySum += topic.conceptMastery;
      subjectMasteryCount++;
      subjectDepthSum += topic.depthScore;
      subjectDepthCount++;
    }

    // Subject-level aggregations
    subject.conceptMastery = subjectMasteryCount > 0
      ? Math.round(subjectMasterySum / subjectMasteryCount) : 0;
    subject.depthScore = subjectDepthCount > 0
      ? Math.round(subjectDepthSum / subjectDepthCount) : 0;
  }

  return subjects;
}

// ─── Learning Velocity ───────────────────────────────────────

async function buildLearningVelocity(userId: string): Promise<LearningVelocity> {
  const pg = getPostgresPool();

  // Get last 28 days of session data, grouped by week — include active days count
  const result = await pg.query(
    `SELECT
       EXTRACT(WEEK FROM started_at) AS week_num,
       MIN(started_at::date)::text AS week_start,
       COUNT(*) AS sessions,
       COUNT(DISTINCT started_at::date) AS active_days,
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

  const weeks = result.rows as { week_num: number; week_start: string; sessions: string; cards: string; active_days: string; accuracy: string; avg_speed: string }[];

  // Build weekly trend — use active days for honest cardsPerDay
  const weeklyTrend = weeks.map(w => {
    const activeDays = Math.max(1, parseInt(w.active_days ?? '1', 10));
    return {
      week: w.week_start,
      cardsPerDay: Math.round(parseInt(w.cards ?? '0', 10) / activeDays),
      accuracy: Math.round(parseFloat(w.accuracy ?? '0')),
      activeDays,
    };
  });

  // Current vs previous period (last 7 days vs 7 days before that)
  const velocityResult = await pg.query(
    `SELECT
       period,
       SUM(cards_studied) AS cards,
       COUNT(DISTINCT started_at::date) AS active_days,
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

  const periods = new Map<string, { cards: number; activeDays: number; accuracy: number; speed: number }>();
  for (const row of velocityResult.rows as { period: string; cards: string; active_days: string; accuracy: string; avg_speed: string }[]) {
    periods.set(row.period, {
      cards: parseInt(row.cards ?? '0', 10),
      activeDays: Math.max(1, parseInt(row.active_days ?? '1', 10)),
      accuracy: Math.round(parseFloat(row.accuracy ?? '0')),
      speed: Math.round(parseFloat(row.avg_speed ?? '0')),
    });
  }

  const current = periods.get('current') ?? { cards: 0, activeDays: 0, accuracy: 0, speed: 0 };
  const previous = periods.get('previous') ?? { cards: 0, activeDays: 0, accuracy: 0, speed: 0 };

  const currentCpd = current.activeDays > 0 ? Math.round(current.cards / current.activeDays) : 0;
  const previousCpd = previous.activeDays > 0 ? Math.round(previous.cards / previous.activeDays) : 0;
  const cardsDelta = previousCpd > 0 ? Math.round(((currentCpd - previousCpd) / previousCpd) * 100) : 0;
  const accDelta = current.accuracy - previous.accuracy;
  const speedDelta = previous.speed > 0 ? Math.round(((current.speed - previous.speed) / previous.speed) * 100) : 0;

  return {
    cardsPerDay: currentCpd,
    cardsPerDayDelta: cardsDelta,
    activeDays: current.activeDays,
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
      // Skip not-started topics — nothing to forecast
      if (topic.urgency === 'not-started') continue;

      // Predict retention in 7 days using Ebbinghaus
      // Use actual average intervalDays as stability proxy instead of ease*2 hack
      const stability = topic.totalCards > 0
        ? Math.max(1, topic.avgEaseFactor * Math.max(1, topic.daysSinceLastReview > 0 ? topic.daysSinceLastReview : 1))
        : 1;
      const futureRetention = estimateRetention(
        topic.daysSinceLastReview + 7,
        stability,
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

function buildExamReadiness(
  health: SubjectMemoryState[],
  velocity: LearningVelocity,
  syllabus: SyllabusSubject[],
  studentTheta: number,
  consistencyScore: number,
  conceptMasteryAll: ConceptMasteryData[],
): ExamReadiness {
  const empty: ExamReadiness = {
    overallScore: 0, conceptMasteryScore: 0, depthScore: 0,
    coverageFactor: 0, consistencyScore: 0, abilityScore: 0,
    studentAbility: 0, studiedTopics: 0, totalTopicsInExam: 0,
    strongAreas: [], vulnerableAreas: [], weakConcepts: [],
    daysToTargetReadiness: 0, weeklyDelta: 0,
  };
  if (health.length === 0) return empty;

  // ── Compute each signal ──

  const totalTopicsInExam = syllabus.reduce((s, sub) => s + sub.topics.length, 0) || 1;
  let studiedTopicCount = 0;
  let masterySum = 0, depthSum = 0;
  let masteryCount = 0, depthCount = 0;
  const strong: string[] = [];
  const vulnerable: string[] = [];

  for (const subject of health) {
    const studied = subject.topics.filter(t => t.urgency !== 'not-started');
    studiedTopicCount += studied.length;

    for (const t of studied) {
      masterySum += t.conceptMastery;
      masteryCount++;
      depthSum += t.depthScore;
      depthCount++;
    }

    // Strong = BKT mastery ≥ 70, depth ≥ 50%, coverage ≥ 60%, no weak concepts
    const subjectCoverage = subject.totalTopicsInSubject > 0
      ? subject.studiedTopics / subject.totalTopicsInSubject : 0;
    const hasWeaks = subject.topics.some(t => t.weakConcepts.length > 0);

    if (subject.conceptMastery >= 70 && subject.depthScore >= 50 && subjectCoverage >= 0.6 && !hasWeaks) {
      strong.push(subject.subjectName);
    } else if (subject.conceptMastery < 50 || subjectCoverage < 0.3 || subject.depthScore < 20) {
      vulnerable.push(subject.subjectName);
    }
  }

  // Signal 1: Concept Mastery (35%) — do they understand the material?
  const conceptMasteryScore = masteryCount > 0 ? Math.round(masterySum / masteryCount) : 0;

  // Signal 2: Depth Score (25%) — have they practiced hard questions?
  const depthScoreAvg = depthCount > 0 ? Math.round(depthSum / depthCount) : 0;

  // Signal 3: Coverage (20%) — have they seen enough topics?
  const coverageFactor = Math.min(1, studiedTopicCount / totalTopicsInExam);
  const coverageScore = Math.round(coverageFactor * 100);

  // Signal 4: Consistency (10%) — are they studying regularly?
  // Already computed by computeConsistencyScore()

  // Signal 5: Ability Match (10%) — can they handle exam difficulty?
  // θ ranges from -3 (weak) to +3 (strong). Map to 0-100.
  // θ = 0 (average) → 50, θ = 1.5 → 85, θ = -1.5 → 15
  const abilityScore = Math.round(Math.min(100, Math.max(0, (studentTheta + 3) / 6 * 100)));

  // ── Weighted overall score ──
  const overallScore = Math.round(
    0.35 * conceptMasteryScore +
    0.25 * depthScoreAvg +
    0.20 * coverageScore +
    0.10 * consistencyScore +
    0.10 * abilityScore
  );

  // ── Weak concepts extraction ──
  const weakConcepts = conceptMasteryAll
    .filter(c => c.pMastery < 0.4 && c.totalAttempts >= 5)
    .sort((a, b) => a.pMastery - b.pMastery)
    .slice(0, 10)
    .map(c => {
      // Try to find subject name from health data
      const matchingSub = health.find(s => s.topics.some(t => c.tag.includes(t.topicSlug)));
      return {
        concept: c.tag,
        subjectName: matchingSub?.subjectName ?? 'Unknown',
        pMastery: Math.round(c.pMastery * 100) / 100,
      };
    });

  // ── Days to target ──
  const targetScore = 85;
  const deficit = Math.max(0, targetScore - overallScore);
  const topicsRemaining = totalTopicsInExam - studiedTopicCount;
  const daysForCoverage = topicsRemaining > 0 ? Math.ceil(topicsRemaining / 2) : 0;
  const daysForMastery = velocity.cardsPerDay > 0 ? Math.ceil(deficit / 2) : 0;
  const daysToTarget = Math.max(daysForCoverage, daysForMastery);

  return {
    overallScore,
    conceptMasteryScore,
    depthScore: depthScoreAvg,
    coverageFactor: Math.round(coverageFactor * 100) / 100,
    consistencyScore,
    abilityScore,
    studentAbility: Math.round(studentTheta * 100) / 100,
    studiedTopics: studiedTopicCount,
    totalTopicsInExam,
    strongAreas: strong,
    vulnerableAreas: vulnerable,
    weakConcepts,
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

  // Fetch the user's last study session date from PostgreSQL for realistic timestamps
  let lastStudyDate: Date | null = null;
  try {
    const pg = getPostgresPool();
    const result = await pg.query(
      `SELECT MAX(started_at) AS last_study
       FROM study_sessions
       WHERE user_id = (SELECT id FROM users WHERE firebase_uid = $1)`,
      [userId],
    );
    if (result.rows[0]?.last_study) {
      lastStudyDate = new Date(result.rows[0].last_study);
    }
  } catch { /* Use fallback below */ }

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

    // Use actual last study date instead of now — prevents false 100% retention
    const reviewDate = lastStudyDate ?? new Date();
    const nextReview = new Date(reviewDate);
    nextReview.setDate(nextReview.getDate() + Math.max(1, intervalDays));

    const pipeline = redis.pipeline();
    pipeline.hset(`card_memory:${userId}:${syntheticCardId}`, {
      repetitions: String(repetitions),
      interval_days: String(intervalDays),
      ease_factor: String(Math.round(easeFactor * 100) / 100),
      last_reviewed_at: reviewDate.toISOString(),
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
