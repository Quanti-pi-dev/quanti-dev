// ─── Subscription Repository ─────────────────────────────────
// PostgreSQL data access for subscriptions, subscription_events.

import { getPostgresPool } from '../lib/database.js';
import type { Subscription, SubscriptionStatus, SubscriptionEvent, SubscriptionEventType } from '@kd/shared';

function rowToSubscription(row: Record<string, unknown>): Subscription {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    planId: row.plan_id as string,
    status: row.status as SubscriptionStatus,
    currentPeriodStart: (row.current_period_start as Date).toISOString(),
    currentPeriodEnd: (row.current_period_end as Date).toISOString(),
    trialStart: row.trial_start ? (row.trial_start as Date).toISOString() : null,
    trialEnd: row.trial_end ? (row.trial_end as Date).toISOString() : null,
    canceledAt: row.canceled_at ? (row.canceled_at as Date).toISOString() : null,
    cancelAtPeriodEnd: row.cancel_at_period_end as boolean,
    retryCount: row.retry_count as number,
    couponId: row.coupon_id as string | null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
    razorpaySubscriptionId: (row.razorpay_subscription_id as string | null) ?? null,
    razorpayCustomerId: (row.razorpay_customer_id as string | null) ?? null,
  };
}

function rowToEvent(row: Record<string, unknown>): SubscriptionEvent {
  return {
    id: row.id as string,
    subscriptionId: row.subscription_id as string,
    userId: row.user_id as string,
    eventType: row.event_type as SubscriptionEventType,
    oldStatus: row.old_status as SubscriptionStatus | null,
    newStatus: row.new_status as SubscriptionStatus | null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: (row.created_at as Date).toISOString(),
  };
}

interface CreateSubscriptionInput {
  userId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialStart?: Date | null;
  trialEnd?: Date | null;
  couponId?: string | null;
  razorpaySubscriptionId?: string | null;
  razorpayCustomerId?: string | null;
}

class SubscriptionRepository {
  private get pool() {
    return getPostgresPool();
  }

  // ─── Find active subscription for user ───────────────
  async findActiveByUserId(userId: string): Promise<Subscription | null> {
    const result = await this.pool.query(
      `SELECT * FROM subscriptions
       WHERE user_id = $1 AND status IN ('trialing', 'active', 'past_due')
       LIMIT 1`,
      [userId],
    );
    if (result.rows.length === 0) return null;
    return rowToSubscription(result.rows[0]);
  }

  // ─── Find canceled subscription still within period (for reactivation) ─
  async findCanceledByUserId(userId: string): Promise<Subscription | null> {
    const result = await this.pool.query(
      `SELECT * FROM subscriptions
       WHERE user_id = $1 AND status = 'canceled' AND current_period_end > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [userId],
    );
    if (result.rows.length === 0) return null;
    return rowToSubscription(result.rows[0]);
  }

  // ─── Find by subscription ID ──────────────────────────
  async findById(id: string): Promise<Subscription | null> {
    const result = await this.pool.query(`SELECT * FROM subscriptions WHERE id = $1`, [id]);
    if (result.rows.length === 0) return null;
    return rowToSubscription(result.rows[0]);
  }

  // ─── List user's subscription history ────────────────
  async listByUserId(userId: string, limit = 10, offset = 0): Promise<Subscription[]> {
    const result = await this.pool.query(
      `SELECT * FROM subscriptions WHERE user_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    );
    return result.rows.map(rowToSubscription);
  }

  // ─── Check if user has ever had a trial for a tier ───
  async hasHadTrialForTier(userId: string, tier: number): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id
       WHERE s.user_id = $1 AND p.tier = $2 AND s.trial_start IS NOT NULL
       LIMIT 1`,
      [userId, tier],
    );
    return result.rows.length > 0;
  }

  // ─── Check if user has ever subscribed (for first_time_only coupons) ─
  async hasAnyPriorSubscription(userId: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM subscriptions WHERE user_id = $1 LIMIT 1`,
      [userId],
    );
    return result.rows.length > 0;
  }

  // ─── Create subscription ────────────────────────────────────
  async create(input: CreateSubscriptionInput): Promise<Subscription> {
    const result = await this.pool.query(
      `INSERT INTO subscriptions
         (user_id, plan_id, status, current_period_start, current_period_end,
          trial_start, trial_end, coupon_id, razorpay_subscription_id, razorpay_customer_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        input.userId,
        input.planId,
        input.status,
        input.currentPeriodStart,
        input.currentPeriodEnd,
        input.trialStart ?? null,
        input.trialEnd ?? null,
        input.couponId ?? null,
        input.razorpaySubscriptionId ?? null,
        input.razorpayCustomerId ?? null,
      ],
    );
    return rowToSubscription(result.rows[0]);
  }

  // ─── Update status ─────────────────────────────────────────
  async updateStatus(
    id: string,
    status: SubscriptionStatus,
    extra?: Partial<{
      canceledAt: Date | null;
      cancelAtPeriodEnd: boolean;
      retryCount: number;
      currentPeriodEnd: Date;
      currentPeriodStart: Date;
    }>,
  ): Promise<Subscription | null> {
    const setClauses = ['status = $2'];
    const values: unknown[] = [id, status];
    let idx = 3;

    if (extra?.canceledAt !== undefined) { setClauses.push(`canceled_at = $${idx++}`); values.push(extra.canceledAt); }
    if (extra?.cancelAtPeriodEnd !== undefined) { setClauses.push(`cancel_at_period_end = $${idx++}`); values.push(extra.cancelAtPeriodEnd); }
    if (extra?.retryCount !== undefined) { setClauses.push(`retry_count = $${idx++}`); values.push(extra.retryCount); }
    if (extra?.currentPeriodEnd !== undefined) { setClauses.push(`current_period_end = $${idx++}`); values.push(extra.currentPeriodEnd); }
    if (extra?.currentPeriodStart !== undefined) { setClauses.push(`current_period_start = $${idx++}`); values.push(extra.currentPeriodStart); }

    const result = await this.pool.query(
      `UPDATE subscriptions SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
      values,
    );
    if (result.rows.length === 0) return null;
    return rowToSubscription(result.rows[0]);
  }

  // ─── Find by Razorpay Subscription ID ──────────────────
  // Primary lookup used by webhook handlers for recurring events.
  async findByRazorpaySubscriptionId(razorpaySubscriptionId: string): Promise<Subscription | null> {
    const result = await this.pool.query(
      `SELECT * FROM subscriptions WHERE razorpay_subscription_id = $1 LIMIT 1`,
      [razorpaySubscriptionId],
    );
    if (result.rows.length === 0) return null;
    return rowToSubscription(result.rows[0]);
  }

  // ─── Find subscriptions expiring within a time window ─
  async findExpiring(statusList: SubscriptionStatus[], beforeDate: Date): Promise<Subscription[]> {
    const statusPlaceholders = statusList.map((_, i) => `$${i + 2}`).join(', ');
    const result = await this.pool.query(
      `SELECT * FROM subscriptions
       WHERE current_period_end <= $1 AND status IN (${statusPlaceholders})
       ORDER BY current_period_end ASC
       LIMIT 200`,
      [beforeDate, ...statusList],
    );
    return result.rows.map(rowToSubscription);
  }

  // ─── Find past_due subscriptions ready for retry ──────
  async findForRetry(maxRetries: number): Promise<Subscription[]> {
    const result = await this.pool.query(
      `SELECT * FROM subscriptions
       WHERE status = 'past_due' AND retry_count < $1
       ORDER BY updated_at ASC
       LIMIT 100`,
      [maxRetries],
    );
    return result.rows.map(rowToSubscription);
  }

  // ─── Find subscriptions with trial ending soon ────────
  async findTrialEndingSoon(withinHours: number): Promise<Subscription[]> {
    const result = await this.pool.query(
      `SELECT * FROM subscriptions
       WHERE status = 'trialing'
         AND trial_end BETWEEN NOW() AND NOW() + ($1 || ' hours')::INTERVAL
       ORDER BY trial_end ASC
       LIMIT 200`,
      [withinHours],
    );
    return result.rows.map(rowToSubscription);
  }

  // ─── Admin: list all subscriptions (U1: enriched with user/plan data) ───
  async listAll(
    options: { status?: SubscriptionStatus; limit?: number; offset?: number } = {},
  ): Promise<{ subscriptions: (Subscription & { userEmail?: string; userDisplayName?: string; planDisplayName?: string })[]; total: number }> {
    const { status, limit = 20, offset = 0 } = options;
    const where = status ? `WHERE s.status = $3` : '';
    const countWhere = status ? `WHERE s.status = $1` : '';
    const params: unknown[] = status ? [limit, offset, status] : [limit, offset];

    const [rows, count] = await Promise.all([
      this.pool.query(
        `SELECT s.*, u.email AS user_email, u.display_name AS user_display_name, p.display_name AS plan_display_name
         FROM subscriptions s
         LEFT JOIN users u ON u.firebase_uid = s.user_id
         LEFT JOIN plans p ON p.id = s.plan_id
         ${where} ORDER BY s.created_at DESC LIMIT $1 OFFSET $2`,
        params,
      ),
      this.pool.query(
        `SELECT COUNT(*) FROM subscriptions s ${countWhere}`,
        status ? [status] : [],
      ),
    ]);

    return {
      subscriptions: rows.rows.map((row: Record<string, unknown>) => ({
        ...rowToSubscription(row),
        userEmail: (row.user_email as string) ?? undefined,
        userDisplayName: (row.user_display_name as string) ?? undefined,
        planDisplayName: (row.plan_display_name as string) ?? undefined,
      })),
      total: parseInt(count.rows[0].count as string, 10),
    };
  }

  // ─── Log subscription event ───────────────────────────
  async logEvent(
    subscriptionId: string,
    userId: string,
    eventType: SubscriptionEventType,
    oldStatus: SubscriptionStatus | null,
    newStatus: SubscriptionStatus | null,
    metadata: Record<string, unknown> = {},
  ): Promise<SubscriptionEvent> {
    const result = await this.pool.query(
      `INSERT INTO subscription_events
         (subscription_id, user_id, event_type, old_status, new_status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [subscriptionId, userId, eventType, oldStatus, newStatus, JSON.stringify(metadata)],
    );
    return rowToEvent(result.rows[0]);
  }

  // ─── List events for a subscription ──────────────────
  async listEvents(subscriptionId: string): Promise<SubscriptionEvent[]> {
    const result = await this.pool.query(
      `SELECT * FROM subscription_events WHERE subscription_id = $1 ORDER BY created_at DESC`,
      [subscriptionId],
    );
    return result.rows.map(rowToEvent);
  }
}

export const subscriptionRepository = new SubscriptionRepository();
