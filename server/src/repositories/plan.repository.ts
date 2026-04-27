// ─── Plan Repository ──────────────────────────────────────────
// PostgreSQL data access for the plans table.

import { getPostgresPool } from '../lib/database.js';
import type { Plan, PlanFeatures } from '@kd/shared';

function rowToPlan(row: Record<string, unknown>): Plan {
  return {
    id: row.id as string,
    slug: row.slug as string,
    displayName: row.display_name as string,
    tier: row.tier as 1 | 2 | 3,
    billingCycle: row.billing_cycle as 'weekly' | 'monthly',
    pricePaise: row.price_paise as number,
    currency: row.currency as string,
    features: row.features as PlanFeatures,
    trialDays: row.trial_days as number,
    isActive: row.is_active as boolean,
    sortOrder: row.sort_order as number,
    createdAt: (row.created_at as Date).toISOString(),
    razorpayPlanId: (row.razorpay_plan_id as string | null) ?? null,
  };
}

class PlanRepository {
  private get pool() {
    return getPostgresPool();
  }

  // ─── List all active plans ────────────────────────────
  async listActive(): Promise<Plan[]> {
    const result = await this.pool.query(
      `SELECT id, slug, display_name, tier, billing_cycle, price_paise,
              currency, features, trial_days, is_active, sort_order, created_at,
              razorpay_plan_id
       FROM plans
       WHERE is_active = TRUE
       ORDER BY sort_order ASC`,
    );
    return result.rows.map(rowToPlan);
  }

  // ─── Find plan by ID ──────────────────────────────────
  async findById(id: string): Promise<Plan | null> {
    const result = await this.pool.query(
      `SELECT id, slug, display_name, tier, billing_cycle, price_paise,
              currency, features, trial_days, is_active, sort_order, created_at,
              razorpay_plan_id
       FROM plans WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return null;
    return rowToPlan(result.rows[0]);
  }

  // ─── Find plan by slug ────────────────────────────────
  async findBySlug(slug: string): Promise<Plan | null> {
    const result = await this.pool.query(
      `SELECT id, slug, display_name, tier, billing_cycle, price_paise,
              currency, features, trial_days, is_active, sort_order, created_at,
              razorpay_plan_id
       FROM plans WHERE slug = $1`,
      [slug],
    );
    if (result.rows.length === 0) return null;
    return rowToPlan(result.rows[0]);
  }

  // ─── List all plans (admin, incl. inactive) ───────────
  async listAll(): Promise<Plan[]> {
    const result = await this.pool.query(
      `SELECT id, slug, display_name, tier, billing_cycle, price_paise,
              currency, features, trial_days, is_active, sort_order, created_at,
              razorpay_plan_id
       FROM plans ORDER BY sort_order ASC`,
    );
    return result.rows.map(rowToPlan);
  }

  // ─── Create plan (admin) ──────────────────────────────
  async create(input: Omit<Plan, 'id' | 'createdAt'>): Promise<Plan> {
    const result = await this.pool.query(
      `INSERT INTO plans
         (slug, display_name, tier, billing_cycle, price_paise, currency, features, trial_days, is_active, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        input.slug,
        input.displayName,
        input.tier,
        input.billingCycle,
        input.pricePaise,
        input.currency,
        JSON.stringify(input.features),
        input.trialDays,
        input.isActive,
        input.sortOrder,
      ],
    );
    return rowToPlan(result.rows[0]);
  }

  // ─── Update plan (admin) ──────────────────────────────
  async update(
    id: string,
    input: Partial<Pick<Plan, 'displayName' | 'pricePaise' | 'features' | 'isActive' | 'sortOrder' | 'trialDays'>>,
  ): Promise<Plan | null> {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (input.displayName !== undefined) { setClauses.push(`display_name = $${idx++}`); values.push(input.displayName); }
    if (input.pricePaise !== undefined) { setClauses.push(`price_paise = $${idx++}`); values.push(input.pricePaise); }
    if (input.features !== undefined) { setClauses.push(`features = $${idx++}`); values.push(JSON.stringify(input.features)); }
    if (input.isActive !== undefined) { setClauses.push(`is_active = $${idx++}`); values.push(input.isActive); }
    if (input.sortOrder !== undefined) { setClauses.push(`sort_order = $${idx++}`); values.push(input.sortOrder); }
    if (input.trialDays !== undefined) { setClauses.push(`trial_days = $${idx++}`); values.push(input.trialDays); }

    if (setClauses.length === 0) return this.findById(id);

    values.push(id);
    const result = await this.pool.query(
      `UPDATE plans SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );
    if (result.rows.length === 0) return null;
    return rowToPlan(result.rows[0]);
  }
  // ─── Set Razorpay plan ID (lazy, once per plan) ───────
  // Called during first paid checkout to persist the Razorpay Plans API ID
  // so future subscriptions can reuse the same plan object.
  async setRazorpayPlanId(id: string, razorpayPlanId: string): Promise<void> {
    await this.pool.query(
      `UPDATE plans SET razorpay_plan_id = $2 WHERE id = $1 AND razorpay_plan_id IS NULL`,
      [id, razorpayPlanId],
    );
  }
}

export const planRepository = new PlanRepository();
