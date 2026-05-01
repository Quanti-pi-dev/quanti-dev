// ─── Admin Topic Routes ─────────────────────────────────────
// CRUD for exam-scoped topics.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { getMongoDb } from '../lib/database.js';
import { topicRepository } from '../repositories/topic.repository.js';
import { subjectRepository } from '../repositories/subject.repository.js';

// ─── Schemas ────────────────────────────────────────────────

const createTopicSchema = z.object({
  examId: z.string().min(1),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be kebab-case'),
  displayName: z.string().min(1).max(200),
  order: z.number().int().nonnegative().optional(),
});

// ─── Routes ─────────────────────────────────────────────────

export async function adminTopicRoutes(fastify: FastifyInstance): Promise<void> {

  // GET /admin/subjects/:id/topics — list topics for a subject
  fastify.get('/subjects/:id/topics', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const subject = await subjectRepository.findById(id);
    if (!subject) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Subject not found' }, timestamp: new Date().toISOString() });
    }
    const topics = await topicRepository.findBySubjectId(id);
    return reply.send({ success: true, data: { subjectId: id, subjectName: subject.name, topics }, timestamp: new Date().toISOString() });
  });

  // POST /admin/subjects/:id/topics — create a new topic (exam-scoped)
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
    // Don't pass examId into updates (it's not changeable)
    const { examId: _ignored, ...safeUpdates } = updates;
    const topic = await topicRepository.update(topicId, safeUpdates);
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

  // POST /admin/subjects/:id/topics/bulk — bulk import topics
  fastify.post('/subjects/:id/topics/bulk', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: subjectId } = request.params as { id: string };
    const subject = await subjectRepository.findById(subjectId);
    if (!subject) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Subject not found' }, timestamp: new Date().toISOString() });
    }

    const bulkTopicSchema = z.object({
      examId: z.string().min(1),
      topics: z.array(z.object({
        slug: z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be kebab-case'),
        displayName: z.string().min(1).max(200),
        order: z.number().int().nonnegative().optional(),
      })).min(1).max(500),
    });

    const input = bulkTopicSchema.parse(request.body);

    const result = await topicRepository.bulkCreate(input.examId, subjectId, input.topics);

    return reply.status(201).send({
      success: true,
      data: {
        inserted: result.inserted,
        skipped: result.skipped,
        requested: input.topics.length,
        topics: result.topics,
      },
      timestamp: new Date().toISOString(),
    });
  });
}

