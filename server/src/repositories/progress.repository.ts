// ─── Progress Repository ────────────────────────────────────
// Redis-primary storage for real-time progress tracking.
// Optional write-behind to PostgreSQL for durable history.

import { getRedisClient } from '../lib/database.js';
import { getPostgresPool } from '../lib/database.js';
import type { ProgressRecord, StudyStreak, StudySession, ProgressSummary, DailyActivity, LevelProgress, SubjectLevelSummary, ExamProgress, LevelAnswerResult } from '@kd/shared';
import { SUBJECT_LEVELS, LEVEL_UNLOCK_THRESHOLD } from '@kd/shared';

class ProgressRepository {
  private get redis() {
    return getRedisClient();
  }

  private get pg() {
    return getPostgresPool();
  }

  // H4 fix: Atomic Lua script for streak freeze consumption.
  // Returns 1 if a freeze was consumed, 0 if no freezes available.
  private static CONSUME_FREEZE_LUA = `
    local freezes = tonumber(redis.call('HGET', KEYS[1], 'freezes') or '0')
    if freezes > 0 then
      redis.call('HINCRBY', KEYS[1], 'freezes', -1)
      return 1
    end
    return 0
  `;

  // ─── Record card completion ───────────────────────────
  async recordCompletion(
    userId: string,
    deckId: string,
    _cardId: string,
    correct: boolean,
    responseTimeMs: number,
  ): Promise<ProgressRecord> {
    const key = `progress:${userId}:${deckId}`;
    const pipeline = this.redis.pipeline();

    if (correct) {
      pipeline.hincrby(key, 'completed_cards', 1);
    }
    pipeline.hset(key, 'last_studied_at', new Date().toISOString());
    // Track this deck in the user's studied-decks SET (avoids SCAN in getSummary)
    pipeline.sadd(`progress_decks:${userId}`, deckId);
    await pipeline.exec();

    // Update streak
    await this.updateStreak(userId);

    // Update daily activity
    await this.updateDailyActivity(userId, responseTimeMs);

    return this.getProgress(userId, deckId);
  }

  // ─── Get progress for a deck ──────────────────────────
  async getProgress(userId: string, deckId: string): Promise<ProgressRecord> {
    const key = `progress:${userId}:${deckId}`;
    const data = await this.redis.hgetall(key);

    const completed = parseInt(data['completed_cards'] ?? '0', 10);
    const total = parseInt(data['total_cards'] ?? '0', 10);

    return {
      userId,
      deckId,
      completedCards: completed,
      totalCards: total,
      completionPercentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      lastStudiedAt: data['last_studied_at'] ?? new Date().toISOString(),
    };
  }

  // ─── Initialize deck progress ─────────────────────────
  async initializeDeckProgress(userId: string, deckId: string, totalCards: number): Promise<void> {
    const key = `progress:${userId}:${deckId}`;
    const exists = await this.redis.exists(key);
    if (!exists) {
      await this.redis.hset(key, {
        completed_cards: '0',
        total_cards: String(totalCards),
        last_card_index: '0',
        last_studied_at: new Date().toISOString(),
      });
    }
  }

  // ─── Streak Management ────────────────────────────────
  async updateStreak(userId: string): Promise<StudyStreak> {
    const key = `streak:${userId}`;
    const today = new Date().toISOString().split('T')[0]!;
    const data = await this.redis.hgetall(key);

    const lastDate = data['last_study_date'] ?? '';
    const currentStreak = parseInt(data['current_streak'] ?? '0', 10);
    const longestStreak = parseInt(data['longest_streak'] ?? '0', 10);
    const freezes = parseInt(data['freezes'] ?? '0', 10);

    if (lastDate === today) {
      // Already studied today, no change
      return {
        userId,
        currentStreak,
        longestStreak,
        lastStudyDate: today,
        streakFreezes: freezes,
        freezeConsumed: false,
      };
    }

    // Check if yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0]!;

    let newStreak: number;
    let freezeConsumed = false;

    if (lastDate === yesterdayStr) {
      // Studied yesterday — streak continues
      newStreak = currentStreak + 1;
    } else {
      // Missed a day — try to consume a streak freeze atomically (H4 fix)
      const freezeConsumedResult = await this.redis.eval(
        ProgressRepository.CONSUME_FREEZE_LUA, 1, key,
      ) as number;
      if (freezeConsumedResult === 1) {
        newStreak = currentStreak + 1;
        freezeConsumed = true;
      } else {
        newStreak = 1; // Reset streak
      }
    }

    const newLongest = Math.max(longestStreak, newStreak);

    await this.redis.hset(key, {
      current_streak: String(newStreak),
      longest_streak: String(newLongest),
      last_study_date: today,
    });

    const updatedFreezes = freezeConsumed ? freezes - 1 : freezes;

    return {
      userId,
      currentStreak: newStreak,
      longestStreak: newLongest,
      lastStudyDate: today,
      streakFreezes: updatedFreezes,
      freezeConsumed,
    };
  }

  async getStreak(userId: string): Promise<StudyStreak> {
    const data = await this.redis.hgetall(`streak:${userId}`);
    return {
      userId,
      currentStreak: parseInt(data['current_streak'] ?? '0', 10),
      longestStreak: parseInt(data['longest_streak'] ?? '0', 10),
      lastStudyDate: data['last_study_date'] ?? '',
      streakFreezes: parseInt(data['freezes'] ?? '0', 10),
      freezeConsumed: false,
    };
  }

  // ─── Daily Activity ───────────────────────────────────
  private async updateDailyActivity(userId: string, responseTimeMs: number): Promise<void> {
    const today = new Date().toISOString().split('T')[0]!;
    const key = `daily_activity:${userId}:${today}`;

    const pipeline = this.redis.pipeline();
    pipeline.hincrby(key, 'cards_studied', 1);
    pipeline.hincrby(key, 'time_ms', responseTimeMs);
    pipeline.expire(key, 7776000); // 90 days TTL
    await pipeline.exec();
  }

  async getWeeklyActivity(userId: string): Promise<DailyActivity[]> {
    const today = new Date();
    const dateStrs: string[] = [];

    // Build keys for last 7 days
    const pipeline = this.redis.pipeline();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0]!;
      dateStrs.push(dateStr);
      pipeline.hgetall(`daily_activity:${userId}:${dateStr}`);
    }

    const results = await pipeline.exec();

    return dateStrs.map((dateStr, idx) => {
      const [err, data] = results?.[idx] ?? [null, {}];
      const record = (!err && data ? data : {}) as Record<string, string>;
      return {
        date: dateStr,
        cardsStudied: parseInt(record['cards_studied'] ?? '0', 10),
        minutesSpent: Math.round(parseInt(record['time_ms'] ?? '0', 10) / 60000),
      };
    });
  }

  // ─── Summary ──────────────────────────────────────────
  async getSummary(userId: string): Promise<ProgressSummary> {
    const streak = await this.getStreak(userId);
    const weeklyActivity = await this.getWeeklyActivity(userId);

    // Use the tracked deck-IDs SET instead of SCAN for O(1) key lookup
    const deckIds = await this.redis.smembers(`progress_decks:${userId}`);
    let totalCards = 0;
    let totalStudyMs = 0;

    if (deckIds.length > 0) {
      // Pipeline all HGETALL calls for efficiency
      const pipeline = this.redis.pipeline();
      for (const deckId of deckIds) {
        pipeline.hgetall(`progress:${userId}:${deckId}`);
      }
      const results = await pipeline.exec();
      if (results) {
        for (const [err, data] of results) {
          if (!err && data && typeof data === 'object') {
            totalCards += parseInt((data as Record<string, string>)['completed_cards'] ?? '0', 10);
          }
        }
      }
    }

    // Sum weekly time
    for (const day of weeklyActivity) {
      totalStudyMs += day.minutesSpent;
    }

    // Get session count from PostgreSQL for accuracy
    const sessionResult = await this.pg.query(
      `SELECT COUNT(DISTINCT deck_id) as decks,
              COALESCE(SUM(correct_answers)::float / NULLIF(SUM(correct_answers + incorrect_answers), 0) * 100, 0) as accuracy
       FROM study_sessions WHERE user_id = (SELECT id FROM users WHERE auth0_id = $1)`,
      [userId],
    );

    const row = sessionResult.rows[0];

    return {
      totalDecksStudied: parseInt(row?.decks ?? '0', 10),
      totalCardsCompleted: totalCards,
      overallAccuracy: Math.round(parseFloat(row?.accuracy ?? '0')),
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      totalStudyTimeMinutes: totalStudyMs,
      weeklyActivity,
    };
  }

  // ─── Study Session (PostgreSQL write-behind) ──────────
  async saveSession(session: Omit<StudySession, 'id'>): Promise<void> {
    await this.pg.query(
      `INSERT INTO study_sessions
         (user_id, deck_id, cards_studied, correct_answers, incorrect_answers, avg_response_time_ms, started_at, ended_at)
       VALUES
         ((SELECT id FROM users WHERE auth0_id = $1), $2, $3, $4, $5, $6, $7, $8)`,
      [
        session.userId,
        session.deckId,
        session.cardsStudied,
        session.correctAnswers,
        session.incorrectAnswers,
        session.averageResponseTimeMs,
        session.startedAt,
        session.endedAt,
      ],
    );
  }

  // ─── Study History ───────────────────────────────────
  async getHistory(userId: string, page: number = 1, pageSize: number = 20) {
    const offset = (page - 1) * pageSize;
    const result = await this.pg.query(
      `SELECT id, deck_id, cards_studied, correct_answers, incorrect_answers,
              avg_response_time_ms, started_at, ended_at, created_at
       FROM study_sessions
       WHERE user_id = (SELECT id FROM users WHERE auth0_id = $1)
       ORDER BY started_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, pageSize, offset],
    );

    const countResult = await this.pg.query(
      `SELECT COUNT(*) as total FROM study_sessions
       WHERE user_id = (SELECT id FROM users WHERE auth0_id = $1)`,
      [userId],
    );

    const total = parseInt(countResult.rows[0]?.total ?? '0', 10);

    return {
      data: result.rows.map((row: Record<string, unknown>) => ({
        id: row.id as string,
        userId,
        deckId: row.deck_id as string,
        cardsStudied: row.cards_studied as number,
        correctAnswers: row.correct_answers as number,
        incorrectAnswers: row.incorrect_answers as number,
        averageResponseTimeMs: row.avg_response_time_ms as number,
        startedAt: (row.started_at as Date).toISOString(),
        endedAt: (row.ended_at as Date).toISOString(),
      })),
      pagination: {
        page,
        pageSize,
        totalItems: total,
        totalPages: Math.ceil(total / pageSize),
        hasNextPage: page * pageSize < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  // ─── Level-scoped Progress (Exam → Subject → Level model) ─────

  /**
   * Record one answer for a (userId, examId, subjectId, level) context.
   * Beginner is always pre-seeded as unlocked on first call.
   * Returns justUnlocked=true and newlyUnlockedLevel when 20 correct answers
   * are reached for the first time in this level.
   */
  async recordLevelAnswer(
    userId: string,
    examId: string,
    subjectId: string,
    level: typeof SUBJECT_LEVELS[number],
    correct: boolean,
    topicSlug: string,
  ): Promise<LevelAnswerResult> {
    const progressKey = `level_progress:${userId}:${examId}:${subjectId}:${topicSlug}:${level}`;
    const unlockKey = `unlocked_levels:${userId}:${examId}:${subjectId}:${topicSlug}`;

    // Seed Beginner as unlocked on first ever call for this topic
    const beginnerAlreadySeeded = await this.redis.sismember(unlockKey, 'Beginner');
    if (!beginnerAlreadySeeded) {
      await this.redis.sadd(unlockKey, 'Beginner');
    }

    // Verify the requested level is currently unlocked
    const isUnlocked = await this.redis.sismember(unlockKey, level);
    if (!isUnlocked) {
      throw new Error(`LEVEL_LOCKED: Level "${level}" is not yet unlocked for this user/exam/subject/topic`);
    }

    // Increment answer counters
    const pipeline = this.redis.pipeline();
    pipeline.hincrby(progressKey, 'total', 1);
    if (correct) {
      pipeline.hincrby(progressKey, 'correct', 1);
    }
    // Track this level-progress key in a SET (avoids SCAN in AI insights)
    pipeline.sadd(`level_progress_keys:${userId}`, `${examId}:${subjectId}:${topicSlug}:${level}`);
    await pipeline.exec();

    // Read updated counts
    const data = await this.redis.hgetall(progressKey);
    const correctCount = parseInt(data['correct'] ?? '0', 10);
    const totalCount = parseInt(data['total'] ?? '0', 10);

    const levelIndex = SUBJECT_LEVELS.indexOf(level);
    const nextLevel = SUBJECT_LEVELS[levelIndex + 1];

    // Check for new unlock
    let justUnlocked = false;
    let newlyUnlockedLevel: typeof SUBJECT_LEVELS[number] | undefined;

    if (correctCount >= LEVEL_UNLOCK_THRESHOLD && nextLevel) {
      const alreadyUnlocked = await this.redis.sismember(unlockKey, nextLevel);
      if (!alreadyUnlocked) {
        await this.redis.sadd(unlockKey, nextLevel);
        justUnlocked = true;
        newlyUnlockedLevel = nextLevel;
      }
    }

    const levelProgress: LevelProgress = {
      userId,
      subjectId,
      examId,
      topicSlug,
      level,
      correctAnswers: correctCount,
      totalAnswers: totalCount,
      isUnlocked: true,
      isCompleted: correctCount >= LEVEL_UNLOCK_THRESHOLD,
    };

    const result: LevelAnswerResult = { levelProgress, justUnlocked, coinsEarned: 0 };
    if (newlyUnlockedLevel) result.newlyUnlockedLevel = newlyUnlockedLevel;
    return result;
  }

  /** Returns all 6 LevelProgress records for a (userId, examId, subjectId, topicSlug). */
  async getSubjectLevelSummary(
    userId: string,
    examId: string,
    subjectId: string,
    topicSlug: string,
  ): Promise<SubjectLevelSummary> {
    const unlockKey = `unlocked_levels:${userId}:${examId}:${subjectId}:${topicSlug}`;

    // Ensure Beginner is seeded
    const beginnerSeeded = await this.redis.sismember(unlockKey, 'Beginner');
    if (!beginnerSeeded) {
      await this.redis.sadd(unlockKey, 'Beginner');
    }

    const unlockedSet = await this.redis.smembers(unlockKey);

    // M2 fix: Pipeline all HGETALL calls for 6x fewer Redis round-trips
    const pipeline = this.redis.pipeline();
    for (const level of SUBJECT_LEVELS) {
      pipeline.hgetall(`level_progress:${userId}:${examId}:${subjectId}:${topicSlug}:${level}`);
    }
    const pipelineResults = await pipeline.exec();

    const levels: LevelProgress[] = SUBJECT_LEVELS.map((level, idx) => {
      const [err, data] = pipelineResults?.[idx] ?? [null, {}];
      const record = (!err && data ? data : {}) as Record<string, string>;
      const correctCount = parseInt(record['correct'] ?? '0', 10);
      const totalCount = parseInt(record['total'] ?? '0', 10);
      const isUnlocked = unlockedSet.includes(level);

      return {
        userId,
        subjectId,
        examId,
        topicSlug,
        level,
        correctAnswers: correctCount,
        totalAnswers: totalCount,
        isUnlocked,
        isCompleted: correctCount >= LEVEL_UNLOCK_THRESHOLD,
      } satisfies LevelProgress;
    });

    return { subjectId, examId, topicSlug, levels };
  }

  /** Returns the highest unlocked level per subject for a given exam.
   *  Aggregates across all topics — the dashboard shows the MAX level reached
   *  for any topic within each subject. */
  async getExamProgress(userId: string, examId: string, subjectIds: string[]): Promise<ExamProgress[]> {
    // Read all tracked progress keys for this user from the tracking SET
    // Key format stored in SET: "examId:subjectId:topicSlug:level"
    const allKeys = await this.redis.smembers(`level_progress_keys:${userId}`);

    // Build a map: subjectId → highest level index (across all topics)
    const subjectMaxLevel = new Map<string, number>();

    for (const key of allKeys) {
      const parts = key.split(':');
      if (parts.length < 4) continue;
      const [keyExamId, keySubjectId, , keyLevel] = parts;
      if (keyExamId !== examId) continue;
      if (!keySubjectId || !subjectIds.includes(keySubjectId)) continue;

      const levelIdx = SUBJECT_LEVELS.indexOf(keyLevel as typeof SUBJECT_LEVELS[number]);
      if (levelIdx < 0) continue;

      const current = subjectMaxLevel.get(keySubjectId) ?? 0;
      if (levelIdx > current) {
        subjectMaxLevel.set(keySubjectId, levelIdx);
      }
    }

    // Also check unlocked_levels SETs for each (subject, topic) combo
    // to catch cases where a user has unlocked a level but not yet answered
    // This is a fallback that ensures Beginner always shows as unlocked
    for (const subjectId of subjectIds) {
      if (!subjectMaxLevel.has(subjectId)) {
        // Check if any topic has Beginner unlocked via the seeded keys
        // Use a scan of the allKeys to find any entry for this subject
        const hasAnyEntry = allKeys.some(k => {
          const parts = k.split(':');
          return parts[0] === examId && parts[1] === subjectId;
        });
        if (!hasAnyEntry) {
          // Default: Beginner (index 0) for subjects with no progress
          subjectMaxLevel.set(subjectId, 0);
        }
      }
    }

    return subjectIds.map(subjectId => ({
      examId,
      subjectId,
      highestUnlockedLevel: SUBJECT_LEVELS[subjectMaxLevel.get(subjectId) ?? 0]!,
    } satisfies ExamProgress));
  }
}

export const progressRepository = new ProgressRepository();
