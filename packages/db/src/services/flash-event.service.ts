// ─── Flash Events Service ───────────────────────────────────
// Time-limited bonus events that create urgency and scarcity.
//
// Psychology: Scarcity Principle (Cialdini) — resources perceived
// as scarce are valued more highly. Time-limited 2x coin events
// create urgency that drives immediate study sessions.
//
// Also leverages the "Fear of Missing Out" (FOMO) — knowing that
// a bonus window is closing creates an itch to act NOW.
//
// Flash event types:
//   1. Subject Boost   — "2x coins on Chemistry for 2 hours!"
//   2. Global Boost    — "Double coins on everything for 1 hour!"
//   3. Speed Challenge  — "Answer 10 questions in 5 min → 50 bonus coins"
//   4. Community Goal   — "Platform collectively answers 10K → everyone gets 20 coins"

import { getRedisClient, getPostgresPool } from '../clients/database.js';
import { notificationService } from './notification.service.js';
import { createServiceLogger } from '../lib/logger.js';

const log = createServiceLogger('FlashEventService');

// ─── Types ──────────────────────────────────────────────────

export type FlashEventType = 'subject_boost' | 'global_boost' | 'speed_challenge' | 'community_goal';
export type FlashEventStatus = 'scheduled' | 'active' | 'completed' | 'cancelled';

export interface FlashEvent {
  id: string;
  type: FlashEventType;
  /** Human-readable event name */
  name: string;
  /** Description with emoji */
  description: string;
  /** Coin multiplier (for boost types) */
  multiplier: number;
  /** ISO timestamp when the event starts */
  startsAt: string;
  /** ISO timestamp when the event ends */
  endsAt: string;
  /** Current status */
  status: FlashEventStatus;
  /** Optional: restrict to a specific subject */
  subjectId: string | null;
  /** For community goals: progress toward target */
  communityProgress?: number;
  communityTarget?: number;
}

export interface CreateFlashEventInput {
  type: FlashEventType;
  name: string;
  description: string;
  multiplier: number;
  durationMinutes: number;
  delayMinutes?: number; // Schedule for later (0 = start now)
  subjectId?: string;
  communityTarget?: number;
}

// ─── Redis Key Patterns ─────────────────────────────────────

const ACTIVE_EVENTS_KEY = 'flash_events:active';
const EVENT_DATA_KEY = (id: string) => `flash_event:${id}`;
const COMMUNITY_COUNTER_KEY = (id: string) => `flash_community:${id}`;

// ─── Flash Event Service ────────────────────────────────────

class FlashEventService {
  private get redis() {
    return getRedisClient();
  }

  private get pg() {
    return getPostgresPool();
  }

  // ─── Create / Schedule a Flash Event ──────────────────────

  /**
   * Create a new flash event. Can start immediately or be scheduled.
   * Called by admin routes to trigger real-time engagement campaigns.
   */
  async createEvent(input: CreateFlashEventInput): Promise<FlashEvent> {
    const now = Date.now();
    const delayMs = (input.delayMinutes ?? 0) * 60 * 1000;
    const startsAt = new Date(now + delayMs);
    const endsAt = new Date(startsAt.getTime() + input.durationMinutes * 60 * 1000);

    // Store in PostgreSQL for audit + admin dashboard
    const result = await this.pg.query(
      `INSERT INTO flash_events
        (type, name, description, multiplier, starts_at, ends_at,
         subject_id, community_target, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        input.type,
        input.name,
        input.description,
        input.multiplier,
        startsAt,
        endsAt,
        input.subjectId ?? null,
        input.communityTarget ?? null,
        delayMs === 0 ? 'active' : 'scheduled',
      ],
    );

    const eventId = result.rows[0].id as string;
    const event: FlashEvent = {
      id: eventId,
      type: input.type,
      name: input.name,
      description: input.description,
      multiplier: input.multiplier,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      status: delayMs === 0 ? 'active' : 'scheduled',
      subjectId: input.subjectId ?? null,
    };

    if (input.communityTarget) {
      event.communityProgress = 0;
      event.communityTarget = input.communityTarget;
    }

    // Store in Redis for fast lookups
    await this.redis.set(
      EVENT_DATA_KEY(eventId),
      JSON.stringify(event),
      'PX', endsAt.getTime() - now + 3600000, // Event TTL + 1hr buffer
    );

    if (delayMs === 0) {
      // Start immediately
      await this.activateEvent(event);
    }

    log.info({ eventId, type: input.type, startsAt, endsAt }, 'Flash event created');
    return event;
  }

  // ─── Activate a Flash Event ───────────────────────────────

  /**
   * Make an event active: set boost keys in Redis and notify users.
   */
  private async activateEvent(event: FlashEvent): Promise<void> {
    const ttlMs = new Date(event.endsAt).getTime() - Date.now();
    if (ttlMs <= 0) return;

    const ttlSeconds = Math.ceil(ttlMs / 1000);

    // Add to active events set
    await this.redis.zadd(ACTIVE_EVENTS_KEY, Date.now(), event.id);

    // For boost types: set the global boost key that variable-reward checks
    if (event.type === 'global_boost' || event.type === 'subject_boost') {
      // Set the global flash event key (per-user overrides happen in checkActiveBoost)
      await this.redis.set(
        `flash_event_global:${event.id}`,
        JSON.stringify({
          multiplier: event.multiplier,
          subjectId: event.subjectId,
        }),
        'EX', ttlSeconds,
      );
    }

    // Push notification to all active users
    void this.broadcastEventNotification(event).catch(() => {});
  }

  // ─── Get Active Events ────────────────────────────────────

  /**
   * Returns all currently active flash events.
   * Called by the mobile home screen to display event banners.
   */
  async getActiveEvents(): Promise<FlashEvent[]> {
    // Get event IDs from sorted set
    const eventIds = await this.redis.zrangebyscore(ACTIVE_EVENTS_KEY, '-inf', '+inf');
    if (eventIds.length === 0) return [];

    const events: FlashEvent[] = [];
    const now = Date.now();

    for (const id of eventIds) {
      const data = await this.redis.get(EVENT_DATA_KEY(id));
      if (!data) continue;

      try {
        const event = JSON.parse(data) as FlashEvent;

        // Check if still active
        if (new Date(event.endsAt).getTime() < now) {
          // Expired — clean up
          await this.redis.zrem(ACTIVE_EVENTS_KEY, id);
          continue;
        }

        // Add community progress if applicable
        if (event.type === 'community_goal') {
          const progress = parseInt(
            await this.redis.get(COMMUNITY_COUNTER_KEY(id)) ?? '0', 10,
          );
          event.communityProgress = progress;
        }

        events.push(event);
      } catch {
        // Skip malformed entries
      }
    }

    return events;
  }

  // ─── Get Flash Boost for User ─────────────────────────────

  /**
   * Check if any active flash event grants a coin boost.
   * Called by the variable reward engine during coin drops.
   *
   * Returns the highest applicable multiplier.
   */
  async getFlashBoostMultiplier(
    userId: string,
    subjectId?: string,
  ): Promise<number> {
    const events = await this.getActiveEvents();
    let maxMultiplier = 1;

    for (const event of events) {
      if (event.type === 'global_boost') {
        maxMultiplier = Math.max(maxMultiplier, event.multiplier);
      } else if (event.type === 'subject_boost' && event.subjectId === subjectId) {
        maxMultiplier = Math.max(maxMultiplier, event.multiplier);
      }
    }

    // Also apply per-user flash boost key (from variable-reward service)
    const userBoost = parseFloat(
      await this.redis.get(`flash_event_boost:${userId}`) ?? '1',
    );
    maxMultiplier = Math.max(maxMultiplier, userBoost);

    return maxMultiplier;
  }

  // ─── Community Goal Progress ──────────────────────────────

  /**
   * Increment community goal progress when any user answers a question.
   * If the community target is reached, distribute rewards.
   */
  async incrementCommunityGoal(eventId: string): Promise<boolean> {
    const event = await this.redis.get(EVENT_DATA_KEY(eventId));
    if (!event) return false;

    const parsed = JSON.parse(event) as FlashEvent;
    if (parsed.type !== 'community_goal' || !parsed.communityTarget) return false;

    const newCount = await this.redis.incr(COMMUNITY_COUNTER_KEY(eventId));

    if (newCount === parsed.communityTarget) {
      // Goal reached! Distribute rewards
      await this.distributeCommunityReward(parsed);
      return true;
    }

    return false;
  }

  // ─── Distribute Community Rewards ─────────────────────────

  private async distributeCommunityReward(event: FlashEvent): Promise<void> {
    // Award coins to all users who studied during the event window
    const rewardCoins = 20; // Fixed community reward

    // Get all users who have had activity today
    const result = await this.pg.query(
      `SELECT DISTINCT u.firebase_uid
       FROM study_sessions ss
       JOIN users u ON u.id = ss.user_id
       WHERE ss.started_at >= $1`,
      [event.startsAt],
    );

    for (const row of result.rows) {
      const uid = row.firebase_uid as string;
      const { gamificationRepository: gr } = await import('../repositories/gamification.repository.js');
      await gr.earnCoins(uid, rewardCoins, 'community_goal');

      void notificationService.sendDirectPush({
        userId: uid,
        title: '🎊 Community Goal Reached!',
        body: `The community hit ${event.communityTarget?.toLocaleString()} answers! +${rewardCoins} bonus coins for everyone!`,
        data: { action: 'celebrate', eventId: event.id },
      }).catch(() => {});
    }

    // Mark event as completed
    await this.pg.query(
      `UPDATE flash_events SET status = 'completed', updated_at = NOW() WHERE id = $1`,
      [event.id],
    );

    log.info({ eventId: event.id, rewardedUsers: result.rows.length }, 'Community goal completed');
  }

  // ─── Event Lifecycle (Cron) ───────────────────────────────

  /**
   * Cron job: activate scheduled events and expire completed ones.
   */
  async processEventLifecycle(): Promise<void> {
    const now = new Date();

    // Activate scheduled events
    const scheduled = await this.pg.query(
      `SELECT id FROM flash_events
       WHERE status = 'scheduled' AND starts_at <= $1`,
      [now],
    );

    for (const row of scheduled.rows) {
      const eventId = row.id as string;
      const data = await this.redis.get(EVENT_DATA_KEY(eventId));
      if (data) {
        const event = JSON.parse(data) as FlashEvent;
        event.status = 'active';
        await this.redis.set(EVENT_DATA_KEY(eventId), JSON.stringify(event));
        await this.activateEvent(event);
        await this.pg.query(
          `UPDATE flash_events SET status = 'active' WHERE id = $1`,
          [eventId],
        );
      }
    }

    // Complete expired events
    const expired = await this.pg.query(
      `SELECT id FROM flash_events
       WHERE status = 'active' AND ends_at <= $1`,
      [now],
    );

    for (const row of expired.rows) {
      const eventId = row.id as string;
      await this.redis.zrem(ACTIVE_EVENTS_KEY, eventId);
      await this.pg.query(
        `UPDATE flash_events SET status = 'completed' WHERE id = $1`,
        [eventId],
      );
    }
  }

  // ─── Broadcast Notification ───────────────────────────────

  private async broadcastEventNotification(event: FlashEvent): Promise<void> {
    // Get all users with active FCM tokens (batch, capped at 500)
    const result = await this.pg.query(
      `SELECT firebase_uid FROM users
       WHERE fcm_token IS NOT NULL
       ORDER BY last_active_at DESC NULLS LAST
       LIMIT 500`,
    );

    const emojiMap: Record<FlashEventType, string> = {
      subject_boost: '⚡',
      global_boost: '🔥',
      speed_challenge: '🏃',
      community_goal: '🤝',
    };

    for (const row of result.rows) {
      void notificationService.sendDirectPush({
        userId: row.firebase_uid as string,
        title: `${emojiMap[event.type]} Flash Event: ${event.name}`,
        body: event.description,
        data: { action: 'flash_event', eventId: event.id },
      }).catch(() => {});
    }
  }
}

export const flashEventService = new FlashEventService();
