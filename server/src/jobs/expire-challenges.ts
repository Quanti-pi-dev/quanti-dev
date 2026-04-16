// ─── Cron: Challenge Expiration & Finalization ──────────────
// Two jobs:
//   1. expirePendingChallenges()    — every 5 minutes
//   2. finalizeAbandonedChallenges() — every 30 seconds
//
// Pattern: identical to expire-subscriptions.ts

import { challengeRepository } from '../repositories/challenge.repository.js';
import { challengeService } from '../services/challenge.service.js';
import { gamificationRepository } from '../repositories/gamification.repository.js';
import { getRedisClient, getPostgresPool } from '../lib/database.js';
import { createServiceLogger } from '../lib/logger.js';
import type { FastifyBaseLogger } from 'fastify';

const log = createServiceLogger('ChallengeWorker');

/**
 * Expires pending challenges that have passed their 24h invite window.
 * Refunds the creator's escrowed coins.
 * Run every 5 minutes.
 */
export async function expirePendingChallenges(logger: FastifyBaseLogger): Promise<void> {
  logger.info('Cron: expirePendingChallenges starting');

  const expired = await challengeRepository.findExpiredPending();
  let refunded = 0;

  for (const challenge of expired) {
    try {
      // Update status to expired
      await challengeRepository.updateStatus(challenge.id, 'expired');

      // Refund creator
      const creatorFirebaseUid = await resolveFirebaseUid(challenge.creatorId);
      if (creatorFirebaseUid) {
        await gamificationRepository.creditCoins(creatorFirebaseUid, challenge.betAmount);
        await recordCoinTx(creatorFirebaseUid, challenge.betAmount, 'challenge_refund_expired', challenge.id);
        refunded++;
      }

      // Cleanup Redis invite set
      const redis = getRedisClient();
      await redis.srem(`challenge_invites:${challenge.opponentId}`, challenge.id);

      logger.info({ challengeId: challenge.id }, 'Pending challenge expired — creator refunded');
    } catch (err) {
      logger.error({ challengeId: challenge.id, err }, 'failed to expire challenge');
    }
  }

  logger.info({ expired: expired.length, refunded }, 'Cron: expirePendingChallenges complete');
}

/**
 * Finalizes active challenges whose time has elapsed.
 * The Lua CAS guard inside finalizeChallenge() makes this idempotent.
 * Run every 30 seconds.
 */
export async function finalizeAbandonedChallenges(logger: FastifyBaseLogger): Promise<void> {
  const abandoned = await challengeRepository.findAbandonedActive();

  for (const challenge of abandoned) {
    try {
      await challengeService.finalizeChallenge(challenge.id);
      logger.info({ challengeId: challenge.id }, 'Abandoned challenge finalized');
    } catch (err) {
      logger.error({ challengeId: challenge.id, err }, 'failed to finalize abandoned challenge');
    }
  }

  if (abandoned.length > 0) {
    logger.info({ count: abandoned.length }, 'Cron: finalizeAbandonedChallenges complete');
  }
}

// ─── Helpers (duplicated to avoid circular import with challenge.service) ──

async function resolveFirebaseUid(pgUserId: string): Promise<string | null> {
  const pg = getPostgresPool();
  const result = await pg.query(`SELECT firebase_uid FROM users WHERE id = $1`, [pgUserId]);
  return (result.rows[0]?.firebase_uid as string) ?? null;
}

async function recordCoinTx(firebaseUid: string, amount: number, reason: string, referenceId: string | null): Promise<void> {
  try {
    const pg = getPostgresPool();
    await pg.query(
      `INSERT INTO coin_transactions (user_id, amount, reason, reference_id)
       VALUES ((SELECT id FROM users WHERE firebase_uid = $1), $2, $3, $4)`,
      [firebaseUid, amount, reason, referenceId],
    );
  } catch (err) {
    log.error({ firebaseUid, reason, err }, 'failed to record coin transaction in cron');
  }
}
