// ─── Feature Gate Middleware ──────────────────────────────────
// Request-level plan enforcement via Redis-cached subscription context.

import { FastifyRequest, FastifyReply } from 'fastify';
import { subscriptionService } from '../services/subscription.service.js';
import type { SubscriptionContext, PlanFeatures } from '@kd/shared';

// ─── Extend Fastify request with subscription context ─────────

declare module 'fastify' {
  interface FastifyRequest {
    subscription?: SubscriptionContext | null;
  }
}

// ─── Load subscription context (used as preHandler) ───────────

export async function loadSubscription(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  if (!request.user) return;
  request.subscription = await subscriptionService.getContext(request.user.id);
}

// ─── Require an active, paid (or trialing) subscription ───────

export function requireSubscription() {
  return async function subscriptionGuard(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        timestamp: new Date().toISOString(),
      });
    }

    const ctx = request.subscription ?? (await subscriptionService.getContext(request.user.id));
    request.subscription = ctx;

    if (!ctx || !['active', 'trialing'].includes(ctx.status)) {
      return reply.status(402).send({
        success: false,
        error: {
          code: 'SUBSCRIPTION_REQUIRED',
          message: 'An active subscription is required to access this feature',
          upgradeUrl: '/api/v1/plans',
        },
        timestamp: new Date().toISOString(),
      });
    }
  };
}

// ─── Require a minimum plan tier ──────────────────────────────

export function requireTier(minTier: 1 | 2 | 3) {
  return async function tierGuard(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        timestamp: new Date().toISOString(),
      });
    }

    const ctx = request.subscription ?? (await subscriptionService.getContext(request.user.id));
    request.subscription = ctx;

    if (!ctx || ctx.planTier < minTier) {
      const tierNames: Record<number, string> = { 1: 'Basic', 2: 'Pro', 3: 'Master' };
      return reply.status(403).send({
        success: false,
        error: {
          code: 'PLAN_UPGRADE_REQUIRED',
          message: `This feature requires a ${tierNames[minTier]} plan or higher`,
          requiredTier: minTier,
          currentTier: ctx?.planTier ?? 0,
          upgradeUrl: '/api/v1/plans',
        },
        timestamp: new Date().toISOString(),
      });
    }
  };
}

// ─── Require a specific feature flag ─────────────────────────

export function requireFeature(feature: keyof PlanFeatures) {
  return async function featureGuard(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        timestamp: new Date().toISOString(),
      });
    }

    const ctx = request.subscription ?? (await subscriptionService.getContext(request.user.id));
    request.subscription = ctx;

    if (!ctx || !ctx.features[feature]) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'FEATURE_NOT_AVAILABLE',
          message: `Your current plan does not include ${String(feature).replace(/_/g, ' ')}`,
          feature,
          upgradeUrl: '/api/v1/plans',
        },
        timestamp: new Date().toISOString(),
      });
    }
  };
}
