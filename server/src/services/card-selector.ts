// ─── Adaptive Card Selector ──────────────────────────────────
// The "educator brain" — replaces random shuffle with intelligent
// card ordering based on BKT mastery, IRT difficulty matching,
// SM-2 urgency, and knowledge graph prerequisites.
//
// Score(card) = w₁ × urgency(SM-2)
//             + w₂ × information_gain(BKT)
//             + w₃ × difficulty_match(IRT)
//             + w₄ × prerequisite_readiness(KG)

import { getRedisClient } from '../lib/database.js';
import { createServiceLogger } from '../lib/logger.js';
import { DEFAULT_BKT_PARAMS, informationGain } from './bkt.js';
import { estimateDifficulty, estimateAbility, adaptiveDifficultyScore } from './irt.js';
import { estimateRetention, INITIAL_EASE_FACTOR } from './sm2.js';
import { prerequisiteReadiness } from './knowledge-graph.service.js';
import type { Flashcard } from '@kd/shared';
import type { CardSelectionScore } from '@kd/shared';

const log = createServiceLogger('CardSelector');

// ─── Scoring Weights ─────────────────────────────────────────
// These control how much each factor contributes to card priority.

const WEIGHTS = {
  urgency: 0.30,          // SM-2 overdue cards
  informationGain: 0.30,  // BKT — concepts we're most uncertain about
  difficultyMatch: 0.25,  // IRT — zone of proximal development
  prerequisite: 0.15,     // Knowledge graph readiness
};

// ─── Main Entry Point ────────────────────────────────────────

/**
 * Score and sort cards for a student, returning them in optimal study order.
 *
 * This is the core educator decision: "What should this student study next?"
 *
 * @param cards   All available cards for this study session
 * @param userId  Firebase UID of the student
 * @returns       Cards sorted by adaptive score (best first), with scores attached
 */
export async function selectAdaptiveOrder(
  cards: Flashcard[],
  userId: string,
): Promise<{ cards: Flashcard[]; scores: CardSelectionScore[] }> {
  if (cards.length === 0) return { cards: [], scores: [] };

  const redis = getRedisClient();

  // ── 1. Gather student state in parallel ────────────────────
  const [conceptMasteryMap, cardMemoryMap, studentAbility] = await Promise.all([
    loadConceptMasteryMap(redis, userId),
    loadCardMemoryMap(redis, userId, cards.map(c => c.id)),
    loadStudentAbility(redis, userId),
  ]);

  // ── 2. Score each card ─────────────────────────────────────
  const scored: { card: Flashcard; score: CardSelectionScore }[] = [];

  for (const card of cards) {
    const score = scoreCard(
      card,
      conceptMasteryMap,
      cardMemoryMap.get(card.id),
      studentAbility,
    );
    scored.push({ card, score });
  }

  // ── 3. Sort by total score descending (best cards first) ───
  scored.sort((a, b) => b.score.totalScore - a.score.totalScore);

  // ── 4. Inject variety — don't serve the same concept 3x in a row ──
  const reordered = injectVariety(scored);

  return {
    cards: reordered.map(s => s.card),
    scores: reordered.map(s => s.score),
  };
}

// ─── Card Scoring ────────────────────────────────────────────

function scoreCard(
  card: Flashcard,
  conceptMastery: Map<string, number>,
  cardMemory: CardMemoryData | undefined,
  studentAbility: number,
): CardSelectionScore {
  // ── Urgency (SM-2) ─────────────────────────────────────────
  // How overdue is this card? Cards past their review date score higher.
  let urgencyScore = 0.3; // Default for unseen cards (moderate urgency)

  if (cardMemory) {
    const daysSince = (Date.now() - new Date(cardMemory.lastReviewedAt).getTime()) / (1000 * 60 * 60 * 24);
    const retention = estimateRetention(daysSince, cardMemory.intervalDays, cardMemory.easeFactor);

    // Low retention = high urgency
    // retention 100% → urgency 0, retention 0% → urgency 1
    urgencyScore = 1 - (retention / 100);
  }

  // ── Information Gain (BKT) ─────────────────────────────────
  // How much will we learn about the student from this card?
  // Concepts near P=0.5 mastery are most informative.
  const cardConcepts = card.tags ?? [];
  let infoGainScore = 0.5; // Default for cards with no concept tags

  if (cardConcepts.length > 0) {
    const gains = cardConcepts.map(tag => {
      const pMastery = conceptMastery.get(tag) ?? DEFAULT_BKT_PARAMS.pInit;
      return informationGain(pMastery);
    });
    infoGainScore = Math.max(...gains); // Use the most informative concept
  }

  // ── Difficulty Match (IRT) ─────────────────────────────────
  // Is this card in the student's zone of proximal development?
  const cardDifficulty = cardMemory
    ? estimateDifficulty(cardMemory.correctRate)
    : 0; // Assume average difficulty for unseen cards

  const diffMatchScore = adaptiveDifficultyScore(studentAbility, cardDifficulty);

  // ── Prerequisite Readiness (Knowledge Graph) ───────────────
  // Check if the student has mastered the prerequisite concepts
  // defined in the knowledge graph before serving this card.
  let prereqScore = 1.0; // Default: no prerequisites

  if (cardConcepts.length > 0) {
    const readinessScores = cardConcepts.map(tag =>
      prerequisiteReadiness(tag, conceptMastery, 0.4),
    );
    // Use the minimum readiness — if ANY concept's prerequisites
    // aren't met, the card should be deprioritized.
    const minReadiness = Math.min(...readinessScores);
    prereqScore = minReadiness;

    // Also reduce priority for fully mastered concepts
    const avgMastery = cardConcepts
      .map(tag => conceptMastery.get(tag) ?? DEFAULT_BKT_PARAMS.pInit)
      .reduce((s, v) => s + v, 0) / cardConcepts.length;

    if (avgMastery > 0.85) {
      prereqScore *= 0.5; // Already mastered — lower priority
    }
  }

  // ── Weighted total ─────────────────────────────────────────
  const totalScore =
    WEIGHTS.urgency * urgencyScore +
    WEIGHTS.informationGain * infoGainScore +
    WEIGHTS.difficultyMatch * diffMatchScore +
    WEIGHTS.prerequisite * prereqScore;

  return {
    cardId: card.id,
    totalScore: Math.round(totalScore * 1000) / 1000,
    urgencyScore: Math.round(urgencyScore * 1000) / 1000,
    informationGainScore: Math.round(infoGainScore * 1000) / 1000,
    difficultyMatchScore: Math.round(diffMatchScore * 1000) / 1000,
    prerequisiteScore: Math.round(prereqScore * 1000) / 1000,
  };
}

// ─── Variety Injection ───────────────────────────────────────
// Prevents serving 3 cards about the same concept in a row,
// which can feel monotonous and reduce engagement.

function injectVariety(
  scored: { card: Flashcard; score: CardSelectionScore }[],
): { card: Flashcard; score: CardSelectionScore }[] {
  if (scored.length <= 3) return scored;

  const result: { card: Flashcard; score: CardSelectionScore }[] = [];
  const remaining = [...scored];
  const recentTags: string[] = [];

  while (remaining.length > 0) {
    // Find the highest-scored card whose primary tag
    // hasn't appeared in the last 2 selections
    let bestIdx = 0;

    for (let i = 0; i < remaining.length; i++) {
      const primaryTag = remaining[i]!.card.tags?.[0];
      if (!primaryTag || !recentTags.includes(primaryTag)) {
        bestIdx = i;
        break;
      }
      // If all remaining share recent tags, just take the best scored one
      if (i === remaining.length - 1) bestIdx = 0;
    }

    const selected = remaining.splice(bestIdx, 1)[0]!;
    result.push(selected);

    const tag = selected.card.tags?.[0];
    if (tag) {
      recentTags.push(tag);
      if (recentTags.length > 2) recentTags.shift();
    }
  }

  return result;
}

// ─── Redis Data Loading ──────────────────────────────────────

interface CardMemoryData {
  lastReviewedAt: string;
  intervalDays: number;
  easeFactor: number;
  correctRate: number;
}

async function loadConceptMasteryMap(
  redis: ReturnType<typeof getRedisClient>,
  userId: string,
): Promise<Map<string, number>> {
  const map = new Map<string, number>();

  try {
    const keys = await redis.smembers(`concept_mastery_keys:${userId}`);
    if (keys.length === 0) return map;

    const pipeline = redis.pipeline();
    for (const tag of keys) {
      pipeline.hget(`concept_mastery:${userId}:${tag}`, 'p_mastery');
    }
    const results = await pipeline.exec();

    for (let i = 0; i < keys.length; i++) {
      const [err, val] = results?.[i] ?? [null, null];
      if (!err && val) {
        map.set(keys[i]!, parseFloat(val as string));
      }
    }
  } catch (err) {
    log.warn({ err }, 'Failed to load concept mastery');
  }

  return map;
}

async function loadCardMemoryMap(
  redis: ReturnType<typeof getRedisClient>,
  userId: string,
  cardIds: string[],
): Promise<Map<string, CardMemoryData>> {
  const map = new Map<string, CardMemoryData>();
  if (cardIds.length === 0) return map;

  try {
    const pipeline = redis.pipeline();
    for (const id of cardIds) {
      pipeline.hgetall(`card_memory:${userId}:${id}`);
    }
    const results = await pipeline.exec();

    for (let i = 0; i < cardIds.length; i++) {
      const [err, raw] = results?.[i] ?? [null, {}];
      const data = (!err && raw ? raw : {}) as Record<string, string>;
      if (data['last_reviewed_at']) {
        map.set(cardIds[i]!, {
          lastReviewedAt: data['last_reviewed_at']!,
          intervalDays: parseFloat(data['interval_days'] ?? '1'),
          easeFactor: parseFloat(data['ease_factor'] ?? String(INITIAL_EASE_FACTOR)),
          correctRate: parseFloat(data['correct_rate'] ?? '0.5'),
        });
      }
    }
  } catch (err) {
    log.warn({ err }, 'Failed to load card memory');
  }

  return map;
}

async function loadStudentAbility(
  redis: ReturnType<typeof getRedisClient>,
  userId: string,
): Promise<number> {
  try {
    const data = await redis.hgetall(`student_ability:${userId}`);
    if (data['theta']) {
      return parseFloat(data['theta']);
    }
    // Estimate from overall stats if no IRT data yet
    const correct = parseInt(data['correct'] ?? '0', 10);
    const total = parseInt(data['total'] ?? '0', 10);
    if (total >= 5) {
      return estimateAbility(correct / total);
    }
  } catch (err) {
    log.warn({ err }, 'Failed to load student ability');
  }

  return 0; // Default: average ability
}

// ─── BKT + IRT Update (called after each answer) ─────────────

/**
 * Update the BKT concept mastery and IRT card difficulty after a response.
 * Called from the level-answer route alongside SM-2 updates.
 */
export async function updateKnowledgeModel(
  userId: string,
  cardId: string,
  cardTags: string[],
  correct: boolean,
): Promise<void> {
  const redis = getRedisClient();

  try {
    // ── Update BKT concept mastery ───────────────────────────
    const { bktUpdate, DEFAULT_BKT_PARAMS: params } = await import('./bkt.js');

    for (const tag of cardTags) {
      const key = `concept_mastery:${userId}:${tag}`;
      const current = await redis.hget(key, 'p_mastery');
      const pMastery = current ? parseFloat(current) : params.pInit;
      const totalStr = await redis.hget(key, 'total_attempts');
      const correctStr = await redis.hget(key, 'correct_attempts');
      const total = parseInt(totalStr ?? '0', 10);
      const correctCount = parseInt(correctStr ?? '0', 10);

      const newMastery = bktUpdate(pMastery, correct, params);

      await redis.hset(key, {
        p_mastery: String(Math.round(newMastery * 1000) / 1000),
        total_attempts: String(total + 1),
        correct_attempts: String(correctCount + (correct ? 1 : 0)),
        last_updated_at: new Date().toISOString(),
      });
      await redis.sadd(`concept_mastery_keys:${userId}`, tag);
    }

    // ── Update IRT card difficulty ───────────────────────────
    const { updateCorrectRate } = await import('./irt.js');

    const cardKey = `card_difficulty:${cardId}`;
    const cardData = await redis.hgetall(cardKey);
    const currentRate = parseFloat(cardData['correct_rate'] ?? '0.5');
    const totalResp = parseInt(cardData['total_responses'] ?? '0', 10);

    const newRate = updateCorrectRate(currentRate, correct, totalResp);

    await redis.hset(cardKey, {
      correct_rate: String(Math.round(newRate * 1000) / 1000),
      total_responses: String(totalResp + 1),
      difficulty: String(estimateDifficulty(newRate)),
    });

    // ── Update student ability ───────────────────────────────
    const abilityKey = `student_ability:${userId}`;
    const abilityData = await redis.hgetall(abilityKey);
    const aTotal = parseInt(abilityData['total'] ?? '0', 10);
    const aCorrect = parseInt(abilityData['correct'] ?? '0', 10);

    const newTotal = aTotal + 1;
    const newCorrect = aCorrect + (correct ? 1 : 0);

    await redis.hset(abilityKey, {
      total: String(newTotal),
      correct: String(newCorrect),
      theta: String(estimateAbility(newCorrect / newTotal)),
    });
  } catch (err) {
    log.error({ err }, 'Knowledge model update failed');
  }
}
