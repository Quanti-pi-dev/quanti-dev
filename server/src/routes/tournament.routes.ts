// ─── Tournament Routes ───────────────────────────────────────
// Public: list, enter, leaderboard.
// Admin: full CRUD for tournament management.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/rbac.js';
import { tournamentRepository } from '../repositories/tournament.repository.js';
import { gamificationRepository } from '../repositories/gamification.repository.js';
import { subscriptionService } from '../services/subscription.service.js';
import { createServiceLogger } from '../lib/logger.js';

const log = createServiceLogger('TournamentRoutes');

// ─── Schemas ─────────────────────────────────────────────────

const adminCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  entryFeeCoins: z.number().int().nonnegative(),
  requiredTier: z.number().int().min(0).max(3).optional(),
  maxParticipants: z.number().int().nonnegative().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  prizeDescription: z.string().max(500).optional(),
  prizeCoins: z.number().int().nonnegative().optional(),
  rules: z.string().max(2000).optional(),
  deckId: z.string().nullable().optional(),
  examId: z.string().nullable().optional(),
});

const adminUpdateSchema = adminCreateSchema.partial().extend({
  status: z.enum(['draft', 'active', 'completed', 'cancelled']).optional(),
});

// ─── Public Routes (under /api/v1) ──────────────────────────

export async function tournamentRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireAuth());

  // GET /tournaments — list active + upcoming tournaments
  fastify.get('/tournaments', async (_request: FastifyRequest, reply: FastifyReply) => {
    const tournaments = await tournamentRepository.listActive();
    return reply.send({
      success: true,
      data: tournaments,
      timestamp: new Date().toISOString(),
    });
  });

  // GET /tournaments/:id — single tournament detail
  fastify.get('/tournaments/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const tournament = await tournamentRepository.findById(id);
    if (!tournament) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Tournament not found' },
        timestamp: new Date().toISOString(),
      });
    }

    const hasEntered = await tournamentRepository.hasEntered(id, request.user!.id);
    return reply.send({
      success: true,
      data: { ...tournament, hasEntered },
      timestamp: new Date().toISOString(),
    });
  });

  // POST /tournaments/:id/enter — enter a tournament
  fastify.post('/tournaments/:id/enter', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.id;

    const tournament = await tournamentRepository.findById(id);
    if (!tournament) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Tournament not found' },
        timestamp: new Date().toISOString(),
      });
    }

    // Check tournament is active
    if (tournament.status !== 'active') {
      return reply.status(400).send({
        success: false,
        error: { code: 'NOT_ACTIVE', message: 'Tournament is not currently active' },
        timestamp: new Date().toISOString(),
      });
    }

    // H5 fix: Cap check moved to atomic enter() to prevent TOCTOU race.
    // Pre-check still provided for fast UX feedback, but atomically enforced in repository.
    if (tournament.maxParticipants > 0 && tournament.entryCount >= tournament.maxParticipants) {
      return reply.status(400).send({
        success: false,
        error: { code: 'FULL', message: 'Tournament is full' },
        timestamp: new Date().toISOString(),
      });
    }

    // Check tier requirement
    if (tournament.requiredTier > 0) {
      const subCtx = await subscriptionService.getContext(userId);
      const userTier = subCtx?.planTier ?? 0;
      if (userTier < tournament.requiredTier) {
        const tierNames: Record<number, string> = { 1: 'Basic', 2: 'Pro', 3: 'Master' };
        return reply.status(403).send({
          success: false,
          error: {
            code: 'TIER_REQUIRED',
            message: `This tournament requires a ${tierNames[tournament.requiredTier]} plan or higher`,
          },
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Deduct entry fee (if any) — atomic Lua check-and-deduct
    if (tournament.entryFeeCoins > 0) {
      const { success, balance } = await gamificationRepository.spendCoins(userId, tournament.entryFeeCoins);
      if (!success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INSUFFICIENT_COINS',
            message: `You need ${tournament.entryFeeCoins} coins to enter. You have ${balance.balance}.`,
          },
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Enter — atomic: handles duplicate + cap enforcement
    const entryId = await tournamentRepository.enter(id, userId, tournament.maxParticipants);
    if (entryId === 'FULL') {
      // Atomic cap was hit — refund entry fee
      if (tournament.entryFeeCoins > 0) {
        await gamificationRepository.creditCoins(userId, tournament.entryFeeCoins);
      }
      return reply.status(400).send({
        success: false,
        error: { code: 'FULL', message: 'Tournament is full' },
        timestamp: new Date().toISOString(),
      });
    }
    if (!entryId) {
      // Already entered — refund coins via creditCoins (does NOT inflate leaderboard)
      if (tournament.entryFeeCoins > 0) {
        await gamificationRepository.creditCoins(userId, tournament.entryFeeCoins);
      }
      return reply.status(409).send({
        success: false,
        error: { code: 'ALREADY_ENTERED', message: 'You have already entered this tournament' },
        timestamp: new Date().toISOString(),
      });
    }

    log.info({ userId, tournamentId: id, entryFee: tournament.entryFeeCoins }, 'Tournament entry');

    return reply.status(201).send({
      success: true,
      data: { entryId, message: 'Successfully entered the tournament!' },
      timestamp: new Date().toISOString(),
    });
  });

  // GET /tournaments/:id/leaderboard — tournament leaderboard
  fastify.get('/tournaments/:id/leaderboard', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const leaderboard = await tournamentRepository.getLeaderboard(id);
    return reply.send({
      success: true,
      data: leaderboard,
      timestamp: new Date().toISOString(),
    });
  });

  // POST /tournaments/:id/score — submit score after playing
  fastify.post('/tournaments/:id/score', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.id;

    const scoreSchema = z.object({
      score: z.number().int().nonnegative(),
      answersCorrect: z.number().int().nonnegative(),
      answersTotal: z.number().int().positive(),
    });

    const input = scoreSchema.parse(request.body);

    const tournament = await tournamentRepository.findById(id);
    if (!tournament) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Tournament not found' },
        timestamp: new Date().toISOString(),
      });
    }

    if (tournament.status !== 'active') {
      return reply.status(400).send({
        success: false,
        error: { code: 'NOT_ACTIVE', message: 'Tournament is no longer active' },
        timestamp: new Date().toISOString(),
      });
    }

    const hasEntered = await tournamentRepository.hasEntered(id, userId);
    if (!hasEntered) {
      return reply.status(403).send({
        success: false,
        error: { code: 'NOT_ENTERED', message: 'You have not entered this tournament' },
        timestamp: new Date().toISOString(),
      });
    }

    // H1 fix: Server-side score validation — cap to prevent inflated scores
    const clampedCorrect = Math.min(input.answersCorrect, input.answersTotal);
    const clampedScore = Math.min(input.score, input.answersTotal);

    const updated = await tournamentRepository.updateScore(
      id, userId, clampedScore, clampedCorrect, input.answersTotal,
    );

    log.info({ userId, tournamentId: id, score: clampedScore }, 'Tournament score submitted');

    return reply.send({
      success: true,
      data: { updated, score: input.score, answersCorrect: input.answersCorrect },
      timestamp: new Date().toISOString(),
    });
  });
}

// ─── Admin Routes (under /api/admin) ────────────────────────

export async function adminTournamentRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireRole('admin'));

  // GET /admin/tournaments — list all tournaments
  fastify.get('/tournaments', async (_request: FastifyRequest, reply: FastifyReply) => {
    const tournaments = await tournamentRepository.listAll();
    return reply.send({
      success: true,
      data: tournaments,
      timestamp: new Date().toISOString(),
    });
  });

  // POST /admin/tournaments — create a tournament
  fastify.post('/tournaments', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = adminCreateSchema.parse(request.body);
    const id = await tournamentRepository.create({
      ...input,
      createdBy: request.user!.id,
    });
    return reply.status(201).send({
      success: true,
      data: { id },
      timestamp: new Date().toISOString(),
    });
  });

  // PUT /admin/tournaments/:id — update a tournament
  fastify.put('/tournaments/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const updates = adminUpdateSchema.parse(request.body);
    const ok = await tournamentRepository.update(id, updates);
    if (!ok) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Tournament not found' },
        timestamp: new Date().toISOString(),
      });
    }
    return reply.send({
      success: true,
      data: { id },
      message: 'Tournament updated',
      timestamp: new Date().toISOString(),
    });
  });

  // DELETE /admin/tournaments/:id — delete a tournament
  fastify.delete('/tournaments/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const ok = await tournamentRepository.delete(id);
    if (!ok) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Tournament not found' },
        timestamp: new Date().toISOString(),
      });
    }
    return reply.send({
      success: true,
      data: { id },
      message: 'Tournament deleted',
      timestamp: new Date().toISOString(),
    });
  });
}
