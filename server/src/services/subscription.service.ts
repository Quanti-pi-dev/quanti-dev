// ─── Subscription Service ─────────────────────────────────────
// Core lifecycle logic: create, activate, cancel, renew, expire.

import { getRedisClient } from '../lib/database.js';
import { planRepository } from '../repositories/plan.repository.js';
import { subscriptionRepository } from '../repositories/subscription.repository.js';
import { paymentRepository } from '../repositories/payment.repository.js';
import { couponRepository } from '../repositories/coupon.repository.js';
import { couponService } from './coupon.service.js';
import { paymentService } from './payment.service.js';
import { notificationService } from './notification.service.js';
import { analyticsService } from './analytics.service.js';
import { userRepository } from '../repositories/user.repository.js';
import type {
  Subscription,
  SubscriptionSummary,
  Plan,
  BillingCycle,
  SubscriptionContext,
} from '@kd/shared';

const SUBSCRIPTION_CACHE_TTL = 300; // 5 minutes

function computeDaysRemaining(periodEnd: string): number {
  return Math.max(0, Math.ceil((new Date(periodEnd).getTime() - Date.now()) / 86_400_000));
}

function billingCycleDays(cycle: BillingCycle): number {
  return cycle === 'weekly' ? 7 : 30;
}

class SubscriptionService {
  // ─── Redis cache key ────────────────────────────────────
  private cacheKey(userId: string) {
    return `sub:${userId}`;
  }

  // ─── Distributed checkout lock (prevents concurrent duplicate subscriptions)
  // Uses SETNX + EX atomically via Lua — if the key already exists, returns 0.
  private static CHECKOUT_LOCK_LUA = `
    local key = KEYS[1]
    local ttl = tonumber(ARGV[1])
    local ok = redis.call('SET', key, '1', 'NX', 'EX', ttl)
    if ok then return 1 else return 0 end
  `;

  // ─── Invalidate user's subscription cache ───────────────
  async invalidateCache(userId: string): Promise<void> {
    await getRedisClient().del(this.cacheKey(userId));
  }

  // ─── Get subscription context (for feature gate) ─────────
  async getContext(userId: string): Promise<SubscriptionContext | null> {
    const redis = getRedisClient();
    const cached = await redis.get(this.cacheKey(userId));

    if (cached) {
      try {
        return JSON.parse(cached) as SubscriptionContext;
      } catch {
        // Corrupted cache entry — fall through to DB lookup
        await redis.del(this.cacheKey(userId));
      }
    }

    const sub = await subscriptionRepository.findActiveByUserId(userId);
    if (!sub || !['trialing', 'active', 'past_due'].includes(sub.status)) {
      return null;
    }

    const plan = await planRepository.findById(sub.planId);
    if (!plan) return null;

    const context: SubscriptionContext = {
      planTier: plan.tier,
      planSlug: plan.slug,
      status: sub.status,
      features: plan.features,
      periodEnd: sub.currentPeriodEnd,
    };

    await redis.setex(this.cacheKey(userId), SUBSCRIPTION_CACHE_TTL, JSON.stringify(context));
    return context;
  }

  // ─── Get user-facing subscription summary ────────────────
  async getSummary(userId: string): Promise<SubscriptionSummary | null> {
    const sub = await subscriptionRepository.findActiveByUserId(userId);
    if (!sub) return null;

    const plan = await planRepository.findById(sub.planId);
    if (!plan) return null;

    const isActive = sub.status === 'active' || sub.status === 'trialing';

    return {
      id: sub.id,
      status: sub.status,
      plan,
      currentPeriodEnd: sub.currentPeriodEnd,
      trialEnd: sub.trialEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      isActive,
      daysRemaining: computeDaysRemaining(sub.currentPeriodEnd),
    };
  }

  // ─── Initiate checkout: validate + create Razorpay order ─
  async initiateCheckout(
    userId: string,
    planId: string,
    couponCode?: string,
  ): Promise<{
    orderId: string;
    amountPaise: number;
    keyId: string;
    plan: Plan;
    discountPaise: number;
    subscription: Subscription;
  }> {
    // Acquire distributed lock to prevent concurrent checkouts for same user
    const lockKey = `lock:checkout:${userId}`;
    const acquired = await getRedisClient().eval(
      SubscriptionService.CHECKOUT_LOCK_LUA, 1, lockKey, 30, // 30s TTL
    ) as number;

    if (acquired === 0) {
      throw Object.assign(
        new Error('A checkout is already in progress. Please wait.'),
        { code: 'CHECKOUT_IN_PROGRESS' },
      );
    }

    try {
      return await this.executeCheckout(userId, planId, couponCode);
    } finally {
      // Always release the lock
      await getRedisClient().del(lockKey);
    }
  }

  // ─── Internal checkout logic (runs under lock) ──────────
  private async executeCheckout(
    userId: string,
    planId: string,
    couponCode?: string,
  ): Promise<{
    orderId: string;
    amountPaise: number;
    keyId: string;
    plan: Plan;
    discountPaise: number;
    subscription: Subscription;
  }> {
    // 1. Guard against duplicate subscriptions
    const existing = await subscriptionRepository.findActiveByUserId(userId);
    if (existing) {
      throw Object.assign(new Error('User already has an active subscription'), { code: 'ALREADY_SUBSCRIBED' });
    }

    // 2. Resolve and validate plan
    const plan = await planRepository.findById(planId);
    if (!plan || !plan.isActive) {
      throw Object.assign(new Error('Plan not found or inactive'), { code: 'PLAN_NOT_FOUND' });
    }

    // 3. Check trial eligibility
    const hasHadTrial = await subscriptionRepository.hasHadTrialForTier(userId, plan.tier);
    const eligibleForTrial = plan.trialDays > 0 && !hasHadTrial;

    // 4. Validate coupon (if provided)
    let discountPaise = 0;
    let finalPricePaise = plan.pricePaise;
    let couponId: string | undefined;

    if (couponCode) {
      const couponResult = await couponService.validate(
        couponCode,
        userId,
        plan.id,
        plan.billingCycle,
        plan.pricePaise,
      );
      if (!couponResult.valid) {
        throw Object.assign(new Error(couponResult.failureReason ?? 'Invalid coupon'), { code: 'INVALID_COUPON' });
      }
      discountPaise = couponResult.discountPaise;
      finalPricePaise = couponResult.finalPricePaise;
      couponId = couponResult.couponId;
    }

    // 5. Delegate to trial or paid path (FIX A11)
    if (eligibleForTrial && !couponCode) {
      return this.createTrialSubscription(userId, plan);
    }
    return this.createPaidSubscription(userId, plan, finalPricePaise, discountPaise, couponId, couponCode);
  }

  // ─── Trial path: no payment required ────────────────────
  private async createTrialSubscription(
    userId: string,
    plan: Plan,
  ): Promise<{
    orderId: string; amountPaise: number; keyId: string;
    plan: Plan; discountPaise: number; subscription: Subscription;
  }> {
    const now = new Date();
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + plan.trialDays);

    const sub = await subscriptionRepository.create({
      userId,
      planId: plan.id,
      status: 'trialing',
      currentPeriodStart: now,
      currentPeriodEnd: trialEnd,
      trialStart: now,
      trialEnd,
    });

    await subscriptionRepository.logEvent(sub.id, userId, 'trial_started', null, 'trialing', {
      plan_slug: plan.slug,
      trial_days: plan.trialDays,
    });

    await this.invalidateCache(userId);

    // Fire-and-forget notifications + analytics
    const user = await userRepository.findByAuth0Id(userId).catch(() => null);
    if (user) {
      void Promise.allSettled([
        analyticsService.trackTrialStarted(userId, plan.slug, plan.trialDays),
        notificationService.handleEvent({
          type: 'trial_started', userId, email: user.email,
          planName: plan.displayName, trialDays: plan.trialDays,
        }),
      ]);
    }

    return {
      orderId: 'trial',
      amountPaise: 0,
      keyId: '',
      plan,
      discountPaise: 0,
      subscription: sub,
    };
  }

  // ─── Paid path: Razorpay order creation ─────────────────
  private async createPaidSubscription(
    userId: string,
    plan: Plan,
    finalPricePaise: number,
    discountPaise: number,
    couponId?: string,
    couponCode?: string,
  ): Promise<{
    orderId: string; amountPaise: number; keyId: string;
    plan: Plan; discountPaise: number; subscription: Subscription;
  }> {
    const now = new Date();

    // Lock coupon usage before creating payment
    if (couponId) {
      const locked = await couponRepository.incrementUsage(couponId);
      if (!locked) {
        throw Object.assign(new Error('Coupon usage limit reached'), { code: 'COUPON_LIMIT_REACHED' });
      }
    }

    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + billingCycleDays(plan.billingCycle));

    const sub = await subscriptionRepository.create({
      userId,
      planId: plan.id,
      status: 'active', // optimistic; webhook confirms
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      couponId: couponId ?? null,
    });

    // Create Razorpay order
    let razorpayOrderId: string;
    try {
      const order = await paymentService.createOrder(finalPricePaise, sub.id);
      razorpayOrderId = order.orderId;
    } catch (err) {
      // Roll back subscription and coupon lock on Razorpay failure
      await subscriptionRepository.updateStatus(sub.id, 'expired');
      if (couponId) await couponRepository.decrementUsage(couponId);
      throw err;
    }

    // Create payment record
    await paymentRepository.create({
      subscriptionId: sub.id,
      userId,
      razorpayOrderId,
      amountPaise: finalPricePaise,
    });

    await subscriptionRepository.logEvent(sub.id, userId, 'created', null, 'active', {
      plan_slug: plan.slug,
      razorpay_order_id: razorpayOrderId,
    });

    // Fire-and-forget analytics
    void analyticsService.trackCheckoutInitiated(userId, plan.slug, finalPricePaise, couponCode);

    return {
      orderId: razorpayOrderId,
      amountPaise: finalPricePaise,
      keyId: '',  // filled in route from config
      plan,
      discountPaise,
      subscription: sub,
    };
  }

  // ─── Verify payment and activate subscription ─────────────
  async verifyAndActivate(
    userId: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
  ): Promise<SubscriptionSummary> {
    // 1. Verify HMAC signature
    const valid = paymentService.verifyPaymentSignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    );

    if (!valid) {
      throw Object.assign(new Error('Invalid payment signature'), { code: 'INVALID_SIGNATURE' });
    }

    // 2. Find payment row
    const payment = await paymentRepository.findByOrderId(razorpayOrderId);
    if (!payment) {
      throw Object.assign(new Error('Payment order not found'), { code: 'ORDER_NOT_FOUND' });
    }

    // 3. Idempotency: already captured — return existing state without re-processing
    if (payment.status === 'captured') {
      const summary = await this.getSummary(userId);
      if (summary) return summary;
      // Payment is captured but subscription summary is missing — this is a data integrity issue
      throw new Error('Payment already captured but subscription summary unavailable');
    }

    // 4. Mark payment captured
    await paymentRepository.markCaptured(razorpayOrderId, razorpayPaymentId, razorpaySignature);

    // 5. Ensure subscription is active
    const sub = await subscriptionRepository.findById(payment.subscriptionId);
    if (!sub) throw new Error('Subscription not found');

    if (sub.status !== 'active') {
      await subscriptionRepository.updateStatus(sub.id, 'active');
    }

    // 6. Record coupon redemption if applicable
    if (sub.couponId) {
      await couponRepository.recordRedemption(sub.couponId, userId, sub.id, 0);
    }

    await subscriptionRepository.logEvent(sub.id, userId, 'activated', sub.status, 'active', {
      razorpay_payment_id: razorpayPaymentId,
    });

    await this.invalidateCache(userId);

    // Fire-and-forget notifications + analytics
    const plan = await planRepository.findById(sub.planId).catch(() => null);
    const user = await userRepository.findByAuth0Id(userId).catch(() => null);
    if (plan && user) {
      void Promise.allSettled([
        analyticsService.trackPaymentSucceeded(userId, plan.slug, payment.amountPaise, razorpayPaymentId),
        analyticsService.trackSubscriptionActivated(userId, plan.slug, plan.billingCycle),
        notificationService.handleEvent({
          type: 'subscription_activated', userId, email: user.email, planName: plan.displayName,
        }),
      ]);
    }

    const summary = await this.getSummary(userId);
    if (!summary) throw new Error('Failed to load subscription summary');
    return summary;
  }

  // ─── Cancel subscription ──────────────────────────────────
  async cancel(userId: string): Promise<SubscriptionSummary> {
    const sub = await subscriptionRepository.findActiveByUserId(userId);
    if (!sub || sub.status === 'canceled' || sub.status === 'expired') {
      throw Object.assign(new Error('No active subscription to cancel'), { code: 'NO_ACTIVE_SUBSCRIPTION' });
    }

    const updated = await subscriptionRepository.updateStatus(sub.id, 'canceled', {
      canceledAt: new Date(),
      cancelAtPeriodEnd: true,
    });

    await subscriptionRepository.logEvent(
      sub.id, userId, 'cancel_requested', sub.status, 'canceled', {},
    );

    await this.invalidateCache(userId);

    // Fire-and-forget analytics (resolve plan slug for readable reporting)
    const canceledPlan = await planRepository.findById(sub.planId).catch(() => null);
    void analyticsService.trackSubscriptionCanceled(userId, canceledPlan?.slug ?? sub.planId);

    const summary = await this.getSummary(userId);
    return summary ?? ({
      id: updated!.id,
      status: 'canceled',
      plan: (await planRepository.findById(sub.planId))!,
      currentPeriodEnd: sub.currentPeriodEnd,
      trialEnd: sub.trialEnd,
      cancelAtPeriodEnd: true,
      isActive: false,
      daysRemaining: computeDaysRemaining(sub.currentPeriodEnd),
    } as SubscriptionSummary);
  }

  // ─── Reactivate a canceled sub (within period) ────────────
  async reactivate(userId: string): Promise<Subscription> {
    // Use findCanceledByUserId — findActiveByUserId excludes 'canceled' status
    const sub = await subscriptionRepository.findCanceledByUserId(userId);
    if (!sub) {
      throw Object.assign(new Error('No canceled subscription to reactivate'), { code: 'NOTHING_TO_REACTIVATE' });
    }

    const updated = await subscriptionRepository.updateStatus(sub.id, 'active', {
      canceledAt: null,
      cancelAtPeriodEnd: false,
    });

    await subscriptionRepository.logEvent(sub.id, userId, 'reactivated', 'canceled', 'active', {});
    await this.invalidateCache(userId);

    return updated!;
  }
  // ─── Admin: grant a subscription manually ──────────────
  async grantManualSubscription(input: {
    userId: string;
    planId: string;
    adminId: string;
    customEndDate?: string;
    adminNotes?: string;
    overwriteExisting?: boolean;
  }): Promise<{ subscription: Subscription; superseded?: Subscription }> {
    const { userId, planId, adminId, customEndDate, adminNotes, overwriteExisting } = input;

    // 1. Validate user exists
    const user = await userRepository.findById(userId);
    if (!user) {
      throw Object.assign(new Error('User not found'), { code: 'USER_NOT_FOUND' });
    }

    // 2. Validate plan exists and is active
    const plan = await planRepository.findById(planId);
    if (!plan || !plan.isActive) {
      throw Object.assign(new Error('Plan not found or inactive'), { code: 'PLAN_NOT_FOUND' });
    }

    // 3. Check for existing active subscription
    const existing = await subscriptionRepository.findActiveByUserId(userId);
    let superseded: Subscription | undefined;

    if (existing) {
      if (!overwriteExisting) {
        const err = Object.assign(
          new Error('User already has an active subscription'),
          { code: 'ALREADY_ACTIVE', existingSubscription: existing },
        );
        throw err;
      }
      // Expire the old subscription
      await subscriptionRepository.updateStatus(existing.id, 'expired');
      await subscriptionRepository.logEvent(
        existing.id, userId, 'expired', existing.status, 'expired',
        { reason: 'superseded_by_manual_grant', admin_id: adminId },
      );
      superseded = existing;
    }

    // 4. Compute period end
    const now = new Date();
    let periodEnd: Date;
    if (customEndDate) {
      periodEnd = new Date(customEndDate);
      if (periodEnd <= now) {
        throw Object.assign(new Error('Custom end date must be in the future'), { code: 'INVALID_END_DATE' });
      }
    } else {
      periodEnd = new Date(now);
      periodEnd.setDate(periodEnd.getDate() + billingCycleDays(plan.billingCycle));
    }

    // 5. Create subscription
    const sub = await subscriptionRepository.create({
      userId,
      planId,
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    });

    // 6. Log event
    await subscriptionRepository.logEvent(
      sub.id, userId, 'manual_grant', null, 'active',
      {
        admin_id: adminId,
        plan_slug: plan.slug,
        admin_notes: adminNotes ?? null,
        custom_end_date: customEndDate ?? null,
        superseded_subscription_id: superseded?.id ?? null,
      },
    );

    // 7. Invalidate cache
    await this.invalidateCache(userId);

    return { subscription: sub, superseded };
  }
}

export const subscriptionService = new SubscriptionService();
