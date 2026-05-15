// ─── Auth Middleware — User API ───────────────────────────────
// Validates Firebase ID tokens. Attaches decoded user context to
// request. Identical to the original monolith auth middleware.
// Supports all roles (student, admin).

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import crypto from 'crypto';
import { getFirebaseAdmin, getRedisClient, getPostgresPool } from '@kd/db';
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

async function authPluginInner(fastify: FastifyInstance): Promise<void> {
  fastify.decorateRequest('user', undefined);

  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const PUBLIC_AUTH_PATHS = ['/api/v1/auth/sync'];
    const urlPath = request.url.split('?')[0]!;

    if (
      urlPath === '/health' ||
      urlPath === '/health/detailed' ||
      urlPath === '/' ||
      urlPath.startsWith('/api/v1/webhooks/') ||
      PUBLIC_AUTH_PATHS.includes(urlPath)
    ) {
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

    // Check token blocklist (for logged-out tokens)
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

    try {
      request.user = await verifyToken(token);
    } catch (err) {
      request.log.warn({ err }, 'Firebase ID token verification failed');
      return reply.status(401).send({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Token verification failed' },
        timestamp: new Date().toISOString(),
      });
    }

    // Ensure the user has been synced to PostgreSQL
    try {
      const redis = getRedisClient();
      const syncKey = `user_synced:${request.user.id}`;
      const isSynced = await redis.get(syncKey);

      if (!isSynced) {
        const pg = getPostgresPool();
        const res = await pg.query('SELECT 1 FROM users WHERE firebase_uid = $1 LIMIT 1', [request.user.id]);
        if (res.rows.length === 0) {
          return reply.status(401).send({
            success: false,
            error: { code: 'USER_NOT_SYNCED', message: 'User profile not synchronized with database' },
            timestamp: new Date().toISOString(),
          });
        }
        await redis.set(syncKey, '1', 'EX', 86400);
      }
    } catch (err) {
      request.log.warn({ err }, 'Failed to verify user sync status');
    }
  });
}

export const authPlugin = fp(authPluginInner);
