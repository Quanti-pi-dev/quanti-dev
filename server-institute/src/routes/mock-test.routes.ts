// ─── Mock Test Routes — Examiner (server-institute) ──────────────
// CRUD for institute mock tests that mirror official exam formats.
// Examiners create; students take via server-user.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { instituteMockTestRepository } from '@kd/db';
import { requireInstituteRole } from '../middleware/auth.js';

// ─── Schemas ──────────────────────────────────────────────────────

const SectionSchema = z.object({
  subjectId: z.string().min(1),
  questionCount: z.number().int().positive(),
  questionIds: z.array(z.string()).default([]),
  marksPerCorrect: z.number().positive().default(4),
  marksPerIncorrect: z.number().default(-1),
});

const CreateMockTestSchema = z.object({
  examTemplateId: z.string().min(1),
  examTemplateName: z.string().optional(),
  title: z.string().min(2).max(200),
  sections: z.array(SectionSchema).min(1),
  durationMinutes: z.number().int().min(30).max(600),
  scheduledAt: z.string().datetime().optional().nullable(),
  closesAt: z.string().datetime().optional().nullable(),
  settings: z.object({
    sectionSwitching: z.boolean().default(false),
    calculatorAllowed: z.boolean().default(false),
  }).optional(),
});

const UpdateMockTestSchema = CreateMockTestSchema.partial().omit({ examTemplateId: true });

const ListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

function notFound(reply: FastifyReply) {
  return reply.status(404).send({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Mock test not found' },
    timestamp: new Date().toISOString(),
  });
}

// ─── Route Registration ───────────────────────────────────────────

export async function mockTestRoutes(fastify: FastifyInstance): Promise<void> {

  // ── GET /institutes/:instituteId/mock-tests — List ────────────
  fastify.get<{ Params: { instituteId: string }; Querystring: unknown }>(
    '/institutes/:instituteId/mock-tests',
    { preHandler: [requireInstituteRole('institute_admin', 'educator', 'examiner')] },
    async (request: FastifyRequest<{ Params: { instituteId: string } }>, reply: FastifyReply) => {
      const { instituteId } = request.params;
      const query = ListQuerySchema.parse(request.query);
      const result = await instituteMockTestRepository.findByInstituteId(instituteId, {
        limit: query.limit,
        offset: query.offset,
      });
      return reply.send({
        success: true,
        data: result.data,
        pagination: { total: result.total, limit: query.limit, offset: query.offset },
        timestamp: new Date().toISOString(),
      });
    },
  );

  // ── POST /institutes/:instituteId/mock-tests — Create ─────────
  fastify.post<{ Params: { instituteId: string }; Body: unknown }>(
    '/institutes/:instituteId/mock-tests',
    { preHandler: [requireInstituteRole('institute_admin', 'examiner')] },
    async (request, reply) => {
      const { instituteId } = request.params as { instituteId: string };
      const body = CreateMockTestSchema.parse(request.body);

      const test = await instituteMockTestRepository.create({
        instituteId,
        createdBy: request.user!.id,
        examTemplateId: body.examTemplateId,
        examTemplateName: body.examTemplateName,
        title: body.title,
        sections: body.sections,
        durationMinutes: body.durationMinutes,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
        closesAt: body.closesAt ? new Date(body.closesAt) : null,
        settings: body.settings,
      });

      return reply.status(201).send({
        success: true,
        data: test,
        timestamp: new Date().toISOString(),
      });
    },
  );

  // ── GET /institutes/:instituteId/mock-tests/:testId — Get ─────
  fastify.get<{ Params: { instituteId: string; testId: string } }>(
    '/institutes/:instituteId/mock-tests/:testId',
    { preHandler: [requireInstituteRole('institute_admin', 'educator', 'examiner')] },
    async (request, reply) => {
      const { instituteId, testId } = request.params;
      const test = await instituteMockTestRepository.findById(testId);
      if (!test || test.instituteId !== instituteId) return notFound(reply);
      return reply.send({ success: true, data: test, timestamp: new Date().toISOString() });
    },
  );

  // ── PATCH /institutes/:instituteId/mock-tests/:testId — Update ─
  fastify.patch<{ Params: { instituteId: string; testId: string }; Body: unknown }>(
    '/institutes/:instituteId/mock-tests/:testId',
    { preHandler: [requireInstituteRole('institute_admin', 'examiner')] },
    async (request, reply) => {
      const { instituteId, testId } = request.params as { instituteId: string; testId: string };
      const body = UpdateMockTestSchema.parse(request.body);

      const existing = await instituteMockTestRepository.findById(testId);
      if (!existing || existing.instituteId !== instituteId) return notFound(reply);

      if (['live', 'closed'].includes(existing.status)) {
        return reply.status(409).send({
          success: false,
          error: { code: 'TEST_LOCKED', message: 'Cannot edit a live or closed mock test' },
          timestamp: new Date().toISOString(),
        });
      }

      const updated = await instituteMockTestRepository.update(testId, instituteId, {
        title: body.title,
        sections: body.sections,
        durationMinutes: body.durationMinutes,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
        closesAt: body.closesAt ? new Date(body.closesAt) : undefined,
        settings: body.settings,
      });

      return reply.send({ success: true, data: updated, timestamp: new Date().toISOString() });
    },
  );

  // ── POST /institutes/:instituteId/mock-tests/:testId/publish — Publish ─
  fastify.post<{ Params: { instituteId: string; testId: string } }>(
    '/institutes/:instituteId/mock-tests/:testId/publish',
    { preHandler: [requireInstituteRole('institute_admin', 'examiner')] },
    async (request, reply) => {
      const { instituteId, testId } = request.params;
      const test = await instituteMockTestRepository.findById(testId);
      if (!test || test.instituteId !== instituteId) return notFound(reply);

      // Validate sections are filled
      const emptySection = test.sections.find(s => s.questionIds.length === 0);
      if (emptySection) {
        return reply.status(422).send({
          success: false,
          error: {
            code: 'EMPTY_SECTION',
            message: `Section for subject ${emptySection.subjectId} has no questions assigned`,
          },
          timestamp: new Date().toISOString(),
        });
      }

      const published = await instituteMockTestRepository.publish(testId, instituteId);
      return reply.send({ success: true, data: published, timestamp: new Date().toISOString() });
    },
  );

  // ── DELETE /institutes/:instituteId/mock-tests/:testId — Delete ─
  fastify.delete<{ Params: { instituteId: string; testId: string } }>(
    '/institutes/:instituteId/mock-tests/:testId',
    { preHandler: [requireInstituteRole('institute_admin', 'examiner')] },
    async (request, reply) => {
      const { instituteId, testId } = request.params;
      const test = await instituteMockTestRepository.findById(testId);
      if (!test || test.instituteId !== instituteId) return notFound(reply);

      await instituteMockTestRepository.delete(testId, instituteId);
      return reply.send({ success: true, data: { deleted: true }, timestamp: new Date().toISOString() });
    },
  );
}
