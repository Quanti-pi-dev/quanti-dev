// ─── Content Service Routes ─────────────────────────────────
// Read-only endpoints for exams, decks, flashcards.
// All routes require authentication.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth } from '../middleware/rbac.js';
import { loadSubscription } from '../middleware/feature-gate.js';
import {
  examRepository,
  deckRepository,
  flashcardRepository,
  questionRepository,
  subjectRepository,
  topicRepository,
} from '../repositories/content.repository.js';
import { gamificationRepository } from '../repositories/gamification.repository.js';
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
// Returns a 403 if the user's plan max_level is exceeded.

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

  // ─── GET /exams — List exams ──────────────────────────
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

    // Verify deck exists
    const deck = await deckRepository.findById(id);
    if (!deck) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Deck not found' },
        timestamp: new Date().toISOString(),
      });
    }

    // Level-gate: if deck has a level, enforce subscription tier limit
    if (deck.level && !checkLevelAccess(request, reply, deck.level)) {
      return; // 403 already sent by helper
    }

    // Coin-gate: if deck was purchased from the shop, verify the user has unlocked it
    if (deck.category === 'shop') {
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

  // ─── GET /study/adaptive — Mix flashcards from decks ──
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

    // Unbiased Fisher-Yates shuffle for adaptive study mix
    const shuffled = fisherYatesShuffle(result.data);

    return reply.send({
      success: true,
      data: shuffled,
      pagination: result.pagination,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── GET /exams/:id/subjects — Subjects for an exam ───
  fastify.get('/exams/:id/subjects', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: examId } = request.params as { id: string };

    // Verify exam exists
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

  // ─── GET /subjects/:id/levels/:level/cards ────────────
  // Resolves the deck for (subjectId, level, topicSlug) and returns flashcards.
  // Also returns the deckId so the client can use it for session tracking.
  fastify.get(
    '/subjects/:id/levels/:level/cards',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id: subjectId, level } = request.params as { id: string; level: string };
      const { topicSlug, ...paginationRaw } = request.query as PaginationQuery & { topicSlug?: string };

      // Validate level value
      if (!SUBJECT_LEVELS.includes(level as typeof SUBJECT_LEVELS[number])) {
        return reply.status(400).send({
          success: false,
          error: { code: 'BAD_REQUEST', message: `Invalid level. Must be one of: ${SUBJECT_LEVELS.join(', ')}` },
          timestamp: new Date().toISOString(),
        });
      }

      // Level-gate: enforce subscription tier limit
      if (!checkLevelAccess(request, reply, level as SubjectLevel)) {
        return; // 403 already sent by helper
      }

      // Resolve the topic-scoped deck
      const deck = await deckRepository.findBySubjectAndLevel(
        subjectId,
        level as typeof SUBJECT_LEVELS[number],
        topicSlug,
      );
      if (!deck) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'No deck found for this subject, level, and topic' },
          timestamp: new Date().toISOString(),
        });
      }

      const result = await flashcardRepository.findByDeckId(deck.id, paginationRaw);

      return reply.send({
        success: true,
        data: {
          deckId: deck.id,
          deckTitle: deck.title,
          cardCount: deck.cardCount,
          cards: result.data,
        },
        pagination: result.pagination,
        timestamp: new Date().toISOString(),
      });
    },
  );

  // ─── GET /subjects/:id/topics — Topic list for a subject ──
  fastify.get('/subjects/:id/topics', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: subjectId } = request.params as { id: string };

    const subject = await subjectRepository.findById(subjectId);
    if (!subject) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Subject not found' },
        timestamp: new Date().toISOString(),
      });
    }

    const topics = await topicRepository.findBySubjectId(subjectId);

    return reply.send({
      success: true,
      data: {
        subjectId,
        subjectName: subject.name,
        topics: topics.map((t) => ({ slug: t.slug, displayName: t.displayName })),
      },
      timestamp: new Date().toISOString(),
    });
  });
}
