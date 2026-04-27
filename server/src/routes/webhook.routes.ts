// ─── Razorpay Webhook Handler ────────────────────────────────
// Receives and processes Razorpay async events (payment.captured,
// payment.failed, refund.created). Idempotent and signature-verified.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { paymentService } from '../services/payment.service.js';
import { paymentRepository } from '../repositories/payment.repository.js';
import { subscriptionRepository } from '../repositories/subscription.repository.js';
import { subscriptionService } from '../services/subscription.service.js';
import { coinPackRepository } from '../repositories/coinpack.repository.js';
import { gamificationRepository } from '../repositories/gamification.repository.js';

interface RazorpayWebhookPayload {
  event: string;
  payload: {
    payment?: {
      entity: {
        id: string;
        order_id: string;
        status: string;
        error_description?: string;
        // Present on subscription payments
        subscription_id?: string;
      };
    };
    refund?: {
      entity: {
        id: string;
        payment_id: string;
        amount: number;
      };
    };
    subscription?: {
      entity: {
        id: string;               // Razorpay sub ID e.g. "sub_XXXX"
        plan_id: string;
        status: string;           // "charged" | "halted" | "cancelled" | "active" etc.
        current_start: number;    // Unix timestamp — start of the newly charged period
        current_end: number;      // Unix timestamp — end of the newly charged period
        paid_count: number;
        charge_at?: number;       // Next charge scheduled time
      };
    };
  };
}

export async function webhookRoutes(fastify: FastifyInstance): Promise<void> {
  // Isolate the webhook in its own encapsulated scope so the raw-body
  // JSON parser doesn't conflict with the global JSON parser used by
  // every other route. Without this, Fastify may throw
  // FST_ERR_CTP_ALREADY_PRESENT or silently break JSON parsing globally.
  fastify.register(async function webhookScope(scope) {
    scope.addContentTypeParser(
      'application/json',
      { parseAs: 'string' },
      function (_req, body, done) {
        done(null, body);
      },
    );

    scope.post('/webhooks/razorpay', async (request: FastifyRequest, reply: FastifyReply) => {
      const rawBody = request.body as string;
      const signature = request.headers['x-razorpay-signature'];

      // 1. Verify webhook signature
      if (!signature || typeof signature !== 'string') {
        request.log.warn('Razorpay webhook: missing signature header');
        return reply.status(400).send({ error: 'Missing signature' });
      }

      const isValid = paymentService.verifyWebhookSignature(rawBody, signature);
      if (!isValid) {
        request.log.warn('Razorpay webhook: invalid signature');
        return reply.status(400).send({ error: 'Invalid signature' });
      }

      // 2. Parse payload
      let event: RazorpayWebhookPayload;
      try {
        event = JSON.parse(rawBody) as RazorpayWebhookPayload;
      } catch {
        return reply.status(400).send({ error: 'Invalid JSON payload' });
      }

      request.log.info({ event: event.event }, 'Razorpay webhook received');

      // 3. Route to handler
      try {
        switch (event.event) {
          case 'payment.captured':
            await handlePaymentCaptured(event, request);
            break;
          case 'payment.failed':
            await handlePaymentFailed(event, request);
            break;
          case 'refund.created':
            await handleRefundCreated(event, request);
            break;

          // ─── Recurring subscription lifecycle events ─────────────────────
          case 'subscription.charged':
            // Fired after each successful recurring debit.
            // This is the primary trigger for extending the billing period.
            await handleSubscriptionCharged(event, request);
            break;
          case 'subscription.halted':
            // Fired when all auto-retry attempts for a charge fail.
            // The subscription mandate is suspended by Razorpay.
            await handleSubscriptionHalted(event, request);
            break;
          case 'subscription.cancelled':
            // Fired when the Razorpay subscription is fully cancelled
            // (either by us calling the cancel API or Razorpay auto-cancellation).
            await handleSubscriptionCancelled(event, request);
            break;

          default:
            request.log.info({ event: event.event }, 'Unhandled Razorpay webhook event');
        }
      } catch (err) {
        request.log.error({ err, event: event.event }, 'Error processing Razorpay webhook');
        // Return 200 to Razorpay so it does NOT retry — we handle failures internally
      }

      // Always return 200 to acknowledge receipt
      return reply.status(200).send({ received: true });
    });
  });
}

// ─── payment.captured ────────────────────────────────────────

async function handlePaymentCaptured(
  event: RazorpayWebhookPayload,
  request: FastifyRequest,
): Promise<void> {
  const entity = event.payload.payment?.entity;
  if (!entity) return;

  const { id: razorpayPaymentId, order_id: razorpayOrderId } = entity;

  // Idempotency: check if already processed
  const existing = await paymentRepository.findByPaymentId(razorpayPaymentId);
  if (existing?.webhookVerified) {
    request.log.info({ razorpayPaymentId }, 'Webhook already processed, skipping');
    return;
  }

  // Find payment by order ID (in case client callback didn't arrive yet)
  const payment = existing ?? await paymentRepository.findByOrderId(razorpayOrderId);
  if (!payment) {
    // Not a subscription payment — check if it's a coin pack purchase
    await handleCoinPackWebhook(razorpayOrderId, razorpayPaymentId, request);
    return;
  }

  // Update payment
  await paymentRepository.markCaptured(razorpayOrderId, razorpayPaymentId, '', true);

  // Ensure subscription is active
  const sub = await subscriptionRepository.findById(payment.subscriptionId);
  if (sub && sub.status !== 'active') {
    await subscriptionRepository.updateStatus(sub.id, 'active');
    await subscriptionService.invalidateCache(sub.userId);
    await subscriptionRepository.logEvent(sub.id, sub.userId, 'activated', sub.status, 'active', {
      source: 'webhook',
      razorpay_payment_id: razorpayPaymentId,
    });
  }

  await paymentRepository.markWebhookVerified(razorpayPaymentId);
}

// ─── Coin Pack webhook fallback ──────────────────────────────

async function handleCoinPackWebhook(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  request: FastifyRequest,
): Promise<void> {
  const purchase = await coinPackRepository.findPurchaseByOrderId(razorpayOrderId);
  if (!purchase) {
    request.log.warn({ razorpayOrderId }, 'No payment or coin pack purchase found for webhook');
    return;
  }

  // Idempotency: already captured
  if (purchase.status === 'captured') {
    request.log.info({ razorpayOrderId }, 'Coin pack webhook already processed, skipping');
    return;
  }

  // Mark captured and credit coins (atomic: only credit if WE flipped the status)
  const captured = await coinPackRepository.markPurchaseCaptured(razorpayOrderId, razorpayPaymentId, 'webhook');
  if (!captured) {
    // Another process (client /verify) already captured — skip to avoid double-credit
    request.log.info({ razorpayOrderId }, 'Coin pack already captured by /verify endpoint, skipping webhook credit');
    return;
  }
  await gamificationRepository.earnCoins(purchase.userId, purchase.coinsCredited, 'coin_pack_purchase');

  request.log.info(
    { userId: purchase.userId, coins: purchase.coinsCredited, orderId: razorpayOrderId },
    'Coin pack purchase completed via webhook fallback',
  );
}

// ─── payment.failed ──────────────────────────────────────────

async function handlePaymentFailed(
  event: RazorpayWebhookPayload,
  request: FastifyRequest,
): Promise<void> {
  const entity = event.payload.payment?.entity;
  if (!entity) return;

  const reason = entity.error_description ?? 'Payment failed';
  await paymentRepository.markFailed(entity.order_id, reason);

  const payment = await paymentRepository.findByOrderId(entity.order_id);
  if (!payment) return;

  const sub = await subscriptionRepository.findById(payment.subscriptionId);
  if (!sub) return;

  // Move to past_due only if currently active/trialing
  if (['active', 'trialing'].includes(sub.status)) {
    await subscriptionRepository.updateStatus(sub.id, 'past_due', {
      retryCount: sub.retryCount + 1,
    });
    await subscriptionService.invalidateCache(sub.userId);
    await subscriptionRepository.logEvent(sub.id, sub.userId, 'payment_failed', sub.status, 'past_due', {
      reason,
      source: 'webhook',
    });
    request.log.warn({ subscriptionId: sub.id, reason }, 'Subscription moved to past_due');
  }
}

// ─── refund.created ──────────────────────────────────────────

async function handleRefundCreated(
  event: RazorpayWebhookPayload,
  request: FastifyRequest,
): Promise<void> {
  const entity = event.payload.refund?.entity;
  if (!entity) return;

  const payment = await paymentRepository.findByPaymentId(entity.payment_id);
  if (!payment) {
    request.log.warn({ razorpayPaymentId: entity.payment_id }, 'Payment not found for refund webhook');
    return;
  }

  const isFull = entity.amount >= payment.amountPaise;
  await paymentRepository.markRefunded(entity.payment_id, entity.amount, isFull);

  request.log.info(
    { paymentId: payment.id, refundAmount: entity.amount, isFull },
    'Refund processed',
  );
}

// ─── subscription.charged ─────────────────────────────────────
// Fired by Razorpay after each successful automatic debit.
// This is the authoritative signal to extend the subscription period.

async function handleSubscriptionCharged(
  event: RazorpayWebhookPayload,
  request: FastifyRequest,
): Promise<void> {
  const subEntity = event.payload.subscription?.entity;
  const paymentEntity = event.payload.payment?.entity;
  if (!subEntity) return;

  const razorpaySubscriptionId = subEntity.id;

  // Look up our internal subscription by Razorpay sub ID
  const sub = await subscriptionRepository.findByRazorpaySubscriptionId(razorpaySubscriptionId);
  if (!sub) {
    request.log.warn({ razorpaySubscriptionId }, 'subscription.charged: no local subscription found');
    return;
  }

  // Idempotency: if this charge already extended the period past current_end, skip
  const newPeriodEnd = new Date(subEntity.current_end * 1000);
  const newPeriodStart = new Date(subEntity.current_start * 1000);
  const existingEnd = new Date(sub.currentPeriodEnd);
  if (newPeriodEnd <= existingEnd) {
    request.log.info(
      { razorpaySubscriptionId, existingEnd, newPeriodEnd },
      'subscription.charged: period already up-to-date, skipping',
    );
    return;
  }

  // Extend the billing period and reset retry counter
  await subscriptionRepository.updateStatus(sub.id, 'active', {
    currentPeriodStart: newPeriodStart,
    currentPeriodEnd: newPeriodEnd,
    retryCount: 0,
    cancelAtPeriodEnd: false,
  });

  // Record the recurring payment if we have payment details
  if (paymentEntity) {
    await paymentRepository.create({
      subscriptionId: sub.id,
      userId: sub.userId,
      razorpayOrderId: paymentEntity.order_id,
      razorpaySubscriptionId,
      amountPaise: 0, // amount resolved via separate payment.captured event
      attemptNumber: subEntity.paid_count,
    });
  }

  await subscriptionRepository.logEvent(sub.id, sub.userId, 'renewed', sub.status, 'active', {
    source: 'webhook',
    razorpay_subscription_id: razorpaySubscriptionId,
    razorpay_payment_id: paymentEntity?.id,
    new_period_end: newPeriodEnd.toISOString(),
    paid_count: subEntity.paid_count,
  });

  await subscriptionService.invalidateCache(sub.userId);

  request.log.info(
    { subscriptionId: sub.id, userId: sub.userId, newPeriodEnd },
    'Subscription renewed via auto-debit',
  );
}

// ─── subscription.halted ──────────────────────────────────────
// Fired when all Razorpay retry attempts for a recurring charge fail.
// The Razorpay mandate is suspended; we move the sub to past_due.

async function handleSubscriptionHalted(
  event: RazorpayWebhookPayload,
  request: FastifyRequest,
): Promise<void> {
  const subEntity = event.payload.subscription?.entity;
  if (!subEntity) return;

  const sub = await subscriptionRepository.findByRazorpaySubscriptionId(subEntity.id);
  if (!sub) {
    request.log.warn({ razorpaySubscriptionId: subEntity.id }, 'subscription.halted: no local subscription found');
    return;
  }

  if (sub.status === 'past_due' || sub.status === 'expired') return; // already handled

  await subscriptionRepository.updateStatus(sub.id, 'past_due');
  await subscriptionRepository.logEvent(sub.id, sub.userId, 'payment_failed', sub.status, 'past_due', {
    source: 'webhook',
    razorpay_subscription_id: subEntity.id,
    reason: 'subscription_halted_all_retries_exhausted',
  });

  await subscriptionService.invalidateCache(sub.userId);

  request.log.warn(
    { subscriptionId: sub.id, userId: sub.userId },
    'Subscription halted — all retry attempts failed',
  );
}

// ─── subscription.cancelled ───────────────────────────────────
// Fired when the Razorpay subscription is fully and finally cancelled.
// This is distinct from our local cancel (which is cancel_at_period_end);
// here the mandate is gone. Expire the subscription immediately if it
// hasn't already ended.

async function handleSubscriptionCancelled(
  event: RazorpayWebhookPayload,
  request: FastifyRequest,
): Promise<void> {
  const subEntity = event.payload.subscription?.entity;
  if (!subEntity) return;

  const sub = await subscriptionRepository.findByRazorpaySubscriptionId(subEntity.id);
  if (!sub) {
    request.log.warn({ razorpaySubscriptionId: subEntity.id }, 'subscription.cancelled: no local subscription found');
    return;
  }

  if (sub.status === 'expired' || sub.status === 'canceled') return; // already handled

  // If the period has already ended, expire immediately; otherwise honour cancel_at_period_end
  const now = new Date();
  const periodEnded = new Date(sub.currentPeriodEnd) <= now;
  const newStatus = periodEnded ? 'expired' : 'canceled';

  await subscriptionRepository.updateStatus(sub.id, newStatus, {
    canceledAt: new Date(),
    cancelAtPeriodEnd: !periodEnded,
  });

  await subscriptionRepository.logEvent(sub.id, sub.userId, 'canceled', sub.status, newStatus, {
    source: 'webhook',
    razorpay_subscription_id: subEntity.id,
    period_ended: periodEnded,
  });

  await subscriptionService.invalidateCache(sub.userId);

  request.log.info(
    { subscriptionId: sub.id, userId: sub.userId, newStatus },
    'Razorpay subscription cancelled webhook processed',
  );
}
