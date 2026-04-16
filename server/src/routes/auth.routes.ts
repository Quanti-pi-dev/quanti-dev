// ─── Auth Service Routes ────────────────────────────────────
// Handles Firebase user sync, logout, and user identity.
// Login, registration, password reset, and token refresh are now
// handled client-side by the Firebase JS SDK.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/rbac.js';
import { authService } from '../services/auth.service.js';

// ─── Input Validation Schemas ───────────────────────────────

const syncSchema = z.object({
  displayName: z.string().min(1).max(100).trim().optional(),
  avatarUrl: z.string().max(2048).optional().nullable(),
});

const updateEmailSchema = z.object({
  email: z.string().email().max(255),
});

// ─── Strict Rate-Limit Config ───────────────────────────────
const authRateLimitConfig = {
  config: {
    rateLimit: {
      max: 10,
      timeWindow: '1 minute',
      keyGenerator: (request: FastifyRequest) => {
        return request.ip;
      },
      errorResponseBuilder: (_request: FastifyRequest, context: { max: number; after: string }) => ({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: `Too many authentication attempts. Max ${context.max} per minute. Retry after ${context.after}.`,
        },
        timestamp: new Date().toISOString(),
      }),
    },
  },
};

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // ─── POST /auth/sync — Lazy upsert after Firebase login ──
  // Called by the mobile client immediately after Firebase
  // authentication succeeds. Creates or updates the user in
  // PostgreSQL. Requires a valid Firebase ID token (the global
  // JWT middleware validates it, but /sync is in PUBLIC_AUTH_PATHS
  // so we validate manually here to extract user info).
  fastify.post('/sync', { ...authRateLimitConfig }, async (request: FastifyRequest, reply: FastifyReply) => {
    // The token has already been validated by the middleware if the user
    // is authenticated. But /sync is a public path so we need to handle
    // both cases: authenticated (middleware ran) and manual extraction.
    if (!request.user) {
      // Extract and verify token manually for the sync endpoint
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' },
          timestamp: new Date().toISOString(),
        });
      }

      const token = authHeader.slice(7);
      try {
        const { getFirebaseAdmin } = await import('../lib/firebase-admin.js');
        const admin = getFirebaseAdmin();
        const decoded = await admin.auth().verifyIdToken(token);
        request.user = {
          id: decoded.uid,
          email: decoded.email ?? '',
          role: ((decoded['role'] as string) ?? 'student') as 'student' | 'admin',
        };
      } catch {
        return reply.status(401).send({
          success: false,
          error: { code: 'INVALID_TOKEN', message: 'Token verification failed' },
          timestamp: new Date().toISOString(),
        });
      }
    }

    const body = syncSchema.safeParse(request.body ?? {});
    const displayName = body.success ? body.data.displayName : undefined;
    const avatarUrl = body.success ? body.data.avatarUrl : undefined;

    try {
      const user = await authService.syncUser({
        firebaseUid: request.user.id,
        email: request.user.email || null,
        displayName: displayName || request.user.email?.split('@')[0] || 'Student',
        avatarUrl: avatarUrl ?? null,
      });

      return reply.send({
        success: true,
        data: user,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sync failed';
      return reply.status(500).send({
        success: false,
        error: { code: 'SYNC_FAILED', message },
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ─── POST /auth/logout — Session invalidation ────────
  fastify.post(
    '/logout',
    { preHandler: requireAuth() },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Extract the access token to add it to the blocklist
      const accessToken = request.headers.authorization?.slice(7) ?? '';
      await authService.logout(accessToken);
      return reply.send({
        success: true,
        data: { message: 'Logged out successfully' },
        timestamp: new Date().toISOString(),
      });
    },
  );

  // ─── GET /auth/me — Current user from JWT ─────────────
  fastify.get(
    '/me',
    { preHandler: requireAuth() },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await authService.getCurrentUser(request.user!.id);
      return reply.send({
        success: true,
        data: user,
        timestamp: new Date().toISOString(),
      });
    },
  );

  // ─── PUT /auth/update-email — Sync email via Firebase ─
  // Used by the onboarding email-prompt screen for social login users who
  // signed up without an email. Updates Firebase (source of truth) first,
  // then mirrors to local PostgreSQL. Rejects if user already has a real email.
  fastify.put(
    '/update-email',
    { preHandler: requireAuth() },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { email } = updateEmailSchema.parse(request.body);

      try {
        await authService.updateEmail(request.user!.id, email);
        return reply.send({
          success: true,
          data: { message: 'Email updated successfully' },
          timestamp: new Date().toISOString(),
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to update email';
        const status = message.includes('only be set') ? 403 : 500;
        return reply.status(status).send({
          success: false,
          error: { code: 'EMAIL_UPDATE_FAILED', message },
          timestamp: new Date().toISOString(),
        });
      }
    },
  );
}
