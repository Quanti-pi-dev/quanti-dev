// ─── Admin PYQ Routes ────────────────────────────────────────
// Dedicated CRUD and bulk-import endpoints for PYQ (Previous Year Question) flashcards.
//
// All routes are scoped to /api/admin/pyq and require admin auth.
//
// GET  /pyq?examId=&subjectId=&topicSlug=&year=&paper=&page=&pageSize=
//   → Paginated list of source=pyq flashcards with rich metadata
//
// GET  /pyq/meta?examId=&subjectId=
//   → Available years + papers for a given exam/subject combo (for filter UI)
//
// POST /pyq/bulk
//   → Bulk-import PYQs; metadata (year, paper, source) set at request level,
//     not per-card, making imports much faster for admins

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireRole } from '../middleware/rbac.js';
import { flashcardRepository } from '../repositories/flashcard.repository.js';
import { deckRepository } from '../repositories/deck.repository.js';
import { topicRepository } from '../repositories/topic.repository.js';
import { subjectRepository } from '../repositories/subject.repository.js';
import { getMongoDb } from '../lib/database.js';
import { ObjectId } from 'mongodb';
import { SUBJECT_LEVELS } from '@kd/shared';

// ─── Schemas ─────────────────────────────────────────────────

const optionSchema = z.object({
  id: z.string().min(1).max(50),
  text: z.string().min(1).max(1000),
});

const pyqCardSchema = z.object({
  question: z.string().min(1).max(2000),
  options: z.array(optionSchema).min(2).max(6),
  correctAnswerId: z.string().min(1).max(50),
  explanation: z.string().max(2000).nullable().optional(),
  // Per-card overrides (optional — defaults to request-level values)
  sourceYear: z.number().int().positive().optional(),
  sourcePaper: z.string().max(200).optional(),
  tags: z.array(z.string().max(100)).optional(),
});

const pyqBulkSchema = z.object({
  // Target: which deck to insert into (resolved via subject+level+topic)
  subjectId: z.string().min(1),
  topicSlug: z.string().min(1),
  level: z.enum(SUBJECT_LEVELS as [string, ...string[]]),
  // Request-level PYQ metadata (applied to all cards unless overridden per-card)
  sourceYear: z.number().int().min(1900).max(2100),
  sourcePaper: z.string().max(200).optional(),
  examLabel: z.string().max(200).optional(),  // e.g. "JEE Main"
  // Cards array (max 500 per call — larger than the standard 100)
  cards: z.array(pyqCardSchema).min(1).max(500),
});

// ─── Routes ──────────────────────────────────────────────────

export async function adminPYQRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireRole('admin'));

  // ── GET /pyq — Paginated PYQ list ───────────────────────
  fastify.get('/pyq', async (request: FastifyRequest, reply: FastifyReply) => {
    const {
      examId, subjectId, topicSlug,
      year, paper,
      page = '1', pageSize = '30',
    } = request.query as {
      examId?: string; subjectId?: string; topicSlug?: string;
      year?: string; paper?: string;
      page?: string; pageSize?: string;
    };

    const db = getMongoDb();
    const pg = Math.max(1, parseInt(page, 10) || 1);
    const ps = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 30));
    const skip = (pg - 1) * ps;

    // Build filter: always source=pyq, plus optional filters
    const filter: Record<string, unknown> = { source: 'pyq' };

    // Resolve deckIds from subject + optional topicSlug
    if (subjectId) {
      let deckFilter: Record<string, unknown> = {
        subjectId: new ObjectId(subjectId),
      };
      if (topicSlug) deckFilter['topicSlug'] = topicSlug;

      const deckDocs = await db.collection('decks').find(deckFilter, {
        projection: { _id: 1 },
      }).toArray();
      const deckIds = deckDocs.map((d) => d._id as ObjectId);

      if (deckIds.length === 0) {
        return reply.send({
          success: true,
          data: { cards: [], pagination: { page: pg, pageSize: ps, totalItems: 0, totalPages: 0 } },
        });
      }
      filter['deckId'] = { $in: deckIds };
    } else if (examId) {
      // Filter by exam — find all subjects for this exam, then all decks
      const examDocs = await db.collection('subjects').find(
        { examIds: new ObjectId(examId) },
        { projection: { _id: 1 } },
      ).toArray();
      const subjectIds = examDocs.map((s) => s._id as ObjectId);
      const deckDocs = await db.collection('decks').find(
        { subjectId: { $in: subjectIds } },
        { projection: { _id: 1 } },
      ).toArray();
      const deckIds = deckDocs.map((d) => d._id as ObjectId);
      if (deckIds.length === 0) {
        return reply.send({
          success: true,
          data: { cards: [], pagination: { page: pg, pageSize: ps, totalItems: 0, totalPages: 0 } },
        });
      }
      filter['deckId'] = { $in: deckIds };
    }

    if (year) {
      const y = parseInt(year, 10);
      if (!isNaN(y)) filter['sourceYear'] = y;
    }
    if (paper) filter['sourcePaper'] = paper;

    const [docs, totalItems] = await Promise.all([
      db.collection('flashcards')
        .find(filter)
        .sort({ sourceYear: -1, sourcePaper: 1, order: 1 })
        .skip(skip)
        .limit(ps)
        .toArray(),
      db.collection('flashcards').countDocuments(filter),
    ]);

    const cards = docs.map((doc) => ({
      id: (doc['_id'] as ObjectId).toHexString(),
      deckId: (doc['deckId'] as ObjectId).toHexString(),
      question: doc['question'] as string,
      options: doc['options'],
      correctAnswerId: doc['correctAnswerId'] as string,
      explanation: (doc['explanation'] as string) ?? null,
      source: 'pyq',
      sourceYear: (doc['sourceYear'] as number) ?? null,
      sourcePaper: (doc['sourcePaper'] as string) ?? null,
      tags: (doc['tags'] as string[]) ?? [],
      createdAt: (doc['createdAt'] as Date).toISOString(),
    }));

    return reply.send({
      success: true,
      data: {
        cards,
        pagination: {
          page: pg,
          pageSize: ps,
          totalItems,
          totalPages: Math.ceil(totalItems / ps),
          hasNextPage: pg * ps < totalItems,
          hasPreviousPage: pg > 1,
        },
      },
      timestamp: new Date().toISOString(),
    });
  });

  // ── GET /pyq/meta — Available years + papers for filter UI ──
  fastify.get('/pyq/meta', async (request: FastifyRequest, reply: FastifyReply) => {
    const { examId, subjectId } = request.query as { examId?: string; subjectId?: string };

    const db = getMongoDb();
    const filter: Record<string, unknown> = { source: 'pyq' };

    // Resolve deckIds if scoped
    if (subjectId) {
      const deckDocs = await db.collection('decks').find(
        { subjectId: new ObjectId(subjectId) },
        { projection: { _id: 1 } },
      ).toArray();
      filter['deckId'] = { $in: deckDocs.map((d) => d._id) };
    } else if (examId) {
      const subjectDocs = await db.collection('subjects').find(
        { examIds: new ObjectId(examId) },
        { projection: { _id: 1 } },
      ).toArray();
      const deckDocs = await db.collection('decks').find(
        { subjectId: { $in: subjectDocs.map((s) => s._id) } },
        { projection: { _id: 1 } },
      ).toArray();
      filter['deckId'] = { $in: deckDocs.map((d) => d._id) };
    }

    // Aggregate unique years and papers
    const agg = await db.collection('flashcards').aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          years: { $addToSet: '$sourceYear' },
          papers: { $addToSet: '$sourcePaper' },
          total: { $sum: 1 },
        },
      },
    ]).toArray();

    const result = agg[0] ?? { years: [], papers: [], total: 0 };
    const years = ((result['years'] as (number | null)[]) ?? [])
      .filter((y): y is number => typeof y === 'number')
      .sort((a, b) => b - a);  // descending
    const papers = ((result['papers'] as (string | null)[]) ?? [])
      .filter((p): p is string => typeof p === 'string' && p.length > 0)
      .sort();

    return reply.send({
      success: true,
      data: { years, papers, total: result['total'] ?? 0 },
      timestamp: new Date().toISOString(),
    });
  });

  // ── POST /pyq/bulk — PYQ bulk import with request-level metadata ──
  fastify.post('/pyq/bulk', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = pyqBulkSchema.parse(request.body);
    const { subjectId, topicSlug, level, sourceYear, sourcePaper, examLabel, cards } = input;

    // Validate level
    if (!SUBJECT_LEVELS.includes(level as typeof SUBJECT_LEVELS[number])) {
      return reply.status(400).send({
        success: false,
        error: { code: 'BAD_REQUEST', message: `Invalid level. Must be one of: ${SUBJECT_LEVELS.join(', ')}` },
      });
    }

    // Find or auto-create the topic-scoped deck
    let deck = await deckRepository.findBySubjectAndLevel(
      subjectId, level as typeof SUBJECT_LEVELS[number], topicSlug,
    );

    if (!deck) {
      const topics = await topicRepository.findBySubjectId(subjectId);
      const topic = topics.find((t) => t.slug === topicSlug);
      const subject = await subjectRepository.findById(subjectId);
      const displayName = topic?.displayName ?? topicSlug;
      const subjectName = subject?.name ?? '';

      const deckId = await deckRepository.create({
        title: `${displayName} — ${level}`,
        description: `${level}-level ${examLabel ? `${examLabel} ` : ''}PYQ questions on ${displayName} (${subjectName})`,
        category: 'subject',
        type: 'mastery',
        subjectId,
        topicSlug,
        level: level as typeof SUBJECT_LEVELS[number],
        tags: [topicSlug, subjectName, level, 'pyq'],
        createdBy: request.user!.id,
      });
      deck = await deckRepository.findById(deckId);
    }

    if (!deck) {
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Could not create or find deck' },
      });
    }

    // Normalise cards: apply request-level metadata as defaults
    const normalised = cards.map((card) => ({
      question: card.question,
      options: card.options,
      correctAnswerId: card.correctAnswerId,
      explanation: card.explanation ?? null,
      source: 'pyq' as const,
      sourceYear: card.sourceYear ?? sourceYear,
      sourcePaper: card.sourcePaper ?? sourcePaper ?? undefined,
      tags: card.tags ?? [topicSlug, String(sourceYear)],
    }));

    // Insert in one batch (repository handles order auto-assign)
    const insertedCount = await flashcardRepository.bulkCreate(deck.id, normalised);

    return reply.status(201).send({
      success: true,
      data: {
        deckId: deck.id,
        created: insertedCount,
        requested: cards.length,
        sourceYear,
        sourcePaper: sourcePaper ?? null,
      },
      timestamp: new Date().toISOString(),
    });
  });

  // ── DELETE /pyq/:cardId — remove a single PYQ card ──────
  fastify.delete('/pyq/:cardId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { cardId } = request.params as { cardId: string };

    const db = getMongoDb();
    let cardOid: ObjectId;
    try {
      cardOid = new ObjectId(cardId);
    } catch {
      return reply.status(400).send({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid cardId' } });
    }

    const card = await db.collection('flashcards').findOne(
      { _id: cardOid, source: 'pyq' },
      { projection: { _id: 1, deckId: 1 } },
    );
    if (!card) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'PYQ card not found' } });
    }

    const ok = await flashcardRepository.delete(cardId, (card['deckId'] as ObjectId).toHexString());
    if (!ok) {
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Delete failed' } });
    }

    return reply.send({ success: true, data: { id: cardId }, timestamp: new Date().toISOString() });
  });
}
