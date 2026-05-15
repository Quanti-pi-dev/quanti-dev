// ─── Auth Middleware — Admin API ──────────────────────────────
// Stricter than the user API auth plugin:
//   1. No public paths (except /health)
//   2. Rejects ALL non-admin tokens at the plugin level — role
//      checks inside route handlers are redundant but kept for
//      defense-in-depth.
//   3. No user-sync check — admins are provisioned separately.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import crypto from 'crypto';
import { getFirebaseAdmin, getRedisClient } from '@kd/db';
import type { UserRole } from '@kd/shared';

// ─── User Context ─────────────────────────────────────────────

export interface RequestUser {
  id: string;
  email: string;
  role: UserRole;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: RequestUser;
  }
}

// ─── Token Verification ───────────────────────────────────────

async function verifyToken(token: string): Promise<RequestUser> {
  const admin = getFirebaseAdmin();
  const decoded = await admin.auth().verifyIdToken(token);
  return {
    id: decoded.uid,
    email: decoded.email ?? '',
    role: ((decoded['role'] as string) ?? 'student') as UserRole,
  };
}

// ─── Plugin ───────────────────────────────────────────────────

async function adminAuthPluginInner(fastify: FastifyInstance): Promise<void> {
  fastify.decorateRequest('user', undefined);

  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const urlPath = request.url.split('?')[0]!;

    // Only /health bypasses auth on the Admin API — everything else
    // requires a valid admin token.
    if (urlPath === '/health' || urlPath === '/health/detailed') {
      return;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' },
        timestamp: new Date().toISOString(),
      });
    }

    const token = authHeader.slice(7);

    // Check token blocklist
    try {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const isBlocked = await getRedisClient().exists(`token_block:${tokenHash}`);
      if (isBlocked) {
        return reply.status(401).send({
          success: false,
          error: { code: 'TOKEN_REVOKED', message: 'Token has been revoked' },
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      request.log.warn({ err }, 'Token blocklist check skipped — Redis unavailable');
    }

    let user: RequestUser;
    try {
      user = await verifyToken(token);
    } catch (err) {
      request.log.warn({ err }, 'Firebase ID token verification failed');
      return reply.status(401).send({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Token verification failed' },
        timestamp: new Date().toISOString(),
      });
    }

    // ── Admin-only gate ────────────────────────────────────────
    // Reject non-admin tokens before they reach any route handler.
    // This is the key security difference from the User API.
    if (user.role !== 'admin') {
      request.log.warn(
        { uid: user.id, role: user.role, url: urlPath },
        'Non-admin token rejected by Admin API',
      );
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admin access required' },
        timestamp: new Date().toISOString(),
      });
    }

    request.user = user;
  });
}

export const adminAuthPlugin = fp(adminAuthPluginInner);
