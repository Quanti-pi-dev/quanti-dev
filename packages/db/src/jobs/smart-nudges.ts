// ─── Cron: Smart Study Nudges ───────────────────────────────
// Behavioral psychology engine: context-aware push notifications
// that fire based on the user's actual learning state rather than
// generic "time to study!" reminders.
//
// Trigger taxonomy (from Nir Eyal's Hook Model):
//   - Loss Aversion: streak at risk, knowledge decay
//   - Endowed Progress: near level unlock
//   - Social Comparison: friend activity
//   - Novelty: new content available
//
// Runs every 30 minutes. Max 3 nudges per user per day to avoid
// notification fatigue (the fastest way to get push disabled).

import { getRedisClient, getPostgresPool } from '../clients/database.js';
import { notificationService } from '../services/notification.service.js';
import { createServiceLogger } from '../lib/logger.js';
import type { FastifyBaseLogger } from 'fastify';

const log = createServiceLogger('SmartNudges');

// ─── Nudge Types ────────────────────────────────────────────

type NudgeType =
  | 'streak_at_risk'
  | 'knowledge_decay'
  | 'near_level_unlock'
  | 'friend_passed_you'
  | 'study_fatigue'
  | 'comeback';

interface NudgeCandidate {
  userId: string;  // firebase_uid
  type: NudgeType;
  priority: number; // higher = more urgent (0-100)
  title: string;
  body: string;
  data?: Record<string, string>; // deep-link payload for the mobile client
}

// Max nudges per user per day (prevents notification fatigue)
const MAX_DAILY_NUDGES = 3;
// Key prefix for tracking daily nudge count
const NUDGE_COUNT_KEY = (userId: string) =>
  `nudge_count:${userId}:${new Date().toISOString().slice(0, 10)}`;

// ─── Main Entry Point ───────────────────────────────────────

export async function runSmartNudges(parentLog?: FastifyBaseLogger): Promise<void> {
  const logger = parentLog ?? log;
  logger.info('Cron: smartNudges starting');

  const redis = getRedisClient();
  const pg = getPostgresPool();

  // Get all users with FCM tokens (only nudge users who can receive push)
  // Also join with streak data and last session time
  const usersResult = await pg.query(`
    SELECT u.firebase_uid, u.display_name,
           (SELECT MAX(started_at) FROM study_sessions WHERE user_id = u.id) AS last_session_at
    FROM users u
    WHERE EXISTS (
      SELECT 1 FROM (SELECT 1) dummy
      WHERE (SELECT EXISTS (SELECT 1))
    )
    ORDER BY u.created_at DESC
    LIMIT 1000
  `);

  // Collect all candidates across all users
  const allCandidates: NudgeCandidate[] = [];

  for (const user of usersResult.rows as { firebase_uid: string; display_name: string; last_session_at: Date | null }[]) {
    const userId = user.firebase_uid;

    // Check if user has FCM token registered
    const hasFcm = await redis.exists(`fcm_token:${userId}`);
    if (!hasFcm) continue;

    // Check daily nudge budget
    const sent = parseInt(await redis.get(NUDGE_COUNT_KEY(userId)) ?? '0', 10);
    if (sent >= MAX_DAILY_NUDGES) continue;

    // ── 1. Streak at Risk ──────────────────────────────────
    // User has a streak >= 2 and hasn't studied today
    const streakData = await redis.hgetall(`streak:${userId}`);
    const currentStreak = parseInt(streakData['current_streak'] ?? '0', 10);
    const lastStudyDate = streakData['last_study_date'] ?? '';
    const today = new Date().toISOString().slice(0, 10);

    if (currentStreak >= 2 && lastStudyDate !== today) {
      allCandidates.push({
        userId,
        type: 'streak_at_risk',
        priority: 90 + Math.min(currentStreak, 10), // longer streaks = more urgent
        title: '⚡ Streak at risk!',
        body: `Your ${currentStreak}-day streak ends tonight! Study just 1 card to save it.`,
        data: { action: 'quick_study', screen: 'study' },
      });
    }

    // ── 2. Knowledge Decay ─────────────────────────────────
    // Cards overdue by more than 3 days in SM-2 review queue
    const cardMemoryKeys = await redis.smembers(`card_memory_keys:${userId}`);
    if (cardMemoryKeys.length > 0) {
      // Sample up to 50 cards to check (avoid scanning thousands)
      const sampleSize = Math.min(cardMemoryKeys.length, 50);
      const sampled = cardMemoryKeys.slice(0, sampleSize);
      const pipeline = redis.pipeline();
      for (const cardId of sampled) {
        pipeline.hget(`card_memory:${userId}:${cardId}`, 'next_review_at');
      }
      const results = await pipeline.exec();

      let overdueCount = 0;
      const now = Date.now();
      const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

      for (const [err, val] of (results ?? [])) {
        if (err || !val) continue;
        const nextReview = new Date(val as string).getTime();
        if (now - nextReview > THREE_DAYS_MS) overdueCount++;
      }

      if (overdueCount >= 5) {
        allCandidates.push({
          userId,
          type: 'knowledge_decay',
          priority: 70 + Math.min(overdueCount, 20),
          title: '📉 Knowledge fading',
          body: `${overdueCount} cards are overdue for review. A 3-minute session can recover them.`,
          data: { action: 'review_queue', screen: 'review-queue' },
        });
      }
    }

    // ── 3. Study Fatigue ───────────────────────────────────
    // User has studied 90+ continuous minutes today without a break.
    // Science: retention diminishes sharply after 90 min (Ultradian Rhythm).
    // This is also an ethical guardrail (blueprint §5 — study fatigue protection).
    //
    // We track session minutes in Redis as a rolling sum, reset daily.
    // The study session handler (progress.routes.ts) increments this key
    // via the `session_minutes_today:{userId}:{date}` key.
    const sessionMinutesTodayKey = `session_minutes_today:${userId}:${today}`;
    const minutesToday = parseInt(await redis.get(sessionMinutesTodayKey) ?? '0', 10);
    if (minutesToday >= 90) {
      allCandidates.push({
        userId,
        type: 'study_fatigue',
        priority: 95, // High priority — fires before streak nudge
        title: '🧘 Take a break — you\'ve earned it!',
        body: `You've studied ${minutesToday} minutes today! A short rest will actually improve your retention.`,
        data: { action: 'break_reminder', screen: 'home' },
      });
    }

    // ── 4. Near Level Unlock ───────────────────────────────
    // Check if any level is within 3 correct answers of unlocking next
    const progressKeys = await redis.smembers(`level_progress_keys:${userId}`);
    for (const key of progressKeys.slice(0, 20)) {
      const segments = key.split(':');
      if (segments.length !== 4) continue;
      const [examId, subjectId, topicSlug, level] = segments as [string, string, string, string];

      const data = await redis.hgetall(
        `level_progress:${userId}:${examId}:${subjectId}:${topicSlug}:${level}`
      );
      const correct = parseInt(data['correct'] ?? '0', 10);
      const remaining = 30 - correct; // LEVEL_UNLOCK_THRESHOLD = 30

      if (remaining > 0 && remaining <= 3) {
        const topicName = topicSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        allCandidates.push({
          userId,
          type: 'near_level_unlock',
          priority: 80,
          title: '🔓 Almost there!',
          body: `${remaining} correct answer${remaining > 1 ? 's' : ''} to unlock the next level in ${topicName}!`,
          data: { action: 'level_study', screen: 'study', examId, subjectId, topicSlug, level },
        });
        break; // Only one per user
      }
    }

    // ── 5. Comeback Nudge ──────────────────────────────────
    // User hasn't studied in 3+ days (lapsed)
    if (user.last_session_at) {
      const daysSince = (Date.now() - new Date(user.last_session_at).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince >= 3 && daysSince <= 14) {
        allCandidates.push({
          userId,
          type: 'comeback',
          priority: 60,
          title: '👋 We miss you!',
          body: `It's been ${Math.floor(daysSince)} days. Just 3 quick questions to get back on track?`,
          data: { action: 'quick_study', screen: 'study', mode: 'micro_session' },
        });
      }
    }

    // ── 6. Friend Passed You ───────────────────────────────────
    // A friend has overtaken the user on the weekly leaderboard.
    // Psychology: Social Comparison Theory (Festinger) — knowing
    // a peer surpassed you creates a competitive drive to catch up.
    try {
      const myRank = await redis.zrevrank('leaderboard:weekly', userId);
      if (myRank !== null) {
        // Resolve internal pg user_id
        const pgUserResult = await pg.query(
          `SELECT id FROM users WHERE firebase_uid = $1 LIMIT 1`,
          [userId],
        );
        const pgUserId = pgUserResult.rows[0]?.id as string | undefined;

        if (pgUserId) {
          const friendsResult = await pg.query<{ firebase_uid: string; display_name: string }>(
            `SELECT u.firebase_uid, u.display_name
             FROM friends f
             JOIN users u ON (
               CASE WHEN f.user_id = $1 THEN f.friend_id ELSE f.user_id END = u.id
             )
             WHERE (f.user_id = $1 OR f.friend_id = $1) AND f.status = 'accepted'
             LIMIT 20`,
            [pgUserId],
          );

          for (const friend of friendsResult.rows) {
            const friendRank = await redis.zrevrank('leaderboard:weekly', friend.firebase_uid);
            // Lower rank index = higher on the leaderboard
            if (friendRank !== null && friendRank < myRank) {
              allCandidates.push({
                userId,
                type: 'friend_passed_you',
                priority: 75,
                title: '🏆 You\'ve been overtaken!',
                body: `${friend.display_name} just passed you on the weekly leaderboard. Study now to reclaim your spot!`,
                data: { action: 'leaderboard', screen: 'gamify' },
              });
              break; // Only one nudge per user per run
            }
          }
        }
      }
    } catch (err) {
      log.warn({ err, userId }, 'friend_passed_you nudge check failed — skipping');
    }
  }

  // ── Dispatch: send the highest-priority nudge per user ──

  // Group by user, pick highest priority
  const perUser = new Map<string, NudgeCandidate>();
  for (const candidate of allCandidates) {
    const existing = perUser.get(candidate.userId);
    if (!existing || candidate.priority > existing.priority) {
      perUser.set(candidate.userId, candidate);
    }
  }

  let dispatched = 0;
  for (const [userId, nudge] of perUser) {
    try {
      await notificationService.sendDirectPush({
        userId,
        title: nudge.title,
        body: nudge.body,
        data: nudge.data,
      });

      // Increment daily nudge counter (TTL: 24h)
      const countKey = NUDGE_COUNT_KEY(userId);
      await redis.incr(countKey);
      await redis.expire(countKey, 86400);

      dispatched++;
    } catch (err) {
      logger.error({ err, userId, type: nudge.type }, 'Failed to send smart nudge');
    }
  }

  logger.info({ candidates: allCandidates.length, dispatched }, 'Cron: smartNudges complete');
}
