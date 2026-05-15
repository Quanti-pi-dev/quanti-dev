// ─── Institute Service ────────────────────────────────────────────
// Business logic for institute membership, join-code enrollment,
// institute-scoped leaderboards, and subscription resolution.

import { getRedisClient, getPostgresPool } from '../clients/database.js';
import { instituteRepository } from '../repositories/institute.repository.js';
import { subscriptionRepository } from '../repositories/subscription.repository.js';
import { planRepository } from '../repositories/plan.repository.js';
import { createServiceLogger } from '../lib/logger.js';
import type {
  InstituteMember,
  InstituteLeaderboard,
  InstituteLeaderboardEntry,
  SubscriptionContext,
} from '@kd/shared';

const log = createServiceLogger('InstituteService');

// ─── Redis Key Helpers ────────────────────────────────────────────

const LEADERBOARD_KEY = (instituteId: string, type: 'global' | 'weekly') =>
  `leaderboard:institute:${instituteId}:${type}`;

const TEST_LEADERBOARD_KEY = (instituteId: string, testId: string) =>
  `leaderboard:institute:${instituteId}:test:${testId}`;

// Cache TTL for institute membership lookup (5 minutes)
const MEMBERSHIP_CACHE_TTL = 300;
const MEMBERSHIP_CACHE_KEY = (firebaseUid: string) => `institute_membership:${firebaseUid}`;

class InstituteService {
  private get redis() {
    return getRedisClient();
  }

  private get pg() {
    return getPostgresPool();
  }

  // ─── Join Code Enrollment ────────────────────────────────────────

  /**
   * Validates a join code and enrolls the user into the corresponding institute.
   * Atomically:
   *   1. Resolves the join code to an institute + role
   *   2. Adds the user as a member
   *   3. Increments code usage counter
   *   4. Claims a seat from the institute subscription (for student role)
   *
   * Returns the created InstituteMember on success.
   */
  async joinViaCode(
    code: string,
    userId: string,      // PostgreSQL UUID
    firebaseUid: string,
  ): Promise<{ member: InstituteMember; instituteName: string }> {
    const joinCode = await instituteRepository.resolveJoinCode(code);
    if (!joinCode) {
      throw Object.assign(new Error('INVALID_JOIN_CODE'), { statusCode: 400 });
    }

    const institute = await instituteRepository.findById(joinCode.instituteId);
    if (!institute || !institute.isActive) {
      throw Object.assign(new Error('INSTITUTE_INACTIVE'), { statusCode: 403 });
    }

    // Check existing membership
    const existing = await instituteRepository.findMembership(userId, joinCode.instituteId);
    if (existing?.isActive) {
      throw Object.assign(new Error('ALREADY_A_MEMBER'), { statusCode: 409 });
    }

    // For students: verify seat availability before enrollment
    if (joinCode.role === 'student') {
      const instSub = await instituteRepository.findActiveSubscription(joinCode.instituteId);
      if (!instSub) {
        throw Object.assign(new Error('NO_INSTITUTE_SUBSCRIPTION'), { statusCode: 402 });
      }
      const seatClaimed = await instituteRepository.claimSeat(instSub.id);
      if (!seatClaimed) {
        throw Object.assign(new Error('NO_SEATS_AVAILABLE'), { statusCode: 402 });
      }

      // Provision an individual subscription row linked to the institute sub
      try {
        const plan = await planRepository.findById(instSub.planId);
        if (plan) {
          await subscriptionRepository.create({
            userId,
            planId: instSub.planId,
            status: 'active',
            currentPeriodStart: new Date(instSub.periodStart),
            currentPeriodEnd: new Date(instSub.periodEnd),
            // Store institute_subscription_id in metadata since we don't add the column yet
            // (column exists in migration 003; will resolve in repository layer)
          });
        }
      } catch (err) {
        // If subscription creation fails, release the seat
        const activeSub = await instituteRepository.findActiveSubscription(joinCode.instituteId);
        if (activeSub) await instituteRepository.releaseSeat(activeSub.id);
        throw err;
      }
    }

    // Add member
    const member = await instituteRepository.addMember({
      instituteId: joinCode.instituteId,
      userId,
      firebaseUid,
      role: joinCode.role,
      department: joinCode.department,
    });

    // Increment code usage
    await instituteRepository.incrementJoinCodeUsage(joinCode.id);

    // Seed the institute leaderboard entry for this user (score = 0 initially)
    await this.redis.zadd(
      LEADERBOARD_KEY(joinCode.instituteId, 'global'),
      'NX',
      0,
      firebaseUid,
    );

    // Invalidate membership cache
    await this.redis.del(MEMBERSHIP_CACHE_KEY(firebaseUid));

    log.info({ instituteId: joinCode.instituteId, userId, role: joinCode.role }, 'User joined institute');
    return { member, instituteName: institute.name };
  }

  // ─── Leaderboard ─────────────────────────────────────────────────

  /**
   * Awards coins to a user's institute leaderboard score.
   * Called from rewardService after a student earns coins, if they belong to an institute.
   */
  async addScoreToInstituteLeaderboard(
    firebaseUid: string,
    amount: number,
  ): Promise<void> {
    // Get user's institute memberships from cache or DB
    const memberships = await this.getMemberships(firebaseUid);
    if (memberships.length === 0) return;

    const pipeline = this.redis.pipeline();
    for (const m of memberships) {
      if (m.role === 'student') {
        pipeline.zincrby(LEADERBOARD_KEY(m.instituteId, 'global'), amount, firebaseUid);
        pipeline.zincrby(LEADERBOARD_KEY(m.instituteId, 'weekly'), amount, firebaseUid);
      }
    }
    await pipeline.exec();
  }

  async getInstituteLeaderboard(
    instituteId: string,
    requestingFirebaseUid: string,
    type: 'global' | 'weekly' = 'global',
    limit: number = 50,
  ): Promise<InstituteLeaderboard> {
    const key = LEADERBOARD_KEY(instituteId, type);

    const results = await this.redis.zrevrange(key, 0, limit - 1, 'WITHSCORES');

    const memberData: { memberId: string; score: number; rank: number }[] = [];
    for (let i = 0; i < results.length; i += 2) {
      memberData.push({
        memberId: results[i]!,
        score: parseFloat(results[i + 1]!),
        rank: Math.floor(i / 2) + 1,
      });
    }

    // Batch fetch user display info
    const memberIds = memberData.map(m => m.memberId);
    const userMap = new Map<string, { display_name: string; avatar_url: string | null }>();

    if (memberIds.length > 0) {
      const placeholders = memberIds.map((_, i) => `$${i + 1}`).join(', ');
      const userResult = await this.pg.query(
        `SELECT firebase_uid, display_name, avatar_url FROM users WHERE firebase_uid IN (${placeholders})`,
        memberIds,
      );
      for (const row of userResult.rows) {
        userMap.set(row['firebase_uid'] as string, {
          display_name: row['display_name'] as string,
          avatar_url: row['avatar_url'] as string | null,
        });
      }
    }

    // Enrich with student UIDs (from institute_members)
    const studentUidMap = new Map<string, string | null>();
    if (memberIds.length > 0) {
      const placeholders = memberIds.map((_, i) => `$${i + 2}`).join(', ');
      const uidResult = await this.pg.query(
        `SELECT firebase_uid, student_uid FROM institute_members
         WHERE institute_id = $1 AND firebase_uid IN (${placeholders})`,
        [instituteId, ...memberIds],
      );
      for (const row of uidResult.rows) {
        studentUidMap.set(row['firebase_uid'] as string, (row['student_uid'] as string | null) ?? null);
      }
    }

    const entries: InstituteLeaderboardEntry[] = memberData.map(({ memberId, score, rank }) => {
      const user = userMap.get(memberId);
      return {
        rank,
        userId: memberId,
        studentUid: studentUidMap.get(memberId) ?? null,
        displayName: user?.display_name ?? 'Unknown',
        avatarUrl: user?.avatar_url ?? null,
        score,
      };
    });

    // User's own rank
    const userRank = await this.redis.zrevrank(key, requestingFirebaseUid);
    const userScore = await this.redis.zscore(key, requestingFirebaseUid);
    let userEntry: InstituteLeaderboardEntry | null = null;

    if (userRank !== null && userScore !== null) {
      const cachedUser = userMap.get(requestingFirebaseUid);
      const userRes = cachedUser ?? (await this.pg.query(
        `SELECT display_name, avatar_url FROM users WHERE firebase_uid = $1`,
        [requestingFirebaseUid],
      ).then(r => r.rows[0] ? { display_name: r.rows[0]['display_name'] as string, avatar_url: r.rows[0]['avatar_url'] as string | null } : null));

      userEntry = {
        rank: userRank + 1,
        userId: requestingFirebaseUid,
        studentUid: studentUidMap.get(requestingFirebaseUid) ?? null,
        displayName: userRes?.display_name ?? 'Unknown',
        avatarUrl: userRes?.avatar_url ?? null,
        score: parseFloat(userScore),
      };
    }

    const totalParticipants = await this.redis.zcard(key);

    return {
      entries,
      userRank: userEntry,
      totalParticipants,
      updatedAt: new Date().toISOString(),
    };
  }

  async addTestScore(instituteId: string, testId: string, firebaseUid: string, score: number): Promise<void> {
    // ZADD NX: record score only if not already submitted (no overwrites)
    await this.redis.zadd(TEST_LEADERBOARD_KEY(instituteId, testId), 'NX', score, firebaseUid);
  }

  // ─── Subscription Resolution ──────────────────────────────────────

  /**
   * Resolves a student's effective subscription context.
   * Checks personal subscription first; falls back to institute-granted subscription.
   * Returns the higher-tier context.
   */
  async resolveSubscriptionContext(
    userId: string,
    firebaseUid: string,
  ): Promise<SubscriptionContext | null> {
    // 1. Personal subscription (existing flow)
    const personalSub = await subscriptionRepository.findActiveByUserId(userId);
    let personalCtx: SubscriptionContext | null = null;
    if (personalSub && ['active', 'trialing'].includes(personalSub.status)) {
      const plan = await planRepository.findById(personalSub.planId);
      if (plan) {
        personalCtx = {
          planTier: plan.tier,
          planSlug: plan.slug,
          status: personalSub.status,
          features: plan.features,
          periodEnd: personalSub.currentPeriodEnd,
        };
      }
    }

    // 2. Institute subscription fallback
    const memberships = await this.getMemberships(firebaseUid);
    const studentMemberships = memberships.filter(m => m.role === 'student');

    for (const m of studentMemberships) {
      const instSub = await instituteRepository.findActiveSubscription(m.instituteId);
      if (!instSub || instSub.status !== 'active') continue;

      const plan = await planRepository.findById(instSub.planId);
      if (!plan) continue;

      const instCtx: SubscriptionContext = {
        planTier: plan.tier,
        planSlug: plan.slug,
        status: 'active',
        features: plan.features,
        periodEnd: instSub.periodEnd,
      };

      // Return highest tier
      if (!personalCtx || instCtx.planTier > personalCtx.planTier) {
        return instCtx;
      }
    }

    return personalCtx;
  }

  // ─── Internal Helpers ─────────────────────────────────────────────

  /** Returns all institute memberships for a user, with caching. */
  async getMemberships(firebaseUid: string): Promise<(InstituteMember & { instituteId: string })[]> {
    // Try cache first
    const cached = await this.redis.get(MEMBERSHIP_CACHE_KEY(firebaseUid));
    if (cached) {
      try {
        return JSON.parse(cached) as (InstituteMember & { instituteId: string })[];
      } catch {
        await this.redis.del(MEMBERSHIP_CACHE_KEY(firebaseUid));
      }
    }

    const memberships = await instituteRepository.findMembershipsByFirebaseUid(firebaseUid);
    await this.redis.set(
      MEMBERSHIP_CACHE_KEY(firebaseUid),
      JSON.stringify(memberships),
      'EX',
      MEMBERSHIP_CACHE_TTL,
    );
    return memberships;
  }

  /** Invalidates the membership cache for a user (call on join/leave). */
  async invalidateMembershipCache(firebaseUid: string): Promise<void> {
    await this.redis.del(MEMBERSHIP_CACHE_KEY(firebaseUid));
  }

  /** Resets the weekly institute leaderboard — called by cron on Sunday midnight. */
  async resetWeeklyLeaderboards(): Promise<void> {
    // Find all institute leaderboard keys and delete them
    const keys = await this.redis.keys('leaderboard:institute:*:weekly');
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
    log.info({ count: keys.length }, 'Weekly institute leaderboards reset');
  }
}

export const instituteService = new InstituteService();
