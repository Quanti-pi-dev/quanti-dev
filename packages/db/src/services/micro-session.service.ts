// ─── Micro Session Service ──────────────────────────────────
// "Just 3 Cards" mode — the lowest-friction path back into studying.
//
// Psychology: Zeigarnik Effect — starting a tiny task creates an
// open loop that the brain wants to close. By reducing the perceived
// effort to "just 3 cards," we bypass the user's resistance to
// starting. Once they begin, most users continue beyond 3 cards.
//
// Card selection priority:
//   1. Overdue SM-2 cards (knowledge decay prevention)
//   2. Near-miss level-unlock cards (endowed progress)
//   3. Previously wrong cards from error journal
//   4. Random cards from current active topics
//
// This service returns a curated micro-batch that maximizes
// perceived value per unit effort — making the user feel productive
// even in 60 seconds.

import { getRedisClient, getMongoDb } from '../clients/database.js';
import { ObjectId } from 'mongodb';


// ─── Types ──────────────────────────────────────────────────

export interface MicroCard {
  cardId: string;
  question: string;
  answers: { id: string; text: string }[];
  correctAnswerId: string;
  topicSlug: string;
  subjectId: string;
  examId: string;
  level: string;
  /** Why this card was selected — helps the UI show context */
  selectionReason: 'overdue_review' | 'near_unlock' | 'error_retry' | 'keep_fresh';
}

export interface MicroSessionPack {
  /** Ordered list of cards for the micro session */
  cards: MicroCard[];
  /** Motivational framing message */
  hook: string;
  /** Estimated seconds to complete */
  estimatedSeconds: number;
  /** Context: what benefit will this micro-session give */
  benefit: string;
}

// ─── Micro Session Service ──────────────────────────────────

class MicroSessionService {
  private get redis() {
    return getRedisClient();
  }

  private get mongo() {
    return getMongoDb();
  }

  /**
   * Build a curated 3-card micro-session for the user.
   * Card selection is prioritized by learning impact.
   */
  async buildMicroSession(
    userId: string,
    examId?: string,
  ): Promise<MicroSessionPack> {
    const selectedCardIds: { cardId: string; reason: MicroCard['selectionReason'] }[] = [];

    // ── 1. Overdue SM-2 cards (highest priority) ───────────
    const overdueCards = await this.getOverdueCards(userId, 3);
    for (const card of overdueCards) {
      if (selectedCardIds.length >= 3) break;
      selectedCardIds.push({ cardId: card.cardId, reason: 'overdue_review' });
    }

    // ── 2. Near-unlock cards (endowed progress) ────────────
    if (selectedCardIds.length < 3) {
      const nearUnlockCards = await this.getNearUnlockCards(userId, examId, 3 - selectedCardIds.length);
      for (const cardId of nearUnlockCards) {
        if (selectedCardIds.length >= 3) break;
        // Dedup
        if (!selectedCardIds.some(c => c.cardId === cardId)) {
          selectedCardIds.push({ cardId, reason: 'near_unlock' });
        }
      }
    }

    // ── 3. Error journal cards (retry wrong answers) ───────
    if (selectedCardIds.length < 3) {
      const errorCards = await this.getErrorJournalCards(userId, 3 - selectedCardIds.length);
      for (const cardId of errorCards) {
        if (selectedCardIds.length >= 3) break;
        if (!selectedCardIds.some(c => c.cardId === cardId)) {
          selectedCardIds.push({ cardId, reason: 'error_retry' });
        }
      }
    }

    // ── 4. Random active-topic cards (freshness) ───────────
    if (selectedCardIds.length < 3) {
      const freshCards = await this.getRandomActiveCards(userId, examId, 3 - selectedCardIds.length);
      for (const cardId of freshCards) {
        if (selectedCardIds.length >= 3) break;
        if (!selectedCardIds.some(c => c.cardId === cardId)) {
          selectedCardIds.push({ cardId, reason: 'keep_fresh' });
        }
      }
    }

    // ── Fetch full card data from MongoDB ──────────────────
    const cards = await this.hydrateCards(selectedCardIds);

    // ── Build motivational hook ────────────────────────────
    const hook = this.buildHook(selectedCardIds);
    const benefit = this.buildBenefit(selectedCardIds);

    return {
      cards,
      hook,
      estimatedSeconds: cards.length * 20, // ~20s per card
      benefit,
    };
  }

  // ─── Card Selectors ───────────────────────────────────────

  /**
   * Get cards overdue by SM-2 schedule (past their next_review_at).
   */
  private async getOverdueCards(
    userId: string,
    limit: number,
  ): Promise<{ cardId: string; overdueDays: number }[]> {
    const redis = this.redis;
    const cardIds = await redis.smembers(`card_memory_keys:${userId}`);
    if (cardIds.length === 0) return [];

    const pipeline = redis.pipeline();
    for (const id of cardIds.slice(0, 200)) {
      pipeline.hget(`card_memory:${userId}:${id}`, 'next_review_at');
    }
    const results = await pipeline.exec();

    const now = Date.now();
    const overdue: { cardId: string; overdueDays: number }[] = [];

    for (let i = 0; i < Math.min(cardIds.length, 200); i++) {
      const [err, val] = results?.[i] ?? [null, null];
      if (err || !val) continue;
      const nextReview = new Date(val as string).getTime();
      if (now > nextReview) {
        const overdueDays = (now - nextReview) / (1000 * 60 * 60 * 24);
        overdue.push({ cardId: cardIds[i]!, overdueDays });
      }
    }

    // Sort most overdue first
    overdue.sort((a, b) => b.overdueDays - a.overdueDays);
    return overdue.slice(0, limit);
  }

  /**
   * Get cards from topics where the user is within 3 correct of unlocking.
   */
  private async getNearUnlockCards(
    userId: string,
    examId: string | undefined,
    limit: number,
  ): Promise<string[]> {
    const redis = this.redis;
    const progressKeys = await redis.smembers(`level_progress_keys:${userId}`);
    const cardIds: string[] = [];

    for (const key of progressKeys.slice(0, 30)) {
      if (cardIds.length >= limit) break;

      const segments = key.split(':');
      if (segments.length !== 4) continue;
      const [keyExamId, subjectId, topicSlug, level] = segments as [string, string, string, string];

      if (examId && keyExamId !== examId) continue;

      const data = await redis.hgetall(
        `level_progress:${userId}:${keyExamId}:${subjectId}:${topicSlug}:${level}`
      );
      const correct = parseInt(data['correct'] ?? '0', 10);
      const remaining = 30 - correct; // LEVEL_UNLOCK_THRESHOLD

      if (remaining > 0 && remaining <= 3) {
        // Find unanswered cards for this topic/level from MongoDB
        const collection = this.mongo.collection('flashcards');
        const answeredSet = await redis.smembers(
          `answered_cards:${userId}:${keyExamId}:${subjectId}:${topicSlug}:${level}`
        );

        const excludeIds: ObjectId[] = [];
        for (const id of answeredSet) {
          try { excludeIds.push(new ObjectId(id)); } catch { /* skip invalid */ }
        }

        const cards = await collection.find({
          examId: keyExamId,
          subjectId,
          topicSlug,
          level,
          ...(excludeIds.length > 0 ? { _id: { $nin: excludeIds } } : {}),
        }).limit(limit - cardIds.length).project({ _id: 1 }).toArray();

        for (const card of cards) {
          cardIds.push(card._id.toString());
        }
      }
    }

    return cardIds;
  }

  /**
   * Get recently-wrong cards from the error journal.
   */
  private async getErrorJournalCards(userId: string, limit: number): Promise<string[]> {
    const redis = this.redis;
    const errorKey = `error_journal:${userId}`;

    // Get the most recent errors
    const entries = await redis.zrevrange(errorKey, 0, limit * 2 - 1);
    const cardIds: string[] = [];

    for (const entry of entries) {
      if (cardIds.length >= limit) break;
      try {
        const data = JSON.parse(entry) as { cardId: string };
        if (data.cardId && !cardIds.includes(data.cardId)) {
          cardIds.push(data.cardId);
        }
      } catch {
        // Skip malformed entries
      }
    }

    return cardIds;
  }

  /**
   * Get random cards from the user's active topics.
   */
  private async getRandomActiveCards(
    userId: string,
    examId: string | undefined,
    limit: number,
  ): Promise<string[]> {
    const collection = this.mongo.collection('flashcards');
    const query: Record<string, unknown> = {};
    if (examId) query['examId'] = examId;

    const cards = await collection
      .aggregate([
        { $match: query },
        { $sample: { size: limit * 3 } },
        { $project: { _id: 1 } },
      ])
      .toArray();

    // Filter out already-known cards (user has reviewed them recently)
    const redis = this.redis;
    const result: string[] = [];

    for (const card of cards) {
      if (result.length >= limit) break;
      const cardId = card._id.toString();
      const hasMemory = await redis.exists(`card_memory:${userId}:${cardId}`);
      if (!hasMemory) {
        result.push(cardId);
      }
    }

    // If not enough new cards, just return any
    if (result.length < limit) {
      for (const card of cards) {
        if (result.length >= limit) break;
        const cardId = card._id.toString();
        if (!result.includes(cardId)) {
          result.push(cardId);
        }
      }
    }

    return result;
  }

  // ─── Card Hydration ───────────────────────────────────────

  /**
   * Fetch full card documents from MongoDB and attach selection reasons.
   */
  private async hydrateCards(
    selections: { cardId: string; reason: MicroCard['selectionReason'] }[],
  ): Promise<MicroCard[]> {
    if (selections.length === 0) return [];

    const collection = this.mongo.collection('flashcards');
    const objectIds: ObjectId[] = [];
    for (const s of selections) {
      try { objectIds.push(new ObjectId(s.cardId)); } catch { /* skip invalid */ }
    }

    const docs = await collection
      .find({ _id: { $in: objectIds } })
      .toArray();

    const cards: MicroCard[] = [];
    for (const sel of selections) {
      const doc = docs.find(d => d._id.toString() === sel.cardId);
      if (!doc) continue;

      cards.push({
        cardId: doc._id.toString(),
        question: doc.question as string,
        answers: (doc.answers as { id: string; text: string }[]) ?? [],
        correctAnswerId: doc.correctAnswerId as string,
        topicSlug: doc.topicSlug as string,
        subjectId: doc.subjectId as string,
        examId: doc.examId as string,
        level: doc.level as string,
        selectionReason: sel.reason,
      });
    }

    return cards;
  }

  // ─── Motivational Copy ────────────────────────────────────

  private buildHook(
    selections: { cardId: string; reason: MicroCard['selectionReason'] }[],
  ): string {
    const primary = selections[0]?.reason;

    switch (primary) {
      case 'overdue_review':
        return '📉 Your memory is fading on these — 60 seconds to save it!';
      case 'near_unlock':
        return '🔓 You\'re SO close to unlocking the next level!';
      case 'error_retry':
        return '💪 Round 2 — prove you learned from last time!';
      case 'keep_fresh':
        return '✨ Quick brain warmup — just 3 cards!';
      default:
        return '⚡ Just 3 cards. Ready?';
    }
  }

  private buildBenefit(
    selections: { cardId: string; reason: MicroCard['selectionReason'] }[],
  ): string {
    const reasons = new Set(selections.map(s => s.reason));

    if (reasons.has('overdue_review')) {
      return 'Prevent knowledge decay and keep your retention score high.';
    }
    if (reasons.has('near_unlock')) {
      return 'Complete these to unlock the next study level!';
    }
    if (reasons.has('error_retry')) {
      return 'Master the cards you got wrong — turn weaknesses into strengths.';
    }
    return 'Stay sharp and keep your study habit alive.';
  }
}

export const microSessionService = new MicroSessionService();
