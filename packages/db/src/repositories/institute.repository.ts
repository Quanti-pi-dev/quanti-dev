// ─── Institute Repository ─────────────────────────────────────────
// PostgreSQL data access for institutes, members, join codes,
// and institute subscriptions.

import crypto from 'crypto';
import { getPostgresPool } from '../clients/database.js';
import type {
  Institute,
  InstituteMember,
  InstituteMemberSummary,
  InstituteJoinCode,
  InstituteSubscription,
  InstituteMemberRole,
  InstituteType,
} from '@kd/shared';

// ─── Helpers ─────────────────────────────────────────────────────

function rowToInstitute(row: Record<string, unknown>): Institute {
  return {
    id: row['id'] as string,
    name: row['name'] as string,
    code: row['code'] as string,
    type: row['type'] as InstituteType,
    logoUrl: (row['logo_url'] as string | null) ?? null,
    contactEmail: row['contact_email'] as string,
    contactPhone: (row['contact_phone'] as string | null) ?? null,
    address: (row['address'] as Institute['address']) ?? null,
    isActive: row['is_active'] as boolean,
    metadata: (row['metadata'] as Record<string, unknown>) ?? {},
    createdAt: (row['created_at'] as Date).toISOString(),
    updatedAt: (row['updated_at'] as Date).toISOString(),
  };
}

function rowToMember(row: Record<string, unknown>): InstituteMember {
  return {
    id: row['id'] as string,
    instituteId: row['institute_id'] as string,
    userId: row['user_id'] as string,
    firebaseUid: row['firebase_uid'] as string,
    role: row['role'] as InstituteMemberRole,
    studentUid: (row['student_uid'] as string | null) ?? null,
    department: (row['department'] as string | null) ?? null,
    isActive: row['is_active'] as boolean,
    joinedAt: (row['joined_at'] as Date).toISOString(),
  };
}

function rowToJoinCode(row: Record<string, unknown>): InstituteJoinCode {
  return {
    id: row['id'] as string,
    instituteId: row['institute_id'] as string,
    code: row['code'] as string,
    role: row['role'] as InstituteMemberRole,
    department: (row['department'] as string | null) ?? null,
    maxUses: (row['max_uses'] as number | null) ?? null,
    usedCount: row['used_count'] as number,
    expiresAt: row['expires_at'] ? (row['expires_at'] as Date).toISOString() : null,
    createdBy: row['created_by'] as string,
    isActive: row['is_active'] as boolean,
    createdAt: (row['created_at'] as Date).toISOString(),
  };
}

function rowToInstSub(row: Record<string, unknown>): InstituteSubscription {
  return {
    id: row['id'] as string,
    instituteId: row['institute_id'] as string,
    planId: row['plan_id'] as string,
    maxSeats: row['max_seats'] as number,
    usedSeats: row['used_seats'] as number,
    status: row['status'] as InstituteSubscription['status'],
    billingContact: (row['billing_contact'] as string | null) ?? null,
    periodStart: (row['period_start'] as Date).toISOString(),
    periodEnd: (row['period_end'] as Date).toISOString(),
    amountPaise: row['amount_paise'] as number,
    metadata: (row['metadata'] as Record<string, unknown>) ?? {},
    createdAt: (row['created_at'] as Date).toISOString(),
    updatedAt: (row['updated_at'] as Date).toISOString(),
  };
}

// ─── Student UID Generator ────────────────────────────────────────
// Uses the institute_uid_sequences table for collision-free sequential IDs.
// Format: {CODE}-{YEAR}-{PADDED_SEQ} e.g. "ALLEN-2026-0042"

async function generateStudentUid(
  pool: ReturnType<typeof getPostgresPool>,
  instituteId: string,
  instituteCode: string,
): Promise<string> {
  const year = new Date().getFullYear();

  // Atomic increment via UPDATE ... RETURNING
  const result = await pool.query(
    `INSERT INTO institute_uid_sequences (institute_id, year, last_seq)
     VALUES ($1, $2, 1)
     ON CONFLICT (institute_id, year) DO UPDATE
       SET last_seq = institute_uid_sequences.last_seq + 1
     RETURNING last_seq`,
    [instituteId, year],
  );

  const seq = result.rows[0]['last_seq'] as number;
  const paddedSeq = String(seq).padStart(4, '0');
  return `${instituteCode}-${year}-${paddedSeq}`;
}

// ─── Join Code Generator ──────────────────────────────────────────
// 6-char alphanumeric code: institute CODE prefix (up to 5 chars) + 1 random digit/char

function generateJoinCode(instituteCode: string): string {
  const prefix = instituteCode.slice(0, 5).toUpperCase();
  const suffix = crypto.randomBytes(2).toString('hex').toUpperCase().slice(0, 6 - prefix.length);
  return `${prefix}${suffix}`;
}

// ─── Institute Repository ─────────────────────────────────────────

class InstituteRepository {
  private get pool() {
    return getPostgresPool();
  }

  // ─── Institutes CRUD ─────────────────────────────────────────

  async create(input: {
    name: string;
    code: string;
    type?: InstituteType;
    logoUrl?: string | null;
    contactEmail: string;
    contactPhone?: string | null;
    address?: Institute['address'] | null;
  }): Promise<Institute> {
    const result = await this.pool.query(
      `INSERT INTO institutes (name, code, type, logo_url, contact_email, contact_phone, address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.name,
        input.code.toUpperCase(),
        input.type ?? 'coaching',
        input.logoUrl ?? null,
        input.contactEmail,
        input.contactPhone ?? null,
        input.address ? JSON.stringify(input.address) : null,
      ],
    );
    return rowToInstitute(result.rows[0]);
  }

  async findById(id: string): Promise<Institute | null> {
    const result = await this.pool.query(
      `SELECT * FROM institutes WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return null;
    return rowToInstitute(result.rows[0]);
  }

  async findByCode(code: string): Promise<Institute | null> {
    const result = await this.pool.query(
      `SELECT * FROM institutes WHERE code = $1`,
      [code.toUpperCase()],
    );
    if (result.rows.length === 0) return null;
    return rowToInstitute(result.rows[0]);
  }

  async listAll(options: { limit?: number; offset?: number; activeOnly?: boolean } = {}): Promise<{ data: Institute[]; total: number }> {
    const { limit = 50, offset = 0, activeOnly = false } = options;
    const where = activeOnly ? 'WHERE is_active = TRUE' : '';
    const [rows, count] = await Promise.all([
      this.pool.query(`SELECT * FROM institutes ${where} ORDER BY name ASC LIMIT $1 OFFSET $2`, [limit, offset]),
      this.pool.query(`SELECT COUNT(*) FROM institutes ${where}`),
    ]);
    return {
      data: rows.rows.map(rowToInstitute),
      total: parseInt(count.rows[0]['count'] as string, 10),
    };
  }

  async update(id: string, updates: Partial<{
    name: string;
    logoUrl: string | null;
    contactEmail: string;
    contactPhone: string | null;
    address: Institute['address'] | null;
    isActive: boolean;
    metadata: Record<string, unknown>;
  }>): Promise<Institute | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (updates.name !== undefined)         { fields.push(`name = $${idx++}`);          values.push(updates.name); }
    if (updates.logoUrl !== undefined)      { fields.push(`logo_url = $${idx++}`);      values.push(updates.logoUrl); }
    if (updates.contactEmail !== undefined) { fields.push(`contact_email = $${idx++}`); values.push(updates.contactEmail); }
    if (updates.contactPhone !== undefined) { fields.push(`contact_phone = $${idx++}`); values.push(updates.contactPhone); }
    if (updates.address !== undefined)      { fields.push(`address = $${idx++}`);       values.push(updates.address ? JSON.stringify(updates.address) : null); }
    if (updates.isActive !== undefined)     { fields.push(`is_active = $${idx++}`);     values.push(updates.isActive); }
    if (updates.metadata !== undefined)     { fields.push(`metadata = $${idx++}`);      values.push(JSON.stringify(updates.metadata)); }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    const result = await this.pool.query(
      `UPDATE institutes SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );
    if (result.rows.length === 0) return null;
    return rowToInstitute(result.rows[0]);
  }

  // ─── Member Management ─────────────────────────────────────────

  async addMember(input: {
    instituteId: string;
    userId: string;
    firebaseUid: string;
    role: InstituteMemberRole;
    department?: string | null;
  }): Promise<InstituteMember> {
    // Fetch institute code for student UID generation
    const institute = await this.findById(input.instituteId);
    if (!institute) throw new Error('INSTITUTE_NOT_FOUND');

    let studentUid: string | null = null;
    if (input.role === 'student') {
      studentUid = await generateStudentUid(this.pool, input.instituteId, institute.code);
    }

    const result = await this.pool.query(
      `INSERT INTO institute_members
         (institute_id, user_id, firebase_uid, role, student_uid, department)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (institute_id, user_id) DO UPDATE
         SET role = EXCLUDED.role,
             department = EXCLUDED.department,
             is_active = TRUE
       RETURNING *`,
      [input.instituteId, input.userId, input.firebaseUid, input.role, studentUid, input.department ?? null],
    );
    return rowToMember(result.rows[0]);
  }

  async removeMember(instituteId: string, userId: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE institute_members SET is_active = FALSE
       WHERE institute_id = $1 AND user_id = $2`,
      [instituteId, userId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async findMembership(userId: string, instituteId: string): Promise<InstituteMember | null> {
    const result = await this.pool.query(
      `SELECT * FROM institute_members
       WHERE user_id = $1 AND institute_id = $2 AND is_active = TRUE`,
      [userId, instituteId],
    );
    if (result.rows.length === 0) return null;
    return rowToMember(result.rows[0]);
  }

  /** Returns all institutes a user belongs to (across roles). */
  async findMembershipsByFirebaseUid(firebaseUid: string): Promise<(InstituteMember & { instituteName: string; instituteCode: string })[]> {
    const result = await this.pool.query(
      `SELECT im.*, i.name AS institute_name, i.code AS institute_code
       FROM institute_members im
       JOIN institutes i ON i.id = im.institute_id
       WHERE im.firebase_uid = $1 AND im.is_active = TRUE`,
      [firebaseUid],
    );
    return result.rows.map((row: Record<string, unknown>) => ({
      ...rowToMember(row),
      instituteName: row['institute_name'] as string,
      instituteCode: row['institute_code'] as string,
    }));
  }

  async listMembers(
    instituteId: string,
    options: {
      role?: InstituteMemberRole;
      limit?: number;
      offset?: number;
      search?: string;
    } = {},
  ): Promise<{ data: InstituteMemberSummary[]; total: number }> {
    const { role, limit = 50, offset = 0, search } = options;
    const conditions: string[] = ['im.institute_id = $1', 'im.is_active = TRUE'];
    const values: unknown[] = [instituteId];
    let idx = 2;

    if (role) { conditions.push(`im.role = $${idx++}`); values.push(role); }
    if (search) {
      conditions.push(`(u.display_name ILIKE $${idx} OR u.email ILIKE $${idx} OR im.student_uid ILIKE $${idx})`);
      values.push(`%${search}%`);
      idx++;
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const [rows, count] = await Promise.all([
      this.pool.query(
        `SELECT im.id, im.firebase_uid, im.role, im.student_uid, im.is_active, im.joined_at,
                u.display_name, u.avatar_url, u.email, u.enrollment_id
         FROM institute_members im
         JOIN users u ON u.id = im.user_id
         ${where}
         ORDER BY im.joined_at DESC
         LIMIT $${idx++} OFFSET $${idx++}`,
        [...values, limit, offset],
      ),
      this.pool.query(`SELECT COUNT(*) FROM institute_members im JOIN users u ON u.id = im.user_id ${where}`, values),
    ]);

    return {
      data: rows.rows.map((row: Record<string, unknown>) => ({
        id: row['id'] as string,
        firebaseUid: row['firebase_uid'] as string,
        role: row['role'] as InstituteMemberRole,
        studentUid: (row['student_uid'] as string | null) ?? null,
        displayName: row['display_name'] as string,
        avatarUrl: (row['avatar_url'] as string | null) ?? null,
        email: row['email'] as string,
        enrollmentId: row['enrollment_id'] as string,
        isActive: row['is_active'] as boolean,
        joinedAt: (row['joined_at'] as Date).toISOString(),
      })),
      total: parseInt(count.rows[0]['count'] as string, 10),
    };
  }

  // ─── Join Codes ────────────────────────────────────────────────

  async createJoinCode(input: {
    instituteId: string;
    role: InstituteMemberRole;
    department?: string | null;
    maxUses?: number | null;
    expiresAt?: Date | null;
    createdBy: string;
  }): Promise<InstituteJoinCode> {
    // Try up to 5 times in case of collision on the short code
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const institute = await this.findById(input.instituteId);
        if (!institute) throw new Error('INSTITUTE_NOT_FOUND');

        const code = generateJoinCode(institute.code);
        const result = await this.pool.query(
          `INSERT INTO institute_join_codes
             (institute_id, code, role, department, max_uses, expires_at, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [
            input.instituteId,
            code,
            input.role,
            input.department ?? null,
            input.maxUses ?? null,
            input.expiresAt ?? null,
            input.createdBy,
          ],
        );
        return rowToJoinCode(result.rows[0]);
      } catch (err: unknown) {
        const pgErr = err as { code?: string };
        if (pgErr.code === '23505') continue; // unique constraint — retry
        throw err;
      }
    }
    throw new Error('Failed to generate unique join code after retries');
  }

  async resolveJoinCode(code: string): Promise<InstituteJoinCode | null> {
    const result = await this.pool.query(
      `SELECT * FROM institute_join_codes
       WHERE code = $1 AND is_active = TRUE
         AND (expires_at IS NULL OR expires_at > NOW())
         AND (max_uses IS NULL OR used_count < max_uses)`,
      [code.toUpperCase()],
    );
    if (result.rows.length === 0) return null;
    return rowToJoinCode(result.rows[0]);
  }

  async incrementJoinCodeUsage(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE institute_join_codes SET used_count = used_count + 1 WHERE id = $1`,
      [id],
    );
  }

  async revokeJoinCode(id: string, instituteId: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE institute_join_codes SET is_active = FALSE
       WHERE id = $1 AND institute_id = $2`,
      [id, instituteId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async listJoinCodes(instituteId: string): Promise<InstituteJoinCode[]> {
    const result = await this.pool.query(
      `SELECT * FROM institute_join_codes
       WHERE institute_id = $1 ORDER BY created_at DESC`,
      [instituteId],
    );
    return result.rows.map(rowToJoinCode);
  }

  // ─── Institute Subscriptions ───────────────────────────────────

  async createSubscription(input: {
    instituteId: string;
    planId: string;
    maxSeats: number;
    billingContact?: string | null;
    periodStart: Date;
    periodEnd: Date;
    amountPaise: number;
    razorpayOrderId?: string | null;
  }): Promise<InstituteSubscription> {
    const result = await this.pool.query(
      `INSERT INTO institute_subscriptions
         (institute_id, plan_id, max_seats, billing_contact,
          period_start, period_end, amount_paise, razorpay_order_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        input.instituteId,
        input.planId,
        input.maxSeats,
        input.billingContact ?? null,
        input.periodStart,
        input.periodEnd,
        input.amountPaise,
        input.razorpayOrderId ?? null,
      ],
    );
    return rowToInstSub(result.rows[0]);
  }

  async findActiveSubscription(instituteId: string): Promise<InstituteSubscription | null> {
    const result = await this.pool.query(
      `SELECT * FROM institute_subscriptions
       WHERE institute_id = $1 AND status = 'active' AND period_end > NOW()
       ORDER BY period_end DESC LIMIT 1`,
      [instituteId],
    );
    if (result.rows.length === 0) return null;
    return rowToInstSub(result.rows[0]);
  }

  async findSubscriptionById(id: string): Promise<InstituteSubscription | null> {
    const result = await this.pool.query(
      `SELECT * FROM institute_subscriptions WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return null;
    return rowToInstSub(result.rows[0]);
  }

  /** Atomically increments used_seats, enforcing the max_seats cap. Returns false if at capacity. */
  async claimSeat(instituteSubscriptionId: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE institute_subscriptions
       SET used_seats = used_seats + 1
       WHERE id = $1 AND used_seats < max_seats AND status = 'active'
       RETURNING id`,
      [instituteSubscriptionId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  /** Returns a seat when a student's access is revoked. */
  async releaseSeat(instituteSubscriptionId: string): Promise<void> {
    await this.pool.query(
      `UPDATE institute_subscriptions
       SET used_seats = GREATEST(0, used_seats - 1)
       WHERE id = $1`,
      [instituteSubscriptionId],
    );
  }

  // ─── Delete Institute ──────────────────────────────────────────

  /**
   * Permanently deletes an institute.
   * Refuses if the institute still has active members to prevent data loss.
   * Returns { deleted: true } on success or { deleted: false, reason } otherwise.
   */
  async delete(id: string): Promise<{ deleted: boolean; reason?: string }> {
    // Guard: reject if active members exist
    const memberCheck = await this.pool.query(
      `SELECT COUNT(*) FROM institute_members WHERE institute_id = $1 AND is_active = TRUE`,
      [id],
    );
    const activeMemberCount = parseInt(memberCheck.rows[0]['count'] as string, 10);
    if (activeMemberCount > 0) {
      return { deleted: false, reason: 'HAS_ACTIVE_MEMBERS' };
    }

    const result = await this.pool.query(
      `DELETE FROM institutes WHERE id = $1 RETURNING id`,
      [id],
    );
    if ((result.rowCount ?? 0) === 0) {
      return { deleted: false, reason: 'NOT_FOUND' };
    }
    return { deleted: true };
  }
}

export const instituteRepository = new InstituteRepository();
