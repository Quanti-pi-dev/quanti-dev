// ─── Admin Content Routes ─────────────────────────────────────
// Deck + Flashcard CRUD. All routes are exam-scoped.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { deckRepository } from '../repositories/deck.repository.js';
import { flashcardRepository } from '../repositories/flashcard.repository.js';
import { SUBJECT_LEVELS } from '@kd/shared';

// ─── Schemas ────────────────────────────────────────────────

const createDeckSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  category: z.string().min(1),
  imageUrl: z.string().url().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

const optionSchema = z.object({
  id: z.string().min(1).max(50),
  text: z.string().min(1).max(1000),
});

const createFlashcardSchema = z.object({
  question: z.string().min(1).max(2000),
  options: z.array(optionSchema).min(2).max(6),
  correctAnswerId: z.string().min(1).max(50),
  explanation: z.string().max(2000).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  tags: z.array(z.string().max(100)).optional(),
  source: z.enum(['original', 'pyq', 'ai_generated']).optional(),
  sourceYear: z.number().int().positive().optional(),
  sourcePaper: z.string().max(200).optional(),
});

const bulkFlashcardsSchema = z.object({
  cards: z.array(createFlashcardSchema).min(1).max(100),
});

// ─── Routes ─────────────────────────────────────────────────

export async function adminContentRoutes(fastify: FastifyInstance): Promise<void> {

  // ═══════════════════════════════════════════════════════
  // DECK CRUD
  // ═══════════════════════════════════════════════════════

  // POST /admin/decks — create a deck
  fastify.post('/decks', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = createDeckSchema.parse(request.body);
    const id = await deckRepository.create({ ...input, createdBy: request.user!.id });
    return reply.status(201).send({ success: true, data: { id }, timestamp: new Date().toISOString() });
  });

  // PUT /admin/decks/:id — update a deck
  fastify.put('/decks/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const input = createDeckSchema.partial().parse(request.body);
    const result = await deckRepository.update(id, input);
    if (!result) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Deck not found' }, timestamp: new Date().toISOString() });
    return reply.send({ success: true, data: { id }, timestamp: new Date().toISOString() });
  });

  // GET /admin/decks — list all decks (admin)
  fastify.get('/decks', async (request: FastifyRequest, reply: FastifyReply) => {
    const { page, pageSize, search } = request.query as { page?: string; pageSize?: string; search?: string };
    const result = await deckRepository.findAllAdmin({
      page: parseInt(page ?? '1', 10) || 1,
      pageSize: Math.min(parseInt(pageSize ?? '50', 10) || 50, 200),
      search,
    });
    return reply.send({ success: true, data: result.data, pagination: { total: result.total, page: result.page, pageSize: result.pageSize }, timestamp: new Date().toISOString() });
  });

  // DELETE /admin/decks/:id — delete a deck
  fastify.delete('/decks/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const deleted = await deckRepository.delete(id);
    if (!deleted) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Deck not found' }, timestamp: new Date().toISOString() });
    return reply.send({ success: true, data: { id }, timestamp: new Date().toISOString() });
  });

  // ═══════════════════════════════════════════════════════
  // FLASHCARD CRUD
  // ═══════════════════════════════════════════════════════

  // POST /admin/decks/:id/flashcards — add card to a specific deck
  fastify.post('/decks/:id/flashcards', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: deckId } = request.params as { id: string };
    const input = createFlashcardSchema.parse(request.body);
    const cardId = await flashcardRepository.create(deckId, input);
    return reply.status(201).send({ success: true, data: { id: cardId, deckId }, timestamp: new Date().toISOString() });
  });

  // GET /admin/decks/:id/flashcards — list flashcards for a deck (admin view, no pagination)
  fastify.get('/decks/:id/flashcards', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: deckId } = request.params as { id: string };
    const cards = await flashcardRepository.findByDeckIdAdmin(deckId);
    return reply.send({ success: true, data: cards, timestamp: new Date().toISOString() });
  });

  // PUT /admin/flashcards/:cardId — update a flashcard
  fastify.put('/flashcards/:cardId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { cardId } = request.params as { cardId: string };
    const input = createFlashcardSchema.partial().parse(request.body);
    const ok = await flashcardRepository.update(cardId, input);
    if (!ok) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Card not found' }, timestamp: new Date().toISOString() });
    return reply.send({ success: true, data: { id: cardId }, timestamp: new Date().toISOString() });
  });

  // DELETE /admin/decks/:deckId/flashcards/:cardId — delete a flashcard
  fastify.delete('/decks/:deckId/flashcards/:cardId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { deckId, cardId } = request.params as { deckId: string; cardId: string };
    const ok = await flashcardRepository.delete(cardId, deckId);
    if (!ok) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Card not found' }, timestamp: new Date().toISOString() });
    return reply.send({ success: true, data: { id: cardId }, timestamp: new Date().toISOString() });
  });

  // POST /admin/decks/:id/flashcards/bulk — bulk insert cards into a specific deck
  fastify.post('/decks/:id/flashcards/bulk', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: deckId } = request.params as { id: string };
    const { cards } = bulkFlashcardsSchema.parse(request.body);
    const insertedCount = await flashcardRepository.bulkCreate(deckId, cards);
    return reply.status(201).send({
      success: true,
      data: { deckId, created: insertedCount, requested: cards.length },
      timestamp: new Date().toISOString(),
    });
  });

  // ═══════════════════════════════════════════════════════
  // HIERARCHY DECK RESOLVER
  // ═══════════════════════════════════════════════════════

  // GET /admin/exams/:examId/subjects/:subjectId/topics/:topicSlug/levels/:level/deck
  // Resolves the deckId for a given exam/subject/topic/level combination.
  // Used by the mobile admin to look up a deck before posting cards to it.
  fastify.get(
    '/exams/:examId/subjects/:subjectId/topics/:topicSlug/levels/:level/deck',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { examId, subjectId, topicSlug, level } = request.params as {
        examId: string; subjectId: string; topicSlug: string; level: string;
      };

      if (!SUBJECT_LEVELS.includes(level as typeof SUBJECT_LEVELS[number])) {
        return reply.status(400).send({
          success: false,
          error: { code: 'BAD_REQUEST', message: `Invalid level. Must be one of: ${SUBJECT_LEVELS.join(', ')}` },
          timestamp: new Date().toISOString(),
        });
      }

      const deck = await deckRepository.findByHierarchy(
        examId, subjectId, topicSlug, level as typeof SUBJECT_LEVELS[number],
      );

      if (!deck) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'No deck found for this exam/subject/topic/level' },
          timestamp: new Date().toISOString(),
        });
      }

      return reply.send({
        success: true,
        data: { deckId: deck.id, cardCount: deck.cardCount },
        timestamp: new Date().toISOString(),
      });
    },
  );
}
