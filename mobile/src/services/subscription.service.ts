// ─── Subscription API Service ─────────────────────────────────

import { api } from './api';
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
  trial: boolean;
  orderId?: string;
  /** Present for recurring paid subscriptions — used as subscription_id in Razorpay SDK. */
  razorpaySubscriptionId?: string | null;
  amountPaise?: number;
  currency?: string;
  keyId?: string;
  plan: Plan;
  discountPaise?: number;
  subscription?: {
    id: string;
    currentPeriodEnd: string;
    trialEnd: string | null;
  };
}

export async function initiateCheckout(
  planId: string,
  couponCode?: string,
): Promise<CheckoutResult> {
  const { data } = await api.post('/subscriptions/checkout', { planId, couponCode });
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
