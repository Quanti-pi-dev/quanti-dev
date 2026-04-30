// ─── Admin Analytics Routes ─────────────────────────────────
// Platform analytics dashboard + asset upload endpoints.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getPostgresPool } from '../lib/database.js';

// ─── Routes ─────────────────────────────────────────────────

export async function adminAnalyticsRoutes(fastify: FastifyInstance): Promise<void> {

  // ═══════════════════════════════════════════════════════
  // PLATFORM ANALYTICS
  // ═══════════════════════════════════════════════════════

  // GET /admin/analytics — Real platform stats from PostgreSQL and Redis.
  fastify.get('/analytics', async (_request: FastifyRequest, reply: FastifyReply) => {
    const pg = getPostgresPool();

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const [
      usersRow,
      activeTodayRow,
      sessionsRow,
      coinsRow,
      shopRow,
    ] = await Promise.all([
      pg.query(`SELECT COUNT(*) AS total FROM users`),
      pg.query(`SELECT COUNT(DISTINCT user_id) AS active FROM study_sessions WHERE started_at::date = $1::date`, [today]),
      pg.query(`
        SELECT
          COUNT(*)                                                            AS total_sessions,
          COALESCE(SUM(cards_studied), 0)                                    AS total_cards,
          COALESCE(SUM(correct_answers)::float
            / NULLIF(SUM(correct_answers + incorrect_answers), 0) * 100, 0)  AS avg_accuracy
        FROM study_sessions
      `),
      // M4 fix: Use amount sign convention
      pg.query(`
        SELECT
          COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS total_earned,
          COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) AS total_spent
        FROM coin_transactions
      `),
      pg.query(`
        SELECT
          (SELECT COUNT(*) FROM shop_items WHERE is_available = true)        AS active_items,
          (SELECT COUNT(*) FROM user_unlocked_decks)                          AS pack_purchases,
          (SELECT COUNT(*) FROM coin_transactions WHERE amount < 0
           AND reason LIKE 'buy_%theme%')                                     AS theme_purchases
      `),
    ]);

    const totalEarned = parseInt(coinsRow.rows[0]?.total_earned ?? '0', 10);
    const totalSpent = parseInt(coinsRow.rows[0]?.total_spent ?? '0', 10);

    return reply.send({
      success: true,
      data: {
        totalUsers: parseInt(usersRow.rows[0]?.total ?? '0', 10),
        activeUsersToday: parseInt(activeTodayRow.rows[0]?.active ?? '0', 10),
        totalSessions: parseInt(sessionsRow.rows[0]?.total_sessions ?? '0', 10),
        totalCardsAnswered: parseInt(sessionsRow.rows[0]?.total_cards ?? '0', 10),
        avgAccuracyPct: Math.round(parseFloat(sessionsRow.rows[0]?.avg_accuracy ?? '0')),
        totalCoinsEarned: totalEarned,
        totalCoinsSpent: totalSpent,
        totalCoinsInCirculation: totalEarned - totalSpent,
        shopItemCount: parseInt(shopRow.rows[0]?.active_items ?? '0', 10),
        purchasedPackCount: parseInt(shopRow.rows[0]?.pack_purchases ?? '0', 10),
        purchasedThemeCount: parseInt(shopRow.rows[0]?.theme_purchases ?? '0', 10),
      },
      timestamp: new Date().toISOString(),
    });
  });

  // ═══════════════════════════════════════════════════════
  // ADMIN ASSET UPLOADS
  // ═══════════════════════════════════════════════════════

  const presignSchema = z.object({
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  });

  // POST /admin/upload/presign — Generate R2 presigned URL
  fastify.post('/upload/presign', async (request: FastifyRequest, reply: FastifyReply) => {
    const { mimeType } = presignSchema.parse(request.body);
    const { generateAdminPresignedUrl } = await import('../lib/storage.js');

    try {
      const result = await generateAdminPresignedUrl(request.user!.id, mimeType);
      return reply.send({
        success: true,
        data: { uploadUrl: result.uploadUrl, cdnUrl: result.cdnUrl },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      request.log.error({ err }, 'Failed to generate admin presigned URL');
      return reply.status(500).send({
        success: false,
        error: { code: 'PRESIGN_FAILED', message: 'Could not generate upload URL' },
        timestamp: new Date().toISOString(),
      });
    }
  });
}
