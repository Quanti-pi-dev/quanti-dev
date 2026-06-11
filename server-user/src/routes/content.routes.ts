// ─── Content Service Routes ─────────────────────────────────
// Read-only endpoints for exams, decks, flashcards.
// All routes require authentication.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth } from '../middleware/rbac.js';
import { loadSubscription } from '../middleware/feature-gate.js';
import { examRepository } from '@kd/db';
import { deckRepository } from '@kd/db';
import { flashcardRepository } from '@kd/db';
import { subjectRepository } from '@kd/db';
import { topicRepository } from '@kd/db';
import { questionRepository } from '@kd/db';

import { gamificationRepository } from '@kd/db';
import { selectAdaptiveOrder } from '@kd/db';
import type { PaginationQuery, SubjectLevel } from '@kd/shared';
import { z } from 'zod';
import { SUBJECT_LEVELS } from '@kd/shared';

// ─── Query Validation Schemas ───────────────────────────────

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

const decksQuerySchema = paginationQuerySchema.extend({
  category: z.string().optional(),
  categories: z.union([z.string(), z.array(z.string())]).optional(),
  search: z.string().optional(),
});

const adaptiveQuerySchema = paginationQuerySchema.extend({
  decks: z.union([z.string(), z.array(z.string())]),
});

// ─── Fisher-Yates Shuffle ───────────────────────────────────

function fisherYatesShuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}

// ─── Tier-Gate Helper ───────────────────────────────────────
// Returns false (and sends 403) if the user's plan max_level is exceeded.

function checkLevelAccess(
  request: FastifyRequest,
  reply: FastifyReply,
  level: SubjectLevel,
): boolean {
  const ctx = request.subscription;
  if (!ctx) return true; // No subscription → free user; level gating handled by progress unlock
  const maxLevel = ctx.features.max_level;
  if (maxLevel === -1) return true; // Unlimited
  const levelIndex = SUBJECT_LEVELS.indexOf(level);
  if (levelIndex >= maxLevel) {
    reply.status(403).send({
      success: false,
      error: {
        code: 'TIER_LOCKED',
        message: 'Upgrade your plan to access this level',
        requiredLevel: maxLevel,
        currentLevel: levelIndex,
        upgradeUrl: '/api/v1/plans',
      },
      timestamp: new Date().toISOString(),
    });
    return false;
  }
  return true;
}

export async function contentRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireAuth());
  // Load subscription context for tier-gating card access
  fastify.addHook('preHandler', loadSubscription);

  // ─── GET /exams — List published exams ────────────────
  fastify.get('/exams', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as PaginationQuery & { category?: string };
    const result = await examRepository.findMany(query);

    return reply.send({
      success: true,
      data: result.data,
      pagination: result.pagination,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── GET /exams/:id — Exam detail with questions ──────
  fastify.get('/exams/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const exam = await examRepository.findById(id);

    if (!exam) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Exam not found' },
        timestamp: new Date().toISOString(),
      });
    }

    const questions = await questionRepository.findByExamId(id);

    return reply.send({
      success: true,
      data: { ...exam, questions },
      timestamp: new Date().toISOString(),
    });
  });

  // ─── GET /exams/:id/subjects — Subjects for an exam ───
  fastify.get('/exams/:id/subjects', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: examId } = request.params as { id: string };

    const exam = await examRepository.findById(examId);
    if (!exam) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Exam not found' },
        timestamp: new Date().toISOString(),
      });
    }

    const subjects = await subjectRepository.findByExamId(examId);

    return reply.send({
      success: true,
      data: subjects,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── GET /exams/:examId/subjects/:subjectId/topics ─────
  // NEW: Exam-scoped topic list (Phase 4)
  fastify.get('/exams/:examId/subjects/:subjectId/topics', async (request: FastifyRequest, reply: FastifyReply) => {
    const { examId, subjectId } = request.params as { examId: string; subjectId: string };

    const [exam, subject] = await Promise.all([
      examRepository.findById(examId),
      subjectRepository.findById(subjectId),
    ]);

    if (!exam) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Exam not found' }, timestamp: new Date().toISOString() });
    if (!subject) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Subject not found' }, timestamp: new Date().toISOString() });

    const topics = await topicRepository.findByExamAndSubject(examId, subjectId);

    return reply.send({
      success: true,
      data: { examId, subjectId, subjectName: subject.name, topics },
      timestamp: new Date().toISOString(),
    });
  });

  // ─── GET /exams/:examId/subjects/:subjectId/topics/:topicSlug/levels/:level/cards ─
  // Full hierarchy path endpoint (Phase 4) — replaces legacy /subjects/:id/levels/:level/cards
  //
  // Card ordering (Bug Fix: returning students see fresh cards first):
  //   1. Unseen cards (no card_memory entry)        ← always first
  //   2. Cards answered but only wrong (n_correct=0) ← needs more practice
  //   3. Cards answered correctly at least once       ← already known
  // Within each group, Fisher-Yates shuffle maintains randomness.
  fastify.get(
    '/exams/:examId/subjects/:subjectId/topics/:topicSlug/levels/:level/cards',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { examId, subjectId, topicSlug, level } = request.params as {
        examId: string;
        subjectId: string;
        topicSlug: string;
        level: string;
      };
      const { ...paginationRaw } = request.query as PaginationQuery;

      // Validate level
      if (!SUBJECT_LEVELS.includes(level as typeof SUBJECT_LEVELS[number])) {
        return reply.status(400).send({
          success: false,
          error: { code: 'BAD_REQUEST', message: `Invalid level. Must be one of: ${SUBJECT_LEVELS.join(', ')}` },
          timestamp: new Date().toISOString(),
        });
      }

      // Level-gate: enforce subscription tier
      if (!checkLevelAccess(request, reply, level as SubjectLevel)) return;

      // Resolve deck via the new compound-indexed hierarchy lookup
      const deck = await deckRepository.findByHierarchy(
        examId,
        subjectId,
        topicSlug,
        level as typeof SUBJECT_LEVELS[number],
      );

      if (!deck) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'No deck found for this exam/subject/topic/level' },
          timestamp: new Date().toISOString(),
        });
      }

      const result = await flashcardRepository.findByDeckId(deck.id, paginationRaw);
      const allCards = result.data;

      // ── Smart prioritisation: deprioritise already-correct cards ──────────────
      // Load the student's card memory SET — one Redis round-trip to get all
      // tracked card IDs, then a pipelined HGETALL for just the cards in this deck.
      // Unseen cards (no entry) → front. Wrong-only → middle. Correct ≥ 1 → end.
      let sortedCards = allCards;
      try {
        const { getRedisClient } = await import('@kd/db');
        const redis = getRedisClient();
        const userId = request.user!.id;

        // Get all tracked card IDs for this user (O(1) SET read)
        const trackedCardIds = await redis.smembers(`card_memory_keys:${userId}`);

        if (trackedCardIds.length > 0) {
          // Only pipeline reads for cards that are BOTH tracked AND in this deck
          const deckCardIds = new Set(allCards.map(c => c.id));
          const relevantIds = trackedCardIds.filter(id => deckCardIds.has(id));

          if (relevantIds.length > 0) {
            const pipeline = redis.pipeline();
            for (const id of relevantIds) {
              pipeline.hmget(`card_memory:${userId}:${id}`, 'n_correct', 'n_wrong');
            }
            const pipelineResults = await pipeline.exec();

            // Build a map: cardId → { nCorrect, nWrong }
            type CardMemory = { nCorrect: number; nWrong: number };
            const memoryMap = new Map<string, CardMemory>();
            for (let i = 0; i < relevantIds.length; i++) {
              const [err, vals] = pipelineResults?.[i] ?? [null, []];
              if (!err && Array.isArray(vals)) {
                memoryMap.set(relevantIds[i]!, {
                  nCorrect: parseInt((vals[0] as string | null) ?? '0', 10),
                  nWrong:   parseInt((vals[1] as string | null) ?? '0', 10),
                });
              }
            }

            // Classify each card into 3 priority buckets
            // Priority 0 = unseen (best for students), 1 = wrong-only, 2 = correct (deprioritise)
            const getPriority = (cardId: string): 0 | 1 | 2 => {
              const mem = memoryMap.get(cardId);
              if (!mem) return 0;                           // Never seen → show first
              if (mem.nCorrect === 0) return 1;             // Seen but never got right → show next
              return 2;                                     // Already answered correctly → show last
            };

            // Shuffle within each priority bucket so order stays random
            const buckets: [typeof allCards, typeof allCards, typeof allCards] = [[], [], []];
            for (const card of allCards) {
              buckets[getPriority(card.id)].push(card);
            }

            sortedCards = [
              ...fisherYatesShuffle(buckets[0]),   // unseen
              ...fisherYatesShuffle(buckets[1]),   // wrong-only
              ...fisherYatesShuffle(buckets[2]),   // already correct
            ];
          } else {
            // No tracked cards in this deck yet — just shuffle
            sortedCards = fisherYatesShuffle(allCards);
          }
        } else {
          // Brand-new student with no card memory — shuffle
          sortedCards = fisherYatesShuffle(allCards);
        }
      } catch (err) {
        // Non-fatal: if Redis is down, fall back to a plain shuffle
        request.log.warn({ err }, 'Card memory read failed for level cards, falling back to shuffle');
        sortedCards = fisherYatesShuffle(allCards);
      }

      return reply.send({
        success: true,
        data: {
          deckId: deck.id,
          deckTitle: deck.title,
          examId: deck.examId,
          subjectId: deck.subjectId,
          topicSlug: deck.topicSlug,
          level: deck.level,
          cardCount: deck.cardCount,
          cards: sortedCards,
        },
        pagination: result.pagination,
        timestamp: new Date().toISOString(),
      });
    },
  );


  // ─── GET /decks — List decks ──────────────────────────
  fastify.get('/decks', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = decksQuerySchema.parse(request.query);
    const query: PaginationQuery & { category?: string; categories?: string[]; search?: string } = {
      page: parsed.page,
      pageSize: parsed.pageSize,
      category: parsed.category,
      search: parsed.search,
    };

    if (parsed.categories) {
      query.categories = Array.isArray(parsed.categories) ? parsed.categories : [parsed.categories];
    }

    const result = await deckRepository.findMany(query);

    return reply.send({
      success: true,
      data: result.data,
      pagination: result.pagination,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── GET /decks/:id/cards — Flashcards in a deck ──────
  fastify.get('/decks/:id/cards', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const query = request.query as PaginationQuery;

    const deck = await deckRepository.findById(id);
    if (!deck) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Deck not found' },
        timestamp: new Date().toISOString(),
      });
    }

    // Level-gate: if deck has a level, enforce subscription tier limit
    if (deck.level && !checkLevelAccess(request, reply, deck.level)) return;

    // Coin-gate: if deck was purchased from the shop, verify the user has unlocked it
    if (deck.category === 'shop' || deck.type === 'shop') {
      const unlocked = await gamificationRepository.getUnlockedDeckIds(request.user!.id);
      if (!unlocked.includes(deck.id)) {
        return reply.status(403).send({
          success: false,
          error: { code: 'DECK_LOCKED', message: 'Purchase this deck from the shop to access it' },
          timestamp: new Date().toISOString(),
        });
      }
    }

    const result = await flashcardRepository.findByDeckId(id, query);

    return reply.send({
      success: true,
      data: result.data,
      pagination: result.pagination,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── GET /flashcards/:id — Single flashcard ───────────
  fastify.get('/flashcards/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const card = await flashcardRepository.findById(id);

    if (!card) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Flashcard not found' },
        timestamp: new Date().toISOString(),
      });
    }

    return reply.send({
      success: true,
      data: card,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── GET /study/adaptive — Intelligently ordered study mix ──
  // Uses the BKT/IRT educator brain to select optimal card order.
  // Falls back to Fisher-Yates shuffle if adaptive scoring fails.
  fastify.get('/study/adaptive', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = adaptiveQuerySchema.parse(request.query);
    const deckIds = Array.isArray(parsed.decks) ? parsed.decks : [parsed.decks];

    if (deckIds.length === 0) {
      return reply.status(400).send({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'At least one deck must be provided' },
        timestamp: new Date().toISOString(),
      });
    }

    const query: PaginationQuery = {
      page: parsed.page,
      pageSize: parsed.pageSize,
    };

    const result = await flashcardRepository.findByDeckIds(deckIds, query);

    // Use the educator brain for intelligent ordering
    let orderedCards = result.data;
    try {
      const userId = request.user?.id;
      if (userId && result.data.length > 0) {
        const adaptive = await selectAdaptiveOrder(result.data, userId);
        orderedCards = adaptive.cards;
      } else {
        // No user context — fall back to shuffle
        orderedCards = fisherYatesShuffle(result.data);
      }
    } catch (err) {
      // Adaptive scoring failed — fall back to shuffle
      request.log.warn({ err }, 'Adaptive card selection failed, falling back to shuffle');
      orderedCards = fisherYatesShuffle(result.data);
    }

    return reply.send({
      success: true,
      data: orderedCards,
      pagination: result.pagination,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── GET /subjects — List all subjects ────────────────
  fastify.get('/subjects', async (_request: FastifyRequest, reply: FastifyReply) => {
    const subjects = await subjectRepository.findAll();
    return reply.send({
      success: true,
      data: subjects,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── GET /subjects/:id — Single subject ───────────────
  fastify.get('/subjects/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const subject = await subjectRepository.findById(id);

    if (!subject) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Subject not found' },
        timestamp: new Date().toISOString(),
      });
    }

    return reply.send({
      success: true,
      data: subject,
      timestamp: new Date().toISOString(),
    });
  });

}

