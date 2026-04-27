// ─── Payment Repository ───────────────────────────────────────
// PostgreSQL data access for the payments table.

import { getPostgresPool } from '../lib/database.js';
import type { Payment, PaymentStatus } from '@kd/shared';

function rowToPayment(row: Record<string, unknown>): Payment {
  return {
    id: row.id as string,
    subscriptionId: row.subscription_id as string,
    userId: row.user_id as string,
    razorpayOrderId: row.razorpay_order_id as string,
    razorpayPaymentId: row.razorpay_payment_id as string | null,
    amountPaise: row.amount_paise as number,
    currency: row.currency as string,
    status: row.status as PaymentStatus,
    failureReason: row.failure_reason as string | null,
    refundAmountPaise: row.refund_amount_paise as number,
    webhookVerified: row.webhook_verified as boolean,
    attemptNumber: row.attempt_number as number,
    createdAt: (row.created_at as Date).toISOString(),
  };
}

interface CreatePaymentInput {
  subscriptionId: string;
  userId: string;
  razorpayOrderId: string;
  amountPaise: number;
  currency?: string;
  attemptNumber?: number;
  razorpaySubscriptionId?: string | null;
}

class PaymentRepository {
  private get pool() {
    return getPostgresPool();
  }

  // ─── Create payment record ────────────────────────────
  async create(input: CreatePaymentInput): Promise<Payment> {
    const result = await this.pool.query(
      `INSERT INTO payments
         (subscription_id, user_id, razorpay_order_id, amount_paise, currency, attempt_number, razorpay_subscription_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.subscriptionId,
        input.userId,
        input.razorpayOrderId,
        input.amountPaise,
        input.currency ?? 'INR',
        input.attemptNumber ?? 1,
        input.razorpaySubscriptionId ?? null,
      ],
    );
    return rowToPayment(result.rows[0]);
  }

  // ─── Create payment for renewal ───────────────────────
  async createForRenewal(input: Omit<CreatePaymentInput, 'attemptNumber'> & { attemptNumber: number }): Promise<Payment> {
    return this.create(input);
  }

  // ─── Find by PG UUID ──────────────────────────────────
  async findById(id: string): Promise<Payment | null> {
    const result = await this.pool.query(
      `SELECT * FROM payments WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return null;
    return rowToPayment(result.rows[0]);
  }

  // ─── Find by Razorpay order ID ────────────────────────
  async findByOrderId(razorpayOrderId: string): Promise<Payment | null> {
    const result = await this.pool.query(
      `SELECT * FROM payments WHERE razorpay_order_id = $1`,
      [razorpayOrderId],
    );
    if (result.rows.length === 0) return null;
    return rowToPayment(result.rows[0]);
  }

  // ─── Find by Razorpay payment ID ──────────────────────
  async findByPaymentId(razorpayPaymentId: string): Promise<Payment | null> {
    const result = await this.pool.query(
      `SELECT * FROM payments WHERE razorpay_payment_id = $1`,
      [razorpayPaymentId],
    );
    if (result.rows.length === 0) return null;
    return rowToPayment(result.rows[0]);
  }

  // ─── Capture payment (success) ────────────────────────
  async markCaptured(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
    webhookVerified = false,
  ): Promise<Payment | null> {
    const result = await this.pool.query(
      `UPDATE payments
       SET status = 'captured',
           razorpay_payment_id = $2,
           razorpay_signature = $3,
           webhook_verified = $4
       WHERE razorpay_order_id = $1
       RETURNING *`,
      [razorpayOrderId, razorpayPaymentId, razorpaySignature, webhookVerified],
    );
    if (result.rows.length === 0) return null;
    return rowToPayment(result.rows[0]);
  }

  // ─── Mark payment failed ──────────────────────────────
  async markFailed(razorpayOrderId: string, reason: string): Promise<Payment | null> {
    const result = await this.pool.query(
      `UPDATE payments SET status = 'failed', failure_reason = $2
       WHERE razorpay_order_id = $1 RETURNING *`,
      [razorpayOrderId, reason],
    );
    if (result.rows.length === 0) return null;
    return rowToPayment(result.rows[0]);
  }

  // ─── Mark webhook verified ────────────────────────────
  async markWebhookVerified(razorpayPaymentId: string): Promise<void> {
    await this.pool.query(
      `UPDATE payments SET webhook_verified = TRUE WHERE razorpay_payment_id = $1`,
      [razorpayPaymentId],
    );
  }

  // ─── Process refund ───────────────────────────────────
  async markRefunded(
    razorpayPaymentId: string,
    refundAmountPaise: number,
    full: boolean,
  ): Promise<Payment | null> {
    const status: PaymentStatus = full ? 'refunded' : 'partially_refunded';
    const result = await this.pool.query(
      `UPDATE payments SET status = $2, refund_amount_paise = $3
       WHERE razorpay_payment_id = $1 RETURNING *`,
      [razorpayPaymentId, status, refundAmountPaise],
    );
    if (result.rows.length === 0) return null;
    return rowToPayment(result.rows[0]);
  }

  // ─── List payments for a user ─────────────────────────
  async listByUserId(userId: string, limit = 20, offset = 0): Promise<Payment[]> {
    const result = await this.pool.query(
      `SELECT * FROM payments WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    );
    return result.rows.map(rowToPayment);
  }

  // ─── Admin: list all payments ─────────────────────────
  async listAll(
    options: { status?: PaymentStatus; limit?: number; offset?: number } = {},
  ): Promise<{ payments: Payment[]; total: number }> {
    const { status, limit = 20, offset = 0 } = options;
    const where = status ? `WHERE status = $3` : '';
    const countWhere = status ? `WHERE status = $1` : '';
    const params: unknown[] = status ? [limit, offset, status] : [limit, offset];

    const [rows, count] = await Promise.all([
      this.pool.query(
        `SELECT * FROM payments ${where} ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
        params,
      ),
      this.pool.query(`SELECT COUNT(*) FROM payments ${countWhere}`, status ? [status] : []),
    ]);

    return {
      payments: rows.rows.map(rowToPayment),
      total: parseInt(count.rows[0].count as string, 10),
    };
  }
}

export const paymentRepository = new PaymentRepository();
