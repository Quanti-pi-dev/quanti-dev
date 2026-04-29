// ─── Progress Service Routes ────────────────────────────────
// Track learning progress, streaks, session history.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/rbac.js';
import { loadSubscription } from '../middleware/feature-gate.js';
import { progressRepository } from '../repositories/progress.repository.js';
import { flashcardRepository } from '../repositories/content.repository.js';
import { rewardService } from '../services/reward.service.js';
import { getRedisClient, getPostgresPool } from '../lib/database.js';
import { SUBJECT_LEVELS } from '@kd/shared';

// ─── Validation Schemas ─────────────────────────────────────

const recordCompletionSchema = z.object({
  deckId: z.string().min(1),
  cardId: z.string().min(1),
  correct: z.boolean(),
  responseTimeMs: z.number().int().nonnegative(),
});

const saveSessionSchema = z.object({
  deckId: z.string().min(1),
  cardsStudied: z.number().int().nonnegative(),
  correctAnswers: z.number().int().nonnegative(),
  incorrectAnswers: z.number().int().nonnegative(),
  averageResponseTimeMs: z.number().int().nonnegative(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  isComplete: z.boolean().optional().default(false),
});

const levelAnswerSchema = z.object({
  examId: z.string().min(1),
  subjectId: z.string().min(1),
  topicSlug: z.string().min(1),
  level: z.enum(SUBJECT_LEVELS as [string, ...string[]]),
  cardId: z.string().min(1),
  selectedAnswerId: z.string().min(1),
  responseTimeMs: z.number().int().nonnegative(),
});

export async function progressRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireAuth());
  fastify.addHook('preHandler', loadSubscription);

  // ─── GET /progress/decks/:id — Deck-level progress ───
  fastify.get('/decks/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: deckId } = request.params as { id: string };
    const progress = await progressRepository.getProgress(request.user!.id, deckId);
    return reply.send({
      success: true,
      data: progress,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── POST /progress/record — Record card completion ───
  fastify.post('/record', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = recordCompletionSchema.parse(request.body);
    try {
      const progress = await progressRepository.recordCompletion(
        request.user!.id,
        input.deckId,
        input.cardId,
        input.correct,
        input.responseTimeMs,
      );
      return reply.send({
        success: true,
        data: progress,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to record progress';
      return reply.status(500).send({
        success: false,
        error: { code: 'PROGRESS_FAILED', message },
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ─── GET /progress/summary — Overall progress ────────
  fastify.get('/summary', async (request: FastifyRequest, reply: FastifyReply) => {
    const summary = await progressRepository.getSummary(request.user!.id);
    return reply.send({
      success: true,
      data: summary,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── GET /progress/streak — Current study streak ─────
  fastify.get('/streak', async (request: FastifyRequest, reply: FastifyReply) => {
    const streak = await progressRepository.getStreak(request.user!.id);
    return reply.send({
      success: true,
      data: streak,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── GET /progress/history — Session history ─────────
  fastify.get('/history', async (request: FastifyRequest, reply: FastifyReply) => {
    const { page, pageSize } = request.query as { page?: string; pageSize?: string };
    const parsedPage = parseInt(page ?? '1', 10);
    const parsedPageSize = parseInt(pageSize ?? '20', 10);
    const safePage = Number.isNaN(parsedPage) ? 1 : Math.max(parsedPage, 1);
    const safePageSize = Number.isNaN(parsedPageSize) ? 20 : Math.min(Math.max(parsedPageSize, 1), 100);
    const result = await progressRepository.getHistory(
      request.user!.id,
      safePage,
      safePageSize,
    );
    return reply.send({
      success: true,
      data: result.data,
      pagination: result.pagination,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── POST /progress/session — Save completed session ─
  fastify.post('/session', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = saveSessionSchema.parse(request.body);
    const userId = request.user!.id;

    await progressRepository.saveSession({ ...input, userId });

    // Award perfect session bonus if 100% accuracy AND completed
    if (input.isComplete && input.cardsStudied >= 3 && input.correctAnswers === input.cardsStudied) {
      await rewardService.awardForPerfectSession(userId, input.startedAt).catch(() => {});
    }

    return reply.status(201).send({
      success: true,
      data: { message: 'Session saved' },
      timestamp: new Date().toISOString(),
    });
  });

  // ─── POST /progress/level-answer ─────────────────────
  // Records one answer for a (subject, exam, level). Returns level progress
  // and a justUnlocked flag the client uses to trigger unlock celebrations.
  // Also fires reward.service for all coin earning events.
  fastify.post('/level-answer', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = levelAnswerSchema.parse(request.body);
    const userId = request.user!.id;

    // H1 fix: Server-side answer verification — look up the card and check
    const card = await flashcardRepository.findById(input.cardId);
    if (!card) {
      return reply.status(404).send({
        success: false,
        error: { code: 'CARD_NOT_FOUND', message: 'Flashcard not found' },
        timestamp: new Date().toISOString(),
      });
    }
    const correct = card.correctAnswerId === input.selectedAnswerId;

    // Tier-gate: check if user's plan allows access to this level
    const maxLevel = request.subscription?.features.max_level;
    if (maxLevel !== undefined && maxLevel !== -1) {
      const levelIndex = SUBJECT_LEVELS.indexOf(input.level as typeof SUBJECT_LEVELS[number]);
      if (levelIndex >= maxLevel) {
        return reply.status(403).send({
          success: false,
          error: { code: 'TIER_LOCKED', message: 'Upgrade your plan to access this level' },
          timestamp: new Date().toISOString(),
        });
      }
    }

    try {
      const result = await progressRepository.recordLevelAnswer(
        userId,
        input.examId,
        input.subjectId,
        input.level as typeof SUBJECT_LEVELS[number],
        correct,
        input.topicSlug,
      );

      // ── Await rewards so we can surface earnings in the response ──
      let coinsEarned = 0;
      try {
        // 1. Correct answer — first-time only per card
        if (correct) {
          const r = await rewardService.awardForCorrectAnswer(
            userId, input.cardId, input.examId, input.subjectId, input.level, input.topicSlug,
          );
          coinsEarned += r?.coinsAwarded ?? 0;
        }

        // 2. Level unlocked for the first time
        if (result.justUnlocked && result.newlyUnlockedLevel) {
          const r = await rewardService.awardForLevelUnlock(userId, result.newlyUnlockedLevel);
          coinsEarned += r.coinsAwarded;
        }

        // 3. Master level completed
        if (
          input.level === 'Master' &&
          result.levelProgress.isCompleted &&
          !result.justUnlocked
        ) {
          const r = await rewardService.awardForMasterCompletion(userId, input.subjectId);
          if (r) coinsEarned += r.coinsAwarded;
        }

        // 4. Streak milestone (fire async — streak update is cheap but not critical path)
        void progressRepository.updateStreak(userId).then(async (streak) => {
          // Award streak milestone coins
          await rewardService.awardForStreakMilestone(userId, streak.currentStreak);
          // Grant trial pass on 7-day streak (for free users only)
          if (streak.currentStreak >= 7) {
            const { trialPassService } = await import('../services/trialpass.service.js');
            await trialPassService.grantIfEligible(userId).catch(() => {});
          }
        }).catch(() => {});
      } catch (rewardErr) {
        request.log.error({ rewardErr }, 'reward side-effect failed');
      }

      return reply.send({
        success: true,
        data: { ...result, coinsEarned },
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.startsWith('LEVEL_LOCKED')) {
        return reply.status(403).send({
          success: false,
          error: { code: 'LEVEL_LOCKED', message: 'This level is not yet unlocked' },
          timestamp: new Date().toISOString(),
        });
      }
      throw err;
    }
  });

  // ─── GET /progress/exams/:examId/subjects/:subjectId/topics/:topicSlug/levels ───
  fastify.get(
    '/exams/:examId/subjects/:subjectId/topics/:topicSlug/levels',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { examId, subjectId, topicSlug } = request.params as {
        examId: string; subjectId: string; topicSlug: string;
      };
      const summary = await progressRepository.getSubjectLevelSummary(
        request.user!.id,
        examId,
        subjectId,
        topicSlug,
      );
      return reply.send({
        success: true,
        data: summary,
        timestamp: new Date().toISOString(),
      });
    },
  );

  // ─── GET /progress/exams/:examId ───────────────────────
  // Returns highest unlocked level per subject. Requires subjectIds query param.
  fastify.get('/exams/:examId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { examId } = request.params as { examId: string };
    const queryRaw = (request.query as Record<string, string | string[]>)['subjectIds'];
    const subjectIds: string[] = Array.isArray(queryRaw)
      ? queryRaw
      : queryRaw
        ? queryRaw.split(',')
        : [];

    if (subjectIds.length === 0) {
      return reply.status(400).send({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'subjectIds query parameter is required' },
        timestamp: new Date().toISOString(),
      });
    }

    const progress = await progressRepository.getExamProgress(request.user!.id, examId, subjectIds);
    return reply.send({
      success: true,
      data: progress,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── GET /progress/sessions-today ───────────────────────────
  // Returns the number of study sessions started today for this user.
  // Used by the mobile app as the authoritative source of truth for
  // the daily exam limit gate (supplements client-side AsyncStorage cache).
  fastify.get('/sessions-today', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.id;
    const pg = getPostgresPool();
    const result = await pg.query(
      `SELECT COUNT(*) as count FROM study_sessions
       WHERE user_id = (SELECT id FROM users WHERE firebase_uid = $1)
         AND started_at >= CURRENT_DATE`,
      [userId],
    );
    const count = parseInt(result.rows[0]?.count ?? '0', 10);
    return reply.send({ success: true, data: { count }, timestamp: new Date().toISOString() });
  });

  // ─── GET /progress/level-progress-summary ──────────────────
  // Uses the O(1) tracking SET `level_progress_keys:{userId}` instead of
  // scanning the entire Redis keyspace. Returns the highest reached level
  // per (examId, subjectId), enriched with names from PostgreSQL.
  fastify.get('/level-progress-summary', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.id;
    const redis = getRedisClient();
    const pg = getPostgresPool();

    // O(1) lookup: read the tracking SET that recordLevelAnswer() maintains
    // Each member has the format: "examId:subjectId:topicSlug:level"
    const trackedMembers = await redis.smembers(`level_progress_keys:${userId}`);

    if (trackedMembers.length === 0) {
      return reply.send({ success: true, data: [], timestamp: new Date().toISOString() });
    }

    // Parse members and pipeline HGETALL calls for each discovered key
    type ParsedEntry = { examId: string; subjectId: string; topicSlug: string; level: string; levelIndex: number };
    const parsed: ParsedEntry[] = [];

    for (const member of trackedMembers) {
      const segments = member.split(':');
      if (segments.length !== 4) continue;
      const [examId, subjectId, topicSlug, level] = segments as [string, string, string, string];
      const levelIndex = SUBJECT_LEVELS.indexOf(level as typeof SUBJECT_LEVELS[number]);
      if (levelIndex === -1) continue;
      parsed.push({ examId, subjectId, topicSlug, level, levelIndex });
    }

    if (parsed.length === 0) {
      return reply.send({ success: true, data: [], timestamp: new Date().toISOString() });
    }

    // Pipeline all HGETALL calls — one round-trip to Redis
    const pipeline = redis.pipeline();
    for (const entry of parsed) {
      pipeline.hgetall(`level_progress:${userId}:${entry.examId}:${entry.subjectId}:${entry.topicSlug}:${entry.level}`);
    }
    const pipelineResults = await pipeline.exec();

    // Aggregate: highest level per (examId, subjectId)
    const entries = new Map<string, { examId: string; subjectId: string; levelIndex: number; level: string; correctAnswers: number }>();

    for (let i = 0; i < parsed.length; i++) {
      const entry = parsed[i]!;
      const [err, rawData] = pipelineResults?.[i] ?? [null, {}];
      const data = (!err && rawData ? rawData : {}) as Record<string, string>;
      const correct = parseInt(data['correct'] ?? '0', 10);

      const mapKey = `${entry.examId}:${entry.subjectId}`;
      const existing = entries.get(mapKey);
      if (!existing || entry.levelIndex > existing.levelIndex) {
        entries.set(mapKey, {
          examId: entry.examId,
          subjectId: entry.subjectId,
          levelIndex: entry.levelIndex,
          level: entry.level,
          correctAnswers: correct,
        });
      }
    }

    if (entries.size === 0) {
      return reply.send({ success: true, data: [], timestamp: new Date().toISOString() });
    }

    // Enrich with subject + exam names from PostgreSQL
    const subjectIds = [...new Set([...entries.values()].map((e) => e.subjectId))];
    const examIds = [...new Set([...entries.values()].map((e) => e.examId))];

    const [subjectRows, examRows] = await Promise.all([
      pg.query(
        `SELECT id, name FROM subjects WHERE id = ANY($1)`,
        [subjectIds],
      ),
      pg.query(
        `SELECT id, title FROM exams WHERE id = ANY($1)`,
        [examIds],
      ),
    ]);

    const subjectMap = new Map<string, string>(
      subjectRows.rows.map((r: { id: string; name: string }) => [r.id, r.name]),
    );
    const examMap = new Map<string, string>(
      examRows.rows.map((r: { id: string; title: string }) => [r.id, r.title]),
    );

    const data = [...entries.values()].map((e) => ({
      examId: e.examId,
      examName: examMap.get(e.examId) ?? e.examId,
      subjectId: e.subjectId,
      subjectName: subjectMap.get(e.subjectId) ?? e.subjectId,
      highestLevel: e.level,
      levelIndex: e.levelIndex,   // 0=Beginner … 5=Master
      correctAnswers: e.correctAnswers,
    }));

    return reply.send({ success: true, data, timestamp: new Date().toISOString() });
  });

  // ─── GET /progress/advanced-insights ──────────────────────────
  // Returns chronotype, speed-vs-accuracy scatter, and subject strength data.
  // Available to all paid tiers; the mobile app controls which sections render
  // based on deep_insights / mastery_radar feature flags.
  fastify.get('/advanced-insights', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.id;
    const insights = await progressRepository.getAdvancedInsights(userId);
    return reply.send({ success: true, data: insights, timestamp: new Date().toISOString() });
  });
}
