// ─── Social Activity Feed Service ───────────────────────────
// Records and queries friend milestones to power the FOMO feed.
//
// Psychology: Social Comparison Theory (Festinger, 1954) — people
// evaluate themselves by comparing to peers. A visible feed of
// friend achievements creates both motivation and fear of falling
// behind, driving users back to the app.
//
// Architecture: Redis sorted sets (score = timestamp) for O(1)
// writes and O(log N) time-range reads. PostgreSQL is used only
// for resolving friend lists and enriching user display names.
//
// Feed items auto-expire after 7 days to keep the feed fresh
// and prevent old achievements from diluting the FOMO signal.

import { getRedisClient, getPostgresPool } from '../clients/database.js';
import { challengeRepository } from '../repositories/challenge.repository.js';
import { notificationService } from './notification.service.js';
import { createServiceLogger } from '../lib/logger.js';

const log = createServiceLogger('FeedService');

// ─── Feed Event Types ───────────────────────────────────────

export type FeedEventType =
  | 'streak_milestone'     // Hit 3, 7, 14, 30, 60, 100-day streak
  | 'level_unlocked'       // Unlocked a new study level
  | 'challenge_won'        // Won a P2P challenge
  | 'perfect_session'      // 100% accuracy in a session
  | 'coins_legendary_drop' // Got a legendary coin drop
  | 'badge_earned'         // Earned a new badge
  | 'exam_readiness'       // Hit 80%+ exam readiness
  | 'comeback';            // Returned after 7+ days

export interface FeedEvent {
  /** Unique event ID */
  id: string;
  /** User who performed the achievement (firebase_uid) */
  actorId: string;
  /** Actor's display name */
  actorName: string;
  /** Actor's avatar URL */
  actorAvatarUrl: string | null;
  /** Event type */
  type: FeedEventType;
  /** Human-readable description */
  message: string;
  /** Additional metadata for deep-linking */
  metadata: Record<string, string>;
  /** ISO timestamp */
  timestamp: string;
}

// ─── Redis Key Patterns ─────────────────────────────────────

// Per-user outbox: all events from this user (fan-out source)
const USER_OUTBOX = (userId: string) => `feed_outbox:${userId}`;
// TTL for feed items: 7 days
const FEED_TTL_SECONDS = 7 * 24 * 60 * 60;
// Max items per user outbox (cap to prevent unbounded growth)
const MAX_OUTBOX_SIZE = 100;

// ─── Feed Service ───────────────────────────────────────────

class FeedService {
  private get redis() {
    return getRedisClient();
  }

  private get pg() {
    return getPostgresPool();
  }

  // ─── Publish a Feed Event ─────────────────────────────────

  /**
   * Record an achievement event and notify relevant friends.
   * Called from progress.routes.ts, challenge.service.ts, etc.
   *
   * 1. Writes to the actor's outbox (Redis sorted set)
   * 2. Looks up the actor's friend list
   * 3. Sends FOMO push notifications to friends
   */
  async publishEvent(
    actorFirebaseUid: string,
    type: FeedEventType,
    message: string,
    metadata: Record<string, string> = {},
  ): Promise<void> {
    try {
      const redis = this.redis;

      // Resolve actor's PG id + display name
      const actorPgId = await challengeRepository.resolveUserId(actorFirebaseUid);
      if (!actorPgId) return;

      const actorResult = await this.pg.query(
        `SELECT display_name, avatar_url FROM users WHERE id = $1`,
        [actorPgId],
      );
      const actorRow = actorResult.rows[0];
      const actorName = (actorRow?.display_name as string) ?? 'A friend';
      const actorAvatarUrl = (actorRow?.avatar_url as string | null) ?? null;

      const event: FeedEvent = {
        id: `${actorFirebaseUid}:${type}:${Date.now()}`,
        actorId: actorFirebaseUid,
        actorName,
        actorAvatarUrl,
        type,
        message,
        metadata,
        timestamp: new Date().toISOString(),
      };

      // Write to outbox (sorted set, score = timestamp ms)
      const outboxKey = USER_OUTBOX(actorFirebaseUid);
      await redis.zadd(outboxKey, Date.now(), JSON.stringify(event));
      await redis.expire(outboxKey, FEED_TTL_SECONDS);

      // Cap outbox size (remove oldest)
      const size = await redis.zcard(outboxKey);
      if (size > MAX_OUTBOX_SIZE) {
        await redis.zremrangebyrank(outboxKey, 0, size - MAX_OUTBOX_SIZE - 1);
      }

      // ── Fan-out: notify friends via push ──────────────────
      const friends = await challengeRepository.listFriends(actorPgId);
      if (friends.length === 0) return;

      // Fire FOMO notifications for high-impact events (non-blocking)
      const highImpactTypes: FeedEventType[] = [
        'streak_milestone', 'level_unlocked', 'challenge_won', 'coins_legendary_drop',
      ];

      if (highImpactTypes.includes(type)) {
        for (const friend of friends.slice(0, 20)) { // Cap at 20 friends
          void this.sendFriendFomoNotification(
            friend.firebaseUid,
            actorName,
            type,
            metadata,
          ).catch(() => {});
        }
      }

      log.debug({ actorId: actorFirebaseUid, type, friendCount: friends.length }, 'Feed event published');
    } catch (err) {
      log.error({ err, actorId: actorFirebaseUid, type }, 'Failed to publish feed event');
    }
  }

  // ─── Get Friend Feed ──────────────────────────────────────

  /**
   * Aggregates the activity feed for a user by reading their friends'
   * outboxes and merging them chronologically.
   *
   * Uses fan-out-on-read: reads each friend's outbox and merges.
   * This is optimal for our scale (< 500 friends per user).
   */
  async getFriendFeed(
    firebaseUid: string,
    limit: number = 20,
    before?: number,  // timestamp cursor for pagination
  ): Promise<{ events: FeedEvent[]; nextCursor: number | null }> {
    const actorPgId = await challengeRepository.resolveUserId(firebaseUid);
    if (!actorPgId) return { events: [], nextCursor: null };

    const friends = await challengeRepository.listFriends(actorPgId);
    if (friends.length === 0) return { events: [], nextCursor: null };

    const maxTs = before ?? Date.now();
    const minTs = Date.now() - FEED_TTL_SECONDS * 1000; // 7 days ago

    // Pipeline: read each friend's outbox in one round-trip
    const redis = this.redis;
    const pipeline = redis.pipeline();
    for (const friend of friends.slice(0, 50)) { // Cap at 50 friends
      pipeline.zrevrangebyscore(
        USER_OUTBOX(friend.firebaseUid),
        maxTs,
        minTs,
        'LIMIT', 0, limit,
      );
    }
    const results = await pipeline.exec();

    // Merge and sort all events chronologically
    const allEvents: FeedEvent[] = [];
    for (const [err, items] of (results ?? [])) {
      if (err || !items) continue;
      for (const raw of (items as string[])) {
        try {
          allEvents.push(JSON.parse(raw) as FeedEvent);
        } catch {
          // Skip malformed entries
        }
      }
    }

    // Sort descending by timestamp and take limit
    allEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const page = allEvents.slice(0, limit);

    const nextCursor = page.length === limit
      ? new Date(page[page.length - 1]!.timestamp).getTime() - 1
      : null;

    return { events: page, nextCursor };
  }

  // ─── Helper: Send Friend FOMO Notification ────────────────

  private async sendFriendFomoNotification(
    recipientFirebaseUid: string,
    actorName: string,
    type: FeedEventType,
    metadata: Record<string, string>,
  ): Promise<void> {
    switch (type) {
      case 'streak_milestone':
        await notificationService.handleEvent({
          type: 'friend_streak_milestone',
          userId: recipientFirebaseUid,
          friendName: actorName,
          streakDays: parseInt(metadata['streakDays'] ?? '0', 10),
        });
        break;

      case 'level_unlocked':
        await notificationService.handleEvent({
          type: 'friend_level_unlocked',
          userId: recipientFirebaseUid,
          friendName: actorName,
          levelName: metadata['levelName'] ?? 'a new level',
          subjectName: metadata['subjectName'] ?? 'a subject',
        });
        break;

      case 'challenge_won':
      case 'coins_legendary_drop':
        // Generic competitive nudge via direct push
        await notificationService.sendDirectPush({
          userId: recipientFirebaseUid,
          title: `🏆 ${actorName} is crushing it!`,
          body: type === 'challenge_won'
            ? `${actorName} just won a challenge. Think you can take them?`
            : `${actorName} just got a legendary coin drop! 🎰`,
          data: { action: 'study', screen: 'study' },
        });
        break;
    }
  }
}

export const feedService = new FeedService();
