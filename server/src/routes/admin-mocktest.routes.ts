// ─── Admin Mock Test Routes ──────────────────────────────────
// CRUD for curated mock test templates. Stored in the MongoDB
// `mock_tests` collection. Each template defines a fixed card
// pool, time limit, and metadata — giving admins full control
// over exam simulations rather than relying on random sampling.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { getMongoDb } from '../lib/database.js';

// ─── Schemas ────────────────────────────────────────────────

const createMockTestSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional().default(''),
  examId: z.string().min(1),
  /** Specific card IDs to include. If empty, cards will be sampled from subjectIds at serve time. */
  cardIds: z.array(z.string().min(1)).optional().default([]),
  /** Subject IDs to sample from when cardIds is empty. */
  subjectIds: z.array(z.string().min(1)).optional().default([]),
  /** Number of cards to serve (used when sampling). */
  cardCount: z.number().int().min(1).max(200).optional().default(30),
  /** Time limit in minutes. 0 = untimed. */
  timeLimitMinutes: z.number().int().min(0).max(300).optional().default(45),
  /** Whether this test is available to students. */
  isActive: z.boolean().optional().default(true),
  /** Display order (lower = shown first). */
  sortOrder: z.number().int().min(0).optional().default(0),
});

const updateMockTestSchema = createMockTestSchema.partial();

// ─── Routes ─────────────────────────────────────────────────

export async function adminMockTestRoutes(fastify: FastifyInstance): Promise<void> {

  // GET /admin/mock-tests — list all mock test templates
  fastify.get('/mock-tests', async (_request: FastifyRequest, reply: FastifyReply) => {
    const mongo = getMongoDb();
    const tests = await mongo
      .collection('mock_tests')
      .find({})
      .sort({ sortOrder: 1, createdAt: -1 })
      .toArray();

    const data = tests.map(doc => ({
      _id: doc._id.toString(),
      title: doc.title as string,
      description: (doc.description as string) ?? '',
      examId: (doc.examId as ObjectId | string)?.toString() ?? '',
      cardIds: (doc.cardIds as string[]) ?? [],
      subjectIds: ((doc.subjectIds ?? []) as (ObjectId | string)[]).map(id => id.toString()),
      cardCount: (doc.cardCount as number) ?? 30,
      timeLimitMinutes: (doc.timeLimitMinutes as number) ?? 45,
      isActive: (doc.isActive as boolean) ?? true,
      sortOrder: (doc.sortOrder as number) ?? 0,
      createdAt: (doc.createdAt as Date)?.toISOString() ?? '',
      updatedAt: (doc.updatedAt as Date)?.toISOString() ?? '',
    }));

    return reply.send({ success: true, data, timestamp: new Date().toISOString() });
  });

  // GET /admin/mock-tests/:id — single mock test
  fastify.get('/mock-tests/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    if (!ObjectId.isValid(id)) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_ID', message: 'Invalid mock test ID' }, timestamp: new Date().toISOString() });
    }

    const mongo = getMongoDb();
    const doc = await mongo.collection('mock_tests').findOne({ _id: new ObjectId(id) });
    if (!doc) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Mock test not found' }, timestamp: new Date().toISOString() });
    }

    return reply.send({
      success: true,
      data: {
        _id: doc._id.toString(),
        title: doc.title,
        description: doc.description ?? '',
        examId: (doc.examId as ObjectId | string)?.toString() ?? '',
        cardIds: doc.cardIds ?? [],
        subjectIds: ((doc.subjectIds ?? []) as (ObjectId | string)[]).map(id => id.toString()),
        cardCount: doc.cardCount ?? 30,
        timeLimitMinutes: doc.timeLimitMinutes ?? 45,
        isActive: doc.isActive ?? true,
        sortOrder: doc.sortOrder ?? 0,
        createdAt: (doc.createdAt as Date)?.toISOString() ?? '',
        updatedAt: (doc.updatedAt as Date)?.toISOString() ?? '',
      },
      timestamp: new Date().toISOString(),
    });
  });

  // POST /admin/mock-tests — create a mock test template
  fastify.post('/mock-tests', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = createMockTestSchema.parse(request.body);
    const mongo = getMongoDb();

    const now = new Date();
    const doc = {
      title: input.title,
      description: input.description,
      examId: ObjectId.isValid(input.examId) ? new ObjectId(input.examId) : input.examId,
      cardIds: input.cardIds,
      subjectIds: input.subjectIds.map(id => ObjectId.isValid(id) ? new ObjectId(id) : id),
      cardCount: input.cardCount,
      timeLimitMinutes: input.timeLimitMinutes,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
      createdBy: request.user!.id,
      createdAt: now,
      updatedAt: now,
    };

    const result = await mongo.collection('mock_tests').insertOne(doc);
    return reply.status(201).send({
      success: true,
      data: { id: result.insertedId.toString() },
      timestamp: new Date().toISOString(),
    });
  });

  // PUT /admin/mock-tests/:id — update a mock test template
  fastify.put('/mock-tests/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    if (!ObjectId.isValid(id)) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_ID', message: 'Invalid mock test ID' }, timestamp: new Date().toISOString() });
    }

    const input = updateMockTestSchema.parse(request.body);
    const mongo = getMongoDb();

    const $set: Record<string, unknown> = { updatedAt: new Date() };
    if (input.title !== undefined) $set.title = input.title;
    if (input.description !== undefined) $set.description = input.description;
    if (input.examId !== undefined) $set.examId = ObjectId.isValid(input.examId) ? new ObjectId(input.examId) : input.examId;
    if (input.cardIds !== undefined) $set.cardIds = input.cardIds;
    if (input.subjectIds !== undefined) $set.subjectIds = input.subjectIds.map(sid => ObjectId.isValid(sid) ? new ObjectId(sid) : sid);
    if (input.cardCount !== undefined) $set.cardCount = input.cardCount;
    if (input.timeLimitMinutes !== undefined) $set.timeLimitMinutes = input.timeLimitMinutes;
    if (input.isActive !== undefined) $set.isActive = input.isActive;
    if (input.sortOrder !== undefined) $set.sortOrder = input.sortOrder;

    const result = await mongo.collection('mock_tests').updateOne(
      { _id: new ObjectId(id) },
      { $set },
    );

    if (result.matchedCount === 0) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Mock test not found' }, timestamp: new Date().toISOString() });
    }

    return reply.send({ success: true, data: { id }, timestamp: new Date().toISOString() });
  });

  // DELETE /admin/mock-tests/:id — delete a mock test template
  fastify.delete('/mock-tests/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    if (!ObjectId.isValid(id)) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_ID', message: 'Invalid mock test ID' }, timestamp: new Date().toISOString() });
    }

    const mongo = getMongoDb();
    const result = await mongo.collection('mock_tests').deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Mock test not found' }, timestamp: new Date().toISOString() });
    }

    return reply.send({ success: true, data: { id }, timestamp: new Date().toISOString() });
  });
}
