// ─── Feed Routes ────────────────────────────────────────────
// Social activity feed API — surfaces friend achievements to
// create FOMO and competitive study motivation.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/rbac.js';
import { feedService } from '@kd/db';

const feedQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).default(20),
  before: z.coerce.number().int().positive().optional(),
});

export async function feedRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireAuth());

  // ─── GET /feed — Friend activity feed ─────────────────────
  // Returns a reverse-chronological list of friend milestones.
  // Supports cursor-based pagination via `before` timestamp.
  //
  // Psychology: Social Comparison Theory — seeing peers succeed
  // creates both motivation and FOMO, driving users to study more.
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { limit, before } = feedQuerySchema.parse(request.query);
    const userId = request.user!.id;

    const result = await feedService.getFriendFeed(userId, limit, before);

    return reply.send({
      success: true,
      data: {
        events: result.events,
        nextCursor: result.nextCursor,
        hasMore: result.nextCursor !== null,
      },
      timestamp: new Date().toISOString(),
    });
  });
}
