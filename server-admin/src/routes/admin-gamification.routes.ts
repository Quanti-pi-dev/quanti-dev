// ─── Admin Gamification Routes ────────────────────────────────
// Manual override tools for platform administrators.
// These were previously registered in server-user under /api/v1 with
// a requireRole('admin') guard, which was an architectural mismatch —
// student-facing traffic and admin tooling shared the same server.
//
// They now live here, under /api/admin/gamify, which is the correct
// location. All routes on server-admin are already protected by the
// adminAuthPlugin (Firebase custom claim: admin === true), so no
// additional per-route guard is needed.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { gamificationRepository } from '@kd/db';

// ─── Schemas ──────────────────────────────────────────────────

const earnCoinsSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  amount: z.number().int().positive('amount must be a positive integer'),
  reason: z.string().min(1, 'reason is required'),
});

const awardBadgeSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  badgeId: z.string().uuid('badgeId must be a valid UUID'),
});

// ─── Route Registration ────────────────────────────────────────

export async function adminGamificationRoutes(fastify: FastifyInstance): Promise<void> {

  // ── POST /gamify/coins/earn — Manually credit coins to a user ──
  // Use case: compensation, testing, promotional awards.
  fastify.post(
    '/gamify/coins/earn',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId, amount, reason } = earnCoinsSchema.parse(request.body);

      const balance = await gamificationRepository.earnCoins(userId, amount, reason);

      return reply.send({
        success: true,
        data: balance,
        timestamp: new Date().toISOString(),
      });
    },
  );

  // ── POST /gamify/badges/award — Manually award a badge to a user ──
  // Use case: milestone awards, manual achievement grants, test setups.
  fastify.post(
    '/gamify/badges/award',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId, badgeId } = awardBadgeSchema.parse(request.body);

      const result = await gamificationRepository.awardBadge(userId, badgeId);

      return reply.send({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    },
  );
}
