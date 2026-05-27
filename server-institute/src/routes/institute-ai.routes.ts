// ─── Institute AI Routes ─────────────────────────────────────
// AI-powered question generation for institute educators.
// Generates quiz questions that can be directly imported into custom tests.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { generateQuizQuestions } from '@kd/db';
import { requireInstituteRole } from '../middleware/auth.js';

// ─── Schemas ────────────────────────────────────────────────

const GenerateQuestionsSchema = z.object({
  topic: z.string().min(1).max(200),
  subject: z.string().min(1).max(100),
  count: z.number().int().min(1).max(20).default(5),
  difficulty: z.enum(['easy', 'medium', 'hard', 'mixed']).default('mixed'),
  examContext: z.string().max(100).optional(),
  marksPerQuestion: z.number().int().min(1).max(10).default(4),
  instructions: z.string().max(500).optional(),
});

// ─── Route Registration ─────────────────────────────────────

export async function instituteAIRoutes(fastify: FastifyInstance): Promise<void> {

  // ── POST /institutes/:instituteId/ai/generate-questions ──
  // Generate quiz questions via AI for use in custom tests.
  // Educators and institute_admins can access this.
  fastify.post<{ Params: { instituteId: string }; Body: unknown }>(
    '/institutes/:instituteId/ai/generate-questions',
    { preHandler: [requireInstituteRole('institute_admin', 'educator')] },
    async (request: FastifyRequest<{ Params: { instituteId: string } }>, reply: FastifyReply) => {
      const body = GenerateQuestionsSchema.parse(request.body);

      try {
        const result = await generateQuizQuestions({
          topic: body.topic,
          subject: body.subject,
          count: body.count,
          difficulty: body.difficulty,
          examContext: body.examContext,
          marksPerQuestion: body.marksPerQuestion,
          instructions: body.instructions,
        });

        // Map to CustomTestQuestion-compatible format with IDs
        const questions = result.questions.map(q => ({
          id: crypto.randomUUID(),
          text: q.text,
          imageUrl: null,
          options: q.options,
          correctAnswerId: q.correctAnswerId,
          explanation: q.explanation,
          marks: q.marks,
          topicSlug: null,
          source: 'ai' as const,
          poolQuestionId: null,
        }));

        return reply.send({
          success: true,
          data: {
            questions,
            generatedCount: questions.length,
            generatedAt: result.generatedAt,
          },
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Question generation failed';
        fastify.log.error({ err }, 'AI question generation error');
        return reply.status(502).send({
          success: false,
          error: { code: 'AI_GENERATION_FAILED', message },
          timestamp: new Date().toISOString(),
        });
      }
    },
  );
}
