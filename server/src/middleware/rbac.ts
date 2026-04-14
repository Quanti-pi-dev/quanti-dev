// ─── Role-Based Access Control Middleware ────────────────────
// Factory function that creates route-level guards for specific roles.

import { FastifyRequest, FastifyReply } from 'fastify';
import type { UserRole } from '@kd/shared';

/**
 * Creates a Fastify preHandler hook that enforces role requirements.
 * Usage:
 *   fastify.get('/admin/users', { preHandler: requireRole('admin') }, handler)
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return async function roleGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const user = request.user;

    if (!user) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        timestamp: new Date().toISOString(),
      });
    }

    if (!allowedRoles.includes(user.role)) {
      request.log.warn(
        { userId: user.id, role: user.role, requiredRoles: allowedRoles },
        'Access denied: insufficient role',
      );
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
        timestamp: new Date().toISOString(),
      });
    }
  };
}

/**
 * Convenience: require authenticated user (any role).
 */
export function requireAuth() {
  return async function authGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        timestamp: new Date().toISOString(),
      });
    }
  };
}
