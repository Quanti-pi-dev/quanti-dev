// ─── Admin Subscription Routes ───────────────────────────────
// Admin management: subscriptions, plans, coupons, payments, analytics.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireRole } from '../middleware/rbac.js';
import { planRepository } from '../repositories/plan.repository.js';
import { subscriptionRepository } from '../repositories/subscription.repository.js';
import { paymentRepository } from '../repositories/payment.repository.js';
import { couponRepository } from '../repositories/coupon.repository.js';
import { subscriptionService } from '../services/subscription.service.js';
import { paymentService } from '../services/payment.service.js';
import { userRepository } from '../repositories/user.repository.js';
import { getPostgresPool } from '../lib/database.js';
import type { SubscriptionStatus, PaymentStatus } from '@kd/shared';

// ─── Schemas ─────────────────────────────────────────────────

const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  status: z.string().optional(),
});

const createPlanSchema = z.object({
  slug: z.string().min(1).max(50),
  displayName: z.string().min(1).max(100),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  billingCycle: z.enum(['weekly', 'monthly']),
  pricePaise: z.number().int().positive(),
  features: z.object({
    max_decks: z.number().int(),
    max_exams_per_day: z.number().int(),
    max_subjects_per_exam: z.number().int().default(-1),  // -1 = unlimited
    max_level: z.number().int().default(-1),              // -1 = all levels; 1-6 = cap
    ai_explanations: z.boolean(),
    offline_access: z.boolean(),
    priority_support: z.boolean(),
    advanced_analytics: z.boolean(),
  }),
  trialDays: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

const updatePlanSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  pricePaise: z.number().int().positive().optional(),
  features: z.any().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  trialDays: z.number().int().min(0).optional(),
});

const createCouponSchema = z.object({
  code: z.string().min(1).max(32).toUpperCase(),
  discountType: z.enum(['percentage', 'fixed_amount']),
  discountValue: z.number().int().positive(),
  maxDiscountPaise: z.number().int().positive().optional(),
  minOrderPaise: z.number().int().min(0).default(0),
  applicablePlans: z.array(z.string().uuid()).default([]),
  applicableCycles: z.array(z.enum(['weekly', 'monthly'])).default([]),
  maxUses: z.number().int().positive().optional(),
  maxUsesPerUser: z.number().int().positive().default(1),
  validUntil: z.string().datetime().optional(),
  isActive: z.boolean().default(true),
  firstTimeOnly: z.boolean().default(false),
});

const patchSubscriptionSchema = z.object({
  status: z.enum(['active', 'past_due', 'canceled', 'expired', 'paused']).optional(),
  cancelAtPeriodEnd: z.boolean().optional(),
});

const refundSchema = z.object({
  amountPaise: z.number().int().positive(),
});

const grantSubscriptionSchema = z.object({
  userId: z.string().uuid(),
  planId: z.string().uuid(),
  customEndDate: z.string().datetime().optional(),
  adminNotes: z.string().max(500).optional(),
  overwriteExisting: z.boolean().default(false),
});

const userSearchSchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().min(1).max(20).default(10),
});

// ─── Route plugin ─────────────────────────────────────────────

export async function adminSubscriptionRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireRole('admin'));

  // ─── Plans CRUD ─────────────────────────────────────────
  fastify.get('/plans', async (_req, reply) => {
    return reply.send({ success: true, data: await planRepository.listAll(), timestamp: new Date().toISOString() });
  });

  fastify.post('/plans', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = createPlanSchema.parse(request.body);
    const plan = await planRepository.create({
      ...input,
      currency: 'INR',
    });
    return reply.status(201).send({ success: true, data: plan, timestamp: new Date().toISOString() });
  });

  fastify.patch('/plans/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const input = updatePlanSchema.parse(request.body);
    const plan = await planRepository.update(id, input);
    if (!plan) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Plan not found' }, timestamp: new Date().toISOString() });
    return reply.send({ success: true, data: plan, timestamp: new Date().toISOString() });
  });

  // ─── Plan soft-delete ───────────────────────────────────
  fastify.delete('/plans/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const plan = await planRepository.findById(id);
    if (!plan) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Plan not found' }, timestamp: new Date().toISOString() });

    // Guard: prevent deletion of plans with active subscribers
    const pool = getPostgresPool();
    const activeCount = await pool.query(
      `SELECT COUNT(*) AS count FROM subscriptions WHERE plan_id = $1 AND status IN ('active', 'trialing', 'past_due')`,
      [id],
    );
    const count = parseInt(activeCount.rows[0].count as string, 10);
    if (count > 0) {
      return reply.status(409).send({
        success: false,
        error: { code: 'PLAN_HAS_ACTIVE_SUBSCRIBERS', message: `Cannot delete: ${count} active subscriber(s)` },
        timestamp: new Date().toISOString(),
      });
    }

    await planRepository.update(id, { isActive: false });
    return reply.send({ success: true, data: { id, isActive: false }, timestamp: new Date().toISOString() });
  });

  // ─── Subscriptions ──────────────────────────────────────
  fastify.get('/subscriptions', async (request: FastifyRequest, reply: FastifyReply) => {
    const { limit, offset, status } = paginationSchema.parse(request.query);
    const result = await subscriptionRepository.listAll({
      status: status as SubscriptionStatus | undefined,
      limit,
      offset,
    });
    return reply.send({ success: true, data: result, timestamp: new Date().toISOString() });
  });

  fastify.get('/subscriptions/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const sub = await subscriptionRepository.findById(id);
    if (!sub) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Subscription not found' }, timestamp: new Date().toISOString() });
    const events = await subscriptionRepository.listEvents(id);
    return reply.send({ success: true, data: { subscription: sub, events }, timestamp: new Date().toISOString() });
  });

  fastify.patch('/subscriptions/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const input = patchSubscriptionSchema.parse(request.body);
    const sub = await subscriptionRepository.findById(id);
    if (!sub) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Subscription not found' }, timestamp: new Date().toISOString() });

    if (input.status) {
      await subscriptionRepository.updateStatus(id, input.status as SubscriptionStatus, {
        cancelAtPeriodEnd: input.cancelAtPeriodEnd,
      });
      await subscriptionService.invalidateCache(sub.userId);
    }
    return reply.send({ success: true, data: await subscriptionRepository.findById(id), timestamp: new Date().toISOString() });
  });

  // ─── Grant manual subscription ─────────────────────────
  fastify.post('/subscriptions', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = grantSubscriptionSchema.parse(request.body);
    try {
      const result = await subscriptionService.grantManualSubscription({
        ...input,
        adminId: request.user!.id,
      });
      return reply.status(201).send({ success: true, data: result, timestamp: new Date().toISOString() });
    } catch (err: unknown) {
      const error = err as Error & { code?: string; existingSubscription?: unknown };
      if (error.code === 'ALREADY_ACTIVE') {
        return reply.status(409).send({
          success: false,
          error: {
            code: 'ALREADY_ACTIVE',
            message: error.message,
            existingSubscription: error.existingSubscription,
          },
          timestamp: new Date().toISOString(),
        });
      }
      if (error.code === 'USER_NOT_FOUND' || error.code === 'PLAN_NOT_FOUND') {
        return reply.status(404).send({
          success: false,
          error: { code: error.code, message: error.message },
          timestamp: new Date().toISOString(),
        });
      }
      if (error.code === 'INVALID_END_DATE') {
        return reply.status(400).send({
          success: false,
          error: { code: error.code, message: error.message },
          timestamp: new Date().toISOString(),
        });
      }
      throw err;
    }
  });

  // ─── User search (for grant modal typeahead) ───────────
  fastify.get('/users/search', async (request: FastifyRequest, reply: FastifyReply) => {
    const { q, limit } = userSearchSchema.parse(request.query);
    const users = await userRepository.searchByEmail(q, limit);
    return reply.send({ success: true, data: users, timestamp: new Date().toISOString() });
  });

  // ─── Coupons CRUD ───────────────────────────────────────
  fastify.get('/coupons', async (_req, reply) => {
    return reply.send({ success: true, data: await couponRepository.listAll(), timestamp: new Date().toISOString() });
  });

  fastify.post('/coupons', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = createCouponSchema.parse(request.body);
    const coupon = await couponRepository.create({
      ...input,
      maxDiscountPaise: input.maxDiscountPaise ?? null,
      maxUses: input.maxUses ?? null,
      validUntil: input.validUntil ?? null,
    } as Parameters<typeof couponRepository.create>[0]);
    return reply.status(201).send({ success: true, data: coupon, timestamp: new Date().toISOString() });
  });

  fastify.patch('/coupons/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const input = z.object({
      isActive: z.boolean().optional(),
      maxUses: z.number().int().positive().nullable().optional(),
      validUntil: z.string().datetime().nullable().optional(),
    }).parse(request.body);
    const coupon = await couponRepository.update(id, input);
    if (!coupon) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Coupon not found' }, timestamp: new Date().toISOString() });
    return reply.send({ success: true, data: coupon, timestamp: new Date().toISOString() });
  });

  // F4: DELETE /admin/coupons/:id — delete a coupon (with redemption guard)
  fastify.delete('/coupons/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const coupon = await couponRepository.findById(id);
    if (!coupon) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Coupon not found' }, timestamp: new Date().toISOString() });
    }
    if (coupon.currentUses > 0) {
      return reply.status(409).send({
        success: false,
        error: { code: 'HAS_REDEMPTIONS', message: `Coupon has ${coupon.currentUses} redemption(s). Deactivate it instead of deleting.` },
        timestamp: new Date().toISOString(),
      });
    }
    const pool = getPostgresPool();
    await pool.query(`DELETE FROM coupons WHERE id = $1`, [id]);
    return reply.send({ success: true, data: { id }, message: 'Coupon deleted', timestamp: new Date().toISOString() });
  });

  // ─── Payments ───────────────────────────────────────────
  fastify.get('/payments', async (request: FastifyRequest, reply: FastifyReply) => {
    const { limit, offset, status } = paginationSchema.parse(request.query);
    const result = await paymentRepository.listAll({
      status: status as PaymentStatus | undefined,
      limit,
      offset,
    });
    return reply.send({ success: true, data: result, timestamp: new Date().toISOString() });
  });

  fastify.post('/payments/:id/refund', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { amountPaise } = refundSchema.parse(request.body);

    const payment = await paymentRepository.findById(id);
    if (!payment?.razorpayPaymentId) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Captured payment not found' }, timestamp: new Date().toISOString() });
    }

    const refund = await paymentService.createRefund(payment.razorpayPaymentId, amountPaise);
    const isFull = amountPaise >= payment.amountPaise;
    await paymentRepository.markRefunded(payment.razorpayPaymentId, amountPaise, isFull);

    return reply.send({ success: true, data: refund, timestamp: new Date().toISOString() });
  });

  // ─── Analytics ──────────────────────────────────────────
  fastify.get('/analytics/subscriptions', async (_req, reply) => {
    const pool = getPostgresPool();
    const result = await pool.query(`
      SELECT
        status,
        COUNT(*) AS count,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS new_30d
      FROM subscriptions
      GROUP BY status
    `);
    return reply.send({ success: true, data: result.rows, timestamp: new Date().toISOString() });
  });

  fastify.get('/analytics/revenue', async (_req, reply) => {
    const pool = getPostgresPool();
    const result = await pool.query(`
      SELECT
        DATE_TRUNC('day', created_at) AS day,
        SUM(amount_paise) AS total_paise,
        COUNT(*) AS payment_count
      FROM payments
      WHERE status = 'captured'
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY day
      ORDER BY day DESC
    `);
    return reply.send({ success: true, data: result.rows, timestamp: new Date().toISOString() });
  });

  // ─── Coin Pack Revenue Analytics ──────────────────────────
  fastify.get('/analytics/coin-packs', async (_req, reply) => {
    const pool = getPostgresPool();
    const [summary, daily] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'captured') AS total_purchases,
          COALESCE(SUM(amount_paise) FILTER (WHERE status = 'captured'), 0) AS total_revenue_paise,
          COALESCE(SUM(coins_credited) FILTER (WHERE status = 'captured'), 0) AS total_coins_sold,
          COUNT(*) FILTER (WHERE status = 'pending') AS pending_count
        FROM coin_pack_purchases
      `),
      pool.query(`
        SELECT
          DATE_TRUNC('day', captured_at) AS day,
          SUM(amount_paise) AS revenue_paise,
          SUM(coins_credited) AS coins_sold,
          COUNT(*) AS purchase_count
        FROM coin_pack_purchases
        WHERE status = 'captured'
          AND captured_at >= NOW() - INTERVAL '30 days'
        GROUP BY day
        ORDER BY day DESC
      `),
    ]);
    return reply.send({
      success: true,
      data: {
        summary: summary.rows[0],
        daily: daily.rows,
      },
      timestamp: new Date().toISOString(),
    });
  });

  // ─── Combined Revenue Dashboard ───────────────────────────
  fastify.get('/analytics/revenue-dashboard', async (_req, reply) => {
    const pool = getPostgresPool();
    const [subscriptionRevenue, coinPackRevenue, totalUsers, activeToday] = await Promise.all([
      pool.query(`
        SELECT
          COALESCE(SUM(amount_paise) FILTER (WHERE status = 'captured'), 0) AS total_paise,
          COUNT(*) FILTER (WHERE status = 'captured') AS payment_count,
          COALESCE(SUM(amount_paise) FILTER (WHERE status = 'captured' AND created_at >= NOW() - INTERVAL '7 days'), 0) AS last_7d_paise,
          COALESCE(SUM(amount_paise) FILTER (WHERE status = 'captured' AND created_at >= NOW() - INTERVAL '30 days'), 0) AS last_30d_paise
        FROM payments
      `),
      pool.query(`
        SELECT
          COALESCE(SUM(amount_paise) FILTER (WHERE status = 'captured'), 0) AS total_paise,
          COUNT(*) FILTER (WHERE status = 'captured') AS purchase_count,
          COALESCE(SUM(amount_paise) FILTER (WHERE status = 'captured' AND captured_at >= NOW() - INTERVAL '7 days'), 0) AS last_7d_paise,
          COALESCE(SUM(amount_paise) FILTER (WHERE status = 'captured' AND captured_at >= NOW() - INTERVAL '30 days'), 0) AS last_30d_paise
        FROM coin_pack_purchases
      `),
      pool.query(`SELECT COUNT(*) AS count FROM users`),
      pool.query(`
        SELECT COUNT(DISTINCT user_id) AS count FROM study_sessions
        WHERE started_at >= CURRENT_DATE
      `),
    ]);

    const subData = subscriptionRevenue.rows[0] || {};
    const cpData = coinPackRevenue.rows[0] || {};

    return reply.send({
      success: true,
      data: {
        subscriptions: {
          totalRevenuePaise: parseInt(subData.total_paise as string ?? '0', 10),
          paymentCount: parseInt(subData.payment_count as string ?? '0', 10),
          last7dPaise: parseInt(subData.last_7d_paise as string ?? '0', 10),
          last30dPaise: parseInt(subData.last_30d_paise as string ?? '0', 10),
        },
        coinPacks: {
          totalRevenuePaise: parseInt(cpData.total_paise as string ?? '0', 10),
          purchaseCount: parseInt(cpData.purchase_count as string ?? '0', 10),
          last7dPaise: parseInt(cpData.last_7d_paise as string ?? '0', 10),
          last30dPaise: parseInt(cpData.last_30d_paise as string ?? '0', 10),
        },
        totalRevenuePaise:
          parseInt(subData.total_paise as string ?? '0', 10) +
          parseInt(cpData.total_paise as string ?? '0', 10),
        totalUsers: parseInt((totalUsers.rows[0] as { count: string })?.count ?? '0', 10),
        activeToday: parseInt((activeToday.rows[0] as { count: string })?.count ?? '0', 10),
      },
      timestamp: new Date().toISOString(),
    });
  });
}
