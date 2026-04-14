// ─── Realtime Service (Redis Pub/Sub + EventEmitter Fan-Out) ─
// Publishes events to Redis channels and fans out to all active
// SSE connections via a local EventEmitter.
//
// Key architectural choice: Redis Pub/Sub handles cross-process
// distribution; the EventEmitter handles per-process fan-out to
// individual SSE response streams. Each listener receives an
// `unsubscribe` function for deterministic cleanup on disconnect.

import { EventEmitter } from 'node:events';
import { Redis } from 'ioredis';
import { config } from '../config.js';
import { getRedisClient } from '../lib/database.js';
import { createServiceLogger } from '../lib/logger.js';

const log = createServiceLogger('RealtimeService');

// ─── Channels ───────────────────────────────────────────────

const CHANNELS = {
  SCORE_UPDATE: 'realtime:score_update',
  BADGE_AWARDED: 'realtime:badge_awarded',
  CHALLENGE_SCORE: 'realtime:challenge_score',
  CHALLENGE_LIFECYCLE: 'realtime:challenge_lifecycle',
} as const;

// ─── Internal EventEmitter (per-process fan-out) ────────────
// Each SSE connection registers a listener on this emitter.
// Redis Pub/Sub messages are received once and broadcast to all.

const emitter = new EventEmitter();
emitter.setMaxListeners(500); // Support up to 500 concurrent SSE connections

// Event names for the emitter (not Redis channels)
const EVENTS = {
  SCORE_UPDATE: 'event:score_update',
  BADGE_AWARDED: 'event:badge_awarded',
  CHALLENGE_SCORE: 'event:challenge_score',
  CHALLENGE_LIFECYCLE: 'event:challenge_lifecycle',
} as const;

// ─── Publisher (reuses main Redis client from database.ts) ──

function getPublisher(): Redis {
  return getRedisClient();
}

// ─── Subscriber ─────────────────────────────────────────────

let subscriber: Redis | null = null;
let subscriberConnected = false;

async function getSubscriber(): Promise<Redis> {
  if (!subscriber) {
    subscriber = new Redis(config.redis.url, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      retryStrategy: (times) => Math.min(times * 500, 5000),
      reconnectOnError: () => true,
    });
    subscriber.on('error', (err) => {
      log.error({ err: err.message }, 'subscriber error');
    });
  }
  if (!subscriberConnected) {
    await subscriber.connect();
    subscriberConnected = true;
  }
  return subscriber;
}

// ─── Channel Binding State ──────────────────────────────────
// Tracks which Redis channels have been subscribed to.
// Each channel is subscribed ONCE; the `message` handler fans
// out to all listeners via the EventEmitter.

const boundChannels = new Set<string>();

/**
 * Ensures a Redis Pub/Sub channel is subscribed exactly once.
 * When a message arrives, it is parsed and emitted on the local
 * EventEmitter for all registered listeners.
 */
async function ensureChannelBound(channel: string, eventName: string): Promise<void> {
  if (boundChannels.has(channel)) return;
  boundChannels.add(channel);

  const sub = await getSubscriber();
  await sub.subscribe(channel);
  sub.on('message', (ch, message) => {
    if (ch !== channel) return;
    try {
      const parsed = JSON.parse(message);
      emitter.emit(eventName, parsed);
    } catch {
      log.error({ channel }, 'failed to parse Pub/Sub message');
    }
  });
}

// ─── Public Types ───────────────────────────────────────────

export interface ScoreUpdateEvent {
  userId: string;
  newScore: number;
  delta: number;
  leaderboard: 'global' | 'weekly';
  timestamp: string;
}

export interface BadgeAwardedEvent {
  userId: string;
  badgeId: string;
  timestamp: string;
}

export interface ChallengeScoreEvent {
  challengeId: string;
  role: 'creator' | 'opponent';
  newScore: number;
}

export interface ChallengeLifecycleEvent {
  challengeId: string;
  event: 'accepted' | 'completed';
  winnerId?: string | null;
}

// ─── Publishers ─────────────────────────────────────────────

export async function publishScoreUpdate(
  userId: string,
  delta: number,
  newScore: number,
  leaderboard: 'global' | 'weekly' = 'global'
): Promise<void> {
  const event: ScoreUpdateEvent = {
    userId,
    newScore,
    delta,
    leaderboard,
    timestamp: new Date().toISOString(),
  };
  await getPublisher().publish(CHANNELS.SCORE_UPDATE, JSON.stringify(event));
}

export async function publishBadgeAwarded(userId: string, badgeId: string): Promise<void> {
  const event: BadgeAwardedEvent = {
    userId,
    badgeId,
    timestamp: new Date().toISOString(),
  };
  await getPublisher().publish(CHANNELS.BADGE_AWARDED, JSON.stringify(event));
}

export async function publishChallengeScore(event: ChallengeScoreEvent): Promise<void> {
  await getPublisher().publish(CHANNELS.CHALLENGE_SCORE, JSON.stringify(event));
}

export async function publishChallengeLifecycle(event: ChallengeLifecycleEvent): Promise<void> {
  await getPublisher().publish(CHANNELS.CHALLENGE_LIFECYCLE, JSON.stringify(event));
}

// ─── Subscribers (with unsubscribe support) ─────────────────
// Each function:
//   1. Ensures the Redis channel is bound (idempotent)
//   2. Registers the callback on the local EventEmitter
//   3. Returns an unsubscribe function that removes ONLY this listener
//
// This replaces the old singleton-callback pattern that only
// allowed a single listener per channel.

export function onScoreUpdate(
  callback: (event: ScoreUpdateEvent) => void,
): () => void {
  void ensureChannelBound(CHANNELS.SCORE_UPDATE, EVENTS.SCORE_UPDATE)
    .catch((err) => log.error({ err }, 'failed to bind SCORE_UPDATE channel'));
  emitter.on(EVENTS.SCORE_UPDATE, callback);
  return () => { emitter.removeListener(EVENTS.SCORE_UPDATE, callback); };
}

export function onBadgeAwarded(
  callback: (event: BadgeAwardedEvent) => void,
): () => void {
  void ensureChannelBound(CHANNELS.BADGE_AWARDED, EVENTS.BADGE_AWARDED)
    .catch((err) => log.error({ err }, 'failed to bind BADGE_AWARDED channel'));
  emitter.on(EVENTS.BADGE_AWARDED, callback);
  return () => { emitter.removeListener(EVENTS.BADGE_AWARDED, callback); };
}

export function onChallengeScore(
  callback: (event: ChallengeScoreEvent) => void,
): () => void {
  void ensureChannelBound(CHANNELS.CHALLENGE_SCORE, EVENTS.CHALLENGE_SCORE)
    .catch((err) => log.error({ err }, 'failed to bind CHALLENGE_SCORE channel'));
  emitter.on(EVENTS.CHALLENGE_SCORE, callback);
  return () => { emitter.removeListener(EVENTS.CHALLENGE_SCORE, callback); };
}

export function onChallengeLifecycle(
  callback: (event: ChallengeLifecycleEvent) => void,
): () => void {
  void ensureChannelBound(CHANNELS.CHALLENGE_LIFECYCLE, EVENTS.CHALLENGE_LIFECYCLE)
    .catch((err) => log.error({ err }, 'failed to bind CHALLENGE_LIFECYCLE channel'));
  emitter.on(EVENTS.CHALLENGE_LIFECYCLE, callback);
  return () => { emitter.removeListener(EVENTS.CHALLENGE_LIFECYCLE, callback); };
}

// ─── Cleanup ────────────────────────────────────────────────

export async function disconnectRealtime(): Promise<void> {
  // Remove all local listeners
  emitter.removeAllListeners();

  // Disconnect the Redis subscriber
  if (subscriber) {
    subscriber.disconnect();
    subscriber = null;
    subscriberConnected = false;
    boundChannels.clear();
  }
}
