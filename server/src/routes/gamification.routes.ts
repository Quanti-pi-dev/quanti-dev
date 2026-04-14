// ─── Gamification Service Routes ────────────────────────────
// Coins, badges, leaderboard, shop.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/rbac.js';
import { gamificationRepository } from '../repositories/gamification.repository.js';
import { getRedisClient } from '../lib/database.js';

const purchaseSchema = z.object({
  itemId: z.string().uuid(),
});

const coinHistorySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
});

// Admin-only manual award schema (kept here for internal tooling / testing)
const adminEarnCoinsSchema = z.object({
  userId: z.string().min(1),
  amount: z.number().int().positive(),
  reason: z.string().min(1),
});

export async function gamificationRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireAuth());

  // ─── GET /gamify/coins — Coin balance ─────────────────────
  fastify.get('/coins', async (request: FastifyRequest, reply: FastifyReply) => {
    const balance = await gamificationRepository.getCoinBalance(request.user!.id);
    return reply.send({
      success: true,
      data: balance,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── GET /gamify/coins/today — Coins earned today ─────────
  // Reads coins_daily:{userId}:{YYYY-MM-DD} from Redis.
  // Returns { earnedToday, dailyCap } so the client can show a progress bar.
  fastify.get('/coins/today', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.id;
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const redis = getRedisClient();
    const raw = await redis.get(`coins_daily:${userId}:${today}`);
    const earnedToday = parseInt(raw ?? '0', 10);
    const { configRepository: cfgRepo } = await import('../repositories/config.repository.js');
    const dailyCap = await cfgRepo.getNumber('coin_daily_cap', 100);
    return reply.send({
      success: true,
      data: { earnedToday, dailyCap },
      timestamp: new Date().toISOString(),
    });
  });

  // ─── GET /gamify/coins/history — Paginated earn/spend log ─
  fastify.get('/coins/history', async (request: FastifyRequest, reply: FastifyReply) => {
    const { page, pageSize } = coinHistorySchema.parse(request.query);
    const result = await gamificationRepository.getCoinHistory(request.user!.id, page, pageSize);
    return reply.send({
      success: true,
      data: result.data,
      pagination: result.pagination,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── POST /gamify/coins/earn — ADMIN ONLY: manual award ─
  fastify.post('/coins/earn', { preHandler: [requireRole('admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId, amount, reason } = adminEarnCoinsSchema.parse(request.body);
    const balance = await gamificationRepository.earnCoins(userId, amount, reason);
    return reply.send({
      success: true,
      data: balance,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── GET /gamify/badges — User badges ─────────────────
  fastify.get('/badges', async (request: FastifyRequest, reply: FastifyReply) => {
    const badges = await gamificationRepository.getUserBadges(request.user!.id);
    return reply.send({
      success: true,
      data: badges,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── POST /gamify/badges/award — Award badge (ADMIN) ─
  fastify.post('/badges/award', { preHandler: [requireRole('admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { badgeId, userId } = z.object({ badgeId: z.string().uuid(), userId: z.string().min(1) }).parse(request.body);
    const result = await gamificationRepository.awardBadge(userId, badgeId);
    return reply.send({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── GET /gamify/leaderboard — Global leaderboard ────
  fastify.get('/leaderboard', async (request: FastifyRequest, reply: FastifyReply) => {
    const { type, limit } = request.query as { type?: string; limit?: string };
    const parsedLimit = parseInt(limit ?? '50', 10);
    const safeLimit = Number.isNaN(parsedLimit) ? 50 : Math.min(Math.max(parsedLimit, 1), 100);
    const leaderboard = await gamificationRepository.getLeaderboard(
      request.user!.id,
      (type === 'weekly' ? 'weekly' : 'global'),
      safeLimit,
    );
    return reply.send({
      success: true,
      data: leaderboard,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── GET /gamify/shop — Shop items (packs + themes) ───
  fastify.get('/shop', async (_request: FastifyRequest, reply: FastifyReply) => {
    const items = await gamificationRepository.getShopItems();
    return reply.send({
      success: true,
      data: items,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── GET /gamify/shop/unlocked — User's unlocked decks ─
  fastify.get('/shop/unlocked', async (request: FastifyRequest, reply: FastifyReply) => {
    const deckIds = await gamificationRepository.getUnlockedDeckIds(request.user!.id);
    return reply.send({
      success: true,
      data: { deckIds },
      timestamp: new Date().toISOString(),
    });
  });

  // ─── POST /gamify/shop/purchase — Buy item ─────────────
  fastify.post('/shop/purchase', async (request: FastifyRequest, reply: FastifyReply) => {
    const { itemId } = purchaseSchema.parse(request.body);
    const result = await gamificationRepository.purchaseItem(request.user!.id, itemId);

    const statusCode = result.success ? 200 : 400;
    return reply.status(statusCode).send({
      success: result.success,
      data: { message: result.message, effect: result.effect ?? null },
      timestamp: new Date().toISOString(),
    });
  });
}
