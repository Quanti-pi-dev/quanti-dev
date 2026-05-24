// ─── Auth Middleware — Institute API ──────────────────────────────
// Validates Firebase ID tokens and enforces institute staff roles.
// Accepts: educator | examiner | institute_admin | admin (super-admin passthrough)
// Rejects: student tokens and unauthenticated requests.
//
// Unlike admin-api (which only accepts 'admin'), this plugin allows
// multiple institute roles. Route handlers enforce finer-grained
// per-role permissions via the requireInstituteRole preHandler.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import crypto from 'crypto';
import { getFirebaseAdmin, getRedisClient, getPostgresPool, instituteRepository } from '@kd/db';
import type { UserRole, InstituteMemberRole } from '@kd/shared';

// ─── Augmented Request Context ────────────────────────────────────

export interface RequestUser {
  id: string;          // Firebase UID
  pgId: string;        // PostgreSQL users.id UUID
  email: string;
  role: UserRole;
  /** Populated if user is a member of the institute in the request context */
  instituteRole?: InstituteMemberRole;
  /** Institute ID derived from route param or membership lookup */
  instituteId?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: RequestUser;
  }
}

// Institute staff roles — students and unauthenticated callers are blocked
const INSTITUTE_STAFF_ROLES: UserRole[] = [
  'educator', 'examiner', 'institute_admin', 'admin',
];

// ─── Token Verification ───────────────────────────────────────────

async function verifyToken(token: string): Promise<{ uid: string; email: string; role: UserRole }> {
  const admin = getFirebaseAdmin();
  const decoded = await admin.auth().verifyIdToken(token);
  return {
    uid: decoded.uid,
    email: decoded.email ?? '',
    role: ((decoded['role'] as string) ?? 'student') as UserRole,
  };
}

// ─── Plugin ───────────────────────────────────────────────────────

async function instituteAuthPluginInner(fastify: FastifyInstance): Promise<void> {
  fastify.decorateRequest('user', undefined);

  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const urlPath = request.url.split('?')[0]!;

    if (urlPath === '/health' || urlPath === '/health/detailed') return;

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' },
        timestamp: new Date().toISOString(),
      });
    }

    const token = authHeader.slice(7);

    // Token blocklist check
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

    let decoded: { uid: string; email: string; role: UserRole };
    try {
      decoded = await verifyToken(token);
    } catch (err) {
      request.log.warn({ err }, 'Firebase ID token verification failed');
      return reply.status(401).send({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Token verification failed' },
        timestamp: new Date().toISOString(),
      });
    }

    // Block students from reaching institute staff endpoints
    if (!INSTITUTE_STAFF_ROLES.includes(decoded.role)) {
      request.log.warn({ uid: decoded.uid, role: decoded.role, url: urlPath },
        'Non-staff token rejected by Institute API');
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Institute staff access required' },
        timestamp: new Date().toISOString(),
      });
    }

    // Resolve PostgreSQL UUID for the user
    const pg = getPostgresPool();
    const pgRes = await pg.query(
      'SELECT id FROM users WHERE firebase_uid = $1 LIMIT 1',
      [decoded.uid],
    );
    if (pgRes.rows.length === 0) {
      return reply.status(401).send({
        success: false,
        error: { code: 'USER_NOT_SYNCED', message: 'User profile not found in database' },
        timestamp: new Date().toISOString(),
      });
    }

    request.user = {
      id: decoded.uid,
      pgId: pgRes.rows[0]['id'] as string,
      email: decoded.email,
      role: decoded.role,
    };
  });
}

export const instituteAuthPlugin = fp(instituteAuthPluginInner);

// ─── Route-level Role Guard ───────────────────────────────────────
// Use as preHandler on routes that need a specific institute role.
// Also attaches `request.user.instituteRole` and `request.user.instituteId`.

export function requireInstituteRole(...allowedRoles: InstituteMemberRole[]) {
  return async function roleGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        timestamp: new Date().toISOString(),
      });
    }

    // Super-admins bypass institute role checks
    if (request.user.role === 'admin') return;

    // Extract instituteId from route params or body
    const instituteId =
      (request.params as Record<string, string>)['instituteId'] ??
      (request.body as Record<string, string> | null)?.['instituteId'];

    if (!instituteId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_INSTITUTE_ID', message: 'Institute ID is required' },
        timestamp: new Date().toISOString(),
      });
    }

    const membership = await instituteRepository.findMembership(request.user.pgId, instituteId);
    if (!membership || !membership.isActive) {
      return reply.status(403).send({
        success: false,
        error: { code: 'NOT_A_MEMBER', message: 'You are not a member of this institute' },
        timestamp: new Date().toISOString(),
      });
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(membership.role)) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'INSUFFICIENT_ROLE',
          message: `This action requires one of: ${allowedRoles.join(', ')}`,
          yourRole: membership.role,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Attach to request for route handlers to use without re-querying
    request.user.instituteRole = membership.role;
    request.user.instituteId = instituteId;
  };
}
