// ─── Coin Pack Routes ────────────────────────────────────────
// Public: list packs, checkout (Razorpay order), verify payment.
// Admin: full CRUD on coin_packs catalog.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/rbac.js';
import { coinPackRepository } from '../repositories/coinpack.repository.js';
import { gamificationRepository } from '../repositories/gamification.repository.js';
import { paymentService } from '../services/payment.service.js';
import { config } from '../config.js';
import { createServiceLogger } from '../lib/logger.js';

const log = createServiceLogger('CoinPackRoutes');

// ─── Schemas ─────────────────────────────────────────────────

const checkoutSchema = z.object({
  coinPackId: z.string().uuid(),
});

const verifySchema = z.object({
  razorpayOrderId: z.string(),
  razorpayPaymentId: z.string(),
  razorpaySignature: z.string(),
});

const customCheckoutSchema = z.object({
  coins: z.number().int().min(10).max(100000), // 10 coin min (₹10), 1 lakh max
});

const adminCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  coins: z.number().int().positive(),
  pricePaise: z.number().int().positive(),
  badgeText: z.string().max(50).nullable().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});

const adminUpdateSchema = adminCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// ─── Public Routes (under /api/v1/gamify) ────────────────────

export async function coinPackRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireAuth());

  // GET /gamify/coin-packs — list active packs
  fastify.get('/coin-packs', async (_request: FastifyRequest, reply: FastifyReply) => {
    const packs = await coinPackRepository.listActive();
    return reply.send({
      success: true,
      data: packs,
      timestamp: new Date().toISOString(),
    });
  });

  // POST /gamify/coin-packs/checkout — create Razorpay order for a pack
  fastify.post('/coin-packs/checkout', async (request: FastifyRequest, reply: FastifyReply) => {
    const { coinPackId } = checkoutSchema.parse(request.body);
    const userId = request.user!.id;

    const pack = await coinPackRepository.findById(coinPackId);
    if (!pack || !pack.isActive) {
      return reply.status(404).send({
        success: false,
        error: { code: 'PACK_NOT_FOUND', message: 'Coin pack not found or unavailable' },
        timestamp: new Date().toISOString(),
      });
    }

    // Create Razorpay order
    const order = await paymentService.createOrder(pack.pricePaise, `cp_${pack.id}`);

    // Create purchase record (pending)
    await coinPackRepository.createPurchase({
      userId,
      coinPackId: pack.id,
      razorpayOrderId: order.orderId,
      amountPaise: pack.pricePaise,
      coinsCredited: pack.coins,
    });

    return reply.send({
      success: true,
      data: {
        orderId: order.orderId,
        amountPaise: pack.pricePaise,
        currency: 'INR',
        keyId: config.razorpay.keyId,
        pack,
      },
      timestamp: new Date().toISOString(),
    });
  });

  // POST /gamify/coin-packs/verify — verify payment and credit coins
  fastify.post('/coin-packs/verify', async (request: FastifyRequest, reply: FastifyReply) => {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = verifySchema.parse(request.body);
    const userId = request.user!.id;

    // 1. Verify HMAC signature
    const valid = paymentService.verifyPaymentSignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    );
    if (!valid) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_SIGNATURE', message: 'Payment signature verification failed' },
        timestamp: new Date().toISOString(),
      });
    }

    // 2. Find purchase record
    const purchase = await coinPackRepository.findPurchaseByOrderId(razorpayOrderId);
    if (!purchase) {
      return reply.status(404).send({
        success: false,
        error: { code: 'ORDER_NOT_FOUND', message: 'Purchase order not found' },
        timestamp: new Date().toISOString(),
      });
    }

    // 3. Idempotency: already captured
    if (purchase.status === 'captured') {
      const balance = await gamificationRepository.getCoinBalance(userId);
      return reply.send({
        success: true,
        data: { coinsAwarded: purchase.coinsCredited, newBalance: balance.balance, alreadyCaptured: true },
        timestamp: new Date().toISOString(),
      });
    }

    // 4. Guard: ensure the purchase belongs to this user
    if (purchase.userId !== userId) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'This purchase does not belong to you' },
        timestamp: new Date().toISOString(),
      });
    }

    // 5. Mark purchase captured (atomic — returns false if already captured by webhook)
    const captured = await coinPackRepository.markPurchaseCaptured(razorpayOrderId, razorpayPaymentId, razorpaySignature);

    if (!captured) {
      // Webhook already processed — return current balance without double-crediting
      const balance = await gamificationRepository.getCoinBalance(userId);
      return reply.send({
        success: true,
        data: { coinsAwarded: purchase.coinsCredited, newBalance: balance.balance, alreadyCaptured: true },
        timestamp: new Date().toISOString(),
      });
    }

    // 6. Credit coins — uses earnCoins() so it updates leaderboard + lifetime
    const reason = purchase.coinPackId ? 'coin_pack_purchase' : 'custom_coin_purchase';
    const balance = await gamificationRepository.earnCoins(userId, purchase.coinsCredited, reason);

    log.info({ userId, coins: purchase.coinsCredited, orderId: razorpayOrderId }, 'Coin pack purchase completed');

    return reply.send({
      success: true,
      data: {
        coinsAwarded: purchase.coinsCredited,
        newBalance: balance.balance,
      },
      timestamp: new Date().toISOString(),
    });
  });

  // POST /gamify/coin-packs/custom-checkout — buy arbitrary coins at 1 Rupee = 1 Coin
  fastify.post('/coin-packs/custom-checkout', async (request: FastifyRequest, reply: FastifyReply) => {
    const { coins } = customCheckoutSchema.parse(request.body);
    const userId = request.user!.id;

    // 1 Rupee = 1 Coin = 100 paise
    const amountPaise = coins * 100;

    // Create Razorpay order
    const order = await paymentService.createOrder(amountPaise, `custom_${coins}`);

    // Create purchase record with NULL coinPackId (custom purchase)
    await coinPackRepository.createPurchase({
      userId,
      coinPackId: null,
      razorpayOrderId: order.orderId,
      amountPaise,
      coinsCredited: coins,
    });

    log.info({ userId, coins, amountPaise, orderId: order.orderId }, 'Custom coin checkout initiated');

    return reply.send({
      success: true,
      data: {
        orderId: order.orderId,
        amountPaise,
        currency: 'INR',
        keyId: config.razorpay.keyId,
        coins,
      },
      timestamp: new Date().toISOString(),
    });
  });
}

// ─── Admin Routes (under /api/admin) ────────────────────────

export async function adminCoinPackRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireRole('admin'));

  // GET /admin/coin-packs — list all packs (including inactive)
  fastify.get('/coin-packs', async (_request: FastifyRequest, reply: FastifyReply) => {
    const packs = await coinPackRepository.listAll();
    return reply.send({
      success: true,
      data: packs,
      timestamp: new Date().toISOString(),
    });
  });

  // POST /admin/coin-packs — create a new pack
  fastify.post('/coin-packs', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = adminCreateSchema.parse(request.body);
    const id = await coinPackRepository.create(input);
    return reply.status(201).send({
      success: true,
      data: { id },
      timestamp: new Date().toISOString(),
    });
  });

  // PUT /admin/coin-packs/:id — update a pack
  fastify.put('/coin-packs/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const updates = adminUpdateSchema.parse(request.body);
    const ok = await coinPackRepository.update(id, updates);
    if (!ok) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Coin pack not found' },
        timestamp: new Date().toISOString(),
      });
    }
    return reply.send({
      success: true,
      data: { id },
      message: 'Coin pack updated',
      timestamp: new Date().toISOString(),
    });
  });

  // DELETE /admin/coin-packs/:id — delete a pack
  fastify.delete('/coin-packs/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const ok = await coinPackRepository.delete(id);
    if (!ok) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Coin pack not found' },
        timestamp: new Date().toISOString(),
      });
    }
    return reply.send({
      success: true,
      data: { id },
      message: 'Coin pack deleted',
      timestamp: new Date().toISOString(),
    });
  });
}
