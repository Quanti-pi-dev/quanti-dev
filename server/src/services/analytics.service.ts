// ─── Analytics Service ───────────────────────────────────────
// Persists subscription analytics events to MongoDB.
// These feed dashboards, funnels, and business metrics (MRR, churn, etc.).

import { getMongoDb } from '../lib/database.js';
import { createServiceLogger } from '../lib/logger.js';

const log = createServiceLogger('AnalyticsService');

// ─── Event Types ─────────────────────────────────────────────

export type AnalyticsEventName =
  | 'plan.viewed'
  | 'plan.selected'
  | 'coupon.applied'
  | 'coupon.failed'
  | 'checkout.initiated'
  | 'checkout.abandoned'
  | 'payment.succeeded'
  | 'payment.failed'
  | 'trial.started'
  | 'trial.ending_soon'
  | 'trial.expired'
  | 'trial.converted'
  | 'subscription.activated'
  | 'subscription.renewed'
  | 'subscription.cancel_requested'
  | 'subscription.canceled'
  | 'subscription.expired'
  | 'subscription.reactivated'
  | 'subscription.upgraded'
  | 'subscription.downgraded'
  | 'refund.initiated'
  | 'refund.completed'
  | 'feature.gated';

export interface AnalyticsEvent {
  event_name: AnalyticsEventName;
  user_id: string;
  properties: Record<string, unknown>;
  timestamp: Date;
  platform?: string;
  app_version?: string;
}

// ─── Analytics Service ────────────────────────────────────────

class AnalyticsService {
  private get collection() {
    return getMongoDb().collection<AnalyticsEvent>('analytics_events');
  }

  // ─── Track a single event ─────────────────────────────
  async track(
    userId: string,
    eventName: AnalyticsEventName,
    properties: Record<string, unknown> = {},
    meta: { platform?: string; appVersion?: string } = {},
  ): Promise<void> {
    try {
      await this.collection.insertOne({
        event_name: eventName,
        user_id: userId,
        properties,
        timestamp: new Date(),
        platform: meta.platform,
        app_version: meta.appVersion,
      });
    } catch (err) {
      // Analytics must never break the main flow — log and swallow
      log.error({ eventName, err }, 'failed to track event');
    }
  }

  // ─── Convenience helpers ──────────────────────────────

  async trackCheckoutInitiated(userId: string, planSlug: string, amountPaise: number, couponCode?: string) {
    return this.track(userId, 'checkout.initiated', { plan_slug: planSlug, amount_paise: amountPaise, coupon_code: couponCode });
  }

  async trackPaymentSucceeded(userId: string, planSlug: string, amountPaise: number, paymentId: string) {
    return this.track(userId, 'payment.succeeded', { plan_slug: planSlug, amount_paise: amountPaise, payment_id: paymentId });
  }

  async trackPaymentFailed(userId: string, planSlug: string, failureReason: string, attemptNumber: number) {
    return this.track(userId, 'payment.failed', { plan_slug: planSlug, failure_reason: failureReason, attempt_number: attemptNumber });
  }

  async trackTrialStarted(userId: string, planSlug: string, trialDays: number) {
    return this.track(userId, 'trial.started', { plan_slug: planSlug, trial_days: trialDays });
  }

  async trackTrialExpired(userId: string, planSlug: string) {
    return this.track(userId, 'trial.expired', { plan_slug: planSlug });
  }

  async trackTrialConverted(userId: string, planSlug: string, amountPaise: number) {
    return this.track(userId, 'trial.converted', { plan_slug: planSlug, amount_paise: amountPaise });
  }

  async trackSubscriptionActivated(userId: string, planSlug: string, billingCycle: string, isUpgrade = false) {
    return this.track(userId, 'subscription.activated', { plan_slug: planSlug, billing_cycle: billingCycle, is_upgrade: isUpgrade });
  }

  async trackSubscriptionCanceled(userId: string, planSlug: string, reason?: string) {
    return this.track(userId, 'subscription.cancel_requested', { plan_slug: planSlug, reason });
  }

  async trackSubscriptionExpired(userId: string, planSlug: string, reason: string) {
    return this.track(userId, 'subscription.expired', { plan_slug: planSlug, reason });
  }

  async trackFeatureGated(userId: string, featureName: string, currentPlanSlug: string) {
    return this.track(userId, 'feature.gated', { feature_name: featureName, current_plan: currentPlanSlug });
  }

  async trackCouponApplied(userId: string, couponCode: string, discountPaise: number, valid: boolean, failureReason?: string) {
    const eventName = valid ? 'coupon.applied' : 'coupon.failed';
    return this.track(userId, eventName, { coupon_code: couponCode, discount_paise: discountPaise, failure_reason: failureReason });
  }

  // ─── Funnel query helpers ─────────────────────────────

  /** Trial conversion rate for a time window */
  async getTrialConversionRate(since: Date): Promise<{ started: number; converted: number; rate: number }> {
    const [started, converted] = await Promise.all([
      this.collection.countDocuments({ event_name: 'trial.started', timestamp: { $gte: since } }),
      this.collection.countDocuments({ event_name: 'trial.converted', timestamp: { $gte: since } }),
    ]);
    return { started, converted, rate: started > 0 ? converted / started : 0 };
  }

  /** Checkout abandonment rate */
  async getCheckoutAbandonmentRate(since: Date): Promise<{ initiated: number; abandoned: number; rate: number }> {
    const [initiated, abandoned] = await Promise.all([
      this.collection.countDocuments({ event_name: 'checkout.initiated', timestamp: { $gte: since } }),
      this.collection.countDocuments({ event_name: 'checkout.abandoned', timestamp: { $gte: since } }),
    ]);
    return { initiated, abandoned, rate: initiated > 0 ? abandoned / initiated : 0 };
  }
}

export const analyticsService = new AnalyticsService();
