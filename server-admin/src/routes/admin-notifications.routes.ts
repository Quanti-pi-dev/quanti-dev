// ─── Admin Notifications Routes ──────────────────────────────
// Endpoints:
//   POST /api/admin/notifications/broadcast  — send push to a user segment
//   GET  /api/admin/notifications/stats      — FCM token coverage stats

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireRole } from '../middleware/rbac.js';
import {
  notificationService,
  getRedisClient,
  getPostgresPool,
  userRepository,
  createServiceLogger,
} from '@kd/db';

const log = createServiceLogger('AdminNotificationRoutes');

// ─── Schemas ─────────────────────────────────────────────────

const broadcastSchema = z.object({
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(300),
  data: z.record(z.string()).optional(),
  // Targeting
  segment: z.enum(['all', 'free', 'paid', 'trial']).default('all'),
  // Optional: send to a specific user by email (manual override)
  targetEmail: z.string().email().optional(),
});

// ─── Routes ──────────────────────────────────────────────────

export async function adminNotificationRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireRole('admin'));

  // ── POST /notifications/broadcast ────────────────────────
  // Sends a custom push notification to a user segment.
  // Segment 'all': every user with a registered FCM token.
  // Segment 'paid': users with planTier > 0.
  // Segment 'free': users with planTier = 0.
  // Segment 'trial': users currently in trial.
  // targetEmail: single-user override (ignores segment).
  fastify.post('/notifications/broadcast', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = broadcastSchema.parse(request.body);
    const redis = getRedisClient();

    let sentCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    try {
      if (input.targetEmail) {
        // ── Single-user send ─────────────────────────────
        const user = await userRepository.searchByEmail(input.targetEmail, 1);
        if (!user.length) {
          return reply.status(404).send({
            success: false,
            error: { code: 'USER_NOT_FOUND', message: `No user found with email: ${input.targetEmail}` },
            timestamp: new Date().toISOString(),
          });
        }
        const target = user[0]!;
        const fcmToken = await redis.get(`fcm_token:${target.id}`);
        if (!fcmToken) {
          return reply.status(422).send({
            success: false,
            error: { code: 'NO_FCM_TOKEN', message: 'Target user has no registered device token.' },
            timestamp: new Date().toISOString(),
          });
        }

        // Use the low-level sendPush via a synthetic event (simplest integration point)
        await notificationService.sendDirectPush({
          userId: target.id,
          title: input.title,
          body: input.body,
          data: input.data,
        });
        sentCount = 1;

      } else {
        // ── Segment broadcast ────────────────────────────
        // Scan fcm_token:* keys from Redis to get all registered users
        const tokenKeys: string[] = [];
        let cursor = '0';
        do {
          const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'fcm_token:*', 'COUNT', 200);
          cursor = nextCursor;
          tokenKeys.push(...keys);
        } while (cursor !== '0');

        if (tokenKeys.length === 0) {
          return reply.send({
            success: true,
            data: { sent: 0, failed: 0, message: 'No registered FCM tokens found.' },
            timestamp: new Date().toISOString(),
          });
        }

        // Extract user IDs from key pattern fcm_token:<userId>
        const userIds = tokenKeys.map(k => k.replace('fcm_token:', ''));

        // Segment filter — for non-all segments, query PG for matching user IDs
        const filteredIds: string[] = [];
        if (input.segment === 'all') {
          filteredIds.push(...userIds);
        } else {
          // Join users to active subscriptions to determine plan tier
          // Tier 0 = free, Tier > 0 = paid, trial = has active trial
          const pg = getPostgresPool();
          const chunkSize = 200;
          for (let i = 0; i < userIds.length; i += chunkSize) {
            const chunk = userIds.slice(i, i + chunkSize);
            const placeholders = chunk.map((_, j) => `$${j + 1}`).join(',');
            let query: string;
            if (input.segment === 'free') {
              // Users with no active paid subscription
              query = `
                SELECT u.id FROM users u
                WHERE u.id = ANY(ARRAY[${placeholders}]::uuid[])
                  AND NOT EXISTS (
                    SELECT 1 FROM subscriptions s
                    JOIN plans p ON s.plan_id = p.id
                    WHERE s.user_id = u.id AND s.status IN ('active','trialing') AND p.tier > 0
                  )
              `;
            } else if (input.segment === 'paid') {
              query = `
                SELECT DISTINCT u.id FROM users u
                JOIN subscriptions s ON s.user_id = u.id
                JOIN plans p ON s.plan_id = p.id
                WHERE u.id = ANY(ARRAY[${placeholders}]::uuid[])
                  AND s.status = 'active' AND p.tier > 0
              `;
            } else {
              // trial
              query = `
                SELECT DISTINCT u.id FROM users u
                JOIN subscriptions s ON s.user_id = u.id
                WHERE u.id = ANY(ARRAY[${placeholders}]::uuid[])
                  AND s.status = 'trialing'
              `;
            }
            const result = await pg.query<{ id: string }>(query, chunk);
            filteredIds.push(...result.rows.map(r => r.id));
          }
        }

        log.info({ segment: input.segment, total: filteredIds.length }, 'Starting broadcast');

        // Send in parallel batches of 50
        const batchSize = 50;
        for (let i = 0; i < filteredIds.length; i += batchSize) {
          const batch = filteredIds.slice(i, i + batchSize);
          const results = await Promise.allSettled(
            batch.map(userId =>
              notificationService.sendDirectPush({
                userId,
                title: input.title,
                body: input.body,
                data: input.data,
              }),
            ),
          );
          for (const r of results) {
            if (r.status === 'fulfilled') sentCount++;
            else { failCount++; errors.push(r.reason as string); }
          }
        }
      }

      log.info({ sentCount, failCount, segment: input.segment }, 'Broadcast complete');

      return reply.send({
        success: true,
        data: {
          sent: sentCount,
          failed: failCount,
          segment: input.targetEmail ? 'single' : input.segment,
          ...(errors.length > 0 && { errors: errors.slice(0, 10) }),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      log.error({ err }, 'Broadcast failed');
      return reply.status(500).send({
        success: false,
        error: { code: 'BROADCAST_FAILED', message: 'Notification broadcast failed.' },
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ── GET /notifications/stats ──────────────────────────────
  // Returns FCM token coverage: total registered devices.
  fastify.get('/notifications/stats', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const redis = getRedisClient();
      // Count fcm_token:* keys (approximate — uses SCAN, not DBSIZE)
      let tokenCount = 0;
      let cursor = '0';
      do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'fcm_token:*', 'COUNT', 500);
        cursor = nextCursor;
        tokenCount += keys.length;
      } while (cursor !== '0');

      return reply.send({
        success: true,
        data: {
          registeredDevices: tokenCount,
          // Note: 1 user can have at most 1 token (latest device)
        },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      log.error({ err }, 'Failed to get notification stats');
      return reply.status(500).send({
        success: false,
        error: { code: 'STATS_FAILED', message: 'Failed to retrieve notification stats.' },
        timestamp: new Date().toISOString(),
      });
    }
  });
}
