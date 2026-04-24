// ─── Admin Service Routes ───────────────────────────────────
// CRUD for exams, decks, flashcards, badges, shop items.
// All routes require the 'admin' role.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireRole } from '../middleware/rbac.js';
import {
  adminExamRepository,
  adminDeckRepository,
  adminFlashcardRepository,
  adminBadgeRepository,
  adminShopItemRepository,
  adminExamSubjectRepository,
} from '../repositories/admin.repository.js';
import { getMongoDb, getPostgresPool, getRedisClient } from '../lib/database.js';
import {
  subjectRepository, topicRepository,
  examSubjectRepository, deckRepository,
} from '../repositories/content.repository.js';
import { ObjectId } from 'mongodb';
import { SUBJECT_LEVELS } from '@kd/shared';

// ─── Validation Schemas ─────────────────────────────────────

const createExamSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  category: z.string().min(1),
  durationMinutes: z.number().int().positive(),
});

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
});

const bulkFlashcardsSchema = z.object({
  cards: z.array(createFlashcardSchema).min(1).max(100),
});

const createBadgeSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1),
  iconUrl: z.string().min(1),
  criteria: z.string().min(1),
});

// U3 fix: imageUrl is now nullable/optional so admins don't need to provide placeholder strings
const createShopItemSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1),
  imageUrl: z.string().nullable().optional(),
  price: z.number().int().nonnegative(),
  // Phase 2: flashcard_pack, theme, and power_up are active
  category: z.enum(['flashcard_pack', 'theme', 'power_up']),
  // flashcard_pack fields
  deckId: z.string().min(1).optional(),
  cardCount: z.number().int().positive().optional(),
  // theme fields
  themeKey: z.string().min(1).optional(),
});

// Update schema extends create with is_available so admins can soft-hide items
const updateShopItemSchema = createShopItemSchema.partial().extend({
  isAvailable: z.boolean().optional(),
});

export async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  // All admin routes require admin role
  fastify.addHook('preHandler', requireRole('admin'));

  // ═══════════════════════════════════════════════════════
  // EXAMS
  // ═══════════════════════════════════════════════════════

  fastify.post('/exams', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = createExamSchema.parse(request.body);
    const id = await adminExamRepository.create({
      ...input,
      createdBy: request.user!.id,
    });
    return reply.status(201).send({
      success: true,
      data: { id },
      timestamp: new Date().toISOString(),
    });
  });

  fastify.put('/exams/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const updates = createExamSchema.partial().parse(request.body);
    const result = await adminExamRepository.update(id, updates);

    if (!result) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Exam not found' },
        timestamp: new Date().toISOString(),
      });
    }

    return reply.send({
      success: true,
      data: { id },
      message: 'Exam updated',
      timestamp: new Date().toISOString(),
    });
  });

  fastify.delete('/exams/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const deleted = await adminExamRepository.delete(id);

    if (!deleted) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Exam not found' },
        timestamp: new Date().toISOString(),
      });
    }

    return reply.send({
      success: true,
      data: { id },
      message: 'Exam deleted',
      timestamp: new Date().toISOString(),
    });
  });

  // ═══════════════════════════════════════════════════════
  // DECKS (F2: full CRUD)
  // ═══════════════════════════════════════════════════════

  // GET /admin/decks — List all decks
  fastify.get('/decks', async (request: FastifyRequest, reply: FastifyReply) => {
    const { page, pageSize } = request.query as { page?: string; pageSize?: string };
    const parsedPage = parseInt(page ?? '1', 10);
    const parsedPageSize = parseInt(pageSize ?? '50', 10);
    const safePage = Number.isNaN(parsedPage) ? 1 : Math.max(parsedPage, 1);
    const safePageSize = Number.isNaN(parsedPageSize) ? 50 : Math.min(Math.max(parsedPageSize, 1), 200);
    const result = await adminDeckRepository.findAll({
      page: safePage,
      pageSize: safePageSize,
    });
    return reply.send({ success: true, data: result.data, pagination: { total: result.total, page: result.page, pageSize: result.pageSize }, timestamp: new Date().toISOString() });
  });

  fastify.post('/decks', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = createDeckSchema.parse(request.body);
    const id = await adminDeckRepository.create({
      ...input,
      createdBy: request.user!.id,
    });
    return reply.status(201).send({
      success: true,
      data: { id },
      timestamp: new Date().toISOString(),
    });
  });

  // PUT /admin/decks/:id — Update a deck
  fastify.put('/decks/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const updates = createDeckSchema.partial().parse(request.body);
    const result = await adminDeckRepository.update(id, updates);
    if (!result) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Deck not found' }, timestamp: new Date().toISOString() });
    }
    return reply.send({ success: true, data: { id }, message: 'Deck updated', timestamp: new Date().toISOString() });
  });

  // DELETE /admin/decks/:id — Delete a deck and its flashcards
  fastify.delete('/decks/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const deleted = await adminDeckRepository.delete(id);
    if (!deleted) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Deck not found' }, timestamp: new Date().toISOString() });
    }
    return reply.send({ success: true, data: { id }, message: 'Deck deleted', timestamp: new Date().toISOString() });
  });

  // ═══════════════════════════════════════════════════════
  // FLASHCARDS
  // ═══════════════════════════════════════════════════════

  fastify.post('/flashcards', async (request: FastifyRequest, reply: FastifyReply) => {
    const { deckId } = request.query as { deckId: string };
    if (!deckId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_PARAM', message: 'deckId query parameter is required' },
        timestamp: new Date().toISOString(),
      });
    }

    const input = createFlashcardSchema.parse(request.body);
    const id = await adminFlashcardRepository.create({ ...input, deckId });
    await adminDeckRepository.incrementCardCount(deckId, 1);

    return reply.status(201).send({
      success: true,
      data: { id },
      timestamp: new Date().toISOString(),
    });
  });

  fastify.post('/flashcards/bulk', async (request: FastifyRequest, reply: FastifyReply) => {
    const { deckId } = request.query as { deckId: string };
    if (!deckId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_PARAM', message: 'deckId query parameter is required' },
        timestamp: new Date().toISOString(),
      });
    }

    const { cards } = bulkFlashcardsSchema.parse(request.body);

    // Use the actual inserted count from MongoDB (handles partial failures)
    let insertedCount: number;
    try {
      insertedCount = await adminFlashcardRepository.bulkCreate(deckId, cards);
    } catch (err) {
      request.log.error({ err, deckId, attempted: cards.length }, 'Bulk flashcard insert failed');
      return reply.status(500).send({
        success: false,
        error: { code: 'BULK_INSERT_FAILED', message: 'Failed to insert flashcards' },
        timestamp: new Date().toISOString(),
      });
    }

    // Only increment cardCount by the number actually inserted
    if (insertedCount > 0) {
      await adminDeckRepository.incrementCardCount(deckId, insertedCount);
    }

    return reply.status(201).send({
      success: true,
      data: { created: insertedCount, requested: cards.length },
      timestamp: new Date().toISOString(),
    });
  });

  // ═══════════════════════════════════════════════════════
  // BADGES (PostgreSQL) — F1: full CRUD
  // ═══════════════════════════════════════════════════════

  // GET /admin/badges — List all badges
  fastify.get('/badges', async (_request: FastifyRequest, reply: FastifyReply) => {
    const badges = await adminBadgeRepository.findAll();
    return reply.send({ success: true, data: badges, timestamp: new Date().toISOString() });
  });

  fastify.post('/badges', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = createBadgeSchema.parse(request.body);
    const id = await adminBadgeRepository.create(input);
    return reply.status(201).send({
      success: true,
      data: { id },
      timestamp: new Date().toISOString(),
    });
  });

  // PATCH /admin/badges/:id — Update a badge
  fastify.patch('/badges/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const updates = createBadgeSchema.partial().parse(request.body);
    const updated = await adminBadgeRepository.update(id, updates);
    if (!updated) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Badge not found' }, timestamp: new Date().toISOString() });
    }
    return reply.send({ success: true, data: { id }, message: 'Badge updated', timestamp: new Date().toISOString() });
  });

  // DELETE /admin/badges/:id — Delete a badge
  fastify.delete('/badges/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const deleted = await adminBadgeRepository.delete(id);
    if (!deleted) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Badge not found' }, timestamp: new Date().toISOString() });
    }
    return reply.send({ success: true, data: { id }, message: 'Badge deleted', timestamp: new Date().toISOString() });
  });

  // ═══════════════════════════════════════════════════════
  // SHOP ITEMS (PostgreSQL) — W1: admin list includes hidden items
  // ═══════════════════════════════════════════════════════

  // GET /admin/shop-items — List ALL items (including is_available=false)
  fastify.get('/shop-items', async (_request: FastifyRequest, reply: FastifyReply) => {
    const pg = getPostgresPool();
    const result = await pg.query(
      `SELECT id, name, description, image_url, price, category,
              is_available, deck_id, card_count, theme_key, created_at, updated_at
       FROM shop_items ORDER BY created_at DESC`,
    );
    const items = result.rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      name: row.name as string,
      description: row.description as string,
      imageUrl: (row.image_url as string) ?? null,
      price: row.price as number,
      category: row.category as string,
      isAvailable: row.is_available as boolean,
      deckId: (row.deck_id as string) ?? null,
      cardCount: (row.card_count as number) ?? null,
      themeKey: (row.theme_key as string) ?? null,
      createdAt: (row.created_at as Date).toISOString(),
      updatedAt: (row.updated_at as Date).toISOString(),
    }));
    return reply.send({ success: true, data: items, timestamp: new Date().toISOString() });
  });

  fastify.post('/shop-items', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = createShopItemSchema.parse(request.body);
    const id = await adminShopItemRepository.create({ ...input, imageUrl: input.imageUrl ?? null });
    return reply.status(201).send({
      success: true,
      data: { id },
      timestamp: new Date().toISOString(),
    });
  });

  fastify.put('/shop-items/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const updates = updateShopItemSchema.parse(request.body);
    const { imageUrl: rawImageUrl, ...rest } = updates;
    const sanitizedUpdates = { ...rest, ...(rawImageUrl !== undefined ? { imageUrl: rawImageUrl ?? '' } : {}) };
    const updated = await adminShopItemRepository.update(id, sanitizedUpdates);
    if (!updated) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Shop item not found' },
        timestamp: new Date().toISOString(),
      });
    }
    return reply.send({ success: true, data: { id }, timestamp: new Date().toISOString() });
  });

  fastify.delete('/shop-items/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const deleted = await adminShopItemRepository.delete(id);
    if (!deleted) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Shop item not found' },
        timestamp: new Date().toISOString(),
      });
    }
    return reply.send({ success: true, data: { id }, timestamp: new Date().toISOString() });
  });


  // ═══════════════════════════════════════════════════════
  // SUBJECTS
  // ═══════════════════════════════════════════════════════

  const createSubjectSchema = z.object({
    name: z.string().min(1).max(200),
    description: z.string().optional(),
    iconName: z.string().optional(),
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  });

  const mapSubjectSchema = z.object({
    subjectId: z.string().min(1),
    order: z.number().int().nonnegative().optional(),
  });

  // POST /admin/subjects — create a subject
  fastify.post('/subjects', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = createSubjectSchema.parse(request.body);
    const subject = await subjectRepository.create(input);
    return reply.status(201).send({
      success: true,
      data: subject,
      timestamp: new Date().toISOString(),
    });
  });

  // PATCH /admin/subjects/:id — update a subject
  fastify.patch('/subjects/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const updates = createSubjectSchema.partial().parse(request.body);
    const subject = await subjectRepository.update(id, updates);
    if (!subject) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Subject not found' },
        timestamp: new Date().toISOString(),
      });
    }
    return reply.send({ success: true, data: subject, timestamp: new Date().toISOString() });
  });

  // F3: DELETE /admin/subjects/:id — delete a subject (with exam-attachment guard)
  fastify.delete('/subjects/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    // Guard: check if subject is attached to any exam
    const db = getMongoDb();
    const attachments = await db.collection('exam_subjects').countDocuments({ subjectId: new ObjectId(id) });
    if (attachments > 0) {
      return reply.status(409).send({
        success: false,
        error: { code: 'HAS_ATTACHMENTS', message: `Subject is attached to ${attachments} exam(s). Remove it from all exams first.` },
        timestamp: new Date().toISOString(),
      });
    }
    const result = await db.collection('subjects').deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Subject not found' }, timestamp: new Date().toISOString() });
    }
    return reply.send({ success: true, data: { id }, message: 'Subject deleted', timestamp: new Date().toISOString() });
  });

  // POST /admin/exams/:id/subjects — map a subject to an exam (C4: with duplicate guard)
  fastify.post('/exams/:id/subjects', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: examId } = request.params as { id: string };
    const input = mapSubjectSchema.parse(request.body);

    // C4 fix: check for duplicate mapping
    const existing = await examSubjectRepository.findByExamId(examId);
    const alreadyAttached = existing.some((m) => m.subjectId === input.subjectId);
    if (alreadyAttached) {
      return reply.status(409).send({
        success: false,
        error: { code: 'DUPLICATE_MAPPING', message: 'This subject is already attached to the exam' },
        timestamp: new Date().toISOString(),
      });
    }

    // Auto-assign order as next slot if not provided
    const order = input.order ?? existing.length;

    const mapping = await examSubjectRepository.addSubjectToExam(examId, input.subjectId, order);
    return reply.status(201).send({
      success: true,
      data: mapping,
      timestamp: new Date().toISOString(),
    });
  });

  // DELETE /admin/exams/:id/subjects/:subjectId — remove subject from exam
  fastify.delete('/exams/:id/subjects/:subjectId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: examId, subjectId } = request.params as { id: string; subjectId: string };
    await examSubjectRepository.removeSubjectFromExam(examId, subjectId);
    return reply.send({ success: true, data: null, timestamp: new Date().toISOString() });
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
    const db = getMongoDb();

    // Find the topic-scoped deck for (subjectId, level, topicSlug)
    let deck = await deckRepository.findBySubjectAndLevel(
      subjectId,
      level as typeof SUBJECT_LEVELS[number],
      topicSlug,
    );

    // Auto-create the deck if it doesn't exist yet
    if (!deck) {
      const deckResult = await db.collection('decks').insertOne({
        title: `${topicSlug} — ${level}`,
        description: `${level} level deck for ${topicSlug} (${subjectId})`,
        category: 'subject',
        subjectId: new ObjectId(subjectId),
        level,
        tags: [topicSlug],
        cardCount: 0,
        isPublished: true,
        createdBy: request.user!.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      deck = await deckRepository.findById(deckResult.insertedId.toHexString());
    }

    if (!deck) {
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Could not create deck' },
        timestamp: new Date().toISOString(),
      });
    }

    const cardResult = await db.collection('flashcards').insertOne({
      deckId: new ObjectId(deck.id),
      ...input,
      order: deck.cardCount,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.collection('decks').updateOne(
      { _id: new ObjectId(deck.id) },
      { $inc: { cardCount: 1 }, $set: { updatedAt: new Date() } },
    );
    // B5 fix: bust subject-scoped deck cache so students see fresh cardCount
    await getRedisClient().del(`cache:deck:${deck.id}`);
    await getRedisClient().del(`cache:deck:subject:${subjectId}:${level}:${topicSlug}`);

    return reply.status(201).send({
      success: true,
      data: { id: cardResult.insertedId.toHexString(), deckId: deck.id },
      timestamp: new Date().toISOString(),
    });
  });

  // ═══════════════════════════════════════════════════════
  // NEW ADMIN READ & MANAGEMENT ROUTES
  // ═══════════════════════════════════════════════════════

  // ─── GET /admin/exams — List all exams (admin view) ────
  fastify.get('/exams', async (request: FastifyRequest, reply: FastifyReply) => {
    const { page, pageSize } = request.query as { page?: string; pageSize?: string };
    const parsedPage = parseInt(page ?? '1', 10);
    const parsedPageSize = parseInt(pageSize ?? '50', 10);
    const safePage = Number.isNaN(parsedPage) ? 1 : Math.max(parsedPage, 1);
    const safePageSize = Number.isNaN(parsedPageSize) ? 50 : Math.min(Math.max(parsedPageSize, 1), 200);
    const result = await adminExamRepository.findAll({
      page: safePage,
      pageSize: safePageSize,
    });
    return reply.send({ success: true, data: result.data, pagination: { total: result.total, page: result.page, pageSize: result.pageSize }, timestamp: new Date().toISOString() });
  });

  // ─── GET /admin/exams/:id — Single exam ────────────────
  fastify.get('/exams/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const exam = await adminExamRepository.findById(id);
    if (!exam) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Exam not found' }, timestamp: new Date().toISOString() });
    return reply.send({ success: true, data: exam, timestamp: new Date().toISOString() });
  });

  // ─── PATCH /admin/exams/:id/publish — Toggle publish (C2: with 404 guard) ───
  fastify.patch('/exams/:id/publish', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    // C2 fix: first check if exam exists
    const exam = await adminExamRepository.findById(id);
    if (!exam) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Exam not found' }, timestamp: new Date().toISOString() });
    }
    const isPublished = await adminExamRepository.togglePublished(id);
    return reply.send({ success: true, data: { id, isPublished }, timestamp: new Date().toISOString() });
  });

  // ─── GET /admin/exams/:id/subjects — List exam subjects ─
  fastify.get('/exams/:id/subjects', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: examId } = request.params as { id: string };
    const mappings = await examSubjectRepository.findByExamId(examId);
    const subjects = await subjectRepository.findByExamId(examId);
    const enriched = mappings.map((m) => ({
      ...m,
      subject: subjects.find((s) => s.id === m.subjectId) ?? null,
    }));
    return reply.send({ success: true, data: enriched, timestamp: new Date().toISOString() });
  });

  // ─── PATCH /admin/exams/:id/subjects/:subjectId/order ──
  const reorderSchema = z.object({ order: z.number().int().min(0) });
  fastify.patch('/exams/:id/subjects/:subjectId/order', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: examId, subjectId } = request.params as { id: string; subjectId: string };
    const { order } = reorderSchema.parse(request.body);
    const ok = await adminExamSubjectRepository.reorder(examId, subjectId, order);
    if (!ok) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Mapping not found' }, timestamp: new Date().toISOString() });
    return reply.send({ success: true, data: { examId, subjectId, order }, timestamp: new Date().toISOString() });
  });

  // ─── GET /admin/subjects — List all subjects ────────────
  fastify.get('/subjects', async (_request: FastifyRequest, reply: FastifyReply) => {
    const subjects = await subjectRepository.findAll();
    return reply.send({ success: true, data: subjects, timestamp: new Date().toISOString() });
  });

  // GET /admin/subjects/:id/levels/:level/cards?topicSlug=
  fastify.get(
    '/subjects/:id/levels/:level/cards',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id: subjectId, level } = request.params as { id: string; level: string };
      const { topicSlug } = request.query as { topicSlug?: string };

      if (!SUBJECT_LEVELS.includes(level as typeof SUBJECT_LEVELS[number])) {
        return reply.status(400).send({
          success: false,
          error: { code: 'BAD_REQUEST', message: `Invalid level. Must be one of: ${SUBJECT_LEVELS.join(', ')}` },
          timestamp: new Date().toISOString(),
        });
      }

      const deck = await deckRepository.findBySubjectAndLevel(
        subjectId,
        level as typeof SUBJECT_LEVELS[number],
        topicSlug,
      );
      if (!deck) {
        return reply.send({ success: true, data: { deckId: null, cardCount: 0, cards: [] }, timestamp: new Date().toISOString() });
      }

      const cards = await adminFlashcardRepository.findByDeckId(deck.id);
      return reply.send({
        success: true,
        data: { deckId: deck.id, cardCount: deck.cardCount, cards },
        timestamp: new Date().toISOString(),
      });
    },
  );

  // ─── PUT /admin/subjects/:id/levels/:level/cards/:cardId ─
  fastify.put(
    '/subjects/:id/levels/:level/cards/:cardId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { cardId } = request.params as { id: string; level: string; cardId: string };
      const input = createFlashcardSchema.partial().parse(request.body);
      const ok = await adminFlashcardRepository.updateCard(cardId, input);
      if (!ok) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Card not found' }, timestamp: new Date().toISOString() });
      return reply.send({ success: true, data: { id: cardId }, timestamp: new Date().toISOString() });
    },
  );

  // DELETE /admin/subjects/:id/levels/:level/cards/:cardId?topicSlug=
  fastify.delete(
    '/subjects/:id/levels/:level/cards/:cardId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id: subjectId, level, cardId } = request.params as { id: string; level: string; cardId: string };
      const { topicSlug } = request.query as { topicSlug?: string };

      if (!SUBJECT_LEVELS.includes(level as typeof SUBJECT_LEVELS[number])) {
        return reply.status(400).send({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Invalid level' },
          timestamp: new Date().toISOString(),
        });
      }

      const deck = await deckRepository.findBySubjectAndLevel(
        subjectId,
        level as typeof SUBJECT_LEVELS[number],
        topicSlug,
      );
      if (!deck) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Deck not found for this topic/level' }, timestamp: new Date().toISOString() });

      const ok = await adminFlashcardRepository.deleteCard(cardId, deck.id);
      if (!ok) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Card not found' }, timestamp: new Date().toISOString() });
      return reply.send({ success: true, data: { id: cardId }, timestamp: new Date().toISOString() });
    },
  );

  // ═══════════════════════════════════════════════════════
  // W2: Topic-scoped Bulk Insert
  // ═══════════════════════════════════════════════════════

  // POST /admin/subjects/:id/levels/:level/cards/bulk?topicSlug=
  fastify.post(
    '/subjects/:id/levels/:level/cards/bulk',
    async (request: FastifyRequest, reply: FastifyReply) => {
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
      const db = getMongoDb();

      // Find or auto-create the topic-scoped deck
      let deck = await deckRepository.findBySubjectAndLevel(
        subjectId,
        level as typeof SUBJECT_LEVELS[number],
        topicSlug,
      );

      if (!deck) {
        const deckResult = await db.collection('decks').insertOne({
          title: `${topicSlug} — ${level}`,
          description: `${level} level deck for ${topicSlug} (${subjectId})`,
          category: 'subject',
          subjectId: new ObjectId(subjectId),
          level,
          tags: [topicSlug],
          cardCount: 0,
          isPublished: true,
          createdBy: request.user!.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        deck = await deckRepository.findById(deckResult.insertedId.toHexString());
      }

      if (!deck) {
        return reply.status(500).send({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Could not create deck' },
          timestamp: new Date().toISOString(),
        });
      }

      const insertedCount = await adminFlashcardRepository.bulkCreate(deck.id, cards);
      if (insertedCount > 0) {
        await adminDeckRepository.incrementCardCount(deck.id, insertedCount);
        // B5 fix: bust subject-scoped deck cache so students see fresh cardCount
        await getRedisClient().del(`cache:deck:${deck.id}`);
        await getRedisClient().del(`cache:deck:subject:${subjectId}:${level}:${topicSlug}`);
      }

      return reply.status(201).send({
        success: true,
        data: { deckId: deck.id, created: insertedCount, requested: cards.length },
        timestamp: new Date().toISOString(),
      });
    },
  );

  // ═══════════════════════════════════════════════════════
  // W4: Topic Taxonomy API
  // ═══════════════════════════════════════════════════════

  // ─── Topic CRUD (Dynamic MongoDB) ─────────────────────

  const createTopicSchema = z.object({
    slug: z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be kebab-case'),
    displayName: z.string().min(1).max(200),
    order: z.number().int().nonnegative().optional(),
  });

  // GET /admin/subjects/:id/topics — dynamic from MongoDB
  fastify.get('/subjects/:id/topics', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const subject = await subjectRepository.findById(id);
    if (!subject) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Subject not found' }, timestamp: new Date().toISOString() });
    }
    const topics = await topicRepository.findBySubjectId(id);
    return reply.send({ success: true, data: { subjectId: id, subjectName: subject.name, topics }, timestamp: new Date().toISOString() });
  });

  // POST /admin/subjects/:id/topics — create a new topic
  fastify.post('/subjects/:id/topics', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: subjectId } = request.params as { id: string };
    const subject = await subjectRepository.findById(subjectId);
    if (!subject) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Subject not found' }, timestamp: new Date().toISOString() });
    }
    const input = createTopicSchema.parse(request.body);
    try {
      const topic = await topicRepository.create({ subjectId, ...input });
      return reply.status(201).send({ success: true, data: topic, timestamp: new Date().toISOString() });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create topic';
      if (message.includes('already exists')) {
        return reply.status(409).send({ success: false, error: { code: 'DUPLICATE_SLUG', message }, timestamp: new Date().toISOString() });
      }
      throw err;
    }
  });

  // PATCH /admin/subjects/:id/topics/:topicId — update a topic
  fastify.patch('/subjects/:id/topics/:topicId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { topicId } = request.params as { id: string; topicId: string };
    const updates = createTopicSchema.partial().parse(request.body);
    const topic = await topicRepository.update(topicId, updates);
    if (!topic) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Topic not found' }, timestamp: new Date().toISOString() });
    }
    return reply.send({ success: true, data: topic, timestamp: new Date().toISOString() });
  });

  // DELETE /admin/subjects/:id/topics/:topicId — delete (blocked if decks exist)
  fastify.delete('/subjects/:id/topics/:topicId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: subjectId, topicId } = request.params as { id: string; topicId: string };
    const topic = await topicRepository.findById(topicId);
    if (!topic) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Topic not found' }, timestamp: new Date().toISOString() });
    }
    // Guard: block deletion if any decks exist for this topic
    const db = getMongoDb();
    const deckCount = await db.collection('decks').countDocuments({
      subjectId: new ObjectId(subjectId),
      'tags.0': topic.slug,
    });
    if (deckCount > 0) {
      return reply.status(409).send({
        success: false,
        error: { code: 'HAS_DECKS', message: `Topic has ${deckCount} deck(s) with flashcards. Remove all decks first.` },
        timestamp: new Date().toISOString(),
      });
    }
    await topicRepository.delete(topicId);
    return reply.send({ success: true, data: { id: topicId }, message: 'Topic deleted', timestamp: new Date().toISOString() });
  });

  // ═══════════════════════════════════════════════════════
  // PLATFORM ANALYTICS
  // ═══════════════════════════════════════════════════════

  // ─── GET /admin/analytics ─────────────────────────────
  // Real platform stats from PostgreSQL and Redis.
  // All values reflect live production data — no mocks.
  fastify.get('/analytics', async (_request: FastifyRequest, reply: FastifyReply) => {
    const pg = getPostgresPool();

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const [
      usersRow,
      activeTodayRow,
      sessionsRow,
      coinsRow,
      shopRow,
    ] = await Promise.all([
      // Total registered users
      pg.query(`SELECT COUNT(*) AS total FROM users`),
      // Users who had a study session today
      pg.query(`SELECT COUNT(DISTINCT user_id) AS active FROM study_sessions WHERE started_at::date = $1::date`, [today]),
      // Sessions + total cards + overall accuracy
      pg.query(`
        SELECT
          COUNT(*)                                                            AS total_sessions,
          COALESCE(SUM(cards_studied), 0)                                    AS total_cards,
          COALESCE(SUM(correct_answers)::float
            / NULLIF(SUM(correct_answers + incorrect_answers), 0) * 100, 0)  AS avg_accuracy
        FROM study_sessions
      `),
      // M4 fix: Use amount sign convention instead of potentially missing 'type' column
      pg.query(`
        SELECT
          COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS total_earned,
          COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) AS total_spent
        FROM coin_transactions
      `),
      // Shop: available items + purchases
      pg.query(`
        SELECT
          (SELECT COUNT(*) FROM shop_items WHERE is_available = true)        AS active_items,
          (SELECT COUNT(*) FROM user_unlocked_decks)                          AS pack_purchases,
          (SELECT COUNT(*) FROM coin_transactions WHERE amount < 0
           AND reason LIKE 'buy_%theme%')                                     AS theme_purchases
      `),
    ]);

    // Total coins in circulation = net of all earn - spend (from postgres)
    // Fall back to 0 if no transactions yet
    const totalEarned = parseInt(coinsRow.rows[0]?.total_earned ?? '0', 10);
    const totalSpent = parseInt(coinsRow.rows[0]?.total_spent ?? '0', 10);

    return reply.send({
      success: true,
      data: {
        totalUsers: parseInt(usersRow.rows[0]?.total ?? '0', 10),
        activeUsersToday: parseInt(activeTodayRow.rows[0]?.active ?? '0', 10),
        totalSessions: parseInt(sessionsRow.rows[0]?.total_sessions ?? '0', 10),
        totalCardsAnswered: parseInt(sessionsRow.rows[0]?.total_cards ?? '0', 10),
        avgAccuracyPct: Math.round(parseFloat(sessionsRow.rows[0]?.avg_accuracy ?? '0')),
        totalCoinsEarned: totalEarned,
        totalCoinsSpent: totalSpent,
        totalCoinsInCirculation: totalEarned - totalSpent,
        shopItemCount: parseInt(shopRow.rows[0]?.active_items ?? '0', 10),
        purchasedPackCount: parseInt(shopRow.rows[0]?.pack_purchases ?? '0', 10),
        purchasedThemeCount: parseInt(shopRow.rows[0]?.theme_purchases ?? '0', 10),
      },
      timestamp: new Date().toISOString(),
    });
  });

  // ═══════════════════════════════════════════════════════
  // ADMIN ASSET UPLOADS
  // ═══════════════════════════════════════════════════════

  const presignSchema = z.object({
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  });

  // POST /admin/upload/presign — Generate R2 presigned URL for admin content images
  fastify.post('/upload/presign', async (request: FastifyRequest, reply: FastifyReply) => {
    const { mimeType } = presignSchema.parse(request.body);
    const { generateAdminPresignedUrl } = await import('../lib/storage.js');

    try {
      const result = await generateAdminPresignedUrl(request.user!.id, mimeType);
      return reply.send({
        success: true,
        data: { uploadUrl: result.uploadUrl, cdnUrl: result.cdnUrl },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      request.log.error({ err }, 'Failed to generate admin presigned URL');
      return reply.status(500).send({
        success: false,
        error: { code: 'PRESIGN_FAILED', message: 'Could not generate upload URL' },
        timestamp: new Date().toISOString(),
      });
    }
  });
}
