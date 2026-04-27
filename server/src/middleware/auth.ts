// ─── JWT Authentication Middleware ───────────────────────────
// Validates Firebase ID tokens using the Firebase Admin SDK.
// Attaches decoded user context to request for downstream handlers.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import crypto from 'crypto';
import { getFirebaseAdmin } from '../lib/firebase-admin.js';
import { getRedisClient } from '../lib/database.js';
import type { UserRole } from '@kd/shared';

// ─── User Context (attached to request) ─────────────────────

export interface RequestUser {
  id: string;        // Firebase UID
  email: string;
  role: UserRole;
}

// Extend Fastify request type
declare module 'fastify' {
  interface FastifyRequest {
    user?: RequestUser;
  }
}

// ─── Token Verification ────────────────────────────────────

async function verifyToken(token: string): Promise<RequestUser> {
  const admin = getFirebaseAdmin();
  const decoded = await admin.auth().verifyIdToken(token);

  return {
    id: decoded.uid,
    email: decoded.email ?? '',
    // Firebase custom claims: set via admin.auth().setCustomUserClaims()
    role: ((decoded['role'] as string) ?? 'student') as UserRole,
  };
}

// ─── Fastify Plugin ─────────────────────────────────────────

async function authPluginInner(fastify: FastifyInstance): Promise<void> {
  fastify.decorateRequest('user', undefined);

  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip auth for health/public routes and webhook endpoints.
    // Webhooks use signature-based authentication (e.g. x-razorpay-signature),
    // not Bearer tokens — their security is enforced inside the handler.
    //
    // Only the truly public auth sub-paths bypass JWT. Protected auth endpoints
    // (/me, /logout) are intentionally NOT listed here so that JWT parsing runs
    // and populates request.user before their route-level requireAuth() guard.
    const PUBLIC_AUTH_PATHS = [
      '/api/v1/auth/sync',
    ];

    // Strip query string for clean path comparison
    const urlPath = request.url.split('?')[0]!;

    if (
      urlPath === '/health' ||
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

    // Check token blocklist (for logged-out tokens) — FIX H5
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
      // Redis unavailable — skip blocklist check rather than blocking all requests.
      // Log at warn level so this is visible in monitoring dashboards.
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

    // Ensure the user exists in PostgreSQL before allowing access to protected routes.
    // If the client has a Firebase token but hasn't synced, interacting with the DB will crash.
    try {
      const redis = getRedisClient();
      const syncKey = `user_synced:${request.user.id}`;
      const isSynced = await redis.get(syncKey);
      
      if (!isSynced) {
        const pg = await import('../lib/database.js').then(m => m.getPostgresPool());
        const res = await pg.query('SELECT 1 FROM users WHERE firebase_uid = $1 LIMIT 1', [request.user.id]);
        
        if (res.rows.length === 0) {
          return reply.status(401).send({
            success: false,
            error: { code: 'USER_NOT_SYNCED', message: 'User profile not synchronized with database' },
            timestamp: new Date().toISOString(),
          });
        }
        // Cache the sync status for 24 hours to avoid DB hits on every request
        await redis.set(syncKey, '1', 'EX', 86400);
      }
    } catch (err) {
      request.log.warn({ err }, 'Failed to verify user sync status');
    }
  });
}

export const authPlugin = fp(authPluginInner);
