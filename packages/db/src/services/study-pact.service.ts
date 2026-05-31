// ─── Study Pact Service ─────────────────────────────────────
// Social accountability contracts — the most powerful commitment
// device in behavioral psychology.
//
// Psychology: Cialdini's Commitment & Consistency — public
// commitments dramatically increase follow-through. Adding
// social accountability (peer witnesses) amplifies this further.
// People who make study pacts with friends study 2.3× more (Sacerdote 2001).
//
// How it works:
//   1. A user creates a pact with 2-5 friends
//   2. Each member commits to a daily study target (N cards/day)
//   3. The pact runs for a fixed duration (3, 7, or 14 days)
//   4. Members who meet the target earn bonus coins
//   5. Members who miss are surfaced in the group → social pressure
//   6. If all members succeed, everyone gets a shared bonus
//
// This creates both positive reinforcement (bonus) and social
// punishment (visibility) — a potent dual-incentive loop.

import { getRedisClient, getPostgresPool } from '../clients/database.js';
import { challengeRepository } from '../repositories/challenge.repository.js';
import { gamificationRepository } from '../repositories/gamification.repository.js';
import { notificationService } from './notification.service.js';
import { createServiceLogger } from '../lib/logger.js';

const log = createServiceLogger('StudyPactService');

// ─── Types ──────────────────────────────────────────────────

export type PactDuration = 3 | 7 | 14;
export type PactStatus = 'active' | 'completed' | 'failed';
export type MemberStatus = 'active' | 'met_today' | 'missed_today';

export interface StudyPact {
  id: string;
  /** Creator's firebase_uid */
  creatorId: string;
  /** Human-readable pact name */
  name: string;
  /** Daily target: minimum cards each member must study */
  dailyTarget: number;
  /** Duration in days */
  durationDays: PactDuration;
  /** ISO date when the pact started */
  startDate: string;
  /** ISO date when the pact ends */
  endDate: string;
  /** Current pact status */
  status: PactStatus;
  /** Bonus coins for completing the pact (per member) */
  completionBonus: number;
  /** Shared bonus if ALL members complete (split equally) */
  perfectBonus: number;
  /** Members and their progress */
  members: PactMember[];
  createdAt: string;
}

export interface PactMember {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  /** Days the member has met the target */
  daysCompleted: number;
  /** Total days in the pact so far */
  totalDays: number;
  /** Today's card count */
  todayCards: number;
  /** Whether they met today's target */
  metToday: boolean;
  /** Completion percentage (0-100) */
  completionRate: number;
}

export interface CreatePactInput {
  name: string;
  dailyTarget: number;
  durationDays: PactDuration;
  memberFirebaseUids: string[]; // Friends to invite
}

// ─── Bonus Config ───────────────────────────────────────────

const BONUS_PER_DAY: Record<PactDuration, number> = {
  3: 5,   // 3-day pact: 15 bonus coins
  7: 3,   // 7-day pact: 21 bonus coins
  14: 2,  // 14-day pact: 28 bonus coins
};

const PERFECT_BONUS: Record<PactDuration, number> = {
  3: 20,   // Everyone completes 3 days: 20 bonus each
  7: 50,   // Everyone completes 7 days: 50 bonus each
  14: 100, // Everyone completes 14 days: 100 bonus each
};

// ─── Study Pact Service ─────────────────────────────────────

class StudyPactService {
  private get redis() {
    return getRedisClient();
  }

  private get pg() {
    return getPostgresPool();
  }

  // ─── Create a Study Pact ──────────────────────────────────

  async createPact(
    creatorFirebaseUid: string,
    input: CreatePactInput,
  ): Promise<StudyPact> {
    const creatorPgId = await challengeRepository.resolveUserId(creatorFirebaseUid);
    if (!creatorPgId) throw Object.assign(new Error('User not found'), { statusCode: 404 });

    // Validate: members must be friends
    const friends = await challengeRepository.listFriends(creatorPgId);
    const friendUids = new Set(friends.map(f => f.firebaseUid));

    for (const uid of input.memberFirebaseUids) {
      if (uid === creatorFirebaseUid) continue;
      if (!friendUids.has(uid)) {
        throw Object.assign(new Error('All pact members must be friends'), { statusCode: 400 });
      }
    }

    // Validate: 2-5 total members (including creator)
    const allMembers = [creatorFirebaseUid, ...input.memberFirebaseUids.filter(uid => uid !== creatorFirebaseUid)];
    if (allMembers.length < 2 || allMembers.length > 5) {
      throw Object.assign(new Error('Pacts require 2-5 members'), { statusCode: 400 });
    }

    // Validate: no overlapping active pacts
    for (const uid of allMembers) {
      const activePact = await this.getActivePactForUser(uid);
      if (activePact) {
        const name = uid === creatorFirebaseUid ? 'You' : 'A member';
        throw Object.assign(
          new Error(`${name} already has an active study pact`),
          { statusCode: 409 },
        );
      }
    }

    const startDate = new Date().toISOString().slice(0, 10);
    const endDate = new Date(Date.now() + input.durationDays * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 10);

    // Create in PostgreSQL
    const result = await this.pg.query(
      `INSERT INTO study_pacts
        (creator_id, name, daily_target, duration_days, start_date, end_date,
         completion_bonus, perfect_bonus)
       VALUES (
         (SELECT id FROM users WHERE firebase_uid = $1),
         $2, $3, $4, $5, $6, $7, $8
       )
       RETURNING id, created_at`,
      [
        creatorFirebaseUid,
        input.name,
        input.dailyTarget,
        input.durationDays,
        startDate,
        endDate,
        input.durationDays * BONUS_PER_DAY[input.durationDays],
        PERFECT_BONUS[input.durationDays],
      ],
    );

    const pactId = result.rows[0].id as string;

    // Add members
    for (const uid of allMembers) {
      await this.pg.query(
        `INSERT INTO study_pact_members (pact_id, user_id)
         SELECT $1, id FROM users WHERE firebase_uid = $2`,
        [pactId, uid],
      );
    }

    // Track in Redis for fast lookups
    for (const uid of allMembers) {
      await this.redis.set(`active_pact:${uid}`, pactId, 'EX', input.durationDays * 86400 + 3600);
    }

    // Notify invited members (non-blocking)
    const creatorName = await challengeRepository.resolveUserDisplayName(creatorPgId);
    for (const uid of allMembers) {
      if (uid === creatorFirebaseUid) continue;
      void notificationService.sendDirectPush({
        userId: uid,
        title: '📋 Study Pact Invitation!',
        body: `${creatorName} started a study pact: "${input.name}" — ${input.dailyTarget} cards/day for ${input.durationDays} days. You're in!`,
        data: { action: 'study_pact', pactId },
      }).catch(() => {});
    }

    log.info({ pactId, creator: creatorFirebaseUid, members: allMembers.length }, 'Study pact created');

    return this.getPact(pactId);
  }

  // ─── Get Pact Details ─────────────────────────────────────

  async getPact(pactId: string): Promise<StudyPact> {
    const result = await this.pg.query(
      `SELECT sp.id, sp.name, sp.daily_target, sp.duration_days,
              sp.start_date, sp.end_date, sp.status,
              sp.completion_bonus, sp.perfect_bonus, sp.created_at,
              u.firebase_uid AS creator_id
       FROM study_pacts sp
       JOIN users u ON u.id = sp.creator_id
       WHERE sp.id = $1`,
      [pactId],
    );

    if (result.rows.length === 0) {
      throw Object.assign(new Error('Pact not found'), { statusCode: 404 });
    }

    const row = result.rows[0];
    const members = await this.getPactMembers(pactId, row.daily_target as number);

    return {
      id: row.id as string,
      creatorId: row.creator_id as string,
      name: row.name as string,
      dailyTarget: row.daily_target as number,
      durationDays: row.duration_days as PactDuration,
      startDate: (row.start_date as Date).toISOString().slice(0, 10),
      endDate: (row.end_date as Date).toISOString().slice(0, 10),
      status: row.status as PactStatus,
      completionBonus: row.completion_bonus as number,
      perfectBonus: row.perfect_bonus as number,
      members,
      createdAt: (row.created_at as Date).toISOString(),
    };
  }

  // ─── Get Active Pact for User ─────────────────────────────

  async getActivePactForUser(firebaseUid: string): Promise<StudyPact | null> {
    const pactId = await this.redis.get(`active_pact:${firebaseUid}`);
    if (!pactId) return null;

    try {
      return await this.getPact(pactId);
    } catch {
      // Pact was deleted or expired, clean up Redis
      await this.redis.del(`active_pact:${firebaseUid}`);
      return null;
    }
  }

  // ─── Record Daily Progress ────────────────────────────────

  /**
   * Called from study session tracking to update a member's daily card count.
   * Fires social accountability notifications when a member meets their target.
   */
  async recordStudyProgress(firebaseUid: string, cardsStudied: number): Promise<void> {
    const pactId = await this.redis.get(`active_pact:${firebaseUid}`);
    if (!pactId) return;

    const today = new Date().toISOString().slice(0, 10);
    const progressKey = `pact_progress:${pactId}:${firebaseUid}:${today}`;

    // Increment today's count
    const newCount = await this.redis.incrby(progressKey, cardsStudied);
    await this.redis.expire(progressKey, 86400 * 2); // 2-day retention

    // Check if the user just met their target
    const dailyTarget = await this.getDailyTarget(pactId);
    const previousCount = newCount - cardsStudied;

    if (previousCount < dailyTarget && newCount >= dailyTarget) {
      // Just crossed the threshold! Track the day
      const daysKey = `pact_days_met:${pactId}:${firebaseUid}`;
      await this.redis.incr(daysKey);
      await this.redis.expire(daysKey, 86400 * 30);

      // Notify group members (social proof + accountability)
      const members = await this.getPactMemberUids(pactId);
      const userName = await this.resolveDisplayName(firebaseUid);

      for (const memberUid of members) {
        if (memberUid === firebaseUid) continue;
        void notificationService.sendDirectPush({
          userId: memberUid,
          title: '✅ Pact Progress!',
          body: `${userName} hit today's ${dailyTarget}-card target! Have you?`,
          data: { action: 'study_pact', pactId },
        }).catch(() => {});
      }
    }
  }

  // ─── Evaluate Pact Completion (called by cron) ────────────

  /**
   * Check all active pacts and evaluate:
   * 1. Members who missed yesterday's target → shame notifications
   * 2. Pacts that have reached their end date → settle rewards
   */
  async evaluateActivePacts(): Promise<void> {
    const result = await this.pg.query(
      `SELECT id, daily_target, duration_days, end_date,
              completion_bonus, perfect_bonus
       FROM study_pacts
       WHERE status = 'active'`,
    );

    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400 * 1000).toISOString().slice(0, 10);

    for (const row of result.rows) {
      const pactId = row.id as string;
      const endDate = (row.end_date as Date).toISOString().slice(0, 10);
      const dailyTarget = row.daily_target as number;

      try {
        if (today > endDate) {
          // Pact ended → settle rewards
          await this.settlePact(
            pactId,
            row.completion_bonus as number,
            row.perfect_bonus as number,
          );
        } else {
          // Check yesterday's progress → accountability notifications
          await this.checkYesterdayProgress(pactId, dailyTarget, yesterday);
        }
      } catch (err) {
        log.error({ err, pactId }, 'Failed to evaluate pact');
      }
    }
  }

  // ─── Settle a Completed Pact ──────────────────────────────

  private async settlePact(
    pactId: string,
    completionBonus: number,
    perfectBonus: number,
  ): Promise<void> {
    const members = await this.getPactMemberUids(pactId);

    // Get the duration to calculate expected days
    const pactResult = await this.pg.query(
      `SELECT duration_days FROM study_pacts WHERE id = $1`, [pactId],
    );
    const durationDays = pactResult.rows[0]?.duration_days as number ?? 7;

    let allCompleted = true;

    for (const uid of members) {
      const daysKey = `pact_days_met:${pactId}:${uid}`;
      const daysMet = parseInt(await this.redis.get(daysKey) ?? '0', 10);
      const completionRate = daysMet / durationDays;

      if (completionRate >= 0.8) {
        // Member completed (80%+ days met) → award bonus
        const bonus = Math.round(completionBonus * completionRate);
        await gamificationRepository.earnCoins(uid, bonus, 'study_pact_bonus');

        void notificationService.sendDirectPush({
          userId: uid,
          title: '🎉 Pact Complete!',
          body: `You earned ${bonus} bonus coins for completing the study pact! (${daysMet}/${durationDays} days)`,
          data: { action: 'study_pact', pactId },
        }).catch(() => {});
      } else {
        allCompleted = false;
      }

      // Clean up Redis
      await this.redis.del(`active_pact:${uid}`);
      await this.redis.del(daysKey);
    }

    // Perfect bonus: everyone met 100% → extra reward for each member
    if (allCompleted) {
      for (const uid of members) {
        await gamificationRepository.earnCoins(uid, perfectBonus, 'study_pact_perfect');
        void notificationService.sendDirectPush({
          userId: uid,
          title: '🏆 PERFECT PACT!',
          body: `Your entire group completed every day! ${perfectBonus} bonus coins for the perfect streak!`,
          data: { action: 'study_pact', pactId },
        }).catch(() => {});
      }
    }

    // Mark pact as completed
    await this.pg.query(
      `UPDATE study_pacts SET status = 'completed', updated_at = NOW() WHERE id = $1`,
      [pactId],
    );

    log.info({ pactId, allCompleted, memberCount: members.length }, 'Study pact settled');
  }

  // ─── Yesterday's Progress Check ───────────────────────────

  private async checkYesterdayProgress(
    pactId: string,
    dailyTarget: number,
    yesterday: string,
  ): Promise<void> {
    const members = await this.getPactMemberUids(pactId);

    for (const uid of members) {
      const progressKey = `pact_progress:${pactId}:${uid}:${yesterday}`;
      const count = parseInt(await this.redis.get(progressKey) ?? '0', 10);

      if (count < dailyTarget) {
        // Member missed yesterday → notify group (social accountability)
        const userName = await this.resolveDisplayName(uid);

        for (const otherUid of members) {
          if (otherUid === uid) continue;
          void notificationService.sendDirectPush({
            userId: otherUid,
            title: '⚠️ Pact Member Missed!',
            body: `${userName} missed yesterday's target (${count}/${dailyTarget} cards). Send them encouragement!`,
            data: { action: 'study_pact', pactId },
          }).catch(() => {});
        }

        // Also nudge the person who missed
        void notificationService.sendDirectPush({
          userId: uid,
          title: '📉 You missed yesterday!',
          body: `You studied ${count}/${dailyTarget} cards. Your pact members are counting on you today!`,
          data: { action: 'study', screen: 'study' },
        }).catch(() => {});
      }
    }
  }

  // ─── Helpers ──────────────────────────────────────────────

  private async getPactMembers(pactId: string, dailyTarget: number): Promise<PactMember[]> {
    const result = await this.pg.query(
      `SELECT u.firebase_uid, u.display_name, u.avatar_url,
              sp.duration_days
       FROM study_pact_members spm
       JOIN users u ON u.id = spm.user_id
       JOIN study_pacts sp ON sp.id = spm.pact_id
       WHERE spm.pact_id = $1`,
      [pactId],
    );

    const today = new Date().toISOString().slice(0, 10);
    const members: PactMember[] = [];

    for (const row of result.rows) {
      const uid = row.firebase_uid as string;
      const durationDays = row.duration_days as number;

      // Today's progress
      const todayKey = `pact_progress:${pactId}:${uid}:${today}`;
      const todayCards = parseInt(await this.redis.get(todayKey) ?? '0', 10);

      // Days completed
      const daysKey = `pact_days_met:${pactId}:${uid}`;
      const daysCompleted = parseInt(await this.redis.get(daysKey) ?? '0', 10);

      // How many days have elapsed?
      const startResult = await this.pg.query(
        `SELECT start_date FROM study_pacts WHERE id = $1`, [pactId],
      );
      const startDate = new Date(startResult.rows[0]?.start_date as Date);
      const totalDays = Math.min(
        Math.floor((Date.now() - startDate.getTime()) / 86400000) + 1,
        durationDays,
      );

      members.push({
        userId: uid,
        displayName: row.display_name as string,
        avatarUrl: row.avatar_url as string | null,
        daysCompleted,
        totalDays,
        todayCards,
        metToday: todayCards >= dailyTarget,
        completionRate: totalDays > 0 ? Math.round((daysCompleted / totalDays) * 100) : 0,
      });
    }

    return members;
  }

  private async getPactMemberUids(pactId: string): Promise<string[]> {
    const result = await this.pg.query(
      `SELECT u.firebase_uid
       FROM study_pact_members spm
       JOIN users u ON u.id = spm.user_id
       WHERE spm.pact_id = $1`,
      [pactId],
    );
    return result.rows.map(r => r.firebase_uid as string);
  }

  private async getDailyTarget(pactId: string): Promise<number> {
    const result = await this.pg.query(
      `SELECT daily_target FROM study_pacts WHERE id = $1`, [pactId],
    );
    return (result.rows[0]?.daily_target as number) ?? 10;
  }

  private async resolveDisplayName(firebaseUid: string): Promise<string> {
    const pgId = await challengeRepository.resolveUserId(firebaseUid);
    if (!pgId) return 'A friend';
    return challengeRepository.resolveUserDisplayName(pgId);
  }
}

export const studyPactService = new StudyPactService();
