// ─── Subscription Types ──────────────────────────────────────
// Shared types for plans, subscriptions, payments, coupons.

// ─── Plans ──────────────────────────────────────────────────

export type BillingCycle = 'weekly' | 'monthly';
export type PlanTier = 1 | 2 | 3;

export interface PlanFeatures {
  max_decks: number;           // -1 = unlimited
  max_exams_per_day: number;   // -1 = unlimited
  max_subjects_per_exam: number; // -1 = unlimited; 0 = no access
  max_level: number;           // 1=Beginner only … 6=all levels; -1 = unlimited
  ai_explanations: boolean;
  offline_access: boolean;
  priority_support: boolean;
  advanced_analytics: boolean;
  deep_insights: boolean;    // Chronotype + Speed vs Accuracy (Pro+)
  mastery_radar: boolean;    // Radar chart + AI recommendations (Master)
}

export interface Plan {
  id: string;
  slug: string;
  displayName: string;
  tier: PlanTier;
  billingCycle: BillingCycle;
  pricePaise: number;
  currency: string;
  features: PlanFeatures;
  trialDays: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  /** Razorpay Plans API ID — populated on first paid checkout, null for free/trial plans. */
  razorpayPlanId?: string | null;
}

// ─── Subscriptions ──────────────────────────────────────────

export type SubscriptionStatus =
  | 'pending'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'expired'
  | 'paused';

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  plan?: Plan;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialStart: string | null;
  trialEnd: string | null;
  canceledAt: string | null;
  cancelAtPeriodEnd: boolean;
  retryCount: number;
  couponId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  /** Razorpay Subscriptions API ID (e.g. "sub_XXXX") — present for recurring paid subscriptions. */
  razorpaySubscriptionId?: string | null;
  /** Razorpay customer ID — stored for mandate/token lookup on renewals. */
  razorpayCustomerId?: string | null;
}

// User-facing subscription summary (includes computed fields)
export interface SubscriptionSummary {
  id: string;
  status: SubscriptionStatus;
  plan: Plan;
  currentPeriodEnd: string;
  trialEnd: string | null;
  cancelAtPeriodEnd: boolean;
  isActive: boolean;
  daysRemaining: number;
  /** Whether this subscription will auto-renew at period end (has Razorpay mandate). */
  autoRenews?: boolean;
}

// ─── Payments ───────────────────────────────────────────────

export type PaymentStatus =
  | 'created'
  | 'authorized'
  | 'captured'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

export interface Payment {
  id: string;
  subscriptionId: string;
  userId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  amountPaise: number;
  currency: string;
  status: PaymentStatus;
  failureReason: string | null;
  refundAmountPaise: number;
  webhookVerified: boolean;
  attemptNumber: number;
  createdAt: string;
}

// ─── Coupons ────────────────────────────────────────────────

export type CouponDiscountType = 'percentage' | 'fixed_amount';

export interface Coupon {
  id: string;
  code: string;
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscountPaise: number | null;
  minOrderPaise: number;
  applicablePlans: string[];
  applicableCycles: BillingCycle[];
  maxUses: number | null;
  maxUsesPerUser: number;
  currentUses: number;
  validFrom: string;
  validUntil: string | null;
  isActive: boolean;
  firstTimeOnly: boolean;
}

export interface CouponValidationResult {
  valid: boolean;
  discountPaise: number;
  finalPricePaise: number;
  couponId: string;
  failureReason?: string;
}

// ─── Subscription Events ─────────────────────────────────────

export type SubscriptionEventType =
  | 'created'
  | 'manual_grant'
  | 'trial_started'
  | 'trial_expired'
  | 'trial_converted'
  | 'activated'
  | 'renewed'
  | 'payment_failed'
  | 'payment_retried'
  | 'cancel_requested'
  | 'canceled'
  | 'expired'
  | 'reactivated'
  | 'upgraded'
  | 'downgraded'
  | 'refunded'
  | 'paused'
  | 'unpaused';

export interface SubscriptionEvent {
  id: string;
  subscriptionId: string;
  userId: string;
  eventType: SubscriptionEventType;
  oldStatus: SubscriptionStatus | null;
  newStatus: SubscriptionStatus | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// ─── Feature Gate ────────────────────────────────────────────

export interface SubscriptionContext {
  planTier: PlanTier;
  planSlug: string;
  status: SubscriptionStatus;
  features: PlanFeatures;
  periodEnd: string;
}
