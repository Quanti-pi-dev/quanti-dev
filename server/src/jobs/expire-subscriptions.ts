// ─── Cron: Expire Subscriptions ──────────────────────────────
// Called by scheduler every 15 minutes.
// Expires trialing/active/past_due subscriptions that have passed their period end.

import { subscriptionRepository } from '../repositories/subscription.repository.js';
import { planRepository } from '../repositories/plan.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { subscriptionService } from '../services/subscription.service.js';
import { notificationService } from '../services/notification.service.js';
import { analyticsService } from '../services/analytics.service.js';
import type { FastifyBaseLogger } from 'fastify';

export async function expireSubscriptions(log: FastifyBaseLogger): Promise<void> {
  const now = new Date();
  log.info('Cron: expireSubscriptions starting');

  // 1. Expire trialing subscriptions whose trial_end has passed
  const expiredTrials = await subscriptionRepository.findExpiring(['trialing'], now);
  for (const sub of expiredTrials) {
    await subscriptionRepository.updateStatus(sub.id, 'expired');
    await subscriptionRepository.logEvent(sub.id, sub.userId, 'trial_expired', 'trialing', 'expired', {});
    await subscriptionService.invalidateCache(sub.userId);

    // Notify user
    const [plan, user] = await Promise.allSettled([
      planRepository.findById(sub.planId),
      userRepository.findByAuth0Id(sub.userId),
    ]);
    const planData = plan.status === 'fulfilled' ? plan.value : null;
    const userData = user.status === 'fulfilled' ? user.value : null;
    if (planData && userData) {
      void Promise.allSettled([
        analyticsService.trackTrialExpired(sub.userId, planData.slug),
        notificationService.handleEvent({ type: 'trial_expired', userId: sub.userId, email: userData.email, planName: planData.displayName }),
      ]);
    }
    log.info({ subscriptionId: sub.id }, 'Trial expired');
  }

  // 2. Expire canceled subscriptions whose period has ended
  const expiredCanceled = await subscriptionRepository.findExpiring(['canceled'], now);
  for (const sub of expiredCanceled) {
    await subscriptionRepository.updateStatus(sub.id, 'expired');
    await subscriptionRepository.logEvent(sub.id, sub.userId, 'expired', 'canceled', 'expired', {});
    await subscriptionService.invalidateCache(sub.userId);

    const [plan, user] = await Promise.allSettled([
      planRepository.findById(sub.planId),
      userRepository.findByAuth0Id(sub.userId),
    ]);
    const planData = plan.status === 'fulfilled' ? plan.value : null;
    const userData = user.status === 'fulfilled' ? user.value : null;
    if (planData && userData) {
      void Promise.allSettled([
        analyticsService.trackSubscriptionExpired(sub.userId, planData.slug, 'period_ended'),
        notificationService.handleEvent({ type: 'subscription_expired', userId: sub.userId, email: userData.email, planName: planData.displayName }),
      ]);
    }
    log.info({ subscriptionId: sub.id }, 'Canceled subscription expired');
  }

  // 3. Expire past_due subscriptions beyond grace period (handled by retry cron)
  // Subscriptions that still have retries remaining are handled by retry-payments cron.
  // Those with retry_count >= max are set to expired here after retry cron gives up.

  log.info(
    { expiredTrials: expiredTrials.length, expiredCanceled: expiredCanceled.length },
    'Cron: expireSubscriptions complete',
  );
}
