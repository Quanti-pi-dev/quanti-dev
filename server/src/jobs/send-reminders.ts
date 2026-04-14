// ─── Cron: Send Subscription Reminders ──────────────────────
// Daily job: trial-ending reminders + renewal-due reminders.
// Runs at startup and then every 24 hours.

import { subscriptionRepository } from '../repositories/subscription.repository.js';
import { planRepository } from '../repositories/plan.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { notificationService } from '../services/notification.service.js';
import { analyticsService } from '../services/analytics.service.js';
import type { FastifyBaseLogger } from 'fastify';

export async function sendSubscriptionReminders(log: FastifyBaseLogger): Promise<void> {
  log.info('Cron: sendSubscriptionReminders starting');

  // ─── Trial ending in ≤24 hours ─────────────────────────
  const trialEndingSoon = await subscriptionRepository.findTrialEndingSoon(24);
  log.info({ count: trialEndingSoon.length }, 'Trial-ending reminders to send');

  for (const sub of trialEndingSoon) {
    try {
      const [planResult, userResult] = await Promise.allSettled([
        planRepository.findById(sub.planId),
        userRepository.findByAuth0Id(sub.userId),
      ]);

      const plan = planResult.status === 'fulfilled' ? planResult.value : null;
      const user = userResult.status === 'fulfilled' ? userResult.value : null;

      if (!plan || !user) continue;

      const daysLeft = sub.trialEnd
        ? Math.max(1, Math.ceil((new Date(sub.trialEnd).getTime() - Date.now()) / 86_400_000))
        : 1;

      await notificationService.handleEvent({
        type: 'trial_ending',
        userId: sub.userId,
        email: user.email,
        planName: plan.displayName,
        daysLeft,
      });

      await analyticsService.track(sub.userId, 'trial.ending_soon', {
        plan_slug: plan.slug,
        days_remaining: daysLeft,
      });

      log.info({ subscriptionId: sub.id, daysLeft }, 'Trial ending reminder sent');
    } catch (err) {
      log.error({ err, subscriptionId: sub.id }, 'Failed to send trial reminder');
    }
  }

  // ─── Active subscriptions renewing in ≤48 hours ────────
  const renewingSoon = await subscriptionRepository.findExpiring(['active'], 
    new Date(Date.now() + 48 * 60 * 60 * 1000)
  );

  log.info({ count: renewingSoon.length }, 'Renewal reminders to send');

  for (const sub of renewingSoon) {
    try {
      // Only send for subscriptions not yet in expiry window (more than 0 days left)
      const hoursLeft = (new Date(sub.currentPeriodEnd).getTime() - Date.now()) / 3_600_000;
      if (hoursLeft <= 0) continue;

      const [planResult, userResult] = await Promise.allSettled([
        planRepository.findById(sub.planId),
        userRepository.findByAuth0Id(sub.userId),
      ]);

      const plan = planResult.status === 'fulfilled' ? planResult.value : null;
      const user = userResult.status === 'fulfilled' ? userResult.value : null;

      if (!plan || !user) continue;

      // Reuse trial_ending template for renewal (1-2 days notice)
      const daysLeft = Math.max(1, Math.ceil(hoursLeft / 24));
      await notificationService.handleEvent({
        type: 'trial_ending',  // renewal reminder uses same UX
        userId: sub.userId,
        email: user.email,
        planName: plan.displayName,
        daysLeft,
      });

      log.info({ subscriptionId: sub.id, daysLeft }, 'Renewal reminder sent');
    } catch (err) {
      log.error({ err, subscriptionId: sub.id }, 'Failed to send renewal reminder');
    }
  }

  log.info('Cron: sendSubscriptionReminders complete');
}
