import { Resend } from 'resend';
import { config } from '../config.js';
import { createServiceLogger } from '../lib/logger.js';

const log = createServiceLogger('EmailService');

class EmailService {
  private resend: Resend | null = null;

  constructor() {
    if (config.resend.apiKey) {
      this.resend = new Resend(config.resend.apiKey);
      log.info('Resend client initialized');
    } else {
      log.warn('RESEND_API_KEY is not set. Emails will not be sent.');
    }
  }

  // ─── Welcome Email ─────────────────────────────────────────
  async sendWelcomeEmail(to: string, name: string): Promise<void> {
    if (!this.resend) {
      log.warn({ to }, 'Skipped sending welcome email (Resend not configured)');
      return;
    }

    try {
      const { data, error } = await this.resend.emails.send({
        from: config.resend.fromEmail,
        to,
        subject: 'Welcome to QuantiPi! 🚀',
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2b6cb0;">Welcome to QuantiPi, ${name}! 🎉</h2>
            <p>We're thrilled to have you on board. QuantiPi is designed to help you study smarter, not harder.</p>
            <p>Explore your dashboard, check out your personalized study plans, and start crushing your exams today.</p>
            <div style="margin: 30px 0;">
              <a href="https://quantipi.in" style="display: inline-block; padding: 12px 24px; background-color: #2b6cb0; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold;">Go to Dashboard</a>
            </div>
            <p>If you have any questions or need help getting started, just reply to this email or reach out to <strong>support@quantipi.in</strong>.</p>
            <hr style="border: none; border-top: 1px solid #eaeaea; margin: 30px 0;" />
            <p style="font-size: 12px; color: #888;">QuantiPi Team</p>
          </div>
        `,
      });

      if (error) {
        log.error({ error, to }, 'Failed to send welcome email via Resend API');
        return;
      }

      log.info({ to, id: data?.id }, 'Welcome email sent successfully');
    } catch (err) {
      log.error({ err, to }, 'Unexpected error sending welcome email');
    }
  }
  // ─── Subscription Upgrade Email ────────────────────────────
  async sendSubscriptionUpgradeEmail(to: string, name: string, planName: string): Promise<void> {
    if (!this.resend) {
      log.warn({ to }, 'Skipped sending upgrade email (Resend not configured)');
      return;
    }

    try {
      const { data, error } = await this.resend.emails.send({
        from: config.resend.fromEmail,
        to,
        subject: `Your QuantiPi ${planName} Subscription is Active! 🌟`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2b6cb0;">You're upgraded, ${name}! 🎉</h2>
            <p>Thank you for subscribing to the <strong>${planName}</strong> plan. Your payment was successful, and your account has been fully upgraded.</p>
            <p>You now have access to all premium features. Dive in and make the most of your study sessions.</p>
            <div style="margin: 30px 0;">
              <a href="https://quantipi.in" style="display: inline-block; padding: 12px 24px; background-color: #2b6cb0; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold;">Explore Premium Features</a>
            </div>
            <p>If you have any questions or need support, reply to this email or reach out to <strong>support@quantipi.in</strong>.</p>
            <hr style="border: none; border-top: 1px solid #eaeaea; margin: 30px 0;" />
            <p style="font-size: 12px; color: #888;">QuantiPi Team</p>
          </div>
        `,
      });

      if (error) {
        log.error({ error, to }, 'Failed to send upgrade email via Resend API');
        return;
      }

      log.info({ to, id: data?.id }, 'Upgrade email sent successfully');
    } catch (err) {
      log.error({ err, to }, 'Unexpected error sending upgrade email');
    }
  }
}

export const emailService = new EmailService();
