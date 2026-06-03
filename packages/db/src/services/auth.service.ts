// ─── Auth Service ───────────────────────────────────────────
// Business logic for authentication operations.
// Integrates with Firebase Admin SDK for user management.

import { getRedisClient, getMongoDb } from '../clients/database.js';
import { getFirebaseAdmin } from '../lib/firebase-admin.js';
import { userRepository } from '../repositories/user.repository.js';
import { instituteRepository } from '../repositories/institute.repository.js';
import { z } from 'zod';
import { createServiceLogger } from '../lib/logger.js';
import type { UserProfile } from '@kd/shared';
import { emailService } from './email.service.js';

const log = createServiceLogger('AuthService');

// ─── Claim Shapes ────────────────────────────────────────────
// Firebase custom claims are merged into the JWT automatically.
// The 'role' claim is the platform-wide role (student/admin/etc).
// Institute-scoped claims use namespaced keys to avoid collisions.
//
// Token payload example:
//   { role: 'educator', institute_role: 'educator', institute_id: 'abc123' }
//
// A student who belongs to an institute keeps role='student' but
// gets 'institute_role' injected for server-side membership checks.
//
// Claims are refreshed on the client by calling getIdToken(true).

const CLAIMS_VERSION = 1; // increment to force-refresh all tokens if claim shape changes

class AuthService {
  // ─── Sync user (lazy upsert after Firebase login) ────
  // Called from POST /auth/sync after client-side Firebase login.
  // Creates the user in PostgreSQL if they don't exist yet, or
  // updates their profile if they do (e.g. avatar changed).
  async syncUser(input: {
    firebaseUid: string;
    email: string | null;
    displayName: string;
    avatarUrl: string | null;
  }): Promise<UserProfile> {
    const existing = await userRepository.findByFirebaseUid(input.firebaseUid);
    if (existing) {
      // Update display name and avatar if changed
      const updated = await userRepository.updateProfile(input.firebaseUid, {
        displayName: input.displayName || existing.displayName,
        avatarUrl: input.avatarUrl ?? existing.avatarUrl,
      });
      return updated ?? existing;
    }

    // Create new user profile
    const user = await userRepository.create({
      firebaseUid: input.firebaseUid,
      email: input.email,
      displayName: input.displayName || input.email?.split('@')[0] || 'Student',
      avatarUrl: input.avatarUrl,
      role: 'student',
    });

    if (user.email && !user.email.includes('@placeholder.')) {
      // Don't await to avoid blocking login response
      emailService.sendWelcomeEmail(user.email, user.displayName).catch((err: any) => {
        log.error({ err, email: user.email }, 'Failed to trigger welcome email');
      });
    }

    return user;
  }

  // ─── Get current user profile ────────────────────────
  async getCurrentUser(firebaseUid: string): Promise<UserProfile | null> {
    return userRepository.findByFirebaseUid(firebaseUid);
  }

  // ─── Logout ──────────────────────────────────────────
  async logout(accessToken: string): Promise<void> {
    try {
      // Decode token to get expiration time (without verifying — already done in middleware)
      const decoded = JSON.parse(
        Buffer.from(accessToken.split('.')[1] ?? '', 'base64').toString(),
      ) as { exp?: number };

      const ttl = decoded.exp ? Math.max(0, decoded.exp - Math.floor(Date.now() / 1000)) : 3600;

      // Add token hash to blocklist with TTL matching remaining lifetime (FIX H5)
      // Uses a single per-hash key that auto-expires — no unbounded SET growth.
      const crypto = await import('crypto');
      const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');
      const redis = getRedisClient();
      await redis.setex(`token_block:${tokenHash}`, ttl, '1');
    } catch (err) {
      // Non-critical — token will expire naturally via JWT exp claim
      log.error({ err }, 'failed to blocklist token on logout');
    }

    // Also revoke Firebase refresh tokens to force re-authentication
    try {
      const decoded = JSON.parse(
        Buffer.from(accessToken.split('.')[1] ?? '', 'base64').toString(),
      ) as { sub?: string };
      if (decoded.sub) {
        const admin = getFirebaseAdmin();
        await admin.auth().revokeRefreshTokens(decoded.sub);
      }
    } catch (err) {
      log.error({ err }, 'failed to revoke Firebase refresh tokens');
    }
  }

  // ─── Update email (Firebase-synced) ───────────────────
  // Only allows setting email for users who currently have no email or a
  // placeholder (social login users). This preserves the VULN-3 fix by
  // preventing arbitrary email reassignment while restoring the email
  // collection flow for social login users during onboarding.
  async updateEmail(firebaseUid: string, newEmail: string): Promise<void> {
    // Validate format
    const emailSchema = z.string().email();
    const parsed = emailSchema.safeParse(newEmail);
    if (!parsed.success) {
      throw new Error('Invalid email address');
    }

    // Check current user — only allow if missing or placeholder email
    const existing = await userRepository.findByFirebaseUid(firebaseUid);
    if (!existing) {
      throw new Error('User not found');
    }
    if (existing.email && !existing.email.includes('@placeholder.')) {
      throw new Error('Email can only be set for accounts without an existing email');
    }

    // 1. Update email in Firebase (source of truth)
    const admin = getFirebaseAdmin();
    try {
      await admin.auth().updateUser(firebaseUid, {
        email: newEmail,
        emailVerified: false,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update email in Firebase';
      throw new Error(message);
    }

    // 2. Mirror to local PostgreSQL
    await userRepository.updateEmail(firebaseUid, newEmail);

    log.info({ firebaseUid }, 'email updated via Firebase Admin SDK');
  }
  // ─── Set institute-scoped custom claims ────────────────
  // Called after a user joins an institute (any role).
  // Updates Firebase custom claims to include the institute role.
  // The client must call getIdToken(true) to pick up the new claims.
  //
  // For users who belong to MULTIPLE institutes (rare but supported),
  // this stores the PRIMARY institute (most recently joined).
  async setInstituteClaims(
    firebaseUid: string,
    instituteId: string,
    instituteRole: string,
    platformRole: string,  // the UserRole e.g. 'educator' | 'student' etc.
  ): Promise<void> {
    const admin = getFirebaseAdmin();
    try {
      // Read existing claims first to preserve any non-institute ones
      const user = await admin.auth().getUser(firebaseUid);
      const existing = (user.customClaims ?? {}) as Record<string, unknown>;

      await admin.auth().setCustomUserClaims(firebaseUid, {
        ...existing,
        role: platformRole,
        institute_role: instituteRole,
        institute_id: instituteId,
        cv: CLAIMS_VERSION,
      });

      log.info({ firebaseUid, instituteId, instituteRole, platformRole }, 'Institute claims set');
    } catch (err) {
      // Non-fatal: claims will be refreshed on next join or admin action.
      // The API still works via DB membership checks.
      log.error({ err, firebaseUid }, 'Failed to set institute custom claims');
    }
  }

  // ─── Clear institute-scoped custom claims ───────────────
  // Called when a user leaves or is removed from an institute.
  // Reverts role to 'student' and removes institute claims.
  async clearInstituteClaims(
    firebaseUid: string,
  ): Promise<void> {
    const admin = getFirebaseAdmin();
    try {
      const user = await admin.auth().getUser(firebaseUid);
      const existing = (user.customClaims ?? {}) as Record<string, unknown>;

      // Remove institute-specific keys, keep everything else
      const { institute_role: _, institute_id: __, ...rest } = existing;
      await admin.auth().setCustomUserClaims(firebaseUid, {
        ...rest,
        role: 'student',   // revert to base role
        cv: CLAIMS_VERSION,
      });

      // Also revoke refresh tokens so the change takes effect immediately
      await admin.auth().revokeRefreshTokens(firebaseUid);

      log.info({ firebaseUid }, 'Institute claims cleared');
    } catch (err) {
      log.error({ err, firebaseUid }, 'Failed to clear institute custom claims');
    }
  }

  // ─── Provision Staff Account ─────────────────────────────
  // Creates a brand-new Firebase account for a tutor/examiner/admin,
  // sets their institute claims, upserts the PG user row, adds them
  // as an institute_member, and emails the temp password.
  //
  // Password policy: 12 chars — uppercase + lowercase + digits + symbol.
  async provisionStaffAccount(input: {
    email: string;
    displayName: string;
    role: 'educator' | 'examiner' | 'institute_admin';
    instituteId: string;
    instituteName: string;
    portalUrl: string;
  }): Promise<{
    firebaseUid: string;
    userId: string;      // PG UUID
    tempPassword: string;
  }> {
    const admin = getFirebaseAdmin();

    // 1. Generate a secure temporary password
    const crypto = await import('crypto');
    const raw = crypto.randomBytes(12).toString('base64url').slice(0, 12);
    // Guarantee policy: uppercase, lowercase, digit, symbol present
    const tempPassword = raw.slice(0, 9) + 'A1!';  // deterministic suffix covers all char classes

    // 2. Create Firebase user — fails fast if email already exists
    let firebaseUid: string;
    try {
      const fbUser = await admin.auth().createUser({
        email: input.email,
        password: tempPassword,
        displayName: input.displayName,
        emailVerified: false,
      });
      firebaseUid = fbUser.uid;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create Firebase account';
      throw new Error(msg);
    }

    try {
      // 3. Set institute custom claims immediately so first login works
      await admin.auth().setCustomUserClaims(firebaseUid, {
        role: input.role,
        institute_role: input.role,
        institute_id: input.instituteId,
        cv: CLAIMS_VERSION,
      });

      // 4. Upsert PG user row — store the actual staff role directly
      const pgUser = await userRepository.create({
        firebaseUid,
        email: input.email,
        displayName: input.displayName,
        avatarUrl: null,
        role: input.role,   // 'educator' | 'examiner' | 'institute_admin'
      });

      // 5. Add to institute_members
      await instituteRepository.addMember({
        instituteId: input.instituteId,
        userId: pgUser.id,
        firebaseUid,
        role: input.role,
      });

      // 6. Send invite email (fire-and-forget — non-fatal)
      emailService.sendStaffInviteEmail({
        to: input.email,
        name: input.displayName,
        instituteName: input.instituteName,
        role: input.role,
        tempPassword,
        portalUrl: input.portalUrl,
      }).catch((err: unknown) => {
        log.error({ err, email: input.email }, 'Failed to send staff invite email');
      });

      log.info({ firebaseUid, instituteId: input.instituteId, role: input.role }, 'Staff account provisioned');
      return { firebaseUid, userId: pgUser.id, tempPassword };

    } catch (err) {
      // Rollback: delete the Firebase account to avoid orphaned credentials
      try { await admin.auth().deleteUser(firebaseUid); } catch { /* best-effort */ }
      throw err;
    }
  }

  // ─── Sync role claim (general purpose) ─────────────────
  // Sets just the 'role' custom claim for any platform role change.
  // Used by admin when promoting a user to institute_admin.
  async syncRoleClaim(
    firebaseUid: string,
    role: string,
  ): Promise<void> {
    const admin = getFirebaseAdmin();
    try {
      const user = await admin.auth().getUser(firebaseUid);
      const existing = (user.customClaims ?? {}) as Record<string, unknown>;
      await admin.auth().setCustomUserClaims(firebaseUid, {
        ...existing,
        role,
        cv: CLAIMS_VERSION,
      });
      log.info({ firebaseUid, role }, 'Role claim synced');
    } catch (err) {
      log.error({ err, firebaseUid }, 'Failed to sync role claim');
    }
  }

  // ─── Hard delete user & all data ─────────────────────────
  // Permanently removes:
  //   1. Firebase Authentication record
  //   2. All MongoDB user-scoped documents (6 collections)
  //   3. Redis AI quota key for today
  //   4. All PostgreSQL rows via a single transaction
  //
  // Accepts the PostgreSQL UUID (id). Resolves firebase_uid internally.
  // Tolerates firebase auth/user-not-found so orphaned DB rows can still
  // be cleaned when the Firebase record was already removed manually.
  async deleteUserAndData(id: string): Promise<void> {
    // 1. Resolve Firebase UID from PG
    const firebaseUid = await userRepository.getFirebaseUid(id);
    if (!firebaseUid) {
      throw Object.assign(new Error('User not found'), { code: 'USER_NOT_FOUND' });
    }

    // 2. Delete Firebase Authentication account
    const admin = getFirebaseAdmin();
    try {
      await admin.auth().deleteUser(firebaseUid);
      log.info({ firebaseUid, id }, 'Firebase account deleted');
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string };
      if (firebaseErr.code !== 'auth/user-not-found') {
        // Unexpected error — abort before touching data
        throw err;
      }
      log.warn({ firebaseUid }, 'Firebase account already absent — continuing with DB purge');
    }

    // 3. Delete all MongoDB user documents (keyed by firebase_uid string)
    const MONGO_USER_COLLECTIONS = [
      'analytics_events',
      'card_annotations',
      'user_decks',
      'user_deck_cards',
      'custom_tests',
      'custom_test_submissions',
    ] as const;

    const mongoDb = getMongoDb();
    await Promise.all(
      MONGO_USER_COLLECTIONS.map((col) =>
        mongoDb.collection(col).deleteMany({ user_id: firebaseUid }),
      ),
    );
    log.info({ firebaseUid }, 'MongoDB user data purged');

    // 4. Evict Redis AI quota key for today (best-effort)
    try {
      const redis = getRedisClient();
      const today = new Date().toISOString().split('T')[0]!;
      await redis.del(`ai:quota:${id}:${today}`);
    } catch (err) {
      log.warn({ err, id }, 'Failed to evict Redis quota key — non-fatal');
    }

    // 5. Delete all PostgreSQL rows in a single transaction
    await userRepository.deleteUserTransact(id, firebaseUid);
    log.info({ firebaseUid, id }, 'User hard-deleted successfully');
  }
}

export const authService = new AuthService();

