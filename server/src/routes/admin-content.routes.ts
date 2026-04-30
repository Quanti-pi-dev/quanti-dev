// ─── Admin Content Routes ───────────────────────────────────
// Deck + Flashcard CRUD, including legacy and hierarchy-based endpoints.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { deckRepository } from '../repositories/deck.repository.js';
import { flashcardRepository } from '../repositories/flashcard.repository.js';
import { topicRepository } from '../repositories/topic.repository.js';
import { subjectRepository } from '../repositories/subject.repository.js';
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
    return reply.status(201).send({
      success: true,
      data: { id },
      timestamp: new Date().toISOString(),
    });
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
    return reply.status(201).send({
      success: true,
      data: { id: cardId, deckId },
      timestamp: new Date().toISOString(),
    });
  });

  // GET /admin/decks/:id/flashcards — list flashcards for a deck
  fastify.get('/decks/:id/flashcards', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: deckId } = request.params as { id: string };
    const cards = await flashcardRepository.findByDeckIdAdmin(deckId);
    return reply.send({
      success: true,
      data: cards,
      timestamp: new Date().toISOString(),
    });
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

  // ═══════════════════════════════════════════════════════
  // LEGACY: Topic-scoped card routes (backward compat)
  // ═══════════════════════════════════════════════════════

  // GET /admin/subjects/:id/levels/:level/cards?topicSlug=
  fastify.get('/subjects/:id/levels/:level/cards', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: subjectId, level } = request.params as { id: string; level: string };
    const { topicSlug } = request.query as { topicSlug?: string };

    if (!SUBJECT_LEVELS.includes(level as typeof SUBJECT_LEVELS[number])) {
      return reply.status(400).send({
        success: false,
        error: { code: 'BAD_REQUEST', message: `Invalid level. Must be one of: ${SUBJECT_LEVELS.join(', ')}` },
        timestamp: new Date().toISOString(),
      });
    }

    const deck = await deckRepository.findBySubjectAndLevel(subjectId, level as typeof SUBJECT_LEVELS[number], topicSlug);
    if (!deck) {
      return reply.send({ success: true, data: { deckId: null, cardCount: 0, cards: [] }, timestamp: new Date().toISOString() });
    }

    const cards = await flashcardRepository.findByDeckIdAdmin(deck.id);
    return reply.send({
      success: true,
      data: { deckId: deck.id, cardCount: deck.cardCount, cards },
      timestamp: new Date().toISOString(),
    });
  });

  // POST /admin/subjects/:id/levels/:level/cards — add card to a topic-scoped deck
  fastify.post('/subjects/:id/levels/:level/cards', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: subjectId, level } = request.params as { id: string; level: string };
    const { topicSlug } = request.query as { topicSlug?: string };

    if (!SUBJECT_LEVELS.includes(level as typeof SUBJECT_LEVELS[number])) {
      return reply.status(400).send({
        success: false,
        error: { code: 'BAD_REQUEST', message: `Invalid level. Must be one of: ${SUBJECT_LEVELS.join(', ')}` },
        timestamp: new Date().toISOString(),
      });
    }
    if (!topicSlug) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_PARAM', message: 'topicSlug query parameter is required' },
        timestamp: new Date().toISOString(),
      });
    }

    const input = createFlashcardSchema.parse(request.body);

    // Find the topic-scoped deck
    let deck = await deckRepository.findBySubjectAndLevel(subjectId, level as typeof SUBJECT_LEVELS[number], topicSlug);

    // Auto-create if it doesn't exist
    if (!deck) {
      const topic = (await topicRepository.findBySubjectId(subjectId)).find(t => t.slug === topicSlug);
      const subject = await subjectRepository.findById(subjectId);
      const displayName = topic?.displayName ?? topicSlug;
      const subjectName = subject?.name ?? '';

      const deckId = await deckRepository.create({
        title: `${displayName} — ${level}`,
        description: `${level}-level questions on ${displayName} (${subjectName})`,
        category: 'subject',
        type: 'mastery',
        subjectId,
        topicSlug,
        level: level as typeof SUBJECT_LEVELS[number],
        tags: [topicSlug, subjectName, level],
        createdBy: request.user!.id,
      });
      deck = await deckRepository.findById(deckId);
    }

    if (!deck) {
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Could not create deck' }, timestamp: new Date().toISOString() });
    }

    const cardId = await flashcardRepository.create(deck.id, input);
    return reply.status(201).send({
      success: true,
      data: { id: cardId, deckId: deck.id },
      timestamp: new Date().toISOString(),
    });
  });

  // PUT /admin/subjects/:id/levels/:level/cards/:cardId — update a card
  fastify.put('/subjects/:id/levels/:level/cards/:cardId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { cardId } = request.params as { id: string; level: string; cardId: string };
    const input = createFlashcardSchema.partial().parse(request.body);
    const ok = await flashcardRepository.update(cardId, input);
    if (!ok) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Card not found' }, timestamp: new Date().toISOString() });
    return reply.send({ success: true, data: { id: cardId }, timestamp: new Date().toISOString() });
  });

  // DELETE /admin/subjects/:id/levels/:level/cards/:cardId?topicSlug=
  fastify.delete('/subjects/:id/levels/:level/cards/:cardId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: subjectId, level, cardId } = request.params as { id: string; level: string; cardId: string };
    const { topicSlug } = request.query as { topicSlug?: string };

    if (!SUBJECT_LEVELS.includes(level as typeof SUBJECT_LEVELS[number])) {
      return reply.status(400).send({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid level' }, timestamp: new Date().toISOString() });
    }

    const deck = await deckRepository.findBySubjectAndLevel(subjectId, level as typeof SUBJECT_LEVELS[number], topicSlug);
    if (!deck) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Deck not found for this topic/level' }, timestamp: new Date().toISOString() });

    const ok = await flashcardRepository.delete(cardId, deck.id);
    if (!ok) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Card not found' }, timestamp: new Date().toISOString() });
    return reply.send({ success: true, data: { id: cardId }, timestamp: new Date().toISOString() });
  });

  // POST /admin/subjects/:id/levels/:level/cards/bulk?topicSlug= — bulk insert
  fastify.post('/subjects/:id/levels/:level/cards/bulk', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: subjectId, level } = request.params as { id: string; level: string };
    const { topicSlug } = request.query as { topicSlug?: string };

    if (!SUBJECT_LEVELS.includes(level as typeof SUBJECT_LEVELS[number])) {
      return reply.status(400).send({
        success: false,
        error: { code: 'BAD_REQUEST', message: `Invalid level. Must be one of: ${SUBJECT_LEVELS.join(', ')}` },
        timestamp: new Date().toISOString(),
      });
    }
    if (!topicSlug) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_PARAM', message: 'topicSlug query parameter is required' },
        timestamp: new Date().toISOString(),
      });
    }

    const { cards } = bulkFlashcardsSchema.parse(request.body);

    // Find or auto-create the topic-scoped deck
    let deck = await deckRepository.findBySubjectAndLevel(subjectId, level as typeof SUBJECT_LEVELS[number], topicSlug);

    if (!deck) {
      const topic = (await topicRepository.findBySubjectId(subjectId)).find(t => t.slug === topicSlug);
      const subject = await subjectRepository.findById(subjectId);
      const displayName = topic?.displayName ?? topicSlug;
      const subjectName = subject?.name ?? '';

      const deckId = await deckRepository.create({
        title: `${displayName} — ${level}`,
        description: `${level}-level questions on ${displayName} (${subjectName})`,
        category: 'subject',
        type: 'mastery',
        subjectId,
        topicSlug,
        level: level as typeof SUBJECT_LEVELS[number],
        tags: [topicSlug, subjectName, level],
        createdBy: request.user!.id,
      });
      deck = await deckRepository.findById(deckId);
    }

    if (!deck) {
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Could not create deck' }, timestamp: new Date().toISOString() });
    }

    const insertedCount = await flashcardRepository.bulkCreate(deck.id, cards);

    return reply.status(201).send({
      success: true,
      data: { deckId: deck.id, created: insertedCount, requested: cards.length },
      timestamp: new Date().toISOString(),
    });
  });
}
