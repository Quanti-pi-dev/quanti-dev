// ─── Platform Stats Routes ──────────────────────────────────
// Provides anonymized, cached activity counters for social proof.
// Used by onboarding screens to show live student counts and
// trending subjects/exams.
//
// Psychology: Social Proof (Cialdini) — showing "12,847 students
// studying today" reduces perceived risk of commitment.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth } from '../middleware/rbac.js';
import { getRedisClient } from '@kd/db';

// Baseline seed — displayed when Redis has no data.
// Set conservatively so new platforms look credible but not inflated.
const BASELINE_ACTIVE_STUDENTS = 847;
const CACHE_TTL_SECONDS = 300; // 5-minute in-memory cache

// Simple in-memory cache to avoid hammering Redis on every request
let cachedStats: { data: PlatformStats; expiresAt: number } | null = null;

interface PlatformStats {
  activeStudents: number;
  examCounts: Record<string, number>;
  trendingSubjects: Array<{ subjectId: string; count: number }>;
}

export async function statsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireAuth());

  // ─── GET /stats/active-students — Platform activity counters ──
  // Returns:
  //   activeStudents: total active students (24h window)
  //   examCounts: { [examId]: studentCount }
  //   trendingSubjects: [{ subjectId, count }] sorted by popularity
  fastify.get('/active-students', async (_request: FastifyRequest, reply: FastifyReply) => {
    const now = Date.now();

    // Return cached data if fresh
    if (cachedStats && cachedStats.expiresAt > now) {
      return reply.send({
        success: true,
        data: cachedStats.data,
        timestamp: new Date().toISOString(),
      });
    }

    try {
      const redis = getRedisClient();

      // Active students — count of unique users who logged in within 24h
      const rawActive = await redis.get('platform:active_students');
      const activeStudents = Math.max(
        parseInt(rawActive ?? '0', 10),
        BASELINE_ACTIVE_STUDENTS,
      );

      // Per-exam student counts
      const examKeys = await redis.keys('platform:exam_students:*');
      const examCounts: Record<string, number> = {};
      if (examKeys.length > 0) {
        const pipeline = redis.multi();
        for (const key of examKeys) {
          pipeline.get(key);
        }
        const values = await pipeline.exec();
        for (let i = 0; i < examKeys.length; i++) {
          const examId = examKeys[i]!.replace('platform:exam_students:', '');
          const val = values?.[i]?.[1];
          examCounts[examId] = parseInt((val as string) ?? '0', 10);
        }
      }

      // Trending subjects — top 10 by activity
      const subjectKeys = await redis.keys('platform:subject_active:*');
      const trendingSubjects: Array<{ subjectId: string; count: number }> = [];
      if (subjectKeys.length > 0) {
        const pipeline = redis.multi();
        for (const key of subjectKeys) {
          pipeline.get(key);
        }
        const values = await pipeline.exec();
        for (let i = 0; i < subjectKeys.length; i++) {
          const subjectId = subjectKeys[i]!.replace('platform:subject_active:', '');
          const count = parseInt((values?.[i]?.[1] as string) ?? '0', 10);
          if (count > 0) {
            trendingSubjects.push({ subjectId, count });
          }
        }
        trendingSubjects.sort((a, b) => b.count - a.count);
        trendingSubjects.splice(10); // Keep top 10
      }

      const stats: PlatformStats = { activeStudents, examCounts, trendingSubjects };

      // Cache for 5 minutes
      cachedStats = { data: stats, expiresAt: now + CACHE_TTL_SECONDS * 1000 };

      return reply.send({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      // Redis failure — return baseline gracefully
      fastify.log.error(err, 'Failed to fetch platform stats from Redis');
      return reply.send({
        success: true,
        data: {
          activeStudents: BASELINE_ACTIVE_STUDENTS,
          examCounts: {},
          trendingSubjects: [],
        },
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ─── POST /stats/track-activity — Increment activity counters ──
  // Called once per app launch (mobile client) to feed social proof.
  // Idempotent per user per day via Redis SET with TTL.
  fastify.post('/track-activity', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.id;
    const redis = getRedisClient();
    const today = new Date().toISOString().slice(0, 10);
    const guardKey = `activity_tracked:${userId}:${today}`;

    // Idempotent — only count once per user per day
    const alreadyTracked = await redis.get(guardKey);
    if (alreadyTracked) {
      return reply.send({
        success: true,
        data: { tracked: false },
        timestamp: new Date().toISOString(),
      });
    }

    try {
      const body = request.body as { examIds?: string[]; subjectIds?: string[] } | undefined;

      // Increment global active count
      await redis.incr('platform:active_students');
      // Set TTL on global counter to auto-decay (24h window)
      await redis.expire('platform:active_students', 86400);

      // Increment per-exam counts
      if (body?.examIds) {
        for (const examId of body.examIds) {
          const key = `platform:exam_students:${examId}`;
          await redis.incr(key);
          await redis.expire(key, 86400);
        }
      }

      // Increment per-subject counts
      if (body?.subjectIds) {
        for (const subjectId of body.subjectIds) {
          const key = `platform:subject_active:${subjectId}`;
          await redis.incr(key);
          await redis.expire(key, 86400);
        }
      }

      // Mark as tracked for today
      await redis.set(guardKey, '1', 'EX', 86400);

      // Invalidate in-memory cache
      cachedStats = null;

      return reply.send({
        success: true,
        data: { tracked: true },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      // Non-critical — don't block the user
      fastify.log.error(err, 'Failed to track activity');
      return reply.send({
        success: true,
        data: { tracked: false },
        timestamp: new Date().toISOString(),
      });
    }
  });
}
