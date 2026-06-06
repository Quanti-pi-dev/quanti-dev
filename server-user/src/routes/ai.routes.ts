// ─── AI Routes ───────────────────────────────────────────────
// Recommendations, Gemini-powered learning insights, and live card explanations.

import crypto from 'node:crypto';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/rbac.js';
import { recommendationService } from '@kd/db';
import { geminiGenerate } from '@kd/db';
import { generateTargetedFeedback } from '@kd/db';
import { getAIQuotaLimit, getAIQuotaStatus, checkAndIncrementAIQuota } from '@kd/db';
import { getMongoDb, getRedisClient } from '@kd/db';
import { ObjectId } from 'mongodb';
import type { Flashcard } from '@kd/shared';

export async function aiRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireAuth());

  // ─── GET /ai/quota ───────────────────────────────────────
  // Returns the current day's AI usage and limit for this user.
  fastify.get('/quota', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.id;
    const limit = await getAIQuotaLimit(userId);
    const status = await getAIQuotaStatus(userId, limit);

    return reply.send({
      success: true,
      data: {
        used: status.used,
        limit: status.limit,
        resetAt: status.resetAt.toISOString(),
        isExhausted: limit !== -1 && status.used >= limit,
      },
    });
  });

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
    const userId = request.user!.id;
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
      // ── Quota gate ──────────────────────────────────────────
      const limit = await getAIQuotaLimit(userId);
      const quota = await checkAndIncrementAIQuota(userId, limit);

      if (!quota.allowed) {
        return reply.status(429).send({
          success: false,
          code: 'AI_QUOTA_EXCEEDED',
          message: "You've used all your AI requests for today. Come back tomorrow!",
          data: {
            used: quota.used,
            limit: quota.limit,
            resetAt: quota.resetAt.toISOString(),
          },
        });
      }

      const explanation = await geminiGenerate({
        featureConfigKey: 'ai_model_explanation',
        systemPrompt: EXPLAIN_SYSTEM_PROMPT,
        userPrompt,
        maxOutputTokens: 280,
        temperature: 0.35,
      });

      return reply.send({
        success: true,
        data: { explanation: explanation.trim(), source: 'gemini' },
      });
    } catch (err: unknown) {
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
    const userId = request.user!.id;
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

    // ── Quota gate (wrong answers also count against daily cap) ──
    const limit = await getAIQuotaLimit(userId);
    const quota = await checkAndIncrementAIQuota(userId, limit);

    if (!quota.allowed) {
      return reply.status(429).send({
        success: false,
        code: 'AI_QUOTA_EXCEEDED',
        message: "You've used all your AI requests for today. Come back tomorrow!",
        data: {
          used: quota.used,
          limit: quota.limit,
          resetAt: quota.resetAt.toISOString(),
        },
      });
    }

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
  // ─── POST /ai/study-plan-preview ─────────────────────────
  // Phase 4: AI-powered personalized study plan narrative for onboarding.
  // Generates a 2-3 sentence personalized study narrative based on the
  // student's exam, subjects, exam date, and study personality.
  //
  // This endpoint is EXEMPT from the daily AI quota — onboarding should
  // never be gated by usage limits. Results are cached in Redis for 24h
  // to avoid redundant AI calls for the same inputs.
  //
  // Psychology: Personalized plan creates commitment (Consistency Principle)
  // and makes the data collection feel valuable (Reciprocity).
  fastify.post('/study-plan-preview', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      examId: z.string().min(1),
      subjects: z.array(z.string()).min(1).max(20),
      examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      studyPersonality: z.string().max(100).optional(),
      dailyCardTarget: z.number().int().positive().optional(),
    }).parse(request.body);

    // ── Cache lookup ─────────────────────────────────────────
    const cacheKey = `study_plan_preview:${crypto
      .createHash('sha256')
      .update(JSON.stringify(body))
      .digest('hex')}`;

    const redis = getRedisClient();
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return reply.send({
          success: true,
          data: { narrative: cached, source: 'cache' },
          timestamp: new Date().toISOString(),
        });
      }
    } catch {
      // Redis unavailable — proceed without cache
    }

    // ── Resolve subject names for richer context ─────────────
    let subjectNames: string[] = [];
    try {
      const db = getMongoDb();
      const subjectDocs = await db.collection('subjects').find(
        { _id: { $in: body.subjects.flatMap(id => {
          try { return [new ObjectId(id)]; } catch { return []; }
        }) } },
        { projection: { name: 1 } },
      ).toArray();
      subjectNames = subjectDocs.map(d => (d['name'] as string) ?? 'Unknown');
    } catch {
      subjectNames = body.subjects; // Fallback to IDs if DB fails
    }

    // ── Compute days until exam ──────────────────────────────
    let daysUntilExam = 90; // Default
    if (body.examDate) {
      const examDate = new Date(body.examDate);
      const now = new Date();
      daysUntilExam = Math.max(1, Math.ceil((examDate.getTime() - now.getTime()) / 86400000));
    }

    const dailyTarget = body.dailyCardTarget ?? 15;

    // ── Build AI prompt ─────────────────────────────────────
    const userPrompt = [
      `Student profile:`,
      `- Subjects: ${subjectNames.join(', ')}`,
      `- Days until exam: ${daysUntilExam}`,
      `- Daily study target: ${dailyTarget} cards/day`,
      body.studyPersonality ? `- Study personality: ${body.studyPersonality}` : '',
      '',
      'Generate a personalized 2-3 sentence study plan recommendation.',
    ].filter(Boolean).join('\n');

    try {
      const narrative = await geminiGenerate({
        model: 'free/auto',
        systemPrompt: STUDY_PLAN_SYSTEM_PROMPT,
        userPrompt,
        maxOutputTokens: 200,
        temperature: 0.6,
      });

      const trimmed = narrative.trim();

      // Cache for 24 hours
      try {
        await redis.setex(cacheKey, 86400, trimmed);
      } catch {
        // Cache write failure — non-critical
      }

      return reply.send({
        success: true,
        data: { narrative: trimmed, source: 'ai' },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      fastify.log.warn({ err }, 'Study plan AI generation failed — returning fallback');

      // Fallback narrative when AI is unavailable
      const fallback = `Your adaptive study plan is ready! With ${daysUntilExam} days until your exam and ${subjectNames.length} subjects to cover, we'll pace you at ~${dailyTarget} cards per day. Let's get started!`;

      return reply.send({
        success: true,
        data: { narrative: fallback, source: 'fallback' },
        timestamp: new Date().toISOString(),
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
- You may use basic markdown: **bold** for key terms, *italic* for emphasis, and short bullet lists when listing steps.
- Do not use headers (#) or horizontal rules (---).
- Wrap ALL mathematical expressions, variables, equations, and units in LaTeX dollar-sign delimiters.
  Use $...$ for inline math (e.g. $v = u + at$) and $$...$$ for standalone equations on their own line.
- Examples of correct LaTeX: $F = ma$, $v^2 = u^2 + 2as$, $s = \\frac{1}{2}at^2$, $\\sqrt{2gh}$, $[LT^{-1}]$.`;

const STUDY_PLAN_SYSTEM_PROMPT = `You are a friendly, expert study coach for competitive exam students.
Given a student's subjects, days until exam, daily target, and personality type, write a personalized 2-3 sentence study plan recommendation.

Rules:
- Be warm and encouraging, not robotic.
- Reference their specific subjects and timeline.
- If they have a study personality, tailor advice to it (e.g. "As a Night Owl Sprinter, you'll crush short evening sessions").
- Keep it under 60 words — this is a quick motivational snapshot, not a detailed schedule.
- Do NOT use markdown, headers, or bullet points. Write flowing sentences.
- Do NOT say "Based on your profile" or similar filler. Jump straight into the plan.`;
