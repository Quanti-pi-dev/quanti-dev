// ─── Challenge Service ──────────────────────────────────────
// Business logic for the full P2P challenge lifecycle:
// create → accept/decline/cancel → submit answers → finalize.
//
// Coin safety:
//   - Escrow:  spendCoins()  (atomic Lua — prevents double-spend)
//   - Payout:  creditCoins() (balance-only — no leaderboard inflation)
//   - Finalize: Lua CAS on 'finalized' field — prevents double-payout

import { challengeRepository } from '../repositories/challenge.repository.js';
import { gamificationRepository } from '../repositories/gamification.repository.js';
import { deckRepository } from '../repositories/content.repository.js';
import { getRedisClient, getPostgresPool } from '../lib/database.js';
import { notificationService } from './notification.service.js';
import { publishChallengeScore, publishChallengeLifecycle } from './realtime.service.js';
import { createServiceLogger } from '../lib/logger.js';
import type { Challenge, ChallengeDetail, AnswerResult, SubjectLevel } from '@kd/shared';

const log = createServiceLogger('ChallengeService');

// ─── Lua: Idempotent finalization guard ─────────────────────
// Atomically sets finalized=1 only if it is currently 0.
// Returns 1 if we won the race, 0 if another process already finalized.
const FINALIZE_GUARD_LUA = `
  local key = KEYS[1]
  local current = redis.call('HGET', key, 'finalized')
  if current == '1' then
    return 0
  end
  redis.call('HSET', key, 'finalized', '1')
  return 1
`;

// ─── Helpers ────────────────────────────────────────────────

function makeError(message: string, statusCode: number): Error {
  return Object.assign(new Error(message), { statusCode });
}

// ─── Service ────────────────────────────────────────────────

class ChallengeService {
  private get redis() {
    return getRedisClient();
  }

  private get pg() {
    return getPostgresPool();
  }

  // ═══════════════════════════════════════════════════════
  // CREATE CHALLENGE
  // ═══════════════════════════════════════════════════════

  async createChallenge(
    creatorFirebaseUid: string,
    input: {
      opponentId: string;   // PG UUID
      examId: string;
      subjectId: string;
      level: string;
      betAmount: number;
      durationSeconds: number;
    },
  ): Promise<Challenge> {
    // 1. Resolve creator's PG UUID
    const creatorId = await challengeRepository.resolveUserId(creatorFirebaseUid);
    if (!creatorId) throw makeError('User not found', 404);

    // 2. Verify opponent exists and is an accepted friend
    const relationship = await challengeRepository.findRelationship(creatorId, input.opponentId);
    if (!relationship || relationship.status !== 'accepted') {
      throw makeError('You can only challenge accepted friends', 403);
    }

    // 3. Verify no existing pending challenge between them
    const hasPending = await challengeRepository.existsPendingBetween(creatorId, input.opponentId);
    if (hasPending) {
      throw makeError('A challenge between you and this friend is already pending', 409);
    }

    // 4. Resolve deckId
    const deck = await deckRepository.findBySubjectAndLevel(input.subjectId, input.level as SubjectLevel);
    if (!deck) {
      throw makeError('No deck available for this Exam/Subject/Level combination', 400);
    }
    if (deck.cardCount < 5) {
      throw makeError('This deck has too few cards for a challenge (minimum 5)', 400);
    }

    // 5. Atomic coin escrow (SPEND_COINS_LUA)
    const { success } = await gamificationRepository.spendCoins(creatorFirebaseUid, input.betAmount);
    if (!success) {
      throw makeError('Insufficient coins', 400);
    }

    // 6. Record escrow transaction in PG ledger
    await this.recordCoinTx(creatorFirebaseUid, -input.betAmount, 'challenge_escrow', null);

    // 7. Insert challenge row
    const challenge = await challengeRepository.create({
      creatorId,
      opponentId: input.opponentId,
      deckId: deck.id,
      examId: input.examId,
      subjectId: input.subjectId,
      level: input.level,
      betAmount: input.betAmount,
      durationSeconds: input.durationSeconds,
    });

    // 8. Add to opponent's invite set in Redis (TTL 25h — slightly longer than PG expiry)
    await this.redis.sadd(`challenge_invites:${input.opponentId}`, challenge.id);
    await this.redis.expire(`challenge_invites:${input.opponentId}`, 25 * 60 * 60);

    // 9. Push notification → opponent
    const creatorName = await challengeRepository.resolveUserDisplayName(creatorId);
    void notificationService.handleEvent({
      type: 'challenge_received' as never,
      userId: input.opponentId,
      challengerName: creatorName,
    } as never).catch((err) => log.error({ err }, 'challenge invite push failed'));

    return challenge;
  }

  // ═══════════════════════════════════════════════════════
  // ACCEPT CHALLENGE
  // ═══════════════════════════════════════════════════════

  async acceptChallenge(challengeId: string, opponentFirebaseUid: string): Promise<Challenge> {
    const opponentId = await challengeRepository.resolveUserId(opponentFirebaseUid);
    if (!opponentId) throw makeError('User not found', 404);

    const challenge = await challengeRepository.findById(challengeId);
    if (!challenge) throw makeError('Challenge not found', 404);
    if (challenge.opponentId !== opponentId) {
      throw makeError('You are not the opponent for this challenge', 403);
    }
    if (challenge.status !== 'pending') {
      throw makeError('Challenge is no longer available', 409);
    }
    if (new Date(challenge.expiresAt) < new Date()) {
      throw makeError('Challenge invite has expired', 410);
    }

    // Escrow opponent's coins
    const { success } = await gamificationRepository.spendCoins(opponentFirebaseUid, challenge.betAmount);
    if (!success) {
      throw makeError('Insufficient coins to accept this challenge', 400);
    }
    await this.recordCoinTx(opponentFirebaseUid, -challenge.betAmount, 'challenge_escrow', challengeId);

    // Update PG status
    const now = new Date();
    await challengeRepository.updateStatus(challengeId, 'accepted', { startedAt: now });

    // Set up Redis active game hash
    const ttl = challenge.durationSeconds + 60; // extra 60s for finalization buffer
    const key = `active_challenge:${challengeId}`;
    await this.redis.hset(key, {
      creator_id: challenge.creatorId,
      opponent_id: challenge.opponentId,
      creator_score: '0',
      opponent_score: '0',
      duration_sec: String(challenge.durationSeconds),
      started_at: now.toISOString(),
      finalized: '0',
    });
    await this.redis.expire(key, ttl);

    // Remove from invite set
    await this.redis.srem(`challenge_invites:${opponentId}`, challengeId);

    // Publish lifecycle event
    void publishChallengeLifecycle({
      challengeId,
      event: 'accepted',
    }).catch((err) => log.error({ err }, 'challenge lifecycle publish failed'));

    // Push notification → creator
    const opponentName = await challengeRepository.resolveUserDisplayName(opponentId);
    void notificationService.handleEvent({
      type: 'challenge_accepted' as never,
      userId: challenge.creatorId,
      opponentName,
    } as never).catch((err) => log.error({ err }, 'challenge accepted push failed'));

    return { ...challenge, status: 'accepted', startedAt: now.toISOString() };
  }

  // ═══════════════════════════════════════════════════════
  // DECLINE CHALLENGE
  // ═══════════════════════════════════════════════════════

  async declineChallenge(challengeId: string, opponentFirebaseUid: string): Promise<void> {
    const opponentId = await challengeRepository.resolveUserId(opponentFirebaseUid);
    if (!opponentId) throw makeError('User not found', 404);

    const challenge = await challengeRepository.findById(challengeId);
    if (!challenge) throw makeError('Challenge not found', 404);
    if (challenge.opponentId !== opponentId) {
      throw makeError('You are not the opponent for this challenge', 403);
    }
    if (challenge.status !== 'pending') {
      throw makeError('Challenge is no longer pending', 409);
    }

    await challengeRepository.updateStatus(challengeId, 'declined');

    // Refund creator via creditCoins (balance-only, no leaderboard)
    // Need creator's firebase_uid for the coin key
    const creatorFirebaseUid = await this.resolveFirebaseUid(challenge.creatorId);
    if (creatorFirebaseUid) {
      await gamificationRepository.creditCoins(creatorFirebaseUid, challenge.betAmount);
      await this.recordCoinTx(creatorFirebaseUid, challenge.betAmount, 'challenge_refund_declined', challengeId);
    }

    // Cleanup Redis invite
    await this.redis.srem(`challenge_invites:${opponentId}`, challengeId);

    // Push notification → creator
    const opponentName = await challengeRepository.resolveUserDisplayName(opponentId);
    void notificationService.handleEvent({
      type: 'challenge_declined' as never,
      userId: challenge.creatorId,
      opponentName,
    } as never).catch((err) => log.error({ err }, 'challenge declined push failed'));
  }

  // ═══════════════════════════════════════════════════════
  // CANCEL CHALLENGE (creator only)
  // ═══════════════════════════════════════════════════════

  async cancelChallenge(challengeId: string, creatorFirebaseUid: string): Promise<void> {
    const creatorId = await challengeRepository.resolveUserId(creatorFirebaseUid);
    if (!creatorId) throw makeError('User not found', 404);

    const challenge = await challengeRepository.findById(challengeId);
    if (!challenge) throw makeError('Challenge not found', 404);
    if (challenge.creatorId !== creatorId) {
      throw makeError('Only the creator can cancel', 403);
    }
    if (challenge.status !== 'pending') {
      throw makeError('Challenge is no longer pending', 409);
    }

    await challengeRepository.updateStatus(challengeId, 'cancelled');

    // Refund creator
    await gamificationRepository.creditCoins(creatorFirebaseUid, challenge.betAmount);
    await this.recordCoinTx(creatorFirebaseUid, challenge.betAmount, 'challenge_refund_cancelled', challengeId);

    // Cleanup Redis invite
    await this.redis.srem(`challenge_invites:${challenge.opponentId}`, challengeId);
  }

  // ═══════════════════════════════════════════════════════
  // SUBMIT ANSWER (during live game)
  // ═══════════════════════════════════════════════════════

  async submitAnswer(
    challengeId: string,
    userFirebaseUid: string,
    isCorrect: boolean,
  ): Promise<AnswerResult> {
    const key = `active_challenge:${challengeId}`;
    const state = await this.redis.hgetall(key);

    if (!state || Object.keys(state).length === 0) {
      throw makeError('Challenge not found or already ended', 404);
    }

    // Determine role
    const userId = await challengeRepository.resolveUserId(userFirebaseUid);
    if (!userId) throw makeError('User not found', 404);

    let role: 'creator' | 'opponent';
    if (state['creator_id'] === userId) role = 'creator';
    else if (state['opponent_id'] === userId) role = 'opponent';
    else throw makeError('You are not a participant in this challenge', 403);

    // Check time
    const startedAt = new Date(state['started_at']!).getTime();
    const durationMs = parseInt(state['duration_sec']!, 10) * 1000;
    const elapsed = Date.now() - startedAt;
    if (elapsed >= durationMs) {
      throw makeError("Time's up!", 409);
    }

    // Increment score if correct
    const scoreField = role === 'creator' ? 'creator_score' : 'opponent_score';
    if (isCorrect) {
      await this.redis.hincrby(key, scoreField, 1);
    }

    // Read current scores
    const [creatorScore, opponentScore] = await Promise.all([
      this.redis.hget(key, 'creator_score'),
      this.redis.hget(key, 'opponent_score'),
    ]);

    const myScore = role === 'creator'
      ? parseInt(creatorScore ?? '0', 10)
      : parseInt(opponentScore ?? '0', 10);
    const theirScore = role === 'creator'
      ? parseInt(opponentScore ?? '0', 10)
      : parseInt(creatorScore ?? '0', 10);

    // Publish score update via Pub/Sub
    void publishChallengeScore({
      challengeId,
      role,
      newScore: myScore,
    }).catch(() => {});

    return {
      yourScore: myScore,
      opponentScore: theirScore,
      timeRemainingMs: Math.max(0, durationMs - elapsed),
    };
  }

  // ═══════════════════════════════════════════════════════
  // FINALIZE CHALLENGE
  // ═══════════════════════════════════════════════════════

  async finalizeChallenge(challengeId: string): Promise<void> {
    const key = `active_challenge:${challengeId}`;

    // Lua CAS: only the first finalizer proceeds
    const won = await this.redis.eval(FINALIZE_GUARD_LUA, 1, key) as number;
    if (won === 0) {
      log.info({ challengeId }, 'finalization skipped — already finalized by another process');
      return;
    }

    // Read final scores from Redis
    const state = await this.redis.hgetall(key);

    // If Redis state is gone (server restart), fall back to 0:0 → tie → refund
    const creatorScore = parseInt(state['creator_score'] ?? '0', 10);
    const opponentScore = parseInt(state['opponent_score'] ?? '0', 10);

    // Load challenge from PG for metadata
    const challenge = await challengeRepository.findById(challengeId);
    if (!challenge) {
      log.error({ challengeId }, 'challenge not found in PG during finalization');
      return;
    }

    const creatorFirebaseUid = await this.resolveFirebaseUid(challenge.creatorId);
    const opponentFirebaseUid = await this.resolveFirebaseUid(challenge.opponentId);

    if (!creatorFirebaseUid || !opponentFirebaseUid) {
      log.error({ challengeId }, 'could not resolve Firebase UIDs during finalization');
      return;
    }

    let winnerId: string | null = null;

    if (creatorScore > opponentScore) {
      // Creator wins — receives full pot
      winnerId = challenge.creatorId;
      await gamificationRepository.creditCoins(creatorFirebaseUid, challenge.betAmount * 2);
      await this.recordCoinTx(creatorFirebaseUid, challenge.betAmount * 2, 'challenge_won', challengeId);

      // Push notifications
      void notificationService.handleEvent({
        type: 'challenge_won' as never,
        userId: challenge.creatorId,
        coinsWon: challenge.betAmount * 2,
      } as never).catch(() => {});
      void notificationService.handleEvent({
        type: 'challenge_lost' as never,
        userId: challenge.opponentId,
      } as never).catch(() => {});

    } else if (opponentScore > creatorScore) {
      // Opponent wins
      winnerId = challenge.opponentId;
      await gamificationRepository.creditCoins(opponentFirebaseUid, challenge.betAmount * 2);
      await this.recordCoinTx(opponentFirebaseUid, challenge.betAmount * 2, 'challenge_won', challengeId);

      void notificationService.handleEvent({
        type: 'challenge_won' as never,
        userId: challenge.opponentId,
        coinsWon: challenge.betAmount * 2,
      } as never).catch(() => {});
      void notificationService.handleEvent({
        type: 'challenge_lost' as never,
        userId: challenge.creatorId,
      } as never).catch(() => {});

    } else {
      // Tie — refund both
      await gamificationRepository.creditCoins(creatorFirebaseUid, challenge.betAmount);
      await gamificationRepository.creditCoins(opponentFirebaseUid, challenge.betAmount);
      await this.recordCoinTx(creatorFirebaseUid, challenge.betAmount, 'challenge_refund_tie', challengeId);
      await this.recordCoinTx(opponentFirebaseUid, challenge.betAmount, 'challenge_refund_tie', challengeId);

      void notificationService.handleEvent({
        type: 'challenge_tie' as never,
        userId: challenge.creatorId,
      } as never).catch(() => {});
      void notificationService.handleEvent({
        type: 'challenge_tie' as never,
        userId: challenge.opponentId,
      } as never).catch(() => {});
    }

    // Persist final scores in PG
    await challengeRepository.setFinalScores(challengeId, creatorScore, opponentScore, winnerId);

    // Cleanup Redis state
    await this.redis.del(key);

    // Publish lifecycle event
    void publishChallengeLifecycle({
      challengeId,
      event: 'completed',
      winnerId,
    }).catch(() => {});

    log.info({ challengeId, creatorScore, opponentScore, winnerId }, 'challenge finalized');
  }

  // ═══════════════════════════════════════════════════════
  // GET STATE (for SSE initial frame & detail endpoint)
  // ═══════════════════════════════════════════════════════

  async getChallengeDetails(challengeId: string, userFirebaseUid: string): Promise<ChallengeDetail> {
    const userId = await challengeRepository.resolveUserId(userFirebaseUid);
    if (!userId) throw makeError('User not found', 404);

    const detail = await challengeRepository.findDetailById(challengeId);
    if (!detail) throw makeError('Challenge not found', 404);

    // Verify the requesting user is a participant
    if (detail.creatorId !== userId && detail.opponentId !== userId) {
      throw makeError('Not a participant in this challenge', 403);
    }

    // If active, merge with Redis live scores
    if (detail.status === 'accepted') {
      const key = `active_challenge:${challengeId}`;
      const state = await this.redis.hgetall(key);
      if (state && Object.keys(state).length > 0) {
        detail.creatorScore = parseInt(state['creator_score'] ?? '0', 10);
        detail.opponentScore = parseInt(state['opponent_score'] ?? '0', 10);
      }
    }

    return detail;
  }

  // ═══════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════

  /**
   * Record a coin transaction in the PostgreSQL audit ledger.
   * Non-critical: failures are logged but never block the main flow.
   */
  private async recordCoinTx(
    firebaseUid: string,
    amount: number,
    reason: string,
    referenceId: string | null,
  ): Promise<void> {
    try {
      await this.pg.query(
        `INSERT INTO coin_transactions (user_id, amount, reason, reference_id)
         SELECT id, $2, $3, $4 FROM users WHERE firebase_uid = $1`,
        [firebaseUid, amount, reason, referenceId],
      );
    } catch (err) {
      log.error({ firebaseUid, reason, err }, 'failed to record coin transaction');
    }
  }

  /** Resolve PG UUID → firebase_uid (for Redis coin keys). */
  private async resolveFirebaseUid(pgUserId: string): Promise<string | null> {
    const result = await this.pg.query(
      `SELECT firebase_uid FROM users WHERE id = $1`,
      [pgUserId],
    );
    return (result.rows[0]?.firebase_uid as string) ?? null;
  }
}

export const challengeService = new ChallengeService();
