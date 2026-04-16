// ─── Notification Service ───────────────────────────────────
// Event-driven notification dispatch: email, push notifications.
// Currently provides a service layer; actual email/push providers
// can be plugged in (SendGrid, Firebase, etc.).

import { config } from '../config.js';
import { getRedisClient } from '../lib/database.js';
import { createServiceLogger } from '../lib/logger.js';

const log = createServiceLogger('NotificationService');

// ─── Types ──────────────────────────────────────────────────

export interface EmailPayload {
  to: string;
  subject: string;
  body: string;
  templateId?: string;
  templateData?: Record<string, string>;
}

export interface PushPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

type NotificationEvent =
  | { type: 'welcome'; userId: string; email: string; displayName: string }
  | { type: 'study_reminder'; userId: string; email: string; streakDays: number }
  | { type: 'badge_earned'; userId: string; email: string; badgeName: string }
  | { type: 'streak_milestone'; userId: string; email: string; streakDays: number }
  // ─── Subscription Events ─────────────────────────────
  | { type: 'trial_started'; userId: string; email: string; planName: string; trialDays: number }
  | { type: 'trial_ending'; userId: string; email: string; planName: string; daysLeft: number }
  | { type: 'trial_expired'; userId: string; email: string; planName: string }
  | { type: 'payment_failed'; userId: string; email: string; planName: string; retryCount: number }
  | { type: 'subscription_activated'; userId: string; email: string; planName: string }
  | { type: 'subscription_expired'; userId: string; email: string; planName: string }
  // ─── P2P Challenge Events ────────────────────
  | { type: 'challenge_received'; userId: string; challengerName: string }
  | { type: 'challenge_accepted'; userId: string; opponentName: string }
  | { type: 'challenge_declined'; userId: string; opponentName: string }
  | { type: 'challenge_won'; userId: string; coinsWon: number }
  | { type: 'challenge_lost'; userId: string }
  | { type: 'challenge_tie'; userId: string }
  // ─── Friend Events ───────────────────────────
  | { type: 'friend_request_received'; userId: string; requesterName: string }
  | { type: 'friend_request_accepted'; userId: string; accepterName: string };

// ─── Email Templates ────────────────────────────────────────

const emailTemplates: Record<string, (data: Record<string, string>) => EmailPayload> = {
  welcome: (data) => ({
    to: data['email']!,
    subject: 'Welcome to Study Platform! 🎓',
    body: `Hi ${data['name']},\n\nWelcome to Study Platform! Start your learning journey today.\n\nHappy studying!`,
  }),

  study_reminder: (data) => ({
    to: data['email']!,
    subject: `Don't break your ${data['streakDays']}-day streak! 🔥`,
    body: `You're on a ${data['streakDays']}-day study streak! Keep it going — study for just 5 minutes today.`,
  }),

  badge_earned: (data) => ({
    to: data['email']!,
    subject: `You earned a badge: ${data['badgeName']}! 🏆`,
    body: `Congratulations! You've earned the "${data['badgeName']}" badge. Keep up the great work!`,
  }),

  streak_milestone: (data) => ({
    to: data['email']!,
    subject: `Amazing! ${data['streakDays']}-day study streak! 🔥🔥🔥`,
    body: `Incredible dedication! You've studied for ${data['streakDays']} days in a row. You're in the top 5% of learners!`,
  }),

  // ─── Subscription templates ────────────────────────────
  trial_started: (data) => ({
    to: data['email']!,
    subject: `Your ${data['trialDays']}-day free trial has started 🎉`,
    body: `Hi there!\n\nYour free trial of ${data['planName']} is now active for ${data['trialDays']} days.\n\nExplore all features and upgrade before it ends to keep access.`,
  }),

  trial_ending: (data) => ({
    to: data['email']!,
    subject: `Your free trial ends in ${data['daysLeft']} day(s) ⏰`,
    body: `Your ${data['planName']} trial is ending soon!\n\nUpgrade now to keep your progress and uninterrupted access.\n\nUpgrade at: https://app.ouanti-pi.com/plans`,
  }),

  trial_expired: (data) => ({
    to: data['email']!,
    subject: `Your free trial has ended`,
    body: `Your ${data['planName']} trial has expired.\n\nUpgrade now to continue learning without interruption.\n\nChoose a plan: https://app.ouanti-pi.com/plans`,
  }),

  payment_failed: (data) => ({
    to: data['email']!,
    subject: `Payment failed — action required ⚠️`,
    body: `We couldn't process your payment for ${data['planName']}.\n\nPlease update your payment method to avoid losing access.\n\nRetry: https://app.ouanti-pi.com/billing\n\nAttempt: ${data['retryCount']} of 3`,
  }),

  subscription_activated: (data) => ({
    to: data['email']!,
    subject: `You're now on ${data['planName']} ✅`,
    body: `Your ${data['planName']} subscription is now active!\n\nStart learning at: https://app.ouanti-pi.com`,
  }),

  subscription_expired: (data) => ({
    to: data['email']!,
    subject: `Your subscription has ended`,
    body: `Your ${data['planName']} subscription has expired.\n\nRenew now to keep your streak alive and access all features.\n\nhttps://app.ouanti-pi.com/plans`,
  }),
};

// ─── Notification Service ───────────────────────────────────

class NotificationService {
  // Cached FCM auth client — lazily initialized once, reused across all push calls.
  private _googleAuth: InstanceType<typeof import('google-auth-library').GoogleAuth> | null = null;
  private _fcmProjectId: string | null = null;

  private async getFcmAuth() {
    if (this._googleAuth && this._fcmProjectId) {
      return { auth: this._googleAuth, projectId: this._fcmProjectId };
    }

    const { GoogleAuth } = await import('google-auth-library');
    this._googleAuth = new GoogleAuth({
      keyFilename: config.fcm.serviceAccountPath,
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    });

    // Read project ID from the service account file
    const sa = await import(config.fcm.serviceAccountPath, { assert: { type: 'json' } });
    this._fcmProjectId = sa.default?.project_id ?? sa.project_id ?? null;

    return { auth: this._googleAuth, projectId: this._fcmProjectId };
  }
  // ─── Process event → dispatch notification ────────────
  async handleEvent(event: NotificationEvent): Promise<void> {
    switch (event.type) {
      case 'welcome':
        await this.sendEmail(
          emailTemplates['welcome']!({
            email: event.email,
            name: event.displayName,
          }),
        );
        break;

      case 'study_reminder':
        await this.sendEmail(
          emailTemplates['study_reminder']!({
            email: event.email,
            streakDays: String(event.streakDays),
          }),
        );
        await this.sendPush({
          userId: event.userId,
          title: 'Time to study! 📚',
          body: `Don't break your ${event.streakDays}-day streak!`,
        });
        break;

      case 'badge_earned':
        await this.sendEmail(
          emailTemplates['badge_earned']!({
            email: event.email,
            badgeName: event.badgeName,
          }),
        );
        await this.sendPush({
          userId: event.userId,
          title: 'Badge Earned! 🏆',
          body: `You earned: ${event.badgeName}`,
        });
        break;

      case 'streak_milestone':
        await this.sendEmail(
          emailTemplates['streak_milestone']!({
            email: event.email,
            streakDays: String(event.streakDays),
          }),
        );
        break;

      // ─── Subscription events ────────────────────────────
      case 'trial_started':
        await this.sendEmail(emailTemplates['trial_started']!({
          email: event.email, planName: event.planName, trialDays: String(event.trialDays),
        }));
        await this.sendPush({ userId: event.userId, title: 'Trial started! 🎉', body: `Your ${event.planName} free trial is active for ${event.trialDays} days.` });
        break;

      case 'trial_ending':
        await this.sendEmail(emailTemplates['trial_ending']!({
          email: event.email, planName: event.planName, daysLeft: String(event.daysLeft),
        }));
        await this.sendPush({ userId: event.userId, title: 'Trial ending soon ⏰', body: `${event.daysLeft} day(s) left on your ${event.planName} trial. Upgrade now!` });
        break;

      case 'trial_expired':
        await this.sendEmail(emailTemplates['trial_expired']!({ email: event.email, planName: event.planName }));
        await this.sendPush({ userId: event.userId, title: 'Trial expired', body: `Your free trial ended. Choose a plan to continue.` });
        break;

      case 'payment_failed':
        await this.sendEmail(emailTemplates['payment_failed']!({
          email: event.email, planName: event.planName, retryCount: String(event.retryCount),
        }));
        await this.sendPush({ userId: event.userId, title: 'Payment failed ⚠️', body: 'Please update your payment method to keep your subscription.' });
        break;

      case 'subscription_activated':
        await this.sendEmail(emailTemplates['subscription_activated']!({ email: event.email, planName: event.planName }));
        await this.sendPush({ userId: event.userId, title: 'Subscription active ✅', body: `You're now on ${event.planName}. Happy learning!` });
        break;

      case 'subscription_expired':
        await this.sendEmail(emailTemplates['subscription_expired']!({ email: event.email, planName: event.planName }));
        await this.sendPush({ userId: event.userId, title: 'Subscription expired', body: 'Renew now to keep learning.' });
        break;

      // ─── P2P Challenge events (push only) ───────────
      case 'challenge_received':
        await this.sendPush({ userId: event.userId, title: '⚔️ Challenge Received!', body: `${event.challengerName} challenged you! Tap to accept.` });
        break;
      case 'challenge_accepted':
        await this.sendPush({ userId: event.userId, title: '🎮 Game On!', body: `${event.opponentName} accepted your challenge! Game starts now.` });
        break;
      case 'challenge_declined':
        await this.sendPush({ userId: event.userId, title: 'Challenge Declined', body: `${event.opponentName} declined your challenge. Bet refunded.` });
        break;
      case 'challenge_won':
        await this.sendPush({ userId: event.userId, title: '🏆 You Won!', body: `Amazing! You won ${event.coinsWon} coins!` });
        break;
      case 'challenge_lost':
        await this.sendPush({ userId: event.userId, title: 'Challenge Complete', body: 'Better luck next time. Keep studying!' });
        break;
      case 'challenge_tie':
        await this.sendPush({ userId: event.userId, title: 'It\'s a Tie!', body: 'Great game! Your bet has been refunded.' });
        break;

      // ─── Friend events (push only) ─────────────────
      case 'friend_request_received':
        await this.sendPush({ userId: event.userId, title: 'New Friend Request 👋', body: `${event.requesterName} wants to be your friend!` });
        break;
      case 'friend_request_accepted':
        await this.sendPush({ userId: event.userId, title: 'Friend Added! 🎉', body: `${event.accepterName} accepted your friend request.` });
        break;
    }
  }

  // ─── Email Dispatch (Resend) ─────────────────────────
  private async sendEmail(payload: EmailPayload): Promise<void> {
    if (config.env === 'development') {
      log.debug({ payload }, 'email payload (dev mode)');
      return;
    }

    if (!config.notifications.enabled || !config.resend.apiKey) {
      // Notifications disabled or Resend not configured — skip silently
      return;
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.resend.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: config.resend.fromEmail,
          to: [payload.to],
          subject: payload.subject,
          text: payload.body,
          // If a template is provided, Resend can use it instead of raw text
          ...(payload.templateId && { template: payload.templateId, data: payload.templateData }),
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'unknown');
        log.error({ statusCode: response.status, errorBody }, 'Resend API error');
      }
    } catch (err) {
      log.error({ err }, 'failed to send email via Resend');
    }
  }

  // ─── Push Notification Dispatch (FCM HTTP v1) ──────────
  private async sendPush(payload: PushPayload): Promise<void> {
    if (config.env === 'development') {
      log.debug({ payload }, 'push payload (dev mode)');
      return;
    }

    if (!config.notifications.enabled || !config.fcm.serviceAccountPath) {
      // Notifications disabled or FCM not configured — skip silently
      return;
    }

    try {
      // Look up FCM token for the user from the database
      const fcmToken = await getRedisClient().get(`fcm_token:${payload.userId}`);
      if (!fcmToken) {
        // User has no registered device token — skip
        return;
      }

      // Get cached FCM auth client and project ID
      const { auth: fcmAuth, projectId } = await this.getFcmAuth();
      if (!projectId) {
        log.error('FCM service account missing project_id');
        return;
      }

      const client = await fcmAuth.getClient();
      const accessToken = (await client.getAccessToken()).token;

      if (!accessToken) {
        log.error('failed to obtain FCM access token');
        return;
      }

      const response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token: fcmToken,
              notification: {
                title: payload.title,
                body: payload.body,
              },
              data: payload.data ?? {},
            },
          }),
        },
      );

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'unknown');
        log.error({ statusCode: response.status, errorBody }, 'FCM API error');

        // If token is invalid/expired, clean it up
        if (response.status === 404 || response.status === 400) {
          await getRedisClient().del(`fcm_token:${payload.userId}`);
        }
      }
    } catch (err) {
      log.error({ err }, 'failed to send push via FCM');
    }
  }
}

export const notificationService = new NotificationService();
