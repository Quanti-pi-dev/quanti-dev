// ─── Gamification Service Routes ────────────────────────────
// Coins, badges, leaderboard, shop.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/rbac.js';
import { gamificationRepository } from '@kd/db';
import { getRedisClient } from '@kd/db';

const purchaseSchema = z.object({
  itemId: z.string().uuid(),
});

const coinHistorySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
});

// NOTE: Admin-only coin/badge award endpoints were previously here.
// They have been moved to server-admin at:
//   POST /api/admin/gamify/coins/earn
//   POST /api/admin/gamify/badges/award
// See server-admin/src/routes/admin-gamification.routes.ts

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
    const { configRepository: cfgRepo } = await import('@kd/db');
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

  // NOTE: Admin endpoints removed in favor of server-admin service.

  // ─── GET /gamify/badges — User badges ─────────────────
  fastify.get('/badges', async (request: FastifyRequest, reply: FastifyReply) => {
    const badges = await gamificationRepository.getUserBadges(request.user!.id);
    return reply.send({
      success: true,
      data: badges,
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
