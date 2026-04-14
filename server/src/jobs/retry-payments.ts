// ─── Cron: Retry Failed Payments ─────────────────────────────
// Called every 6 hours. Retries past_due subscriptions up to 3 times.
// Schedule: Day 1, 3, 7 after initial failure.

import { subscriptionRepository } from '../repositories/subscription.repository.js';
import { subscriptionService } from '../services/subscription.service.js';
import { paymentService } from '../services/payment.service.js';
import { paymentRepository } from '../repositories/payment.repository.js';
import type { FastifyBaseLogger } from 'fastify';

const MAX_RETRIES = 3;

export async function retryFailedPayments(log: FastifyBaseLogger): Promise<void> {
  log.info('Cron: retryFailedPayments starting');

  const pastDueSubs = await subscriptionRepository.findForRetry(MAX_RETRIES);
  log.info({ count: pastDueSubs.length }, 'Found past_due subscriptions for retry');

  for (const sub of pastDueSubs) {
    try {
      log.info({ subscriptionId: sub.id, retryCount: sub.retryCount }, 'Retrying payment');

      // Get the original payment amount
      const payments = await paymentRepository.listByUserId(sub.userId, 1, 0);
      const lastPayment = payments[0];
      if (!lastPayment) {
        log.warn({ subscriptionId: sub.id }, 'No payment record found for retry');
        continue;
      }

      // Create a new Razorpay order for the retry
      const order = await paymentService.createOrder(lastPayment.amountPaise, sub.id);

      // Record the retry payment attempt
      await paymentRepository.create({
        subscriptionId: sub.id,
        userId: sub.userId,
        razorpayOrderId: order.orderId,
        amountPaise: lastPayment.amountPaise,
        attemptNumber: sub.retryCount + 2, // +2 because attempt 1 already failed
      });

      await subscriptionRepository.logEvent(sub.id, sub.userId, 'payment_retried', 'past_due', 'past_due', {
        retry_count: sub.retryCount + 1,
        razorpay_order_id: order.orderId,
      });

      log.info({ subscriptionId: sub.id, orderId: order.orderId }, 'Retry order created');
    } catch (err) {
      log.error({ err, subscriptionId: sub.id }, 'Failed to create retry order');

      const newRetryCount = sub.retryCount + 1;

      if (newRetryCount >= MAX_RETRIES) {
        // All retries exhausted — expire subscription
        await subscriptionRepository.updateStatus(sub.id, 'expired');
        await subscriptionRepository.logEvent(sub.id, sub.userId, 'expired', 'past_due', 'expired', {
          reason: 'max_retries_exhausted',
          retry_count: newRetryCount,
        });
        await subscriptionService.invalidateCache(sub.userId);
        log.warn({ subscriptionId: sub.id }, 'Subscription expired after max retries');
      } else {
        await subscriptionRepository.updateStatus(sub.id, 'past_due', {
          retryCount: newRetryCount,
        });
      }
    }
  }

  log.info({ processed: pastDueSubs.length }, 'Cron: retryFailedPayments complete');
}
