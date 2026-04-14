// ─── Auth Service ───────────────────────────────────────────
// Business logic for authentication operations.
// Integrates with Auth0 for token exchange and manages user onboarding.

import { config } from '../config.js';
import { getRedisClient } from '../lib/database.js';
import { userRepository } from '../repositories/user.repository.js';
import { z } from 'zod';
import { createServiceLogger } from '../lib/logger.js';
import type { AuthTokens, UserProfile } from '@kd/shared';

const log = createServiceLogger('AuthService');

// ─── Timeout-safe fetch for Auth0 calls ─────────────────────
// All Auth0 HTTP calls use a 10-second timeout to prevent hung connections
// from blocking the request handler indefinitely.

const AUTH0_TIMEOUT_MS = 10_000;

function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AUTH0_TIMEOUT_MS);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

class AuthService {
  // ─── Forgot password (Auth0 hosted link) ─────────────
  // Triggers Auth0 to send a password-reset email with a secure link.
  // The user clicks the link in their email — no OTP needed in the app.
  async forgotPassword(email: string): Promise<void> {
    const response = await fetchWithTimeout(`https://${config.auth0.domain}/dbconnections/change_password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: config.auth0.clientId,
        email,
        connection: 'Username-Password-Authentication',
      }),
    });

    if (!response.ok) {
      // Auth0 returns plain text on success/failure for this endpoint
      const body = await response.text();
      throw new Error(body || 'Failed to send password reset email');
    }
    // Auth0 returns "We've just sent you an email to reset your password." on success
  }

  // ─── Email/Password login (ROPC) ─────────────────────

  async loginWithPassword(email: string, password: string): Promise<AuthTokens> {
    const response = await fetchWithTimeout(`https://${config.auth0.domain}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'password',
        client_id: config.auth0.clientId,
        client_secret: config.auth0.clientSecret,
        audience: config.auth0.audience,
        scope: 'openid profile email offline_access',
        username: email,
        password,
      }),
    });

    if (!response.ok) {
      const body = (await response.json()) as { error_description?: string };
      const msg = body.error_description ?? 'Invalid email or password';
      throw new Error(msg);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    // Trigger user onboarding if first login
    await this.onboardIfNew(data.access_token);

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  // ─── Email/Password registration ─────────────────────
  // Creates user via Auth0 Management API, then logs them in via ROPC.
  async registerWithPassword(
    email: string,
    password: string,
    displayName: string,
  ): Promise<AuthTokens> {
    // 1. Get a Management API token
    const mgmtTokenRes = await fetchWithTimeout(`https://${config.auth0.domain}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: config.auth0.clientId,
        client_secret: config.auth0.clientSecret,
        audience: `https://${config.auth0.domain}/api/v2/`,
      }),
    });

    if (!mgmtTokenRes.ok) {
      throw new Error('Could not reach Auth0 management API');
    }

    const { access_token: mgmtToken } = (await mgmtTokenRes.json()) as { access_token: string };

    // 2. Create the user in Auth0's database connection
    const createRes = await fetchWithTimeout(`https://${config.auth0.domain}/api/v2/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mgmtToken}`,
      },
      body: JSON.stringify({
        connection: 'Username-Password-Authentication',
        email,
        password,
        name: displayName,
        email_verified: false,
      }),
    });

    if (!createRes.ok) {
      const body = (await createRes.json()) as { message?: string };
      const msg = body.message ?? 'Registration failed';
      // Auth0 returns "The user already exists" for duplicate emails
      throw new Error(msg);
    }

    // 3. Log the new user in via ROPC to get tokens
    return this.loginWithPassword(email, password);
  }

  // ─── Exchange authorization code for tokens ───────────

  async exchangeCode(code: string, redirectUri: string): Promise<AuthTokens> {
    const response = await fetchWithTimeout(`https://${config.auth0.domain}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: config.auth0.clientId,
        client_secret: config.auth0.clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Auth0 token exchange failed: ${error}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      id_token?: string;
    };

    // Trigger user onboarding if first login
    await this.onboardIfNew(data.access_token);

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  // ─── Refresh tokens ──────────────────────────────────
  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    const response = await fetchWithTimeout(`https://${config.auth0.domain}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: config.auth0.clientId,
        client_secret: config.auth0.clientSecret,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
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
  }

  // ─── Get current user profile ────────────────────────
  async getCurrentUser(auth0Id: string): Promise<UserProfile | null> {
    return userRepository.findByAuth0Id(auth0Id);
  }

  // ─── Onboard new user ────────────────────────────────
  private async onboardIfNew(accessToken: string): Promise<void> {
    // Fetch user info from Auth0
    const response = await fetchWithTimeout(`https://${config.auth0.domain}/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) return;

    const userInfo = (await response.json()) as {
      sub: string;
      email?: string;
      name?: string;
      given_name?: string;       // Microsoft, LinkedIn
      family_name?: string;      // Microsoft, LinkedIn
      nickname?: string;         // GitHub (login handle)
      picture?: string;
    };

    // Check if user already exists
    const existing = await userRepository.findByAuth0Id(userInfo.sub);
    if (existing) return;

    // Normalise displayName across providers:
    //   Google   → name
    //   Microsoft/LinkedIn → given_name + family_name
    //   GitHub   → nickname (the login handle) when name is absent
    //   Fallback → local-part of email → 'Student'
    const displayName =
      userInfo.name ??
      ([userInfo.given_name, userInfo.family_name].filter(Boolean).join(' ') || undefined) ??
      userInfo.nickname ??
      userInfo.email?.split('@')[0] ??
      'Student';

    // Create new user profile
    await userRepository.create({
      auth0Id: userInfo.sub,
      email: userInfo.email ?? null,
      displayName,
      avatarUrl: userInfo.picture ?? null,
      role: 'student',
    });
  }

  // ─── Update email (Auth0-synced) ───────────────────
  // Only allows setting email for users who currently have no email or a
  // placeholder (social login users). This preserves the VULN-3 fix by
  // preventing arbitrary email reassignment while restoring the email
  // collection flow for social login users during onboarding.
  async updateEmail(auth0Id: string, newEmail: string): Promise<void> {
    // Validate format
    const emailSchema = z.string().email();
    const parsed = emailSchema.safeParse(newEmail);
    if (!parsed.success) {
      throw new Error('Invalid email address');
    }

    // Check current user — only allow if missing or placeholder email
    const existing = await userRepository.findByAuth0Id(auth0Id);
    if (!existing) {
      throw new Error('User not found');
    }
    if (existing.email && !existing.email.includes('@placeholder.')) {
      throw new Error('Email can only be set for accounts without an existing email');
    }

    // 1. Get Management API token
    const mgmtTokenRes = await fetchWithTimeout(`https://${config.auth0.domain}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: config.auth0.clientId,
        client_secret: config.auth0.clientSecret,
        audience: `https://${config.auth0.domain}/api/v2/`,
      }),
    });

    if (!mgmtTokenRes.ok) {
      throw new Error('Could not reach Auth0 management API');
    }

    const { access_token: mgmtToken } = (await mgmtTokenRes.json()) as { access_token: string };

    // 2. Update email in Auth0 (source of truth)
    const updateRes = await fetchWithTimeout(
      `https://${config.auth0.domain}/api/v2/users/${encodeURIComponent(auth0Id)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mgmtToken}`,
        },
        body: JSON.stringify({ email: newEmail, email_verified: false }),
      },
    );

    if (!updateRes.ok) {
      const body = (await updateRes.json()) as { message?: string };
      throw new Error(body.message ?? 'Failed to update email in Auth0');
    }

    // 3. Mirror to local PostgreSQL
    await userRepository.updateEmail(auth0Id, newEmail);

    log.info({ auth0Id }, 'email updated via Auth0 Management API');
  }
}

export const authService = new AuthService();
