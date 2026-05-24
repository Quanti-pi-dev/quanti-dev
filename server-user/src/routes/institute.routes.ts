// ─── Institute Student Routes — User API ──────────────────────────
// Student-facing endpoints for institute features:
//   - Join an institute via code
//   - View assigned tests
//   - View institute leaderboard
//   - Get own institute membership context

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { instituteService } from '@kd/db';

// ─── Schemas ──────────────────────────────────────────────────────

const JoinInstituteSchema = z.object({
  code: z.string().min(4).max(10).toUpperCase(),
});

const LeaderboardQuerySchema = z.object({
  type: z.enum(['global', 'weekly']).default('global'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// ─── Routes ───────────────────────────────────────────────────────

export async function instituteStudentRoutes(fastify: FastifyInstance): Promise<void> {

  // ── GET /institute/me — Get user's institute memberships ──────
  fastify.get(
    '/institute/me',
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.user) return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED' }, timestamp: new Date().toISOString() });

      const memberships = await instituteService.getMemberships(request.user.id);

      return reply.send({
        success: true,
        data: memberships,
        timestamp: new Date().toISOString(),
      });
    },
  );

  // ── POST /institute/join — Join an institute via code ─────────
  fastify.post<{ Body: unknown }>(
    '/institute/join',
    async (request: FastifyRequest<{ Body: unknown }>, reply: FastifyReply) => {
      if (!request.user) return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED' }, timestamp: new Date().toISOString() });

      const body = JoinInstituteSchema.parse(request.body);

      // Resolve PostgreSQL user ID from firebase UID
      const { getPostgresPool } = await import('@kd/db');
      const pgRes = await getPostgresPool().query(
        'SELECT id FROM users WHERE firebase_uid = $1 LIMIT 1',
        [request.user.id],
      );
      if (pgRes.rows.length === 0) {
        return reply.status(401).send({
          success: false,
          error: { code: 'USER_NOT_SYNCED', message: 'User profile not synchronized' },
          timestamp: new Date().toISOString(),
        });
      }
      const pgUserId = pgRes.rows[0]['id'] as string;

      try {
        const { member, instituteName } = await instituteService.joinViaCode(
          body.code,
          pgUserId,
          request.user.id,
        );
        return reply.status(201).send({
          success: true,
          data: { member, instituteName },
          timestamp: new Date().toISOString(),
        });
      } catch (err: unknown) {
        const error = err as { message?: string; statusCode?: number };
        const knownErrors: Record<string, { status: number; message: string }> = {
          INVALID_JOIN_CODE:        { status: 400, message: 'Invalid or expired join code' },
          INSTITUTE_INACTIVE:       { status: 403, message: 'This institute is not currently active' },
          ALREADY_A_MEMBER:         { status: 409, message: 'You are already a member of this institute' },
          NO_INSTITUTE_SUBSCRIPTION:{ status: 402, message: 'Institute subscription has expired' },
          NO_SEATS_AVAILABLE:       { status: 402, message: 'No seats available in institute subscription' },
        };
        const known = knownErrors[error.message ?? ''];
        if (known) {
          return reply.status(known.status).send({
            success: false,
            error: { code: error.message, message: known.message },
            timestamp: new Date().toISOString(),
          });
        }
        throw err;
      }
    },
  );

  // ── GET /institute/:instituteId/leaderboard — Institute leaderboard (student view) ──
  fastify.get<{ Params: { instituteId: string }; Querystring: unknown }>(
    '/institute/:instituteId/leaderboard',
    async (request: FastifyRequest<{ Params: { instituteId: string } }>, reply: FastifyReply) => {
      if (!request.user) return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED' }, timestamp: new Date().toISOString() });

      const { instituteId } = request.params;
      const query = LeaderboardQuerySchema.parse(request.query);

      // Verify student is a member of this institute
      const { getPostgresPool } = await import('@kd/db');
      const pg = getPostgresPool();
      const memberCheck = await pg.query(
        `SELECT 1 FROM institute_members
         WHERE institute_id = $1 AND firebase_uid = $2 AND is_active = TRUE`,
        [instituteId, request.user.id],
      );
      if (memberCheck.rows.length === 0) {
        return reply.status(403).send({
          success: false,
          error: { code: 'NOT_A_MEMBER', message: 'You are not a member of this institute' },
          timestamp: new Date().toISOString(),
        });
      }

      const leaderboard = await instituteService.getInstituteLeaderboard(
        instituteId,
        request.user.id,
        query.type,
        query.limit,
      );

      return reply.send({
        success: true,
        data: leaderboard,
        timestamp: new Date().toISOString(),
      });
    },
  );
}
