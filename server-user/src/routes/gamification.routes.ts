// ─── Gamification Service Routes ────────────────────────────────────
// Coins, badges, leaderboard, shop, daily chest,
// flash events (homepage blitz banner), and celebration cascade queue.

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

  // ─── POST /gamify/daily-chest — Open daily bonus chest ────
  // First study session each day triggers a mystery chest with
  // random coin drops and temporary multiplier boosts.
  // Psychology: Variable reward (Rewards of the Hunt) — the daily
  // chest creates a daily appointment mechanic while the randomized
  // tiers (bronze/silver/gold) activate dopamine prediction-error.
  fastify.post('/daily-chest', async (request: FastifyRequest, reply: FastifyReply) => {
    const { variableRewardService: vrService } = await import('@kd/db');
    const result = await vrService.openDailyChest(request.user!.id);
    return reply.send({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── GET /gamify/daily-chest/status — Check chest availability ─
  // Returns whether the user has already opened today's chest.
  // The mobile client uses this to show/hide the chest icon on the home screen.
  fastify.get('/daily-chest/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const { variableRewardService: vrService } = await import('@kd/db');
    const opened = await vrService.hasOpenedChestToday(request.user!.id);
    return reply.send({
      success: true,
      data: { opened, availableToday: !opened },
      timestamp: new Date().toISOString(),
    });
  });

  // ─── GET /gamify/flash-event/active — Active flash events ──
  // Returns the currently active flash event (if any) for the homepage
  // blitz banner on the mobile client.
  //
  // Psychology: Scarcity Principle (Cialdini) — time-limited 2x coin
  // events create urgency that drives immediate study sessions.
  fastify.get('/flash-event/active', async (_request: FastifyRequest, reply: FastifyReply) => {
    const { flashEventService } = await import('@kd/db');
    const events = await flashEventService.getActiveEvents();
    // Return the most impactful active event (highest multiplier)
    const topEvent = events.sort((a, b) => b.multiplier - a.multiplier)[0] ?? null;
    return reply.send({
      success: true,
      data: topEvent,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── GET /gamify/celebration/pending — Poll celebration queue ─
  // The mobile CelebrationOverlay polls this every 30 seconds.
  // Returns a CelebrationSequence (or null) from the user's Redis queue.
  //
  // Step types are normalised to match the client's CelebrationStepType:
  //   Backend → Client:
  //   coin_shower  → coin_drop
  //   streak_fire  → streak_milestone
  //   stat_card    → stat_card  (passed-through; client falls back to null render)
  //   social_card  → social_card (passed-through)
  //   sound_effect → sound_effect (passed-through; client ignores on native)
  //
  // Psychology: Peak-End Rule (Kahneman) — multi-step celebrations create
  // memorable emotional peaks that reinforce the study habit.
  fastify.get('/celebration/pending', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.id;
    const redis = getRedisClient();
    const raw = await redis.get(`celebration_queue:${userId}`);

    if (!raw) {
      return reply.send({ success: true, data: null, timestamp: new Date().toISOString() });
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const sequence = JSON.parse(raw);

      // Normalise step types from backend to client naming convention
      const CLIENT_TYPE_MAP: Record<string, string> = {
        coin_shower:  'coin_drop',
        streak_fire:  'streak_milestone',
      };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (Array.isArray(sequence?.steps)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
        sequence.steps = (sequence.steps as any[]).map((step: any) => ({
          ...step,
          type: CLIENT_TYPE_MAP[step.type as string] ?? step.type,
        }));
      }

      return reply.send({ success: true, data: sequence, timestamp: new Date().toISOString() });
    } catch {
      // Malformed queue entry — clear it and return null
      await redis.del(`celebration_queue:${userId}`);
      return reply.send({ success: true, data: null, timestamp: new Date().toISOString() });
    }
  });

  // ─── POST /gamify/celebration/ack — Acknowledge celebration ──
  // Called by the mobile client after the overlay finishes playing.
  // Removes the celebration from the Redis queue so it doesn't replay.
  fastify.post('/celebration/ack', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.id;
    const redis = getRedisClient();
    await redis.del(`celebration_queue:${userId}`);
    return reply.send({ success: true, data: { acknowledged: true }, timestamp: new Date().toISOString() });
  });

  // ─── GET /gamify/wager/active — Get current active wager status ──
  fastify.get('/wager/active', async (request: FastifyRequest, reply: FastifyReply) => {
    const { wagerService } = await import('@kd/db');
    const state = await wagerService.getActiveWager(request.user!.id);
    return reply.send({
      success: true,
      data: state,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── POST /gamify/wager/initiate — Start a new wager session ──
  fastify.post('/wager/initiate', async (request: FastifyRequest, reply: FastifyReply) => {
    const { wagerService } = await import('@kd/db');
    const bodySchema = z.object({
      wagerCoins: z.number().int().positive(),
      deckId: z.string().optional(),
    });
    const { wagerCoins, deckId } = bodySchema.parse(request.body);
    const result = await wagerService.initiateWager(request.user!.id, wagerCoins, deckId);
    if (!result.success) {
      return reply.status(400).send({
        success: false,
        message: result.message,
        timestamp: new Date().toISOString(),
      });
    }
    return reply.send({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── POST /gamify/wager/submit — Submit answer for a card ──
  fastify.post('/wager/submit', async (request: FastifyRequest, reply: FastifyReply) => {
    const { wagerService } = await import('@kd/db');
    const bodySchema = z.object({
      cardId: z.string(),
      selectedOptionId: z.string(),
    });
    const { cardId, selectedOptionId } = bodySchema.parse(request.body);
    const result = await wagerService.submitWagerAnswer(request.user!.id, cardId, selectedOptionId);
    return reply.send({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  });
}
