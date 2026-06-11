// ─── Collaborative Filter (ALS-style) ────────────────────────
// Priority 3 from the ML roadmap.
//
// "Students like you who struggled with Kinematics also found
//  Work & Energy challenging — schedule it early."
//
// Implements lightweight matrix factorisation using:
//   • User embeddings   (rank-16 vectors, keyed by userId)
//   • Topic embeddings  (rank-16 vectors, keyed by topicSlug)
//   • Dot-product similarity for new-topic affinity prediction
//
// The embeddings are trained weekly by the Python ALS batch job
// (scripts/train_als.py) and stored in Redis:
//   `als_user:{userId}`   → Float32 rank-16 vector (base64)
//   `als_topic:{topicSlug}` → Float32 rank-16 vector (base64)
//   `als_topic_index`     → sorted set of all topic slugs
//
// When Redis has no trained embeddings (cold start), the module
// falls back to a heuristic similarity score derived directly from
// BKT mastery data — ensuring it still improves new-topic ordering
// from day one without requiring the batch job to have run.
//
// Integration: called from buildStudyPlan's new_topic injection step
// to reorder candidate topics by predicted affinity.

import { getRedisClient } from '../clients/database.js';
import { createServiceLogger } from '../lib/logger.js';

const log = createServiceLogger('CollaborativeFilter');

// ─── Embedding helpers ────────────────────────────────────────

const RANK = 16; // embedding dimension — matches training script

/** Encode a Float32 vector as a base64 string for Redis storage. */
export function encodeEmbedding(vec: number[]): string {
  const buf = Buffer.allocUnsafe(vec.length * 4);
  for (let i = 0; i < vec.length; i++) buf.writeFloatLE(vec[i]!, i * 4);
  return buf.toString('base64');
}

/** Decode a base64 string back into a Float32 vector. */
export function decodeEmbedding(b64: string): number[] {
  const buf = Buffer.from(b64, 'base64');
  const out: number[] = [];
  for (let i = 0; i < buf.length; i += 4) out.push(buf.readFloatLE(i));
  return out;
}

/** Dot product of two equal-length vectors. */
function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) s += (a[i]! * b[i]!);
  return s;
}

/** L2 norm. */
function norm(v: number[]): number {
  return Math.sqrt(v.reduce((s, x) => s + x * x, 0));
}

/** Cosine similarity — normalised dot product, range [−1, 1]. */
function cosine(a: number[], b: number[]): number {
  const na = norm(a), nb = norm(b);
  if (na === 0 || nb === 0) return 0;
  return dot(a, b) / (na * nb);
}

// ─── Redis key helpers ────────────────────────────────────────

const userKey  = (userId: string)    => `als_user:${userId}`;
const topicKey = (topicSlug: string) => `als_topic:${topicSlug}`;

// ─── Embedding I/O ───────────────────────────────────────────

async function loadUserEmbedding(userId: string): Promise<number[] | null> {
  try {
    const redis = getRedisClient();
    const raw = await redis.get(userKey(userId));
    if (!raw) return null;
    return decodeEmbedding(raw);
  } catch {
    return null;
  }
}

async function loadTopicEmbedding(topicSlug: string): Promise<number[] | null> {
  try {
    const redis = getRedisClient();
    const raw = await redis.get(topicKey(topicSlug));
    if (!raw) return null;
    return decodeEmbedding(raw);
  } catch {
    return null;
  }
}

/** Persist a user embedding (called from the weekly training job). */
export async function saveUserEmbedding(userId: string, vec: number[]): Promise<void> {
  const redis = getRedisClient();
  await redis.set(userKey(userId), encodeEmbedding(vec), 'EX', 7 * 24 * 3600); // 7d TTL
}

/** Persist a topic embedding (called from the weekly training job). */
export async function saveTopicEmbedding(topicSlug: string, vec: number[]): Promise<void> {
  const redis = getRedisClient();
  await redis.set(topicKey(topicSlug), encodeEmbedding(vec), 'EX', 7 * 24 * 3600);
}

// ─── Affinity scoring ─────────────────────────────────────────

export interface TopicAffinity {
  topicSlug: string;
  /** Predicted difficulty for this student (0 = easy, 1 = very hard). */
  predictedDifficulty: number;
  /** Confidence: 'trained' = ALS model, 'heuristic' = BKT fallback. */
  source: 'trained' | 'heuristic';
}

/**
 * Heuristic fallback (cold start or missing embeddings):
 * Uses BKT mastery data to estimate topic difficulty for this student.
 *
 * Logic: topics conceptually adjacent to ones the student struggles with
 * are likely to also be hard — measured by shared concept tags.
 *
 * @param topicSlug          The new topic to estimate difficulty for
 * @param conceptMasteryMap  BKT p_mastery keyed by concept tag
 * @param topicConceptTags   All concept tags known for this topic
 * @returns                  Difficulty estimate 0–1
 */
function heuristicDifficulty(
  _topicSlug: string,
  conceptMasteryMap: Map<string, number>,
  topicConceptTags: string[],
): number {
  if (topicConceptTags.length === 0 || conceptMasteryMap.size === 0) return 0.5;

  // Mean inverse mastery across known concept tags
  const knownTags = topicConceptTags.filter(t => conceptMasteryMap.has(t));
  if (knownTags.length === 0) return 0.5;

  const avgMastery = knownTags
    .map(t => conceptMasteryMap.get(t) ?? 0.5)
    .reduce((a, b) => a + b, 0) / knownTags.length;

  // Low mastery on related concepts → high difficulty for new topic
  return Math.round((1 - avgMastery) * 1000) / 1000;
}

/**
 * Predict affinity (difficulty) of a new topic for a given student.
 *
 * When trained ALS embeddings are available in Redis, uses cosine
 * similarity between user and topic embeddings (range: 0 = aligned,
 * 1 = misaligned → high difficulty).
 *
 * Falls back to BKT heuristic when embeddings are absent.
 *
 * @param userId              Firebase UID
 * @param topicSlug           Target topic
 * @param conceptMasteryMap   BKT mastery per concept (for heuristic)
 * @param topicConceptTags    Concept tags associated with the topic
 */
export async function predictTopicAffinity(
  userId: string,
  topicSlug: string,
  conceptMasteryMap: Map<string, number>,
  topicConceptTags: string[],
): Promise<TopicAffinity> {
  const [userEmb, topicEmb] = await Promise.all([
    loadUserEmbedding(userId),
    loadTopicEmbedding(topicSlug),
  ]);

  if (userEmb && topicEmb && userEmb.length === RANK && topicEmb.length === RANK) {
    // ALS cosine similarity: high similarity → student is well-prepared → low difficulty
    const sim = cosine(userEmb, topicEmb);
    // Map [-1, 1] → [1, 0]: dissimilarity = difficulty
    const predictedDifficulty = Math.round(((1 - sim) / 2) * 1000) / 1000;
    return { topicSlug, predictedDifficulty, source: 'trained' };
  }

  // Fallback: BKT heuristic
  const predictedDifficulty = heuristicDifficulty(topicSlug, conceptMasteryMap, topicConceptTags);
  return { topicSlug, predictedDifficulty, source: 'heuristic' };
}

/**
 * Batch-score a list of new topics for a student.
 * Returns topics sorted by predicted difficulty ascending
 * (easiest first = most confident introductions first).
 *
 * @param userId              Firebase UID
 * @param topics              List of { topicSlug, conceptTags } to rank
 * @param conceptMasteryMap   BKT mastery per concept
 */
export async function rankNewTopics(
  userId: string,
  topics: { topicSlug: string; conceptTags: string[] }[],
  conceptMasteryMap: Map<string, number>,
): Promise<TopicAffinity[]> {
  if (topics.length === 0) return [];

  try {
    const scored = await Promise.all(
      topics.map(({ topicSlug, conceptTags }) =>
        predictTopicAffinity(userId, topicSlug, conceptMasteryMap, conceptTags),
      ),
    );

    // Sort easiest → hardest: introduce easier new topics first to build confidence
    return scored.sort((a, b) => a.predictedDifficulty - b.predictedDifficulty);
  } catch (err) {
    log.warn({ err }, 'rankNewTopics failed, returning unranked list');
    return topics.map(({ topicSlug }) => ({
      topicSlug,
      predictedDifficulty: 0.5,
      source: 'heuristic',
    }));
  }
}

// ─── Concept mastery loader (Redis) ──────────────────────────

/**
 * Load the student's full BKT concept mastery map from Redis.
 * Used by rankNewTopics for the heuristic fallback.
 *
 * @param userId  Firebase UID
 * @returns       Map of conceptTag → p_mastery (0–1)
 */
export async function loadConceptMasteryMap(userId: string): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const redis = getRedisClient();
    const tags = await redis.smembers(`concept_mastery_keys:${userId}`);
    if (tags.length === 0) return map;

    const pipeline = redis.pipeline();
    for (const tag of tags) pipeline.hget(`concept_mastery:${userId}:${tag}`, 'p_mastery');
    const results = await pipeline.exec();

    for (let i = 0; i < tags.length; i++) {
      const [err, val] = results?.[i] ?? [null, null];
      if (!err && val) map.set(tags[i]!, parseFloat(val as string));
    }
  } catch (err) {
    log.warn({ err }, 'Failed to load concept mastery map');
  }
  return map;
}
