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
      };
    };
    refund?: {
      entity: {
        id: string;
        payment_id: string;
        amount: number;
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
