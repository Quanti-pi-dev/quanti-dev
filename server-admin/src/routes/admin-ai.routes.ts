// ─── Admin AI Routes ─────────────────────────────────────────
// AI-powered content generation endpoints for the admin dashboard.
// Includes flashcard generation, quiz generation, and AI health checks.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  generateFlashcards,
  generateQuizQuestions,
  flashcardRepository,
} from '@kd/db';

// ─── Schemas ────────────────────────────────────────────────

const GenerateFlashcardsSchema = z.object({
  topic: z.string().min(1).max(200),
  subject: z.string().min(1).max(100),
  level: z.enum(['Emerging', 'Developing', 'Proficient', 'Master']),
  count: z.number().int().min(1).max(20).default(5),
  examContext: z.string().max(100).optional(),
  instructions: z.string().max(500).optional(),
  /** If provided, generated cards are auto-inserted into this deck */
  deckId: z.string().optional(),
});

const GenerateQuizSchema = z.object({
  topic: z.string().min(1).max(200),
  subject: z.string().min(1).max(100),
  count: z.number().int().min(1).max(30).default(10),
  difficulty: z.enum(['easy', 'medium', 'hard', 'mixed']).default('mixed'),
  examContext: z.string().max(100).optional(),
  marksPerQuestion: z.number().int().min(1).max(10).default(4),
  instructions: z.string().max(500).optional(),
});

// ─── Route Registration ─────────────────────────────────────

export async function adminAIRoutes(fastify: FastifyInstance): Promise<void> {

  // ── POST /admin/ai/generate-flashcards — Generate flashcards via AI ──
  // Returns the generated cards. Optionally auto-inserts them into a deck.
  fastify.post('/ai/generate-flashcards', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = GenerateFlashcardsSchema.parse(request.body);

    try {
      const result = await generateFlashcards({
        topic: body.topic,
        subject: body.subject,
        level: body.level,
        count: body.count,
        examContext: body.examContext,
        instructions: body.instructions,
      });

      // Auto-insert into deck if deckId is provided
      let insertedCount = 0;
      if (body.deckId) {
        const cardsToInsert = result.cards.map(c => ({
          question: c.question,
          options: c.options,
          correctAnswerId: c.correctAnswerId,
          explanation: c.explanation,
          source: 'ai_generated' as const,
        }));

        insertedCount = await flashcardRepository.bulkCreate(body.deckId, cardsToInsert);
      }

      return reply.send({
        success: true,
        data: {
          cards: result.cards,
          generatedCount: result.cards.length,
          insertedCount,
          deckId: body.deckId ?? null,
          generatedAt: result.generatedAt,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Flashcard generation failed';
      fastify.log.error({ err }, 'Flashcard generation error');
      return reply.status(502).send({
        success: false,
        error: { code: 'AI_GENERATION_FAILED', message },
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ── POST /admin/ai/generate-quiz — Generate quiz questions via AI ──
  // Returns the generated questions in CustomTestQuestion-compatible format.
  fastify.post('/ai/generate-quiz', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = GenerateQuizSchema.parse(request.body);

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

      return reply.send({
        success: true,
        data: {
          questions: result.questions,
          generatedCount: result.questions.length,
          generatedAt: result.generatedAt,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Quiz generation failed';
      fastify.log.error({ err }, 'Quiz generation error');
      return reply.status(502).send({
        success: false,
        error: { code: 'AI_GENERATION_FAILED', message },
        timestamp: new Date().toISOString(),
      });
    }
  });
}
