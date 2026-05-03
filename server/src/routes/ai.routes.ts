// ─── AI Routes ───────────────────────────────────────────────
// Recommendations, Gemini-powered learning insights, and live card explanations.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth } from '../middleware/rbac.js';
import { recommendationService } from '../services/ai.service.js';
import { geminiGenerate } from '../lib/gemini.js';
import { generateTargetedFeedback } from '../services/targeted-feedback.service.js';
import { getMongoDb } from '../lib/database.js';
import { ObjectId } from 'mongodb';
import type { Flashcard } from '@kd/shared';

export async function aiRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireAuth());

  // ─── GET /ai/recommendations ─────────────────────────────
  // Returns personalized deck recommendations based on accuracy + recency.
  fastify.get('/recommendations', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.id;
    const recommendations = await recommendationService.generateRecommendations(userId);
    return reply.send({
      success: true,
      data: recommendations,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── GET /ai/insights ────────────────────────────────────
  // Returns heuristic + Gemini-powered study insights.
  fastify.get('/insights', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.id;
    const insights = await recommendationService.generateInsights(userId);
    return reply.send({
      success: true,
      data: insights,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── POST /ai/explain ────────────────────────────────────
  // On-demand Gemini explanation for a specific flashcard.
  // Body: { cardId: string }
  // Returns: { explanation: string }
  //
  // Flow:
  //   1. Fetch the flashcard from MongoDB
  //   2. Build a subject-aware prompt with the question + correct answer
  //   3. Call Gemini with a focused tutor system prompt
  //   4. Return the explanation (client caches it locally per session)
  fastify.post('/explain', async (request: FastifyRequest, reply: FastifyReply) => {
    const { cardId } = request.body as { cardId?: string };

    if (!cardId || typeof cardId !== 'string') {
      return reply.status(400).send({ success: false, message: 'cardId is required' });
    }

    const db = getMongoDb();

    // Fetch the flashcard
    let cardDoc: Record<string, unknown> | null = null;
    try {
      cardDoc = await db.collection('flashcards').findOne({ _id: new ObjectId(cardId) }) as Record<string, unknown> | null;
    } catch {
      return reply.status(400).send({ success: false, message: 'Invalid cardId' });
    }

    if (!cardDoc) {
      return reply.status(404).send({ success: false, message: 'Card not found' });
    }

    // Build context: fetch the deck for subject/topic info
    const deckId = cardDoc['deckId'] as ObjectId | undefined;
    let context = '';
    if (deckId) {
      const deck = await db.collection('decks').findOne({ _id: deckId }) as Record<string, unknown> | null;
      if (deck) {
        const topic = (deck['topicSlug'] as string) ?? '';
        const level = (deck['level'] as string) ?? '';
        if (topic) context = `Topic: ${topic}${level ? ` (${level} level)` : ''}. `;
      }
    }

    // Find correct option text
    const options = cardDoc['options'] as Array<{ id: string; text: string }> | undefined;
    const correctId = cardDoc['correctAnswerId'] as string | undefined;
    const correctOption = options?.find((o) => o.id === correctId);
    const correctText = correctOption?.text ?? 'the correct answer';

    // Build prompt
    const question = cardDoc['question'] as string ?? '';
    const seedExplanation = cardDoc['explanation'] as string | null ?? null;

    const userPrompt = [
      context,
      `Question: ${question}`,
      `Correct answer: ${correctText}`,
      seedExplanation ? `Existing explanation hint: ${seedExplanation}` : '',
    ].filter(Boolean).join('\n');

    try {
      const explanation = await geminiGenerate({
        systemPrompt: EXPLAIN_SYSTEM_PROMPT,
        userPrompt,
        maxOutputTokens: 280,
        temperature: 0.35,
      });

      return reply.send({
        success: true,
        data: { explanation: explanation.trim(), source: 'gemini' },
      });
    } catch (err) {
      // Gemini unavailable (quota, network, etc.) — return seed explanation as fallback
      fastify.log.warn({ err, cardId }, 'Gemini explain failed — falling back to seed explanation');

      if (seedExplanation && seedExplanation.trim().length > 0) {
        return reply.send({
          success: true,
          data: { explanation: seedExplanation.trim(), source: 'seed' },
        });
      }

      return reply.status(502).send({
        success: false,
        message: 'AI explanation temporarily unavailable. Please try again.',
      });
    }
  });

  // ─── POST /ai/explain-wrong ──────────────────────────────
  // Targeted misconception-aware explanation for a wrong answer.
  // Body: { cardId: string, selectedOptionId: string }
  // Returns: { feedback: TargetedFeedback }
  //
  // This is the Socratic educator — it doesn't just say "X is right",
  // it says "you chose Y because you likely confused A with B".
  fastify.post('/explain-wrong', async (request: FastifyRequest, reply: FastifyReply) => {
    const { cardId, selectedOptionId } = request.body as {
      cardId?: string;
      selectedOptionId?: string;
    };

    if (!cardId || !selectedOptionId) {
      return reply.status(400).send({
        success: false,
        message: 'cardId and selectedOptionId are required',
      });
    }

    const db = getMongoDb();
    let cardDoc: Record<string, unknown> | null = null;
    try {
      cardDoc = await db.collection('flashcards').findOne({ _id: new ObjectId(cardId) }) as Record<string, unknown> | null;
    } catch {
      return reply.status(400).send({ success: false, message: 'Invalid cardId' });
    }

    if (!cardDoc) {
      return reply.status(404).send({ success: false, message: 'Card not found' });
    }

    // Map MongoDB doc to Flashcard shape for the service
    const card: Flashcard = {
      id: cardDoc['_id']!.toString(),
      deckId: (cardDoc['deckId'] as ObjectId)?.toString() ?? '',
      question: cardDoc['question'] as string ?? '',
      options: cardDoc['options'] as Flashcard['options'] ?? [],
      correctAnswerId: cardDoc['correctAnswerId'] as string ?? '',
      explanation: cardDoc['explanation'] as string | null ?? null,
      imageUrl: cardDoc['imageUrl'] as string | null ?? null,
      source: (cardDoc['source'] as Flashcard['source']) ?? 'original',
      tags: cardDoc['tags'] as string[] ?? [],
      createdAt: '',
      updatedAt: '',
    };

    const isCorrect = selectedOptionId === card.correctAnswerId;
    const feedback = await generateTargetedFeedback(card, selectedOptionId, isCorrect);

    if (!feedback) {
      return reply.send({
        success: true,
        data: { feedback: null, message: 'No targeted feedback needed for correct answers' },
      });
    }

    return reply.send({
      success: true,
      data: { feedback },
    });
  });
}

// ─── Prompts ─────────────────────────────────────────────────

const EXPLAIN_SYSTEM_PROMPT = `You are a concise, expert study tutor for competitive exams (JEE, NEET, GATE).
When given a multiple-choice question and its correct answer, explain WHY that answer is correct in 2-4 sentences.
- Focus on the conceptual reasoning, not just restating the answer.
- Use plain language suitable for a student learning this topic.
- Do not start with "The correct answer is..." — start directly with the explanation.
- You may use basic markdown: **bold** for key terms, *italic* for emphasis, and short bullet lists when listing steps.
- Do not use headers (#) or horizontal rules (---).
- Wrap ALL mathematical expressions, variables, equations, and units in LaTeX dollar-sign delimiters.
  Use $...$ for inline math (e.g. $v = u + at$) and $$...$$ for standalone equations on their own line.
- Examples of correct LaTeX: $F = ma$, $v^2 = u^2 + 2as$, $s = \\frac{1}{2}at^2$, $\\sqrt{2gh}$, $[LT^{-1}]$.`;
