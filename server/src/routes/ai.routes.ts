// ─── AI Routes ───────────────────────────────────────────────
// Recommendations, Gemini-powered learning insights, and live card explanations.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth } from '../middleware/rbac.js';
import { recommendationService } from '../services/ai.service.js';
import { geminiGenerate } from '../lib/gemini.js';
import { getMongoDb } from '../lib/database.js';
import { ObjectId } from 'mongodb';

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
        data: { explanation: explanation.trim() },
      });
    } catch (err) {
      // Return a proper error so the client can distinguish a real AI response
      // from a Gemini failure and fall back to the seed explanation on its own.
      fastify.log.warn({ err, cardId }, 'Gemini explain failed — returning 502 to client');
      return reply.status(502).send({
        success: false,
        message: 'AI explanation temporarily unavailable. Please try again.',
      });
    }
  });
}

// ─── Prompts ─────────────────────────────────────────────────

const EXPLAIN_SYSTEM_PROMPT = `You are a concise, expert study tutor for competitive exams (JEE, NEET, GATE).
When given a multiple-choice question and its correct answer, explain WHY that answer is correct in 2-4 sentences.
- Focus on the conceptual reasoning, not just restating the answer.
- Use plain language suitable for a student learning this topic.
- Do not start with "The correct answer is..." — start directly with the explanation.
- Do not use markdown, bullet points, or headers. Plain prose only.`;
