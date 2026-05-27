// ─── Custom Test Routes — Educator (server-institute) ─────────────
// CRUD for custom tests, question management, submissions, and analytics.
// Educators can manage tests for their institute.
// Institute admins have full visibility across all educators.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { customTestRepository, subjectRepository, topicRepository } from '@kd/db';
import { requireInstituteRole } from '../middleware/auth.js';

// ─── Schemas ──────────────────────────────────────────────────────

const QuestionSchema = z.object({
  id: z.string().optional(),   // auto-generated if omitted
  text: z.string().min(1),
  imageUrl: z.string().url().optional().nullable(),
  options: z.array(z.object({ id: z.string(), text: z.string() })).min(2).max(5),
  correctAnswerId: z.string(),
  explanation: z.string().optional().nullable(),
  marks: z.number().int().positive().default(4),
  topicSlug: z.string().optional().nullable(),
  source: z.enum(['custom', 'pool', 'ai']).default('custom'),
  poolQuestionId: z.string().optional().nullable(),
});

const CreateTestSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().default(''),
  subjectId: z.string().min(1),
  topicIds: z.array(z.string()).default([]),
  durationMinutes: z.number().int().min(5).max(480),
  scheduledAt: z.string().datetime().optional().nullable(),
  closesAt: z.string().datetime().optional().nullable(),
  settings: z.object({
    shuffleQuestions: z.boolean().default(true),
    showResults: z.enum(['immediate', 'after_close', 'manual']).default('immediate'),
    negativeMarking: z.boolean().default(false),
    negativeMarkValue: z.number().min(0).default(0),
    passingScore: z.number().min(0).max(100).default(60),
  }).optional(),
  questions: z.array(QuestionSchema).optional(),
});

const UpdateTestSchema = CreateTestSchema.partial();

const AddQuestionsSchema = z.object({
  questions: z.array(QuestionSchema).min(1),
  replace: z.boolean().default(false),   // true = overwrite, false = append
});

const PoolQuerySchema = z.object({
  subjectId: z.string().min(1),
  topicSlug: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const SubmissionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// ─── Helpers ──────────────────────────────────────────────────────

function ensureQuestionsHaveIds(questions: z.infer<typeof QuestionSchema>[]) {
  return questions.map(q => ({
    ...q,
    id: q.id ?? crypto.randomUUID(),
  }));
}

function notFound(reply: FastifyReply) {
  return reply.status(404).send({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Test not found' },
    timestamp: new Date().toISOString(),
  });
}

// ─── Route Registration ───────────────────────────────────────────

export async function customTestRoutes(fastify: FastifyInstance): Promise<void> {

  // ── GET /institutes/:instituteId/content/subjects — List all subjects with their topics ─
  // Used by the test creator UI to populate subject dropdown + per-question topic selectors.
  fastify.get<{ Params: { instituteId: string } }>(
    '/institutes/:instituteId/content/subjects',
    { preHandler: [requireInstituteRole('institute_admin', 'educator', 'examiner')] },
    async (_request, reply) => {
      const subjects = await subjectRepository.findAll();

      // Fetch topics in parallel for each subject
      const withTopics = await Promise.all(
        subjects.map(async (s) => {
          const topics = await topicRepository.findBySubjectId(s.id);
          return {
            id: s.id,
            name: s.name,
            accent: s.accent ?? null,
            topics: topics.map(t => ({ slug: t.slug, displayName: t.displayName })),
          };
        }),
      );

      return reply.send({ success: true, data: withTopics, timestamp: new Date().toISOString() });
    },
  );


  // ── GET /institutes/:instituteId/tests — List tests ───────────
  fastify.get<{ Params: { instituteId: string }; Querystring: unknown }>(
    '/institutes/:instituteId/tests',
    { preHandler: [requireInstituteRole('institute_admin', 'educator', 'examiner')] },
    async (request: FastifyRequest<{ Params: { instituteId: string } }>, reply: FastifyReply) => {
      const { instituteId } = request.params;
      const query = SubmissionsQuerySchema.parse(request.query);

      // Educators only see their own tests; institute_admin sees all
      const createdBy = request.user!.instituteRole === 'educator'
        ? request.user!.id
        : undefined;

      const result = await customTestRepository.findByInstituteId(instituteId, {
        createdBy,
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

  // ── POST /institutes/:instituteId/tests — Create test ─────────
  fastify.post<{ Params: { instituteId: string }; Body: unknown }>(
    '/institutes/:instituteId/tests',
    { preHandler: [requireInstituteRole('institute_admin', 'educator')] },
    async (request, reply) => {
      const { instituteId } = request.params as { instituteId: string };
      const body = CreateTestSchema.parse(request.body);

      const questions = body.questions ? ensureQuestionsHaveIds(body.questions) : [];

      const test = await customTestRepository.create({
        instituteId,
        createdBy: request.user!.id,
        title: body.title,
        description: body.description,
        subjectId: body.subjectId,
        topicIds: body.topicIds,
        durationMinutes: body.durationMinutes,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
        closesAt: body.closesAt ? new Date(body.closesAt) : null,
        settings: body.settings,
        questions: questions as import('@kd/shared').CustomTestQuestion[],
      });

      return reply.status(201).send({
        success: true,
        data: test,
        timestamp: new Date().toISOString(),
      });
    },
  );

  // ── GET /institutes/:instituteId/tests/:testId — Get test ─────
  fastify.get<{ Params: { instituteId: string; testId: string } }>(
    '/institutes/:instituteId/tests/:testId',
    { preHandler: [requireInstituteRole('institute_admin', 'educator', 'examiner')] },
    async (request, reply) => {
      const { instituteId, testId } = request.params;
      const test = await customTestRepository.findById(testId);
      if (!test || test.instituteId !== instituteId) return notFound(reply);
      return reply.send({ success: true, data: test, timestamp: new Date().toISOString() });
    },
  );

  // ── PATCH /institutes/:instituteId/tests/:testId — Update test ─
  fastify.patch<{ Params: { instituteId: string; testId: string }; Body: unknown }>(
    '/institutes/:instituteId/tests/:testId',
    { preHandler: [requireInstituteRole('institute_admin', 'educator')] },
    async (request, reply) => {
      const { instituteId, testId } = request.params as { instituteId: string; testId: string };
      const body = UpdateTestSchema.parse(request.body);

      const existing = await customTestRepository.findById(testId);
      if (!existing || existing.instituteId !== instituteId) return notFound(reply);

      // Educators can only edit their own tests
      if (request.user!.instituteRole === 'educator' && existing.createdBy !== request.user!.id) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You can only edit your own tests' },
          timestamp: new Date().toISOString(),
        });
      }

      // Cannot edit a live or closed test
      if (['live', 'closed', 'graded'].includes(existing.status)) {
        return reply.status(409).send({
          success: false,
          error: { code: 'TEST_LOCKED', message: 'Cannot edit a published or live test' },
          timestamp: new Date().toISOString(),
        });
      }

      const questions = body.questions ? ensureQuestionsHaveIds(body.questions) : undefined;
      const updated = await customTestRepository.update(testId, instituteId, {
        title: body.title,
        description: body.description,
        subjectId: body.subjectId,
        topicIds: body.topicIds,
        durationMinutes: body.durationMinutes,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
        closesAt: body.closesAt ? new Date(body.closesAt) : undefined,
        settings: body.settings,
        questions: questions as import('@kd/shared').CustomTestQuestion[] | undefined,
      });

      return reply.send({ success: true, data: updated, timestamp: new Date().toISOString() });
    },
  );

  // ── POST /institutes/:instituteId/tests/:testId/questions — Add questions ─
  fastify.post<{ Params: { instituteId: string; testId: string }; Body: unknown }>(
    '/institutes/:instituteId/tests/:testId/questions',
    { preHandler: [requireInstituteRole('institute_admin', 'educator')] },
    async (request, reply) => {
      const { instituteId, testId } = request.params as { instituteId: string; testId: string };
      const body = AddQuestionsSchema.parse(request.body);

      const existing = await customTestRepository.findById(testId);
      if (!existing || existing.instituteId !== instituteId) return notFound(reply);
      if (['live', 'closed', 'graded'].includes(existing.status)) {
        return reply.status(409).send({
          success: false,
          error: { code: 'TEST_LOCKED', message: 'Cannot add questions to a live test' },
          timestamp: new Date().toISOString(),
        });
      }

      const newQuestions = ensureQuestionsHaveIds(body.questions) as import('@kd/shared').CustomTestQuestion[];
      const merged = body.replace ? newQuestions : [...existing.questions, ...newQuestions];

      const updated = await customTestRepository.update(testId, instituteId, { questions: merged });
      return reply.send({ success: true, data: updated, timestamp: new Date().toISOString() });
    },
  );

  // ── GET /institutes/:instituteId/pool/questions — Browse question pool ─
  fastify.get<{ Params: { instituteId: string }; Querystring: unknown }>(
    '/institutes/:instituteId/pool/questions',
    { preHandler: [requireInstituteRole('institute_admin', 'educator', 'examiner')] },
    async (request, reply) => {
      const query = PoolQuerySchema.parse(request.query);
      const questions = await customTestRepository.searchQuestionPool(
        query.subjectId,
        query.topicSlug,
        query.limit,
      );
      return reply.send({ success: true, data: questions, timestamp: new Date().toISOString() });
    },
  );

  // ── POST /institutes/:instituteId/tests/:testId/publish — Publish ─
  fastify.post<{ Params: { instituteId: string; testId: string } }>(
    '/institutes/:instituteId/tests/:testId/publish',
    { preHandler: [requireInstituteRole('institute_admin', 'educator')] },
    async (request, reply) => {
      const { instituteId, testId } = request.params;
      const test = await customTestRepository.findById(testId);
      if (!test || test.instituteId !== instituteId) return notFound(reply);

      if (test.questions.length === 0) {
        return reply.status(422).send({
          success: false,
          error: { code: 'NO_QUESTIONS', message: 'Test must have at least one question before publishing' },
          timestamp: new Date().toISOString(),
        });
      }

      const published = await customTestRepository.publish(testId, instituteId);
      return reply.send({ success: true, data: published, timestamp: new Date().toISOString() });
    },
  );

  // ── DELETE /institutes/:instituteId/tests/:testId — Delete test ─
  fastify.delete<{ Params: { instituteId: string; testId: string } }>(
    '/institutes/:instituteId/tests/:testId',
    { preHandler: [requireInstituteRole('institute_admin', 'educator')] },
    async (request, reply) => {
      const { instituteId, testId } = request.params;
      const test = await customTestRepository.findById(testId);
      if (!test || test.instituteId !== instituteId) return notFound(reply);

      if (request.user!.instituteRole === 'educator' && test.createdBy !== request.user!.id) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You can only delete your own tests' },
          timestamp: new Date().toISOString(),
        });
      }

      await customTestRepository.delete(testId, instituteId);
      return reply.send({ success: true, data: { deleted: true }, timestamp: new Date().toISOString() });
    },
  );

  // ── GET /institutes/:instituteId/tests/:testId/submissions — All submissions ─
  fastify.get<{ Params: { instituteId: string; testId: string }; Querystring: unknown }>(
    '/institutes/:instituteId/tests/:testId/submissions',
    { preHandler: [requireInstituteRole('institute_admin', 'educator')] },
    async (request, reply) => {
      const { instituteId, testId } = request.params as { instituteId: string; testId: string };
      const query = SubmissionsQuerySchema.parse(request.query);

      const test = await customTestRepository.findById(testId);
      if (!test || test.instituteId !== instituteId) return notFound(reply);

      const result = await customTestRepository.findSubmissionsByTest(testId, {
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

  // ── GET /institutes/:instituteId/tests/:testId/analytics — Analytics ─
  fastify.get<{ Params: { instituteId: string; testId: string } }>(
    '/institutes/:instituteId/tests/:testId/analytics',
    { preHandler: [requireInstituteRole('institute_admin', 'educator')] },
    async (request, reply) => {
      const { instituteId, testId } = request.params;
      const test = await customTestRepository.findById(testId);
      if (!test || test.instituteId !== instituteId) return notFound(reply);

      const analytics = await customTestRepository.getTestAnalytics(testId);
      return reply.send({ success: true, data: analytics, timestamp: new Date().toISOString() });
    },
  );
}
