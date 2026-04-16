// ─── Subscription Routes ─────────────────────────────────────
// User-facing: plans, checkout, payment verify, cancel, reactivate, invoices.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/rbac.js';
import { planRepository } from '../repositories/plan.repository.js';
import { paymentRepository } from '../repositories/payment.repository.js';
import { subscriptionService } from '../services/subscription.service.js';
import { couponService } from '../services/coupon.service.js';
import { userRepository } from '../repositories/user.repository.js';
import { config } from '../config.js';

// ─── Validation Schemas ───────────────────────────────────────

const checkoutSchema = z.object({
  planId: z.string().uuid(),
  couponCode: z.string().min(1).max(32).optional(),
});

const verifySchema = z.object({
  razorpayOrderId: z.string(),
  razorpayPaymentId: z.string(),
  razorpaySignature: z.string(),
});

const couponValidateSchema = z.object({
  code: z.string().min(1).max(32),
  planId: z.string().uuid(),
});

// ─── Route Plugin ─────────────────────────────────────────────

export async function subscriptionRoutes(fastify: FastifyInstance): Promise<void> {
  // Auth required for all subscription routes
  fastify.addHook('preHandler', requireAuth());

  // ─── GET /plans — List active plans ─────────────────────
  fastify.get('/plans', async (_request: FastifyRequest, reply: FastifyReply) => {
    const plans = await planRepository.listActive();
    return reply.send({
      success: true,
      data: plans,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── GET /subscriptions/me — My subscription summary ────
  fastify.get('/subscriptions/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const summary = await subscriptionService.getSummary(request.user!.id);
    return reply.send({
      success: true,
      data: summary ?? null,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── POST /subscriptions/checkout — Initiate checkout ───
  fastify.post('/subscriptions/checkout', async (request: FastifyRequest, reply: FastifyReply) => {
    const { planId, couponCode } = checkoutSchema.parse(request.body);

    const result = await subscriptionService.initiateCheckout(
      request.user!.id,
      planId,
      couponCode,
    );

    // Trial: no payment needed
    if (result.orderId === 'trial') {
      return reply.send({
        success: true,
        data: {
          trial: true,
          subscription: result.subscription,
          plan: result.plan,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Fetch user profile for checkout prefill
    const userProfile = await userRepository.findByFirebaseUid(request.user!.id);

    return reply.send({
      success: true,
      data: {
        trial: false,
        orderId: result.orderId,
        amountPaise: result.amountPaise,
        currency: 'INR',
        keyId: config.razorpay.keyId,
        plan: result.plan,
        discountPaise: result.discountPaise,
        prefill: {
          name: userProfile?.displayName ?? request.user!.email,
          email: request.user!.email,
        },
      },
      timestamp: new Date().toISOString(),
    });
  });

  // ─── POST /subscriptions/verify — Verify & activate ────
  fastify.post('/subscriptions/verify', async (request: FastifyRequest, reply: FastifyReply) => {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = verifySchema.parse(request.body);

    const summary = await subscriptionService.verifyAndActivate(
      request.user!.id,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    );

    return reply.send({
      success: true,
      data: summary,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── POST /subscriptions/cancel — Cancel at period end ──
  fastify.post('/subscriptions/cancel', async (request: FastifyRequest, reply: FastifyReply) => {
    const summary = await subscriptionService.cancel(request.user!.id);
    return reply.send({
      success: true,
      data: summary,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── POST /subscriptions/reactivate — Undo cancel ───────
  fastify.post('/subscriptions/reactivate', async (request: FastifyRequest, reply: FastifyReply) => {
    const sub = await subscriptionService.reactivate(request.user!.id);
    return reply.send({
      success: true,
      data: sub,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── GET /subscriptions/invoices — Payment history ──────
  fastify.get('/subscriptions/invoices', async (request: FastifyRequest, reply: FastifyReply) => {
    const payments = await paymentRepository.listByUserId(request.user!.id);
    return reply.send({
      success: true,
      data: payments,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── POST /coupons/validate — Validate a coupon code ────
  fastify.post('/coupons/validate', async (request: FastifyRequest, reply: FastifyReply) => {
    const { code, planId } = couponValidateSchema.parse(request.body);

    const plan = await planRepository.findById(planId);
    if (!plan || !plan.isActive) {
      return reply.status(404).send({
        success: false,
        error: { code: 'PLAN_NOT_FOUND', message: 'Plan not found' },
        timestamp: new Date().toISOString(),
      });
    }

    const result = await couponService.validate(
      code,
      request.user!.id,
      plan.id,
      plan.billingCycle,
      plan.pricePaise,
    );

    return reply.send({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── GET /subscriptions/trial-pass — Trial pass status ─────
  // Returns whether the user has an active streak-triggered trial pass.
  fastify.get('/subscriptions/trial-pass', async (request: FastifyRequest, reply: FastifyReply) => {
    const { trialPassService } = await import('../services/trialpass.service.js');
    const status = await trialPassService.getStatus(request.user!.id);
    return reply.send({
      success: true,
      data: status,
      timestamp: new Date().toISOString(),
    });
  });
}
