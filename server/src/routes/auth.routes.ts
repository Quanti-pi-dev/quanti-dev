// ─── Auth Service Routes ────────────────────────────────────
// Handles Auth0 callback, token refresh, logout, and user identity.
// Rate-limited: 5 req/min on sensitive endpoints to block credential stuffing.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/rbac.js';
import { authService } from '../services/auth.service.js';

// ─── H2 Fix: Input Validation Schemas ───────────────────────

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(100).trim(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email().max(255),
});

const callbackSchema = z.object({
  code: z.string().min(1).max(2048),
  redirectUri: z.string().max(2048).optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1).max(4096),
});

// ─── Strict Rate-Limit Config ───────────────────────────────
const authRateLimitConfig = {
  config: {
    rateLimit: {
      max: 5,
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
  // ─── POST /auth/forgot-password — Send reset email ────
  fastify.post('/forgot-password', { ...authRateLimitConfig }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { email } = forgotPasswordSchema.parse(request.body);

    try {
      await authService.forgotPassword(email);
      return reply.send({
        success: true,
        data: { message: "Password reset link sent — check your email." },
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send reset email';
      return reply.status(500).send({
        success: false,
        error: { code: 'RESET_FAILED', message },
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ─── POST /auth/login — Email/Password (ROPC) ─────────
  fastify.post('/login', { ...authRateLimitConfig }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, password } = loginSchema.parse(request.body);

    try {
      const tokens = await authService.loginWithPassword(email, password);
      return reply.send({ success: true, data: tokens, timestamp: new Date().toISOString() });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid email or password';
      return reply.status(401).send({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message },
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ─── POST /auth/register — Email/Password signup ──────
  fastify.post('/register', { ...authRateLimitConfig }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, password, displayName } = registerSchema.parse(request.body);

    try {
      const tokens = await authService.registerWithPassword(email, password, displayName);
      return reply.status(201).send({ success: true, data: tokens, timestamp: new Date().toISOString() });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      return reply.status(409).send({
        success: false,
        error: { code: 'REGISTRATION_FAILED', message },
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ─── POST /auth/callback — Auth0 PKCE callback ────────
  fastify.post('/callback', { ...authRateLimitConfig }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { code, redirectUri } = callbackSchema.parse(request.body);

    try {
      const tokens = await authService.exchangeCode(code, redirectUri ?? '');
      return reply.send({
        success: true,
        data: tokens,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Token exchange failed';
      return reply.status(401).send({
        success: false,
        error: { code: 'AUTH_FAILED', message },
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ─── POST /auth/refresh — Token refresh ───────────────
  fastify.post('/refresh', { ...authRateLimitConfig }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { refreshToken } = refreshSchema.parse(request.body);

    try {
      const tokens = await authService.refreshTokens(refreshToken);
      return reply.send({
        success: true,
        data: tokens,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Token refresh failed';
      return reply.status(401).send({
        success: false,
        error: { code: 'REFRESH_FAILED', message },
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
  // ─── PUT /auth/update-email — Sync email via Auth0 ────
  // Used by the onboarding email-prompt screen for social login users who
  // signed up without an email. Updates Auth0 (source of truth) first,
  // then mirrors to local PostgreSQL. Rejects if user already has a real email.
  fastify.put(
    '/update-email',
    { preHandler: requireAuth() },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { email } = forgotPasswordSchema.parse(request.body);

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
