// ─── Payment Service ──────────────────────────────────────────
// Razorpay integration: order creation, signature verification, webhooks.

import crypto from 'crypto';
import { config } from '../config.js';

const RAZORPAY_BASE = 'https://api.razorpay.com/v1';

interface RazorpayOrderResponse {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
}

interface RazorpayRefundResponse {
  id: string;
  payment_id: string;
  amount: number;
}

interface RazorpayPlanResponse {
  id: string;           // e.g. "plan_XXXX"
  interval: number;
  period: string;       // "weekly" | "monthly"
  item: {
    name: string;
    amount: number;
    currency: string;
  };
}

interface RazorpaySubscriptionResponse {
  id: string;            // e.g. "sub_XXXX"
  plan_id: string;
  status: string;
  total_count: number;
  paid_count: number;
  current_start: number; // unix timestamp
  current_end: number;   // unix timestamp
  customer_id?: string;
  short_url?: string;
}

// ─── Razorpay HTTP helper ─────────────────────────────────────

const RAZORPAY_TIMEOUT_MS = 15_000;

async function razorpayRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const credentials = Buffer.from(
    `${config.razorpay.keyId}:${config.razorpay.keySecret}`,
  ).toString('base64');

  // Timeout guard — same pattern as auth.service (FIX A9)
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RAZORPAY_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${RAZORPAY_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Razorpay API error ${response.status}: ${JSON.stringify(error)}`);
  }

  return response.json() as Promise<T>;
}

// ─── Payment Service ─────────────────────────────────────────

class PaymentService {
  // ─── Create Razorpay order (one-off) ──────────────────────
  async createOrder(amountPaise: number, receiptId: string): Promise<{ orderId: string; amountPaise: number }> {
    const order = await razorpayRequest<RazorpayOrderResponse>('POST', '/orders', {
      amount: amountPaise,
      currency: 'INR',
      receipt: receiptId.slice(0, 40), // Razorpay receipt max length = 40
    });

    return {
      orderId: order.id,
      amountPaise: order.amount,
    };
  }

  // ─── Create Razorpay Plan (recurring) ────────────────────
  // Razorpay Plans represent a reusable billing template. One plan per
  // (billing_cycle, amount) combination. We create it lazily on first checkout.
  async createRazorpayPlan(input: {
    name: string;
    amountPaise: number;
    period: 'weekly' | 'monthly';
    currency?: string;
  }): Promise<{ razorpayPlanId: string }> {
    const plan = await razorpayRequest<RazorpayPlanResponse>('POST', '/plans', {
      period: input.period,
      interval: 1,
      item: {
        name: input.name,
        amount: input.amountPaise,
        currency: input.currency ?? 'INR',
      },
    });
    return { razorpayPlanId: plan.id };
  }

  // ─── Create Razorpay Subscription (recurring billing mandate) ──
  // This replaces createOrder for paid, recurring subscriptions.
  // The SDK uses the returned subscription_id to launch the checkout modal
  // which captures the customer's UPI Autopay / card mandate.
  async createRazorpaySubscription(input: {
    razorpayPlanId: string;
    totalCount: number;   // How many billing cycles (use a large number like 120 for "indefinite")
    customerId?: string;  // Razorpay customer ID if already known
    customerNotify?: 0 | 1;
    subscriptionReceiptId?: string;
  }): Promise<{ razorpaySubscriptionId: string; shortUrl?: string }> {
    const sub = await razorpayRequest<RazorpaySubscriptionResponse>('POST', '/subscriptions', {
      plan_id: input.razorpayPlanId,
      total_count: input.totalCount,
      customer_notify: input.customerNotify ?? 1,
      ...(input.customerId ? { customer_id: input.customerId } : {}),
    });
    return {
      razorpaySubscriptionId: sub.id,
      shortUrl: sub.short_url,
    };
  }

  // ─── Cancel Razorpay Subscription ──────────────────────────
  // cancelAtCycleEnd=1 means cancel at billing period end (graceful);
  // cancelAtCycleEnd=0 means cancel immediately.
  async cancelRazorpaySubscription(
    razorpaySubscriptionId: string,
    cancelAtCycleEnd = 1,
  ): Promise<void> {
    await razorpayRequest<RazorpaySubscriptionResponse>(
      'POST',
      `/subscriptions/${razorpaySubscriptionId}/cancel`,
      { cancel_at_cycle_end: cancelAtCycleEnd },
    );
  }

  // ─── Verify payment signature ────────────────────────────
  // HMAC-SHA256(order_id + "|" + payment_id, key_secret)
  verifyPaymentSignature(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
  ): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', config.razorpay.keySecret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

      if (expectedSignature.length !== razorpaySignature.length) return false;

      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(razorpaySignature, 'hex'),
      );
    } catch {
      // Malformed hex or buffer length mismatch — treat as invalid
      return false;
    }
  }

  // ─── Verify webhook signature ────────────────────────────
  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', config.razorpay.webhookSecret)
        .update(rawBody)
        .digest('hex');

      if (expectedSignature.length !== signature.length) return false;

      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(signature, 'hex'),
      );
    } catch {
      // Malformed hex or buffer length mismatch — treat as invalid
      return false;
    }
  }

  // ─── Initiate refund ─────────────────────────────────────
  async createRefund(
    razorpayPaymentId: string,
    amountPaise: number,
  ): Promise<{ refundId: string; amountPaise: number }> {
    const refund = await razorpayRequest<RazorpayRefundResponse>(
      'POST',
      `/payments/${razorpayPaymentId}/refund`,
      { amount: amountPaise },
    );

    return { refundId: refund.id, amountPaise: refund.amount };
  }
}

export const paymentService = new PaymentService();
