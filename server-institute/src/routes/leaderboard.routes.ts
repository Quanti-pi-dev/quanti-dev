// ─── Institute Leaderboard Routes ─────────────────────────────────
// Institute-scoped leaderboard endpoints.
// Accessible by all institute roles (students use server-user mirror endpoint).

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { instituteService } from '@kd/db';
import { requireInstituteRole } from '../middleware/auth.js';

const LeaderboardQuerySchema = z.object({
  type: z.enum(['global', 'weekly']).default('global'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export async function instituteLeaderboardRoutes(fastify: FastifyInstance): Promise<void> {

  // GET /institutes/:instituteId/leaderboard
  fastify.get<{ Params: { instituteId: string }; Querystring: unknown }>(
    '/institutes/:instituteId/leaderboard',
    { preHandler: [requireInstituteRole('institute_admin', 'educator', 'examiner')] },
    async (request: FastifyRequest<{ Params: { instituteId: string } }>, reply: FastifyReply) => {
      const { instituteId } = request.params;
      const query = LeaderboardQuerySchema.parse(request.query);

      const leaderboard = await instituteService.getInstituteLeaderboard(
        instituteId,
        request.user!.id,
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
