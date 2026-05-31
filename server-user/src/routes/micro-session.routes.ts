// ─── Micro Session Routes ───────────────────────────────────
// "Just 3 Cards" mode — the lowest-friction path back into studying.
//
// Psychology: Zeigarnik Effect — starting a tiny task creates an
// open loop that the brain wants to close. By reducing perceived
// effort to "just 3 cards," we bypass user resistance to starting.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/rbac.js';
import { microSessionService } from '@kd/db';

const microSessionQuerySchema = z.object({
  examId: z.string().optional(),
});

export async function microSessionRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireAuth());

  // ─── GET /micro-session — Build a "Just 3 Cards" pack ─────
  // Returns a curated 3-card study session optimized for maximum
  // learning impact per unit effort.
  //
  // Card selection priority:
  //   1. Overdue SM-2 cards (knowledge decay prevention)
  //   2. Near-miss level-unlock cards (endowed progress)
  //   3. Previously wrong cards from error journal
  //   4. Random cards from current active topics
  //
  // Used by: Push notification deep-links, home screen CTA,
  //          comeback nudges, streak-at-risk recovery.
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { examId } = microSessionQuerySchema.parse(request.query);
    const userId = request.user!.id;

    const pack = await microSessionService.buildMicroSession(userId, examId);

    return reply.send({
      success: true,
      data: pack,
      timestamp: new Date().toISOString(),
    });
  });
}
