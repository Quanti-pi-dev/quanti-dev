// ─── Auth Service ───────────────────────────────────────────
// Business logic for authentication operations.
// Integrates with Firebase Admin SDK for user management.

import { getRedisClient } from '../lib/database.js';
import { getFirebaseAdmin } from '../lib/firebase-admin.js';
import { userRepository } from '../repositories/user.repository.js';
import { z } from 'zod';
import { createServiceLogger } from '../lib/logger.js';
import type { UserProfile } from '@kd/shared';

const log = createServiceLogger('AuthService');

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
    return userRepository.create({
      firebaseUid: input.firebaseUid,
      email: input.email,
      displayName: input.displayName || input.email?.split('@')[0] || 'Student',
      avatarUrl: input.avatarUrl,
      role: 'student',
    });
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
}

export const authService = new AuthService();
