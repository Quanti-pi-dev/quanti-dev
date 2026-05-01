// ─── Admin Subject Routes ───────────────────────────────────
// CRUD for subjects + exam-subject mapping.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { getMongoDb } from '../lib/database.js';
import { subjectRepository, examSubjectRepository } from '../repositories/subject.repository.js';

// ─── Schemas ────────────────────────────────────────────────

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

// ─── Routes ─────────────────────────────────────────────────

export async function adminSubjectRoutes(fastify: FastifyInstance): Promise<void> {

  // GET /admin/subjects — List all subjects
  fastify.get('/subjects', async (_request: FastifyRequest, reply: FastifyReply) => {
    const subjects = await subjectRepository.findAll();
    return reply.send({ success: true, data: subjects, timestamp: new Date().toISOString() });
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

  // DELETE /admin/subjects/:id — delete a subject (with exam-attachment guard)
  fastify.delete('/subjects/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const db = getMongoDb();
    const attachments = await db.collection('exam_subjects').countDocuments({ subjectId: new ObjectId(id) });
    if (attachments > 0) {
      return reply.status(409).send({
        success: false,
        error: { code: 'HAS_ATTACHMENTS', message: `Subject is attached to ${attachments} exam(s). Remove it from all exams first.` },
        timestamp: new Date().toISOString(),
      });
    }
    const deleted = await subjectRepository.delete(id);
    if (!deleted) {
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

    const order = input.order ?? existing.length;
    const mapping = await examSubjectRepository.create(examId, input.subjectId, order);
    return reply.status(201).send({
      success: true,
      data: mapping,
      timestamp: new Date().toISOString(),
    });
  });

  // DELETE /admin/exams/:id/subjects/:subjectId — remove subject from exam
  // Blocked if topics or decks exist for this exam+subject pair.
  fastify.delete('/exams/:id/subjects/:subjectId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: examId, subjectId } = request.params as { id: string; subjectId: string };
    const db = getMongoDb();
    const examOid = new ObjectId(examId);
    const subjectOid = new ObjectId(subjectId);

    const [topicCount, deckCount] = await Promise.all([
      db.collection('topics').countDocuments({ examId: examOid, subjectId: subjectOid }),
      db.collection('decks').countDocuments({ examId: examOid, subjectId: subjectOid }),
    ]);

    if (topicCount > 0 || deckCount > 0) {
      return reply.status(409).send({
        success: false,
        error: {
          code: 'HAS_CONTENT',
          message: `Cannot remove: this subject has ${topicCount} topic(s) and ${deckCount} deck(s) under this exam. Delete all topics and decks first.`,
        },
        timestamp: new Date().toISOString(),
      });
    }

    await examSubjectRepository.remove(examId, subjectId);
    return reply.send({ success: true, data: null, timestamp: new Date().toISOString() });
  });
}
