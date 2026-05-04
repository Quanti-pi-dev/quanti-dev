// ─── User Repository ────────────────────────────────────────
// PostgreSQL data access for users and user_preferences tables.

import crypto from 'crypto';
import { getPostgresPool } from '../lib/database.js';
import type { UserProfile, UserPreferences, UserRole } from '@kd/shared';

// Generate a unique enrollment ID in the format QP-XXXXXXXX
function generateEnrollmentId(): string {
  const hex = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `QP-${hex}`;
}

// H3 fix: Escape ILIKE wildcards to prevent pattern injection
function escapeIlike(str: string): string {
  return str.replace(/[%_\\]/g, '\\$&');
}

interface CreateUserInput {
  firebaseUid: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
}

// Email is intentionally excluded — managed through Firebase only
interface UpdateProfileInput {
  displayName?: string;
  avatarUrl?: string | null;
}

class UserRepository {
  private get pool() {
    return getPostgresPool();
  }

  // ─── Find by Firebase ID ────────────────────────────────
  async findByFirebaseUid(firebaseUid: string): Promise<UserProfile | null> {
    const result = await this.pool.query(
      `SELECT id, display_name, avatar_url, email, role, enrollment_id, created_at
       FROM users WHERE firebase_uid = $1`,
      [firebaseUid],
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      email: row.email,
      role: row.role,
      enrollmentId: row.enrollment_id,
      joinedAt: row.created_at.toISOString(),
    };
  }

  // ─── Find by UUID ────────────────────────────────────
  async findById(id: string): Promise<UserProfile | null> {
    const result = await this.pool.query(
      `SELECT id, display_name, avatar_url, email, role, enrollment_id, created_at
       FROM users WHERE id = $1`,
      [id],
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      email: row.email,
      role: row.role,
      enrollmentId: row.enrollment_id,
      joinedAt: row.created_at.toISOString(),
    };
  }

  // ─── Resolve PG UUID → Firebase UID ───────────────────
  async getFirebaseUid(id: string): Promise<string | null> {
    const result = await this.pool.query(
      `SELECT firebase_uid FROM users WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return null;
    return result.rows[0].firebase_uid as string;
  }

  // ─── Create user ─────────────────────────────────────
  async create(input: CreateUserInput): Promise<UserProfile> {
    // Generate a unique enrollment ID with retry on rare collision
    let enrollmentId = generateEnrollmentId();
    const MAX_RETRIES = 3;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const result = await this.pool.query(
          `INSERT INTO users (firebase_uid, email, display_name, avatar_url, role, enrollment_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, display_name, avatar_url, email, role, enrollment_id, created_at`,
          [input.firebaseUid, input.email, input.displayName, input.avatarUrl, input.role, enrollmentId],
        );

        const row = result.rows[0];

        // Create default preferences
        await this.pool.query(
          `INSERT INTO user_preferences (user_id) VALUES ($1)`,
          [row.id],
        );

        return {
          id: row.id,
          displayName: row.display_name,
          avatarUrl: row.avatar_url,
          email: row.email,
          role: row.role,
          enrollmentId: row.enrollment_id,
          joinedAt: row.created_at.toISOString(),
        };
      } catch (err: unknown) {
        const pgErr = err as { code?: string; constraint?: string };
        if (pgErr.code === '23505' && pgErr.constraint === 'uq_users_enrollment_id') {
          // Collision on enrollment_id — regenerate and retry
          enrollmentId = generateEnrollmentId();
          continue;
        }
        throw err;
      }
    }
    throw new Error('Failed to generate unique enrollment ID after retries');
  }

  // ─── Update profile ──────────────────────────────────
  // NOTE: email updates are not supported here — emails are managed via Firebase.
  async updateProfile(firebaseUid: string, input: UpdateProfileInput): Promise<UserProfile | null> {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.displayName !== undefined) {
      setClauses.push(`display_name = $${paramIndex++}`);
      values.push(input.displayName);
    }
    if (input.avatarUrl !== undefined) {
      setClauses.push(`avatar_url = $${paramIndex++}`);
      values.push(input.avatarUrl);
    }

    if (setClauses.length === 0) {
      return this.findByFirebaseUid(firebaseUid);
    }

    // M5 fix: always update timestamp
    setClauses.push(`updated_at = NOW()`);

    values.push(firebaseUid);
    const result = await this.pool.query(
      `UPDATE users SET ${setClauses.join(', ')}
       WHERE firebase_uid = $${paramIndex}
       RETURNING id, display_name, avatar_url, email, role, enrollment_id, created_at`,
      values,
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      email: row.email,
      role: row.role,
      enrollmentId: row.enrollment_id,
      joinedAt: row.created_at.toISOString(),
    };
  }

  // ─── Get preferences ──────────────────────────────────
  async getPreferences(firebaseUid: string): Promise<UserPreferences | null> {
    const result = await this.pool.query(
      `SELECT up.user_id, up.theme, up.notifications_enabled,
              up.study_reminders_enabled, up.reminder_time,
              up.onboarding_completed, up.selected_exams, up.selected_subjects,
              up.exam_date, up.preferred_study_time, up.daily_card_target
       FROM user_preferences up
       JOIN users u ON u.id = up.user_id
       WHERE u.firebase_uid = $1`,
      [firebaseUid],
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      userId: row.user_id,
      theme: row.theme,
      notificationsEnabled: row.notifications_enabled,
      studyRemindersEnabled: row.study_reminders_enabled,
      reminderTime: row.reminder_time?.toString() ?? null,
      onboardingCompleted: row.onboarding_completed ?? false,
      selectedExams: row.selected_exams ?? [],
      selectedSubjects: row.selected_subjects ?? [],
      examDate: row.exam_date ? row.exam_date.toISOString().split('T')[0] : null,
      preferredStudyTime: row.preferred_study_time ?? null,
      dailyCardTarget: row.daily_card_target ?? null,
    };
  }

  // ─── Update preferences ───────────────────────────────
  async updatePreferences(
    firebaseUid: string,
    input: Partial<Omit<UserPreferences, 'userId'>>,
  ): Promise<UserPreferences | null> {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.theme !== undefined) {
      setClauses.push(`theme = $${paramIndex++}`);
      values.push(input.theme);
    }
    if (input.notificationsEnabled !== undefined) {
      setClauses.push(`notifications_enabled = $${paramIndex++}`);
      values.push(input.notificationsEnabled);
    }
    if (input.studyRemindersEnabled !== undefined) {
      setClauses.push(`study_reminders_enabled = $${paramIndex++}`);
      values.push(input.studyRemindersEnabled);
    }
    if (input.reminderTime !== undefined) {
      setClauses.push(`reminder_time = $${paramIndex++}`);
      values.push(input.reminderTime === null ? null : input.reminderTime);
    }
    if (input.onboardingCompleted !== undefined) {
      setClauses.push(`onboarding_completed = $${paramIndex++}`);
      values.push(input.onboardingCompleted);
    }
    if (input.selectedExams !== undefined) {
      setClauses.push(`selected_exams = $${paramIndex++}`);
      values.push(input.selectedExams);
    }
    if (input.selectedSubjects !== undefined) {
      setClauses.push(`selected_subjects = $${paramIndex++}`);
      values.push(input.selectedSubjects);
    }
    if (input.examDate !== undefined) {
      setClauses.push(`exam_date = $${paramIndex++}`);
      values.push(input.examDate);
    }
    if (input.preferredStudyTime !== undefined) {
      setClauses.push(`preferred_study_time = $${paramIndex++}`);
      values.push(input.preferredStudyTime);
    }
    if (input.dailyCardTarget !== undefined) {
      setClauses.push(`daily_card_target = $${paramIndex++}`);
      values.push(input.dailyCardTarget);
    }

    if (setClauses.length === 0) {
      return this.getPreferences(firebaseUid);
    }

    values.push(firebaseUid);
    await this.pool.query(
      `UPDATE user_preferences SET ${setClauses.join(', ')}
       WHERE user_id = (SELECT id FROM users WHERE firebase_uid = $${paramIndex})`,
      values,
    );

    return this.getPreferences(firebaseUid);
  }
  // ─── Update email (called after Firebase sync) ───────────
  // Only used by authService.updateEmail() after the email has been set in
  // Firebase first. Mirrors the Firebase source of truth into PostgreSQL.
  async updateEmail(firebaseUid: string, email: string): Promise<void> {
    await this.pool.query(
      `UPDATE users SET email = $1 WHERE firebase_uid = $2`,
      [email, firebaseUid],
    );
  }

  // ─── Search users by email (admin typeahead) ──────────
  async searchByEmail(query: string, limit = 10): Promise<UserProfile[]> {
    const result = await this.pool.query(
      `SELECT id, display_name, avatar_url, email, role, enrollment_id, created_at
       FROM users
       WHERE email ILIKE $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [`%${escapeIlike(query)}%`, limit],
    );

    return result.rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      displayName: row.display_name as string,
      avatarUrl: row.avatar_url as string | null,
      email: row.email as string,
      role: row.role as UserRole,
      enrollmentId: row.enrollment_id as string,
      joinedAt: (row.created_at as Date).toISOString(),
    }));
  }
}

export const userRepository = new UserRepository();
