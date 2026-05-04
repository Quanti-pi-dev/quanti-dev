// ─── Progress Service Routes ────────────────────────────────
// Track learning progress, streaks, session history.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/rbac.js';
import { loadSubscription } from '../middleware/feature-gate.js';
import { progressRepository } from '../repositories/progress.repository.js';
import { flashcardRepository } from '../repositories/content.repository.js';
import { rewardService } from '../services/reward.service.js';
import { updateCardMemory } from '../services/learning-intelligence.service.js';
import { updateKnowledgeModel } from '../services/card-selector.js';
import { getRedisClient, getPostgresPool, getMongoDb } from '../lib/database.js';
import { ObjectId } from 'mongodb';
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

      // ── SM-2 card memory tracking (fire-and-forget) ──────────
      void updateCardMemory(
        userId, input.cardId, correct, input.responseTimeMs,
        input.topicSlug, input.subjectId,
      ).catch((err) => request.log.error({ err }, 'SM-2 card memory update failed'));

      // ── BKT + IRT knowledge model update (fire-and-forget) ──
      void updateKnowledgeModel(
        userId, input.cardId, card.tags ?? [], correct,
      ).catch((err) => request.log.error({ err }, 'Knowledge model update failed'));

      // ── Error Journal: track wrong answers for review ──
      if (!correct) {
        const redis = getRedisClient();
        const errorKey = `error_journal:${userId}`;
        const member = JSON.stringify({
          cardId: input.cardId,
          examId: input.examId,
          subjectId: input.subjectId,
          topicSlug: input.topicSlug,
          level: input.level,
          selectedAnswerId: input.selectedAnswerId,
        });
        // Score = timestamp (ms) for chronological ordering
        void redis.zadd(errorKey, Date.now(), member)
          .catch((err) => request.log.error({ err }, 'Error journal write failed'));
        // Cap at 200 entries to prevent unbounded growth
        void redis.zremrangebyrank(errorKey, 0, -201)
          .catch(() => {});
      }

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

    // Aggregate: highest level + sum of ALL correct/total across levels per (examId, subjectId)
    const entries = new Map<string, { examId: string; subjectId: string; levelIndex: number; level: string; correctAnswers: number; totalAnswers: number }>();

    for (let i = 0; i < parsed.length; i++) {
      const entry = parsed[i]!;
      const [err, rawData] = pipelineResults?.[i] ?? [null, {}];
      const data = (!err && rawData ? rawData : {}) as Record<string, string>;
      const correct = parseInt(data['correct'] ?? '0', 10);
      const total = parseInt(data['total'] ?? '0', 10);

      const mapKey = `${entry.examId}:${entry.subjectId}`;
      const existing = entries.get(mapKey);
      if (!existing) {
        entries.set(mapKey, {
          examId: entry.examId,
          subjectId: entry.subjectId,
          levelIndex: entry.levelIndex,
          level: entry.level,
          correctAnswers: correct,
          totalAnswers: total,
        });
      } else {
        // Sum correct/total across all levels for this subject
        existing.correctAnswers += correct;
        existing.totalAnswers += total;
        // Track the highest level reached
        if (entry.levelIndex > existing.levelIndex) {
          existing.levelIndex = entry.levelIndex;
          existing.level = entry.level;
        }
      }
    }

    if (entries.size === 0) {
      return reply.send({ success: true, data: [], timestamp: new Date().toISOString() });
    }

    // Enrich with subject + exam names from PostgreSQL
    const subjectIds = [...new Set([...entries.values()].map((e) => e.subjectId))];
    const examIds = [...new Set([...entries.values()].map((e) => e.examId))];

    const mongo = getMongoDb();
    
    const validSubjectIds = subjectIds.filter(id => /^[0-9a-fA-F]{24}$/.test(id)).map(id => new ObjectId(id));
    const validExamIds = examIds.filter(id => /^[0-9a-fA-F]{24}$/.test(id)).map(id => new ObjectId(id));

    const [subjects, exams] = await Promise.all([
      validSubjectIds.length > 0
        ? mongo.collection('subjects').find({ _id: { $in: validSubjectIds } }).project({ name: 1 }).toArray()
        : Promise.resolve([]),
      validExamIds.length > 0
        ? mongo.collection('exams').find({ _id: { $in: validExamIds } }).project({ title: 1 }).toArray()
        : Promise.resolve([]),
    ]);

    const subjectMap = new Map<string, string>(
      subjects.map((s) => [s._id.toString(), s.name as string]),
    );
    const examMap = new Map<string, string>(
      exams.map((e) => [e._id.toString(), e.title as string]),
    );

    const data = [...entries.values()].map((e) => ({
      examId: e.examId,
      examName: examMap.get(e.examId) ?? e.examId,
      subjectId: e.subjectId,
      subjectName: subjectMap.get(e.subjectId) ?? e.subjectId,
      highestLevel: e.level,
      levelIndex: e.levelIndex,   // 0=Emerging … 3=Master
      correctAnswers: e.correctAnswers,  // total correct across ALL levels
      totalAnswers: e.totalAnswers,      // total attempts across ALL levels
    }));

    return reply.send({ success: true, data, timestamp: new Date().toISOString() });
  });

  // ─── GET /progress/error-journal ──────────────────────────────
  // Returns the student's wrong-answer journal, enriched with card
  // content from MongoDB. Most recent errors first. Capped at 50.
  fastify.get('/error-journal', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.id;
    const redis = getRedisClient();
    const mongo = getMongoDb();

    // Read the latest 50 entries (reverse chronological)
    const raw = await redis.zrevrange(`error_journal:${userId}`, 0, 49, 'WITHSCORES');

    if (!raw || raw.length === 0) {
      return reply.send({ success: true, data: [], timestamp: new Date().toISOString() });
    }

    // Parse pairs: [member, score, member, score, …]
    type JournalEntry = {
      cardId: string;
      examId: string;
      subjectId: string;
      topicSlug: string;
      level: string;
      selectedAnswerId: string;
      timestamp: number;
    };

    const entries: JournalEntry[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      try {
        const parsed = JSON.parse(raw[i]!) as Omit<JournalEntry, 'timestamp'>;
        entries.push({ ...parsed, timestamp: parseInt(raw[i + 1]!, 10) });
      } catch { /* skip malformed entries */ }
    }

    if (entries.length === 0) {
      return reply.send({ success: true, data: [], timestamp: new Date().toISOString() });
    }

    // Batch fetch card content from MongoDB
    const cardIds = [...new Set(entries.map(e => e.cardId))];
    const validCardIds = cardIds.filter(id => /^[0-9a-fA-F]{24}$/.test(id)).map(id => new ObjectId(id));

    const cards = validCardIds.length > 0
      ? await mongo.collection('flashcards')
          .find({ _id: { $in: validCardIds } })
          .project({ question: 1, answers: 1, correctAnswerId: 1, topicDisplayName: 1 })
          .toArray()
      : [];

    const cardMap = new Map(cards.map(c => [c._id.toString(), c]));

    // Also fetch subject names
    const subjectIds = [...new Set(entries.map(e => e.subjectId))];
    const validSubjectIds = subjectIds.filter(id => /^[0-9a-fA-F]{24}$/.test(id)).map(id => new ObjectId(id));
    const subjects = validSubjectIds.length > 0
      ? await mongo.collection('subjects').find({ _id: { $in: validSubjectIds } }).project({ name: 1 }).toArray()
      : [];
    const subjectMap = new Map(subjects.map(s => [s._id.toString(), s.name as string]));

    // Enrich
    const data = entries.map(entry => {
      const card = cardMap.get(entry.cardId);
      return {
        cardId: entry.cardId,
        examId: entry.examId,
        subjectId: entry.subjectId,
        subjectName: subjectMap.get(entry.subjectId) ?? entry.subjectId,
        topicSlug: entry.topicSlug,
        topicName: (card?.topicDisplayName as string) ?? entry.topicSlug,
        level: entry.level,
        question: (card?.question as string) ?? 'Question unavailable',
        correctAnswerId: (card?.correctAnswerId as string) ?? '',
        selectedAnswerId: entry.selectedAnswerId,
        answers: (card?.answers as { id: string; text: string }[]) ?? [],
        timestamp: entry.timestamp,
      };
    });

    return reply.send({ success: true, data, timestamp: new Date().toISOString() });
  });

  // ─── DELETE /progress/error-journal/:cardId ───────────────────
  // Dismiss a specific card from the error journal after review.
  fastify.delete(
    '/error-journal/:cardId',
    async (request: FastifyRequest<{ Params: { cardId: string } }>, reply: FastifyReply) => {
      const userId = request.user!.id;
      const { cardId } = request.params;
      const redis = getRedisClient();

      // Need to find and remove all entries matching this cardId
      const raw = await redis.zrange(`error_journal:${userId}`, 0, -1);
      let removed = 0;
      for (const member of raw) {
        try {
          const parsed = JSON.parse(member) as { cardId: string };
          if (parsed.cardId === cardId) {
            await redis.zrem(`error_journal:${userId}`, member);
            removed++;
          }
        } catch { /* skip */ }
      }

      return reply.send({
        success: true,
        data: { removed },
        timestamp: new Date().toISOString(),
      });
    },
  );


  // ─── GET /progress/subject-mastery/:examId/:subjectId ────────
  // Returns per-topic mastery for a single subject. Used by the
  // Topic Mastery Overview screen to show a bird's-eye view of
  // all topics with their mastery percentages, sorted by weakness.
  fastify.get(
    '/subject-mastery/:examId/:subjectId',
    async (request: FastifyRequest<{ Params: { examId: string; subjectId: string } }>, reply: FastifyReply) => {
      const userId = request.user!.id;
      const { examId, subjectId } = request.params;
      const redis = getRedisClient();

      // Read tracking set
      const trackedMembers = await redis.smembers(`level_progress_keys:${userId}`);
      const relevantMembers = trackedMembers.filter(m => {
        const parts = m.split(':');
        return parts[0] === examId && parts[1] === subjectId;
      });

      // Get all topics for this subject from MongoDB
      const mongo = getMongoDb();
      const topicDocs = await mongo
        .collection('decks')
        .aggregate([
          {
            $match: {
              examId: /^[0-9a-fA-F]{24}$/.test(examId) ? new ObjectId(examId) : examId,
              subjectId: /^[0-9a-fA-F]{24}$/.test(subjectId) ? new ObjectId(subjectId) : subjectId,
            },
          },
          { $group: { _id: '$topicSlug', displayName: { $first: '$topicDisplayName' } } },
          { $sort: { _id: 1 } },
        ])
        .toArray();

      // Parse tracked entries and pipeline Redis reads
      type ParsedEntry = { topicSlug: string; level: string; levelIndex: number };
      const parsed: ParsedEntry[] = [];

      for (const member of relevantMembers) {
        const segments = member.split(':');
        if (segments.length !== 4) continue;
        const [, , topicSlug, level] = segments as [string, string, string, string];
        const levelIndex = SUBJECT_LEVELS.indexOf(level as typeof SUBJECT_LEVELS[number]);
        if (levelIndex === -1) continue;
        parsed.push({ topicSlug, level, levelIndex });
      }

      // Pipeline HGETALL for each discovered key
      const pipeline = redis.pipeline();
      for (const entry of parsed) {
        pipeline.hgetall(`level_progress:${userId}:${examId}:${subjectId}:${entry.topicSlug}:${entry.level}`);
      }
      const pipelineResults = parsed.length > 0 ? await pipeline.exec() : [];

      // Aggregate per topic
      const topicMap = new Map<string, {
        correct: number;
        total: number;
        highestLevelIndex: number;
        highestLevel: string;
      }>();

      for (let i = 0; i < parsed.length; i++) {
        const entry = parsed[i]!;
        const [err, rawData] = pipelineResults?.[i] ?? [null, {}];
        const data = (!err && rawData ? rawData : {}) as Record<string, string>;
        const correct = parseInt(data['correct'] ?? '0', 10);
        const total = parseInt(data['total'] ?? '0', 10);

        const existing = topicMap.get(entry.topicSlug);
        if (!existing) {
          topicMap.set(entry.topicSlug, {
            correct,
            total,
            highestLevelIndex: entry.levelIndex,
            highestLevel: entry.level,
          });
        } else {
          existing.correct += correct;
          existing.total += total;
          if (entry.levelIndex > existing.highestLevelIndex) {
            existing.highestLevelIndex = entry.levelIndex;
            existing.highestLevel = entry.level;
          }
        }
      }

      // Build response — include ALL topics (even ones not started)
      const topics = topicDocs.map(doc => {
        const slug = doc._id as string;
        const progress = topicMap.get(slug);
        const maxCorrect = SUBJECT_LEVELS.length * 30; // 4 levels × 30 correct each = 120
        return {
          topicSlug: slug,
          topicName: (doc.displayName as string) ?? slug,
          correctAnswers: progress?.correct ?? 0,
          totalAnswers: progress?.total ?? 0,
          highestLevel: progress?.highestLevel ?? null,
          highestLevelIndex: progress?.highestLevelIndex ?? -1,
          masteryPercent: Math.min(100, Math.round(((progress?.correct ?? 0) / maxCorrect) * 100)),
        };
      });

      // Sort: lowest mastery first (weakest topics at top)
      topics.sort((a, b) => a.masteryPercent - b.masteryPercent);

      return reply.send({ success: true, data: topics, timestamp: new Date().toISOString() });
    },
  );


  // ─── GET /progress/advanced-insights ──────────────────────────
  // Returns chronotype, speed-vs-accuracy scatter, and subject strength data.
  // Available to all paid tiers; the mobile app controls which sections render
  // based on deep_insights / mastery_radar feature flags.
  fastify.get('/advanced-insights', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.id;
    const insights = await progressRepository.getAdvancedInsights(userId);
    return reply.send({ success: true, data: insights, timestamp: new Date().toISOString() });
  });

  // ─── GET /progress/learning-profile ──────────────────────────
  // Returns the full learning intelligence profile: study plan,
  // knowledge health, exam readiness, velocity, and topic forecasts.
  // Available to ALL users (free tier included) for engagement.
  fastify.get('/learning-profile', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.id;

    // Lazy backfill: if user has level progress but no card memory, seed it
    const redis = getRedisClient();
    const hasMemory = await redis.scard(`card_memory_keys:${userId}`);
    const hasProgress = await redis.scard(`level_progress_keys:${userId}`);
    if (hasMemory === 0 && hasProgress > 0) {
      const { backfillCardMemory } = await import('../services/learning-intelligence.service.js');
      await backfillCardMemory(userId).catch((err) =>
        request.log.error({ err }, 'Card memory backfill failed'),
      );
    }

    const { buildLearningProfile } = await import('../services/learning-intelligence.service.js');
    const profile = await buildLearningProfile(userId);
    return reply.send({ success: true, data: profile, timestamp: new Date().toISOString() });
  });

  // ─── GET /progress/review-queue ──────────────────────────────
  // Returns cards whose SM-2 next_review_at is <= now, enriched
  // with question content and PYQ metadata. Sorted by most overdue.
  // Optional ?source=pyq to filter to PYQ-only review.
  fastify.get('/review-queue', async (request: FastifyRequest<{
    Querystring: { source?: string; limit?: string };
  }>, reply: FastifyReply) => {
    const userId = request.user!.id;
    const sourceFilter = (request.query as { source?: string }).source;
    const limit = Math.min(parseInt((request.query as { limit?: string }).limit ?? '30', 10), 50);

    const redis = getRedisClient();
    const mongo = getMongoDb();

    // Get all tracked card IDs
    const cardIds = await redis.smembers(`card_memory_keys:${userId}`);
    if (cardIds.length === 0) {
      return reply.send({ success: true, data: [], timestamp: new Date().toISOString() });
    }

    // Pipeline read all card memory states
    const pipeline = redis.pipeline();
    for (const id of cardIds) {
      pipeline.hgetall(`card_memory:${userId}:${id}`);
    }
    const results = await pipeline.exec();

    const now = new Date();

    // Filter to due cards
    type DueCard = {
      cardId: string;
      subjectId: string;
      topicSlug: string;
      nextReviewAt: string;
      overdueDays: number;
      intervalDays: number;
      easeFactor: number;
      repetitions: number;
    };

    const dueCards: DueCard[] = [];
    for (let i = 0; i < cardIds.length; i++) {
      const [err, raw] = results?.[i] ?? [null, {}];
      const data = (!err && raw ? raw : {}) as Record<string, string>;
      if (!data['next_review_at']) continue;

      const nextReview = new Date(data['next_review_at']!);
      if (nextReview > now) continue; // Not yet due

      const overdueDays = (now.getTime() - nextReview.getTime()) / (1000 * 60 * 60 * 24);

      dueCards.push({
        cardId: cardIds[i]!,
        subjectId: data['subject_id'] ?? '',
        topicSlug: data['topic_slug'] ?? '',
        nextReviewAt: data['next_review_at']!,
        overdueDays: Math.round(overdueDays * 10) / 10,
        intervalDays: parseFloat(data['interval_days'] ?? '1'),
        easeFactor: parseFloat(data['ease_factor'] ?? '2.5'),
        repetitions: parseInt(data['repetitions'] ?? '0', 10),
      });
    }

    // Sort by most overdue first
    dueCards.sort((a, b) => b.overdueDays - a.overdueDays);

    if (dueCards.length === 0) {
      return reply.send({ success: true, data: [], timestamp: new Date().toISOString() });
    }

    // Enrich from MongoDB — fetch cards with content + PYQ metadata
    const dueCardIds = dueCards.map(c => c.cardId);
    const validIds = dueCardIds
      .filter(id => /^[0-9a-fA-F]{24}$/.test(id))
      .map(id => new ObjectId(id));

    const mongoFilter: Record<string, unknown> = validIds.length > 0
      ? { _id: { $in: validIds } }
      : {};
    if (sourceFilter === 'pyq') {
      mongoFilter['source'] = 'pyq';
    }

    const cards = validIds.length > 0
      ? await mongo.collection('flashcards')
          .find(mongoFilter)
          .project({
            question: 1, answers: 1, correctAnswerId: 1,
            source: 1, sourceYear: 1, sourcePaper: 1,
            topicDisplayName: 1, explanation: 1,
          })
          .toArray()
      : [];

    const cardContentMap = new Map(cards.map(c => [c._id.toString(), c]));

    // Fetch subject names
    const subjectIds = [...new Set(dueCards.map(c => c.subjectId).filter(Boolean))];
    const validSubjectIds = subjectIds.filter(id => /^[0-9a-fA-F]{24}$/.test(id)).map(id => new ObjectId(id));
    const subjects = validSubjectIds.length > 0
      ? await mongo.collection('subjects').find({ _id: { $in: validSubjectIds } }).project({ name: 1 }).toArray()
      : [];
    const subjectNameMap = new Map(subjects.map(s => [s._id.toString(), s.name as string]));

    // Build response
    const data = dueCards
      .filter(c => cardContentMap.has(c.cardId)) // Only include cards that exist in MongoDB
      .slice(0, limit)
      .map(c => {
        const content = cardContentMap.get(c.cardId)!;
        return {
          cardId: c.cardId,
          subjectId: c.subjectId,
          subjectName: subjectNameMap.get(c.subjectId) ?? c.subjectId,
          topicSlug: c.topicSlug,
          topicName: (content.topicDisplayName as string) ?? c.topicSlug,
          question: (content.question as string) ?? '',
          answers: (content.answers as { id: string; text: string }[]) ?? [],
          correctAnswerId: (content.correctAnswerId as string) ?? '',
          explanation: (content.explanation as string) ?? null,
          source: (content.source as string) ?? 'original',
          sourceYear: (content.sourceYear as number) ?? null,
          sourcePaper: (content.sourcePaper as string) ?? null,
          overdueDays: c.overdueDays,
          intervalDays: c.intervalDays,
          easeFactor: c.easeFactor,
          repetitions: c.repetitions,
        };
      });

    return reply.send({ success: true, data, timestamp: new Date().toISOString() });
  });

  // ─── GET /progress/diagnostic-deck ──────────────────────────
  // Returns a placement quiz deck: 3 cards per level × 4 levels = 12 cards.
  // Used in onboarding to auto-unlock levels based on existing knowledge.
  fastify.get('/diagnostic-deck', async (request: FastifyRequest<{
    Querystring: { examId: string; subjectId: string };
  }>, reply: FastifyReply) => {
    const { examId, subjectId } = request.query as { examId: string; subjectId: string };
    const mongo = getMongoDb();

    if (!examId || !subjectId) {
      return reply.status(400).send({ success: false, error: { code: 'MISSING_PARAMS', message: 'examId and subjectId are required' } });
    }

    const examObjId = /^[0-9a-fA-F]{24}$/.test(examId) ? new ObjectId(examId) : null;
    const subjectObjId = /^[0-9a-fA-F]{24}$/.test(subjectId) ? new ObjectId(subjectId) : null;
    if (!examObjId || !subjectObjId) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_ID', message: 'Invalid examId or subjectId' } });
    }

    // Sample 3 cards per level
    const cards: unknown[] = [];
    for (const level of SUBJECT_LEVELS) {
      // Find decks for this subject+exam+level
      const decks = await mongo.collection('decks')
        .find({ examId: examObjId, subjectId: subjectObjId, level })
        .project({ _id: 1, topicSlug: 1 })
        .limit(10)
        .toArray();

      if (decks.length === 0) continue;

      const levelCards = await mongo.collection('flashcards')
        .aggregate([
          { $match: { deckId: { $in: decks.map(d => d._id) } } },
          { $sample: { size: 3 } },
          { $project: { question: 1, answers: '$options', correctAnswerId: 1, topicDisplayName: 1 } },
        ])
        .toArray();

      for (const c of levelCards) {
        cards.push({
          cardId: c._id.toString(),
          question: (c.question as string) ?? '',
          answers: (c.answers as { id: string; text: string }[]) ?? [],
          correctAnswerId: (c.correctAnswerId as string) ?? '',
          level,
          topicName: (c.topicDisplayName as string) ?? level,
        });
      }
    }

    return reply.send({ success: true, data: { cards, examId, subjectId }, timestamp: new Date().toISOString() });
  });

  // ─── POST /progress/diagnostic-result ────────────────────────
  // Processes placement quiz results. For each level where the student
  // answered ≥2/3 correctly, that level (and all preceding) are unlocked
  // across all topics in the subject. Seeds BKT priors from accuracy.
  fastify.post('/diagnostic-result', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.id;
    const body = request.body as {
      examId: string;
      subjectId: string;
      results: { cardId: string; level: string; correct: boolean }[];
    };

    const { examId, subjectId, results } = body;
    if (!examId || !subjectId || !Array.isArray(results)) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_BODY', message: 'examId, subjectId, and results are required' } });
    }

    // Tally per-level performance
    const levelScores = new Map<string, { correct: number; total: number }>();
    for (const r of results) {
      const cur = levelScores.get(r.level) ?? { correct: 0, total: 0 };
      levelScores.set(r.level, {
        correct: cur.correct + (r.correct ? 1 : 0),
        total: cur.total + 1,
      });
    }

    // Determine highest level where student scored ≥2/3
    const PASS_THRESHOLD = 2 / 3;
    let highestPassedIdx = -1;
    for (let i = 0; i < SUBJECT_LEVELS.length; i++) {
      const level = SUBJECT_LEVELS[i]!;
      const score = levelScores.get(level);
      if (!score || score.total === 0) break;
      const accuracy = score.correct / score.total;
      if (accuracy >= PASS_THRESHOLD) {
        highestPassedIdx = i;
      } else {
        break; // Stop at first failed level — don't skip ahead
      }
    }

    const redis = getRedisClient();
    const mongo = getMongoDb();

    // Fetch all topics in this subject to unlock levels across them
    const subjectObjId = /^[0-9a-fA-F]{24}$/.test(subjectId) ? new ObjectId(subjectId) : null;
    const examObjId = /^[0-9a-fA-F]{24}$/.test(examId) ? new ObjectId(examId) : null;

    const topics = subjectObjId && examObjId
      ? await mongo.collection('decks')
          .distinct('topicSlug', { examId: examObjId, subjectId: subjectObjId })
      : [];

    // Unlock all levels up to (and including) the level after the highest passed
    const levelsToUnlock = SUBJECT_LEVELS.slice(0, highestPassedIdx + 2); // +2: passed level + next

    const pipeline = redis.pipeline();
    for (const topicSlug of topics) {
      const unlockKey = `unlocked_levels:${userId}:${examId}:${subjectId}:${topicSlug}`;
      // Always at minimum unlock Emerging
      pipeline.sadd(unlockKey, 'Emerging');
      for (const level of levelsToUnlock) {
        pipeline.sadd(unlockKey, level);
      }
    }
    await pipeline.exec();

    const unlockedCount = levelsToUnlock.length;
    const unlockedUpTo = levelsToUnlock[levelsToUnlock.length - 1] ?? 'Emerging';

    return reply.send({
      success: true,
      data: {
        highestPassedLevel: highestPassedIdx >= 0 ? SUBJECT_LEVELS[highestPassedIdx] : null,
        unlockedUpTo,
        unlockedCount,
        topicsUnlocked: topics.length,
      },
      timestamp: new Date().toISOString(),
    });
  });

  // ─── GET /progress/mock-test ─────────────────────────────────
  // Generates a mixed-subject mock test by sampling flashcards
  // across the student's selected subjects. Returns shuffled cards
  // with a suggested time limit. ?count=30&examId=...
  fastify.get('/mock-test', async (request: FastifyRequest<{
    Querystring: { examId?: string; count?: string };
  }>, reply: FastifyReply) => {
    const userId = request.user!.id;
    const requestedCount = Math.min(parseInt((request.query as { count?: string }).count ?? '30', 10), 50);
    const examIdFilter = (request.query as { examId?: string }).examId;

    const mongo = getMongoDb();
    const pg = getPostgresPool();

    // Get user's selected subjects from preferences
    const prefResult = await pg.query(
      `SELECT selected_subjects FROM user_preferences
       WHERE user_id = (SELECT id FROM users WHERE firebase_uid = $1)`,
      [userId],
    );
    const selectedSubjects: string[] = prefResult.rows[0]?.selected_subjects ?? [];

    if (selectedSubjects.length === 0) {
      return reply.send({ success: true, data: { cards: [], timeLimitMinutes: 0 }, timestamp: new Date().toISOString() });
    }

    // Build MongoDB query — sample flashcards across subjects
    const subjectFilter = selectedSubjects
      .filter(id => /^[0-9a-fA-F]{24}$/.test(id))
      .map(id => new ObjectId(id));

    const matchStage: Record<string, unknown> = {};
    if (subjectFilter.length > 0) {
      matchStage['subjectId'] = { $in: subjectFilter };
    }
    if (examIdFilter && /^[0-9a-fA-F]{24}$/.test(examIdFilter)) {
      matchStage['examId'] = new ObjectId(examIdFilter);
    }

    // Use $sample to get random cards — first find eligible decks
    const deckIds = await mongo.collection('decks')
      .find(matchStage)
      .project({ _id: 1 })
      .toArray();

    if (deckIds.length === 0) {
      return reply.send({ success: true, data: { cards: [], timeLimitMinutes: 0 }, timestamp: new Date().toISOString() });
    }

    const cards = await mongo.collection('flashcards')
      .aggregate([
        { $match: { deckId: { $in: deckIds.map(d => d._id) } } },
        { $sample: { size: requestedCount } },
        {
          $project: {
            question: 1,
            answers: '$options',
            correctAnswerId: 1,
            explanation: 1,
            source: 1,
            sourceYear: 1,
            sourcePaper: 1,
            tags: 1,
            topicDisplayName: 1,
            deckId: 1,
          },
        },
      ])
      .toArray();

    // Enrich with subject/topic info from decks
    const deckMap = new Map<string, { subjectId: string; topicSlug: string }>();
    const enrichDecks = await mongo.collection('decks')
      .find({ _id: { $in: deckIds.map(d => d._id) } })
      .project({ subjectId: 1, topicSlug: 1, topicDisplayName: 1 })
      .toArray();
    for (const d of enrichDecks) {
      deckMap.set(d._id.toString(), {
        subjectId: d.subjectId?.toString() ?? '',
        topicSlug: (d.topicSlug as string) ?? '',
      });
    }

    // Subject name lookup
    const subjectIds = [...new Set(enrichDecks.map(d => d.subjectId?.toString()).filter(Boolean))] as string[];
    const validSubIds = subjectIds.filter(id => /^[0-9a-fA-F]{24}$/.test(id)).map(id => new ObjectId(id));
    const subjects = validSubIds.length > 0
      ? await mongo.collection('subjects').find({ _id: { $in: validSubIds } }).project({ name: 1 }).toArray()
      : [];
    const subjectNameMap = new Map(subjects.map(s => [s._id.toString(), s.name as string]));

    // Time limit: ~90 seconds per card
    const timeLimitMinutes = Math.ceil((cards.length * 90) / 60);

    const data = {
      cards: cards.map(c => {
        const answers = (c.answers as { id: string; text: string }[]) ?? 
                        (c.options as { id: string; text: string }[]) ?? [];
        return {
          cardId: c._id.toString(),
          question: (c.question as string) ?? '',
          answers,
          correctAnswerId: (c.correctAnswerId as string) ?? '',
          explanation: (c.explanation as string) ?? null,
          source: (c.source as string) ?? 'original',
          sourceYear: (c.sourceYear as number) ?? null,
          sourcePaper: (c.sourcePaper as string) ?? null,
          topicName: (c.topicDisplayName as string) ?? '',
          subjectName: (() => {
            const deck = deckMap.get(c.deckId?.toString() ?? '');
            return deck ? (subjectNameMap.get(deck.subjectId) ?? '') : '';
          })(),
        };
      }),
      timeLimitMinutes,
      totalCards: cards.length,
    };

    return reply.send({ success: true, data, timestamp: new Date().toISOString() });
  });
}
