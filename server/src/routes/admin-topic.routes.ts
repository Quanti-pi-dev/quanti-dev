// ─── Admin Topic Routes ─────────────────────────────────────
// Full CRUD for exam-scoped topics.
// All routes require the exam context — no subject-only fallback.
//
// GET    /admin/exams/:examId/subjects/:subjectId/topics
// POST   /admin/exams/:examId/subjects/:subjectId/topics
// PATCH  /admin/exams/:examId/subjects/:subjectId/topics/:topicId
// DELETE /admin/exams/:examId/subjects/:subjectId/topics/:topicId
// POST   /admin/exams/:examId/subjects/:subjectId/topics/bulk

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { getMongoDb } from '../lib/database.js';
import { topicRepository } from '../repositories/topic.repository.js';
import { subjectRepository } from '../repositories/subject.repository.js';
import { examRepository } from '../repositories/exam.repository.js';

// ─── Schemas ────────────────────────────────────────────────

const topicBodySchema = z.object({
  slug: z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be kebab-case'),
  displayName: z.string().min(1).max(200),
  order: z.number().int().nonnegative().optional(),
});

const bulkTopicBodySchema = z.object({
  topics: z.array(z.object({
    slug: z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be kebab-case'),
    displayName: z.string().min(1).max(200),
    order: z.number().int().nonnegative().optional(),
  })).min(1).max(500),
});

// ─── Shared resolver ─────────────────────────────────────────

async function resolveExamAndSubject(
  examId: string, subjectId: string, reply: FastifyReply,
): Promise<{ subjectName: string } | null> {
  const [exam, subject] = await Promise.all([
    examRepository.findById(examId),
    subjectRepository.findById(subjectId),
  ]);
  if (!exam) {
    await reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Exam not found' }, timestamp: new Date().toISOString() });
    return null;
  }
  if (!subject) {
    await reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Subject not found' }, timestamp: new Date().toISOString() });
    return null;
  }
  return { subjectName: subject.name };
}

// ─── Routes ─────────────────────────────────────────────────

export async function adminTopicRoutes(fastify: FastifyInstance): Promise<void> {

  // GET /admin/exams/:examId/subjects/:subjectId/topics
  fastify.get('/exams/:examId/subjects/:subjectId/topics', async (request: FastifyRequest, reply: FastifyReply) => {
    const { examId, subjectId } = request.params as { examId: string; subjectId: string };
    const resolved = await resolveExamAndSubject(examId, subjectId, reply);
    if (!resolved) return;
    const topics = await topicRepository.findByExamAndSubject(examId, subjectId);
    return reply.send({
      success: true,
      data: { subjectId, subjectName: resolved.subjectName, topics },
      timestamp: new Date().toISOString(),
    });
  });

  // POST /admin/exams/:examId/subjects/:subjectId/topics
  fastify.post('/exams/:examId/subjects/:subjectId/topics', async (request: FastifyRequest, reply: FastifyReply) => {
    const { examId, subjectId } = request.params as { examId: string; subjectId: string };
    const resolved = await resolveExamAndSubject(examId, subjectId, reply);
    if (!resolved) return;
    const input = topicBodySchema.parse(request.body);
    try {
      const topic = await topicRepository.create({ examId, subjectId, ...input });
      return reply.status(201).send({ success: true, data: topic, timestamp: new Date().toISOString() });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create topic';
      if (message.includes('already exists')) {
        return reply.status(409).send({ success: false, error: { code: 'DUPLICATE_SLUG', message }, timestamp: new Date().toISOString() });
      }
      throw err;
    }
  });

  // PATCH /admin/exams/:examId/subjects/:subjectId/topics/:topicId
  fastify.patch('/exams/:examId/subjects/:subjectId/topics/:topicId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { topicId } = request.params as { examId: string; subjectId: string; topicId: string };
    const updates = topicBodySchema.partial().parse(request.body);
    const topic = await topicRepository.update(topicId, updates);
    if (!topic) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Topic not found' }, timestamp: new Date().toISOString() });
    }
    return reply.send({ success: true, data: topic, timestamp: new Date().toISOString() });
  });

  // DELETE /admin/exams/:examId/subjects/:subjectId/topics/:topicId
  fastify.delete('/exams/:examId/subjects/:subjectId/topics/:topicId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { examId, subjectId, topicId } = request.params as { examId: string; subjectId: string; topicId: string };
    const topic = await topicRepository.findById(topicId);
    if (!topic) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Topic not found' }, timestamp: new Date().toISOString() });
    }
    const deckCount = await getMongoDb().collection('decks').countDocuments({
      examId: new ObjectId(examId),
      subjectId: new ObjectId(subjectId),
      topicSlug: topic.slug,
    });
    if (deckCount > 0) {
      return reply.status(409).send({
        success: false,
        error: { code: 'HAS_DECKS', message: `Topic has ${deckCount} deck(s). Remove all decks first.` },
        timestamp: new Date().toISOString(),
      });
    }
    await topicRepository.delete(topicId);
    return reply.send({ success: true, data: { id: topicId }, message: 'Topic deleted', timestamp: new Date().toISOString() });
  });

  // POST /admin/exams/:examId/subjects/:subjectId/topics/bulk
  fastify.post('/exams/:examId/subjects/:subjectId/topics/bulk', async (request: FastifyRequest, reply: FastifyReply) => {
    const { examId, subjectId } = request.params as { examId: string; subjectId: string };
    const resolved = await resolveExamAndSubject(examId, subjectId, reply);
    if (!resolved) return;
    const { topics } = bulkTopicBodySchema.parse(request.body);
    const result = await topicRepository.bulkCreate(examId, subjectId, topics);
    return reply.status(201).send({
      success: true,
      data: { inserted: result.inserted, skipped: result.skipped, requested: topics.length, topics: result.topics },
      timestamp: new Date().toISOString(),
    });
  });
}
