// ─── Challenge Routes ───────────────────────────────────────
// REST endpoints for P2P challenge lifecycle.
// Prefix: /api/v1/p2p (matches architecture.md module spec)

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/rbac.js';
import { challengeService } from '../services/challenge.service.js';
import { challengeRepository } from '../repositories/challenge.repository.js';
import { flashcardRepository } from '../repositories/content.repository.js';
import { onChallengeScore, onChallengeLifecycle } from '../services/realtime.service.js';
import { getRedisClient } from '../lib/database.js';
import { SUBJECT_LEVELS } from '@kd/shared';

// ─── Validation Schemas ─────────────────────────────────────

const createChallengeSchema = z.object({
  opponentId: z.string().uuid(),
  examId: z.string().min(1).max(24),
  subjectId: z.string().min(1).max(24),
  level: z.enum(SUBJECT_LEVELS as [string, ...string[]]),
  betAmount: z.number().int().min(10).max(50000),
  durationSeconds: z.union([z.literal(60), z.literal(90), z.literal(120), z.literal(180)]),
});

const submitAnswerSchema = z.object({
  cardId: z.string().min(1),
  selectedAnswerId: z.string().min(1),
});

export async function challengeRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireAuth());

  // ─── POST /p2p/challenges — Create challenge ─────────
  fastify.post('/p2p/challenges', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = createChallengeSchema.parse(request.body);
    try {
      const challenge = await challengeService.createChallenge(request.user!.id, input);
      return reply.status(201).send({
        success: true,
        data: challenge,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      const status = error.statusCode ?? 500;
      return reply.status(status).send({
        success: false,
        error: { code: 'CREATE_CHALLENGE_FAILED', message: error.message },
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ─── GET /p2p/challenges — Challenge history (paginated) ─
  fastify.get('/p2p/challenges', async (request: FastifyRequest, reply: FastifyReply) => {
    const { page, pageSize } = request.query as { page?: string; pageSize?: string };
    const parsedPage = parseInt(page ?? '1', 10);
    const parsedPageSize = parseInt(pageSize ?? '20', 10);
    const safePage = Number.isNaN(parsedPage) ? 1 : Math.max(parsedPage, 1);
    const safePageSize = Number.isNaN(parsedPageSize) ? 20 : Math.min(Math.max(parsedPageSize, 1), 100);
    const userId = await challengeRepository.resolveUserId(request.user!.id);
    if (!userId) {
      return reply.status(404).send({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
        timestamp: new Date().toISOString(),
      });
    }
    const result = await challengeRepository.findHistory(
      userId,
      safePage,
      safePageSize,
    );
    return reply.send({
      success: true,
      data: result.data,
      pagination: result.pagination,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── GET /p2p/challenges/pending — Pending invites ────
  fastify.get('/p2p/challenges/pending', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = await challengeRepository.resolveUserId(request.user!.id);
    if (!userId) {
      return reply.send({ success: true, data: [], timestamp: new Date().toISOString() });
    }
    const pending = await challengeRepository.findPendingForOpponent(userId);
    return reply.send({
      success: true,
      data: pending,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── GET /p2p/challenges/active — Currently live game ─
  fastify.get('/p2p/challenges/active', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = await challengeRepository.resolveUserId(request.user!.id);
    if (!userId) {
      return reply.send({ success: true, data: null, timestamp: new Date().toISOString() });
    }
    const active = await challengeRepository.findActiveForUser(userId);
    return reply.send({
      success: true,
      data: active,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── GET /p2p/challenges/:id — Challenge detail ───────
  fastify.get('/p2p/challenges/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    try {
      const detail = await challengeService.getChallengeDetails(id, request.user!.id);
      return reply.send({
        success: true,
        data: detail,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      const status = error.statusCode ?? 500;
      return reply.status(status).send({
        success: false,
        error: { code: 'CHALLENGE_DETAIL_FAILED', message: error.message },
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ─── POST /p2p/challenges/:id/accept ──────────────────
  fastify.post('/p2p/challenges/:id/accept', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    try {
      const challenge = await challengeService.acceptChallenge(id, request.user!.id);
      return reply.send({
        success: true,
        data: challenge,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      const status = error.statusCode ?? 500;
      return reply.status(status).send({
        success: false,
        error: { code: 'ACCEPT_FAILED', message: error.message },
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ─── POST /p2p/challenges/:id/decline ─────────────────
  fastify.post('/p2p/challenges/:id/decline', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    try {
      await challengeService.declineChallenge(id, request.user!.id);
      return reply.send({
        success: true,
        data: { message: 'Challenge declined' },
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      const status = error.statusCode ?? 500;
      return reply.status(status).send({
        success: false,
        error: { code: 'DECLINE_FAILED', message: error.message },
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ─── POST /p2p/challenges/:id/cancel ──────────────────
  fastify.post('/p2p/challenges/:id/cancel', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    try {
      await challengeService.cancelChallenge(id, request.user!.id);
      return reply.send({
        success: true,
        data: { message: 'Challenge cancelled' },
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      const status = error.statusCode ?? 500;
      return reply.status(status).send({
        success: false,
        error: { code: 'CANCEL_FAILED', message: error.message },
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ─── POST /p2p/challenges/:id/answer ──────────────────
  fastify.post('/p2p/challenges/:id/answer', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const input = submitAnswerSchema.parse(request.body);

    // H1 fix: Server-side answer verification
    const card = await flashcardRepository.findById(input.cardId);
    if (!card) {
      return reply.status(404).send({
        success: false,
        error: { code: 'CARD_NOT_FOUND', message: 'Flashcard not found' },
        timestamp: new Date().toISOString(),
      });
    }
    const isCorrect = card.correctAnswerId === input.selectedAnswerId;

    try {
      const result = await challengeService.submitAnswer(id, request.user!.id, isCorrect);
      return reply.send({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      const status = error.statusCode ?? 500;
      return reply.status(status).send({
        success: false,
        error: { code: 'ANSWER_FAILED', message: error.message },
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ─── GET /p2p/challenges/:id/stream — SSE score feed ──
  fastify.get('/p2p/challenges/:id/stream', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: challengeId } = request.params as { id: string };

    // Verify challenge is active and user is a participant
    const userId = await challengeRepository.resolveUserId(request.user!.id);
    if (!userId) {
      return reply.status(404).send({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
        timestamp: new Date().toISOString(),
      });
    }

    const challenge = await challengeRepository.findById(challengeId);
    if (!challenge || challenge.status !== 'accepted') {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No active challenge found' },
        timestamp: new Date().toISOString(),
      });
    }
    if (challenge.creatorId !== userId && challenge.opponentId !== userId) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not a participant' },
        timestamp: new Date().toISOString(),
      });
    }

    // Set SSE headers — hijack tells Fastify we're handling the response ourselves
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
    });

    // Send initial state frame
    const redis = getRedisClient();
    const state = await redis.hgetall(`active_challenge:${challengeId}`);
    const initialData = {
      type: 'initial',
      creatorScore: parseInt(state['creator_score'] ?? '0', 10),
      opponentScore: parseInt(state['opponent_score'] ?? '0', 10),
      startedAt: state['started_at'] ?? challenge.startedAt,
      durationSeconds: challenge.durationSeconds,
    };
    reply.raw.write(`data: ${JSON.stringify(initialData)}\n\n`);

    // Keepalive interval (prevents proxy timeout)
    const keepalive = setInterval(() => {
      try { reply.raw.write(':keepalive\n\n'); } catch { /* connection closed */ }
    }, 15_000);

    // Subscribe to Pub/Sub for this challenge
    const scoreHandler = (event: { challengeId: string; role: string; newScore: number }) => {
      if (event.challengeId !== challengeId) return;
      try {
        reply.raw.write(`data: ${JSON.stringify({ type: 'score', ...event })}\n\n`);
      } catch { /* connection closed */ }
    };

    const lifecycleHandler = (event: { challengeId: string; event: string; winnerId?: string | null }) => {
      if (event.challengeId !== challengeId) return;
      try {
        reply.raw.write(`data: ${JSON.stringify({ type: 'lifecycle', ...event })}\n\n`);
        // If game completed, end the stream
        if (event.event === 'completed') {
          clearInterval(keepalive);
          reply.raw.end();
        }
      } catch { /* connection closed */ }
    };

    const unsubScore = onChallengeScore(scoreHandler);
    const unsubLifecycle = onChallengeLifecycle(lifecycleHandler);

    // Cleanup on client disconnect — deterministic listener removal
    request.raw.on('close', () => {
      clearInterval(keepalive);
      unsubScore();
      unsubLifecycle();
    });
  });
}
