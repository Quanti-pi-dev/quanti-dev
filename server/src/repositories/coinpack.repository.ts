// ─── Coin Pack Repository ────────────────────────────────────
// CRUD for coin_packs + purchase ledger for fiat coin purchases.

import { getPostgresPool } from '../lib/database.js';

// ─── Types ───────────────────────────────────────────────────

export interface CoinPack {
  id: string;
  name: string;
  description: string;
  coins: number;
  pricePaise: number;
  badgeText: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CoinPackPurchase {
  id: string;
  userId: string;
  coinPackId: string | null;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  razorpaySignature: string | null;
  amountPaise: number;
  coinsCredited: number;
  status: 'pending' | 'captured' | 'failed';
  createdAt: string;
  capturedAt: string | null;
}

// ─── Row mappers ─────────────────────────────────────────────

function mapCoinPack(row: Record<string, unknown>): CoinPack {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? '',
    coins: row.coins as number,
    pricePaise: row.price_paise as number,
    badgeText: (row.badge_text as string) ?? null,
    isActive: row.is_active as boolean,
    sortOrder: row.sort_order as number,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

function mapPurchase(row: Record<string, unknown>): CoinPackPurchase {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    coinPackId: (row.coin_pack_id as string) ?? null,
    razorpayOrderId: row.razorpay_order_id as string,
    razorpayPaymentId: (row.razorpay_payment_id as string) ?? null,
    razorpaySignature: (row.razorpay_signature as string) ?? null,
    amountPaise: row.amount_paise as number,
    coinsCredited: row.coins_credited as number,
    status: row.status as CoinPackPurchase['status'],
    createdAt: (row.created_at as Date).toISOString(),
    capturedAt: row.captured_at ? (row.captured_at as Date).toISOString() : null,
  };
}

// ─── Repository ─────────────────────────────────────────────

class CoinPackRepository {
  private get pg() {
    return getPostgresPool();
  }

  // ─── Public reads ─────────────────────────────────────────

  /** List active coin packs, sorted by sort_order */
  async listActive(): Promise<CoinPack[]> {
    const result = await this.pg.query(
      `SELECT * FROM coin_packs WHERE is_active = true ORDER BY sort_order ASC`,
    );
    return result.rows.map(mapCoinPack);
  }

  /** Find a single pack by ID */
  async findById(id: string): Promise<CoinPack | null> {
    const result = await this.pg.query(
      `SELECT * FROM coin_packs WHERE id = $1`, [id],
    );
    return result.rows.length > 0 ? mapCoinPack(result.rows[0] as Record<string, unknown>) : null;
  }

  // ─── Admin CRUD ────────────────────────────────────────────

  /** List all packs (including inactive) for admin */
  async listAll(): Promise<CoinPack[]> {
    const result = await this.pg.query(
      `SELECT * FROM coin_packs ORDER BY sort_order ASC, created_at DESC`,
    );
    return result.rows.map(mapCoinPack);
  }

  /** Create a new coin pack */
  async create(input: {
    name: string;
    description?: string;
    coins: number;
    pricePaise: number;
    badgeText?: string | null;
    sortOrder?: number;
  }): Promise<string> {
    const result = await this.pg.query(
      `INSERT INTO coin_packs (name, description, coins, price_paise, badge_text, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [input.name, input.description ?? '', input.coins, input.pricePaise, input.badgeText ?? null, input.sortOrder ?? 0],
    );
    return (result.rows[0] as { id: string }).id;
  }

  /** Update a coin pack */
  async update(id: string, updates: Partial<{
    name: string;
    description: string;
    coins: number;
    pricePaise: number;
    badgeText: string | null;
    isActive: boolean;
    sortOrder: number;
  }>): Promise<boolean> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    if (updates.name !== undefined) { fields.push(`name = $${paramIdx++}`); values.push(updates.name); }
    if (updates.description !== undefined) { fields.push(`description = $${paramIdx++}`); values.push(updates.description); }
    if (updates.coins !== undefined) { fields.push(`coins = $${paramIdx++}`); values.push(updates.coins); }
    if (updates.pricePaise !== undefined) { fields.push(`price_paise = $${paramIdx++}`); values.push(updates.pricePaise); }
    if (updates.badgeText !== undefined) { fields.push(`badge_text = $${paramIdx++}`); values.push(updates.badgeText); }
    if (updates.isActive !== undefined) { fields.push(`is_active = $${paramIdx++}`); values.push(updates.isActive); }
    if (updates.sortOrder !== undefined) { fields.push(`sort_order = $${paramIdx++}`); values.push(updates.sortOrder); }

    if (fields.length === 0) return false;

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await this.pg.query(
      `UPDATE coin_packs SET ${fields.join(', ')} WHERE id = $${paramIdx}`,
      values,
    );
    return (result.rowCount ?? 0) > 0;
  }

  /** Delete a coin pack */
  async delete(id: string): Promise<boolean> {
    const result = await this.pg.query(`DELETE FROM coin_packs WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // ─── Purchase ledger ──────────────────────────────────────

  /** Create a pending purchase record (coinPackId is null for custom coin purchases) */
  async createPurchase(input: {
    userId: string;
    coinPackId: string | null;
    razorpayOrderId: string;
    amountPaise: number;
    coinsCredited: number;
  }): Promise<string> {
    const result = await this.pg.query(
      `INSERT INTO coin_pack_purchases (user_id, coin_pack_id, razorpay_order_id, amount_paise, coins_credited)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [input.userId, input.coinPackId, input.razorpayOrderId, input.amountPaise, input.coinsCredited],
    );
    return (result.rows[0] as { id: string }).id;
  }

  /** Find a purchase by Razorpay order ID */
  async findPurchaseByOrderId(orderId: string): Promise<CoinPackPurchase | null> {
    const result = await this.pg.query(
      `SELECT * FROM coin_pack_purchases WHERE razorpay_order_id = $1`, [orderId],
    );
    return result.rows.length > 0 ? mapPurchase(result.rows[0] as Record<string, unknown>) : null;
  }

  /** Mark a purchase as captured */
  async markPurchaseCaptured(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
  ): Promise<boolean> {
    const result = await this.pg.query(
      `UPDATE coin_pack_purchases
       SET status = 'captured', razorpay_payment_id = $2, razorpay_signature = $3, captured_at = NOW()
       WHERE razorpay_order_id = $1 AND status = 'pending'`,
      [razorpayOrderId, razorpayPaymentId, razorpaySignature],
    );
    return (result.rowCount ?? 0) > 0;
  }

  /** List purchases for a user */
  async listUserPurchases(userId: string): Promise<CoinPackPurchase[]> {
    const result = await this.pg.query(
      `SELECT * FROM coin_pack_purchases WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [userId],
    );
    return result.rows.map(mapPurchase);
  }
}

export const coinPackRepository = new CoinPackRepository();
