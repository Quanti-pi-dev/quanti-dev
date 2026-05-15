// ─── Institute Test Routes — Student (server-user) ────────────────
// Student-facing endpoints to list, start, submit, and review
// both custom tests (educator-made) and mock tests (examiner-made).

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { customTestRepository, instituteMockTestRepository, instituteService } from '@kd/db';

// ─── Schemas ──────────────────────────────────────────────────────

const AnswerSchema = z.object({
  questionId: z.string(),
  selectedOptionId: z.string().nullable(),
  timeSpentMs: z.number().int().min(0).default(0),
});

const SubmitSchema = z.object({
  answers: z.array(AnswerSchema),
  timeTakenSeconds: z.number().int().min(0),
});

const ListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// ─── Helpers ──────────────────────────────────────────────────────

async function assertMembership(request: FastifyRequest, reply: FastifyReply, instituteId: string): Promise<boolean> {
  const { getPostgresPool } = await import('@kd/db');
  const pg = getPostgresPool();
  const check = await pg.query(
    `SELECT 1 FROM institute_members
     WHERE institute_id = $1 AND firebase_uid = $2 AND is_active = TRUE`,
    [instituteId, request.user!.id],
  );
  if (check.rows.length === 0) {
    reply.status(403).send({
      success: false,
      error: { code: 'NOT_A_MEMBER', message: 'You are not a member of this institute' },
      timestamp: new Date().toISOString(),
    });
    return false;
  }
  return true;
}

// ─── Route Registration ───────────────────────────────────────────

export async function instituteTestRoutes(fastify: FastifyInstance): Promise<void> {

  // ── GET /institute/:instituteId/tests — List assigned tests ───
  fastify.get<{ Params: { instituteId: string }; Querystring: unknown }>(
    '/institute/:instituteId/tests',
    async (request: FastifyRequest<{ Params: { instituteId: string } }>, reply: FastifyReply) => {
      if (!request.user) return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED' }, timestamp: new Date().toISOString() });
      const { instituteId } = request.params;
      if (!await assertMembership(request, reply, instituteId)) return;

      const query = ListQuerySchema.parse(request.query);
      const result = await customTestRepository.findAssignedToStudent(instituteId, {
        limit: query.limit,
        offset: query.offset,
      });

      // Sanitize: strip correct answers before sending to students
      const sanitized = result.data.map(t => ({
        ...t,
        questions: t.questions.map(q => ({
          id: q.id,
          text: q.text,
          imageUrl: q.imageUrl,
          options: q.options,
          marks: q.marks,
          topicSlug: q.topicSlug,
          // correctAnswerId intentionally omitted
        })),
      }));

      return reply.send({
        success: true,
        data: sanitized,
        pagination: { total: result.total, limit: query.limit, offset: query.offset },
        timestamp: new Date().toISOString(),
      });
    },
  );

  // ── GET /institute/:instituteId/tests/:testId — Get test details ─
  fastify.get<{ Params: { instituteId: string; testId: string } }>(
    '/institute/:instituteId/tests/:testId',
    async (request: FastifyRequest<{ Params: { instituteId: string; testId: string } }>, reply: FastifyReply) => {
      if (!request.user) return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED' }, timestamp: new Date().toISOString() });
      const { instituteId, testId } = request.params;
      if (!await assertMembership(request, reply, instituteId)) return;

      const test = await customTestRepository.findById(testId);
      if (!test || test.instituteId !== instituteId || !test.isPublished) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Test not found' }, timestamp: new Date().toISOString() });
      }

      // Strip correct answers
      const sanitized = {
        ...test,
        questions: test.questions.map(q => ({
          id: q.id, text: q.text, imageUrl: q.imageUrl,
          options: q.options, marks: q.marks, topicSlug: q.topicSlug,
        })),
      };

      return reply.send({ success: true, data: sanitized, timestamp: new Date().toISOString() });
    },
  );

  // ── POST /institute/:instituteId/tests/:testId/start — Begin attempt ─
  fastify.post<{ Params: { instituteId: string; testId: string } }>(
    '/institute/:instituteId/tests/:testId/start',
    async (request: FastifyRequest<{ Params: { instituteId: string; testId: string } }>, reply: FastifyReply) => {
      if (!request.user) return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED' }, timestamp: new Date().toISOString() });
      const { instituteId, testId } = request.params;
      if (!await assertMembership(request, reply, instituteId)) return;

      const test = await customTestRepository.findById(testId);
      if (!test || test.instituteId !== instituteId || !test.isPublished) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' }, timestamp: new Date().toISOString() });
      }
      if (test.status === 'closed' || test.status === 'graded') {
        return reply.status(410).send({
          success: false,
          error: { code: 'TEST_CLOSED', message: 'This test is no longer accepting submissions' },
          timestamp: new Date().toISOString(),
        });
      }

      const submission = await customTestRepository.startSubmission({
        testId,
        studentId: request.user.id,
        instituteId,
      });

      return reply.status(201).send({
        success: true,
        data: {
          submissionId: submission.id,
          startedAt: submission.startedAt,
          durationMinutes: test.durationMinutes,
          questionCount: test.questions.length,
        },
        timestamp: new Date().toISOString(),
      });
    },
  );

  // ── POST /institute/:instituteId/tests/:testId/submit — Submit answers ─
  fastify.post<{ Params: { instituteId: string; testId: string }; Body: unknown }>(
    '/institute/:instituteId/tests/:testId/submit',
    async (request: FastifyRequest<{ Params: { instituteId: string; testId: string }; Body: unknown }>, reply: FastifyReply) => {
      if (!request.user) return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED' }, timestamp: new Date().toISOString() });
      const { instituteId, testId } = request.params;
      if (!await assertMembership(request, reply, instituteId)) return;

      const body = SubmitSchema.parse(request.body);

      const submission = await customTestRepository.submitAnswers({
        testId,
        studentId: request.user.id,
        answers: body.answers,
        timeTakenSeconds: body.timeTakenSeconds,
      });

      // Update institute leaderboard with test score
      await instituteService.addTestScore(instituteId, testId, request.user.id, submission.score);

      return reply.send({ success: true, data: submission, timestamp: new Date().toISOString() });
    },
  );

  // ── GET /institute/:instituteId/tests/:testId/result — View result ─
  fastify.get<{ Params: { instituteId: string; testId: string } }>(
    '/institute/:instituteId/tests/:testId/result',
    async (request: FastifyRequest<{ Params: { instituteId: string; testId: string } }>, reply: FastifyReply) => {
      if (!request.user) return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED' }, timestamp: new Date().toISOString() });
      const { instituteId, testId } = request.params;
      if (!await assertMembership(request, reply, instituteId)) return;

      const test = await customTestRepository.findById(testId);
      if (!test || test.instituteId !== instituteId) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' }, timestamp: new Date().toISOString() });
      }

      const submission = await customTestRepository.findSubmission(testId, request.user.id);
      if (!submission || submission.status === 'in_progress') {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_SUBMITTED', message: 'You have not submitted this test yet' },
          timestamp: new Date().toISOString(),
        });
      }

      // Check if results are visible according to settings
      const showResults = test.settings.showResults;
      const isHidden = showResults === 'after_close' && test.status !== 'closed' && test.status !== 'graded';
      const isManualHidden = showResults === 'manual' && test.status !== 'graded';

      if (isHidden || isManualHidden) {
        return reply.send({
          success: true,
          data: {
            submission: { id: submission.id, status: submission.status, submittedAt: submission.submittedAt },
            message: 'Results will be available after the test closes',
            resultsAvailable: false,
          },
          timestamp: new Date().toISOString(),
        });
      }

      // Enrich with correct answers for review
      const questionMap = new Map(test.questions.map(q => [q.id, q]));
      const reviewAnswers = submission.answers.map(a => {
        const q = questionMap.get(a.questionId);
        return {
          ...a,
          correctAnswerId: q?.correctAnswerId ?? null,
          explanation: q?.explanation ?? null,
          marks: q?.marks ?? 0,
          isCorrect: q ? a.selectedOptionId === q.correctAnswerId : false,
        };
      });

      return reply.send({
        success: true,
        data: {
          submission: { ...submission, answers: reviewAnswers },
          test: {
            title: test.title,
            totalMarks: submission.totalMarks,
            passingScore: test.settings.passingScore,
            passed: submission.score >= (test.settings.passingScore / 100) * submission.totalMarks,
          },
          resultsAvailable: true,
        },
        timestamp: new Date().toISOString(),
      });
    },
  );

  // ── GET /institute/:instituteId/mock-tests — List assigned mock tests ─
  fastify.get<{ Params: { instituteId: string }; Querystring: unknown }>(
    '/institute/:instituteId/mock-tests',
    async (request: FastifyRequest<{ Params: { instituteId: string } }>, reply: FastifyReply) => {
      if (!request.user) return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED' }, timestamp: new Date().toISOString() });
      const { instituteId } = request.params;
      if (!await assertMembership(request, reply, instituteId)) return;

      const query = ListQuerySchema.parse(request.query);
      const result = await instituteMockTestRepository.findByInstituteId(instituteId, {
        status: 'live',
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
}
