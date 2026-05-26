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

  // ─── Staff Invite Email ────────────────────────────────────
  // Sent when an admin provisions a new educator/examiner account.
  async sendStaffInviteEmail(opts: {
    to: string;
    name: string;
    instituteName: string;
    role: string;         // 'educator' | 'examiner' | 'institute_admin'
    tempPassword: string;
    portalUrl: string;
  }): Promise<void> {
    if (!this.resend) {
      log.warn({ to: opts.to }, 'Skipped sending staff invite email (Resend not configured)');
      return;
    }

    const roleLabel = opts.role === 'institute_admin' ? 'Institute Admin'
      : opts.role === 'examiner' ? 'Examiner'
      : 'Educator';

    try {
      const { data, error } = await this.resend.emails.send({
        from: config.resend.fromEmail,
        to: opts.to,
        subject: `You've been added to ${opts.instituteName} on QuantiPi`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #6366f1;">Welcome to ${opts.instituteName}! 👋</h2>
            <p>Hi ${opts.name},</p>
            <p>You have been added as a <strong>${roleLabel}</strong> on QuantiPi for <strong>${opts.instituteName}</strong>.</p>
            <p>Use the credentials below to sign in to the Institute Portal:</p>
            <div style="background: #f4f4f9; border: 1px solid #e0e0f0; border-radius: 8px; padding: 16px; margin: 24px 0;">
              <p style="margin: 4px 0;"><strong>Portal:</strong> <a href="${opts.portalUrl}">${opts.portalUrl}</a></p>
              <p style="margin: 4px 0;"><strong>Email:</strong> ${opts.to}</p>
              <p style="margin: 4px 0;"><strong>Temporary Password:</strong> <code style="background:#e8e8f8;padding:2px 6px;border-radius:4px;">${opts.tempPassword}</code></p>
            </div>
            <p style="color: #e53e3e; font-weight: 600;">⚠️ Please change your password after your first login.</p>
            <div style="margin: 30px 0;">
              <a href="${opts.portalUrl}" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold;">Sign in to Institute Portal</a>
            </div>
            <p>If you have any questions, contact your institute administrator or reply to this email.</p>
            <hr style="border: none; border-top: 1px solid #eaeaea; margin: 30px 0;" />
            <p style="font-size: 12px; color: #888;">QuantiPi Team</p>
          </div>
        `,
      });

      if (error) {
        log.error({ error, to: opts.to }, 'Failed to send staff invite email via Resend API');
        return;
      }

      log.info({ to: opts.to, id: data?.id }, 'Staff invite email sent successfully');
    } catch (err) {
      log.error({ err, to: opts.to }, 'Unexpected error sending staff invite email');
    }
  }
}

export const emailService = new EmailService();
