// ─── Admin Challenges Routes ──────────────────────────────────
// Admin-scoped read access to all P2P challenge data.
// Challenges are created/managed by users (server-user), but admins
// need platform-wide visibility for moderation and analytics.
//
// Routes:
//   GET /api/admin/challenges  — paginated list of all challenges

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireRole } from '../middleware/rbac.js';
import { challengeRepository, createServiceLogger } from '@kd/db';
import type { ChallengeStatus } from '@kd/shared';

const log = createServiceLogger('AdminChallengeRoutes');

const VALID_STATUSES = ['all', 'pending', 'accepted', 'completed', 'expired', 'declined'] as const;

const querySchema = z.object({

  status: z.enum(VALID_STATUSES).optional().default('all'),
  limit:  z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export async function adminChallengeRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireRole('admin'));

  // ── GET /challenges ─────────────────────────────────────────
  // Returns paginated platform-wide challenge list with joined
  // creator/opponent display names. Supports status filter.
  fastify.get<{ Querystring: unknown }>(
    '/challenges',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = querySchema.parse(request.query);

      try {
        const { data, total } = await challengeRepository.findAllAdmin({
          status: query.status as ChallengeStatus | 'all',
          limit:  query.limit,
          offset: query.offset,
        });

        log.debug(
          { status: query.status, limit: query.limit, offset: query.offset, total },
          'Admin challenges fetched',
        );

        return reply.send({
          success: true,
          data: {
            challenges: data,
            total,
            pagination: {
              limit:   query.limit,
              offset:  query.offset,
              hasMore: query.offset + data.length < total,
            },
          },
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        log.error({ err }, 'Failed to fetch admin challenges');
        return reply.status(500).send({
          success: false,
          error: { code: 'FETCH_FAILED', message: 'Failed to retrieve challenges.' },
          timestamp: new Date().toISOString(),
        });
      }
    },
  );
}
