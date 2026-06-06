// ─── Subscription API Service ─────────────────────────────────

import { api } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Plan, SubscriptionSummary, CouponValidationResult } from '@kd/shared';

// ─── Plans ────────────────────────────────────────────────────

export async function fetchPlans(): Promise<Plan[]> {
  const { data } = await api.get('/plans');
  return (data?.data ?? []) as Plan[];
}

// ─── My Subscription ──────────────────────────────────────────

export async function fetchMySubscription(): Promise<SubscriptionSummary | null> {
  const { data } = await api.get('/subscriptions/me');
  return (data?.data ?? null) as SubscriptionSummary | null;
}

// ─── Checkout ─────────────────────────────────────────────────

export interface CheckoutResult {
  orderId: string;
  /** Present for recurring subscriptions — used as subscription_id in Razorpay SDK. */
  razorpaySubscriptionId?: string | null;
  amountPaise: number;
  currency?: string;
  keyId: string;
  plan: Plan;
  discountPaise?: number;
  /** 0 = immediate paid; >0 = trial with mandate (first charge deferred) */
  trialDays: number;
  prefill?: { name?: string; email?: string };
  subscription?: {
    id: string;
    currentPeriodEnd: string;
    trialEnd: string | null;
  };
}

export async function initiateCheckout(
  planId: string,
  couponCode?: string,
  skipTrial: boolean = false,
): Promise<CheckoutResult> {
  const { data } = await api.post('/subscriptions/checkout', { planId, couponCode, skipTrial });
  return data?.data as CheckoutResult;
}

// ─── Verify Payment ────────────────────────────────────────────

export interface PaymentVerification {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export async function verifyPayment(payload: PaymentVerification): Promise<SubscriptionSummary> {
  const { data } = await api.post('/subscriptions/verify', payload);
  return data?.data as SubscriptionSummary;
}

// ─── Pending-Verify Queue ─────────────────────────────────────
// When the optimistic overlay is shown, the Razorpay signature payload is
// written here BEFORE the background verify attempt fires. If the verify call
// fails all retries (server down, app killed mid-request), this entry survives
// in AsyncStorage and is drained on the next app open — so no Razorpay-captured
// payment ever goes permanently unactivated in our database.
//
// The /subscriptions/verify endpoint is fully idempotent (returns the current
// summary if already captured), so re-sending a payload is always safe.

const PENDING_VERIFY_KEY = 'sub:pending_verify';

export interface PendingVerification extends PaymentVerification {
  capturedAt: string; // ISO timestamp — for diagnostics
}

/** Persist a verify payload to the durable queue. Call immediately after Razorpay resolves. */
export async function enqueuePendingVerify(payload: PaymentVerification): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_VERIFY_KEY);
    const queue: PendingVerification[] = raw ? JSON.parse(raw) : [];
    // Deduplicate by paymentId — safe to call multiple times
    if (!queue.some((p) => p.razorpayPaymentId === payload.razorpayPaymentId)) {
      queue.push({ ...payload, capturedAt: new Date().toISOString() });
      await AsyncStorage.setItem(PENDING_VERIFY_KEY, JSON.stringify(queue));
    }
  } catch {
    // Non-fatal — worst case the recovery entry isn't persisted
  }
}

/** Remove a successfully-verified entry from the queue. */
export async function dequeuePendingVerify(razorpayPaymentId: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_VERIFY_KEY);
    if (!raw) return;
    const queue: PendingVerification[] = JSON.parse(raw);
    const filtered = queue.filter((p) => p.razorpayPaymentId !== razorpayPaymentId);
    await AsyncStorage.setItem(PENDING_VERIFY_KEY, JSON.stringify(filtered));
  } catch {
    // Non-fatal
  }
}

/** Read the full pending-verify queue (called on app open to drain stale entries). */
export async function loadPendingVerifyQueue(): Promise<PendingVerification[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_VERIFY_KEY);
    return raw ? (JSON.parse(raw) as PendingVerification[]) : [];
  } catch {
    return [];
  }
}

// ─── Cancel / Reactivate ──────────────────────────────────────

export async function cancelSubscription(): Promise<SubscriptionSummary> {
  const { data } = await api.post('/subscriptions/cancel');
  return data?.data as SubscriptionSummary;
}

export async function reactivateSubscription(): Promise<SubscriptionSummary> {
  const { data } = await api.post('/subscriptions/reactivate');
  return data?.data as SubscriptionSummary;
}

// ─── Coupon ───────────────────────────────────────────────────

export async function validateCoupon(
  code: string,
  planId: string,
): Promise<CouponValidationResult> {
  const { data } = await api.post('/coupons/validate', { code, planId });
  return data?.data as CouponValidationResult;
}

// ─── Display Helpers ─────────────────────────────────────────

export function formatPrice(paise: number): string {
  const rupees = paise / 100;
  // Show decimals only when there's a fractional part
  const formatted = rupees % 1 === 0 ? rupees.toFixed(0) : rupees.toFixed(2);
  return `₹${formatted}`;
}

export function formatCycle(cycle: string): string {
  return cycle === 'weekly' ? '/wk' : '/mo';
}
