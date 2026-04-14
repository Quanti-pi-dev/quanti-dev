// ─── Coupon Repository ────────────────────────────────────────
// PostgreSQL data access for coupons and coupon_redemptions.

import { getPostgresPool } from '../lib/database.js';
import type { Coupon, BillingCycle } from '@kd/shared';

function rowToCoupon(row: Record<string, unknown>): Coupon {
  return {
    id: row.id as string,
    code: row.code as string,
    discountType: row.discount_type as 'percentage' | 'fixed_amount',
    discountValue: row.discount_value as number,
    maxDiscountPaise: row.max_discount_paise as number | null,
    minOrderPaise: row.min_order_paise as number,
    applicablePlans: (row.applicable_plans as string[]) ?? [],
    applicableCycles: (row.applicable_cycles as BillingCycle[]) ?? [],
    maxUses: row.max_uses as number | null,
    maxUsesPerUser: row.max_uses_per_user as number,
    currentUses: row.current_uses as number,
    validFrom: (row.valid_from as Date).toISOString(),
    validUntil: row.valid_until ? (row.valid_until as Date).toISOString() : null,
    isActive: row.is_active as boolean,
    firstTimeOnly: row.first_time_only as boolean,
  };
}

class CouponRepository {
  private get pool() {
    return getPostgresPool();
  }

  // ─── Find coupon by code (case-insensitive) ───────────
  async findByCode(code: string): Promise<Coupon | null> {
    const result = await this.pool.query(
      `SELECT * FROM coupons WHERE UPPER(code) = UPPER($1) AND is_active = TRUE`,
      [code],
    );
    if (result.rows.length === 0) return null;
    return rowToCoupon(result.rows[0]);
  }

  // ─── Find coupon by ID ─────────────────────────────────
  async findById(id: string): Promise<Coupon | null> {
    const result = await this.pool.query(`SELECT * FROM coupons WHERE id = $1`, [id]);
    if (result.rows.length === 0) return null;
    return rowToCoupon(result.rows[0]);
  }

  // ─── Count redemptions by user for a coupon ───────────
  async countRedemptionsByUser(couponId: string, userId: string): Promise<number> {
    const result = await this.pool.query(
      `SELECT COUNT(*) FROM coupon_redemptions WHERE coupon_id = $1 AND user_id = $2`,
      [couponId, userId],
    );
    return parseInt(result.rows[0].count as string, 10);
  }

  // ─── Atomically increment usage (returns false if limit hit) ─
  async incrementUsage(couponId: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE coupons
       SET current_uses = current_uses + 1
       WHERE id = $1 AND (max_uses IS NULL OR current_uses < max_uses)
       RETURNING id`,
      [couponId],
    );
    return result.rows.length > 0;
  }

  // ─── Decrement usage (on payment failure rollback) ────
  async decrementUsage(couponId: string): Promise<void> {
    await this.pool.query(
      `UPDATE coupons SET current_uses = GREATEST(0, current_uses - 1) WHERE id = $1`,
      [couponId],
    );
  }

  // ─── Record a successful redemption ───────────────────
  async recordRedemption(
    couponId: string,
    userId: string,
    subscriptionId: string,
    discountPaise: number,
  ): Promise<void> {
    // Idempotent: ON CONFLICT prevents duplicate redemption records from
    // webhook retries or client-side verify + webhook racing.
    await this.pool.query(
      `INSERT INTO coupon_redemptions (coupon_id, user_id, subscription_id, discount_paise)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (coupon_id, user_id, subscription_id) DO NOTHING`,
      [couponId, userId, subscriptionId, discountPaise],
    );
  }

  // ─── Admin: list all coupons ──────────────────────────
  async listAll(): Promise<Coupon[]> {
    const result = await this.pool.query(
      `SELECT * FROM coupons ORDER BY created_at DESC`,
    );
    return result.rows.map(rowToCoupon);
  }

  // ─── Admin: create coupon ─────────────────────────────
  async create(input: Omit<Coupon, 'id' | 'currentUses' | 'validFrom'>): Promise<Coupon> {
    const result = await this.pool.query(
      `INSERT INTO coupons
         (code, discount_type, discount_value, max_discount_paise, min_order_paise,
          applicable_plans, applicable_cycles, max_uses, max_uses_per_user,
          valid_until, is_active, first_time_only)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        input.code.toUpperCase(),
        input.discountType,
        input.discountValue,
        input.maxDiscountPaise ?? null,
        input.minOrderPaise,
        input.applicablePlans,
        input.applicableCycles,
        input.maxUses ?? null,
        input.maxUsesPerUser,
        input.validUntil ?? null,
        input.isActive,
        input.firstTimeOnly,
      ],
    );
    return rowToCoupon(result.rows[0]);
  }

  // ─── Admin: update coupon ─────────────────────────────
  async update(
    id: string,
    input: Partial<Pick<Coupon, 'isActive' | 'maxUses' | 'validUntil'>>,
  ): Promise<Coupon | null> {
    const setClauses: string[] = [];
    const values: unknown[] = [id];
    let idx = 2;
    if (input.isActive !== undefined) { setClauses.push(`is_active = $${idx++}`); values.push(input.isActive); }
    if (input.maxUses !== undefined) { setClauses.push(`max_uses = $${idx++}`); values.push(input.maxUses); }
    if (input.validUntil !== undefined) { setClauses.push(`valid_until = $${idx++}`); values.push(input.validUntil); }
    if (setClauses.length === 0) return this.findById(id);
    const result = await this.pool.query(
      `UPDATE coupons SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
      values,
    );
    if (result.rows.length === 0) return null;
    return rowToCoupon(result.rows[0]);
  }
}

export const couponRepository = new CouponRepository();
