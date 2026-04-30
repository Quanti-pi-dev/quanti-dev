// ─── Admin Exam Routes ──────────────────────────────────────
// CRUD for exams + exam-subject mappings.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { examRepository } from '../repositories/exam.repository.js';
import { subjectRepository, examSubjectRepository } from '../repositories/subject.repository.js';

// ─── Schemas ────────────────────────────────────────────────

const createExamSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  category: z.string().min(1),
  durationMinutes: z.number().int().positive(),
});

const reorderSchema = z.object({ order: z.number().int().min(0) });

// ─── Routes ─────────────────────────────────────────────────

export async function adminExamRoutes(fastify: FastifyInstance): Promise<void> {

  // ═══════════════════════════════════════════════════════
  // EXAM CRUD
  // ═══════════════════════════════════════════════════════

  // POST /admin/exams — create an exam
  fastify.post('/exams', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = createExamSchema.parse(request.body);
    const id = await examRepository.create({ ...input, createdBy: request.user!.id });
    return reply.status(201).send({
      success: true,
      data: { id },
      timestamp: new Date().toISOString(),
    });
  });

  // PUT /admin/exams/:id — update an exam
  fastify.put('/exams/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const input = createExamSchema.partial().parse(request.body);
    const result = await examRepository.update(id, input);
    if (!result) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Exam not found' }, timestamp: new Date().toISOString() });
    return reply.send({ success: true, data: { id }, timestamp: new Date().toISOString() });
  });

  // DELETE /admin/exams/:id — delete an exam
  fastify.delete('/exams/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const deleted = await examRepository.delete(id);
    if (!deleted) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Exam not found' }, timestamp: new Date().toISOString() });
    return reply.send({ success: true, data: { id }, timestamp: new Date().toISOString() });
  });

  // GET /admin/exams — List all exams (admin view)
  fastify.get('/exams', async (request: FastifyRequest, reply: FastifyReply) => {
    const { page, pageSize } = request.query as { page?: string; pageSize?: string };
    const parsedPage = parseInt(page ?? '1', 10);
    const parsedPageSize = parseInt(pageSize ?? '50', 10);
    const safePage = Number.isNaN(parsedPage) ? 1 : Math.max(parsedPage, 1);
    const safePageSize = Number.isNaN(parsedPageSize) ? 50 : Math.min(Math.max(parsedPageSize, 1), 200);
    const result = await examRepository.findAll({
      page: safePage,
      pageSize: safePageSize,
    });
    return reply.send({ success: true, data: result.data, pagination: { total: result.total, page: result.page, pageSize: result.pageSize }, timestamp: new Date().toISOString() });
  });

  // GET /admin/exams/:id — Single exam
  fastify.get('/exams/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const exam = await examRepository.findById(id);
    if (!exam) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Exam not found' }, timestamp: new Date().toISOString() });
    return reply.send({ success: true, data: exam, timestamp: new Date().toISOString() });
  });

  // PATCH /admin/exams/:id/publish — Toggle publish (C2: with 404 guard)
  fastify.patch('/exams/:id/publish', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const exam = await examRepository.findById(id);
    if (!exam) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Exam not found' }, timestamp: new Date().toISOString() });
    }
    const isPublished = await examRepository.togglePublished(id);
    return reply.send({ success: true, data: { id, isPublished }, timestamp: new Date().toISOString() });
  });

  // ═══════════════════════════════════════════════════════
  // EXAM-SUBJECT MAPPINGS
  // ═══════════════════════════════════════════════════════

  // GET /admin/exams/:id/subjects — List exam subjects
  fastify.get('/exams/:id/subjects', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: examId } = request.params as { id: string };
    const mappings = await examSubjectRepository.findByExamId(examId);
    const allSubjects = await subjectRepository.findAll();
    const enriched = mappings.map((m) => ({
      ...m,
      subject: allSubjects.find((s) => s.id === m.subjectId) ?? null,
    }));
    return reply.send({ success: true, data: enriched, timestamp: new Date().toISOString() });
  });

  // PATCH /admin/exams/:id/subjects/:subjectId/order
  fastify.patch('/exams/:id/subjects/:subjectId/order', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: examId, subjectId } = request.params as { id: string; subjectId: string };
    const { order } = reorderSchema.parse(request.body);
    const ok = await examSubjectRepository.reorder(examId, subjectId, order);
    if (!ok) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Mapping not found' }, timestamp: new Date().toISOString() });
    return reply.send({ success: true, data: { examId, subjectId, order }, timestamp: new Date().toISOString() });
  });
}
