// ─── Challenge Repository ───────────────────────────────────
// PostgreSQL data access for challenges and friendships tables.
// Pattern: singleton class, identical to gamification.repository.ts.

import { getPostgresPool } from '../lib/database.js';
import type {
  Challenge,
  ChallengeStatus,
  Friendship,
  FriendshipStatus,
  UserSummary,
  ChallengeDetail,
} from '@kd/shared';

// H3 fix: Escape ILIKE wildcards to prevent pattern injection
function escapeIlike(str: string): string {
  return str.replace(/[%_\\]/g, '\\$&');
}

// ─── Row → Interface mappers ────────────────────────────────

function rowToChallenge(row: Record<string, unknown>): Challenge {
  return {
    id: row.id as string,
    creatorId: row.creator_id as string,
    opponentId: row.opponent_id as string,
    deckId: row.deck_id as string,
    examId: row.exam_id as string,
    subjectId: row.subject_id as string,
    level: row.level as string,
    betAmount: row.bet_amount as number,
    durationSeconds: row.duration_seconds as number,
    status: row.status as ChallengeStatus,
    creatorScore: row.creator_score as number,
    opponentScore: row.opponent_score as number,
    winnerId: (row.winner_id as string | null) ?? null,
    startedAt: row.started_at ? (row.started_at as Date).toISOString() : null,
    endedAt: row.ended_at ? (row.ended_at as Date).toISOString() : null,
    expiresAt: (row.expires_at as Date).toISOString(),
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

function rowToFriendship(row: Record<string, unknown>): Friendship {
  return {
    id: row.id as string,
    requesterId: row.requester_id as string,
    addresseeId: row.addressee_id as string,
    status: row.status as FriendshipStatus,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

function rowToUserSummary(row: Record<string, unknown>): UserSummary {
  return {
    id: row.id as string,
    firebaseUid: row.firebase_uid as string,
    displayName: row.display_name as string,
    avatarUrl: (row.avatar_url as string | null) ?? null,
    enrollmentId: row.enrollment_id as string,
  };
}

// ─── Repository ─────────────────────────────────────────────

class ChallengeRepository {
  private get pg() {
    return getPostgresPool();
  }

  // ═══════════════════════════════════════════════════════
  // CHALLENGES
  // ═══════════════════════════════════════════════════════

  async create(input: {
    creatorId: string;    // PG UUID (from users.id)
    opponentId: string;   // PG UUID
    deckId: string;
    examId: string;
    subjectId: string;
    level: string;
    betAmount: number;
    durationSeconds: number;
  }): Promise<Challenge> {
    const result = await this.pg.query(
      `INSERT INTO challenges
        (creator_id, opponent_id, deck_id, exam_id, subject_id, level,
         bet_amount, duration_seconds, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW() + INTERVAL '24 hours')
       RETURNING *`,
      [
        input.creatorId, input.opponentId, input.deckId, input.examId,
        input.subjectId, input.level, input.betAmount, input.durationSeconds,
      ],
    );
    return rowToChallenge(result.rows[0]);
  }

  async findById(id: string): Promise<Challenge | null> {
    const result = await this.pg.query(
      `SELECT * FROM challenges WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return null;
    return rowToChallenge(result.rows[0]);
  }

  async findDetailById(id: string): Promise<ChallengeDetail | null> {
    const result = await this.pg.query(
      `SELECT c.*,
              creator.display_name AS creator_name,
              opponent.display_name AS opponent_name
       FROM challenges c
       JOIN users creator  ON creator.id  = c.creator_id
       JOIN users opponent ON opponent.id = c.opponent_id
       WHERE c.id = $1`,
      [id],
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      ...rowToChallenge(row),
      creatorName: row.creator_name as string,
      opponentName: row.opponent_name as string,
    };
  }

  async findPendingForOpponent(opponentId: string): Promise<ChallengeDetail[]> {
    const result = await this.pg.query(
      `SELECT c.*,
              creator.display_name AS creator_name,
              opponent.display_name AS opponent_name
       FROM challenges c
       JOIN users creator  ON creator.id  = c.creator_id
       JOIN users opponent ON opponent.id = c.opponent_id
       WHERE c.opponent_id = $1 AND c.status = 'pending' AND c.expires_at > NOW()
       ORDER BY c.created_at DESC`,
      [opponentId],
    );
    return result.rows.map((row: Record<string, unknown>) => ({
      ...rowToChallenge(row),
      creatorName: row.creator_name as string,
      opponentName: row.opponent_name as string,
    }));
  }

  async findActiveForUser(userId: string): Promise<ChallengeDetail | null> {
    const result = await this.pg.query(
      `SELECT c.*,
              creator.display_name AS creator_name,
              opponent.display_name AS opponent_name
       FROM challenges c
       JOIN users creator  ON creator.id  = c.creator_id
       JOIN users opponent ON opponent.id = c.opponent_id
       WHERE (c.creator_id = $1 OR c.opponent_id = $1)
         AND c.status = 'accepted'
       LIMIT 1`,
      [userId],
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      ...rowToChallenge(row),
      creatorName: row.creator_name as string,
      opponentName: row.opponent_name as string,
    };
  }

  async findHistory(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<{ data: ChallengeDetail[]; pagination: Record<string, unknown> }> {
    const offset = (page - 1) * pageSize;

    const [rowsRes, countRes] = await Promise.all([
      this.pg.query(
        `SELECT c.*,
                creator.display_name AS creator_name,
                opponent.display_name AS opponent_name
         FROM challenges c
         JOIN users creator  ON creator.id  = c.creator_id
         JOIN users opponent ON opponent.id = c.opponent_id
         WHERE (c.creator_id = $1 OR c.opponent_id = $1)
         ORDER BY c.created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, pageSize, offset],
      ),
      this.pg.query(
        `SELECT COUNT(*) AS total FROM challenges
         WHERE creator_id = $1 OR opponent_id = $1`,
        [userId],
      ),
    ]);

    const total = parseInt(countRes.rows[0]?.total ?? '0', 10);

    return {
      data: rowsRes.rows.map((row: Record<string, unknown>) => ({
        ...rowToChallenge(row),
        creatorName: row.creator_name as string,
        opponentName: row.opponent_name as string,
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

  async findExpiredPending(): Promise<Challenge[]> {
    const result = await this.pg.query(
      `SELECT * FROM challenges WHERE status = 'pending' AND expires_at < NOW()
       ORDER BY expires_at ASC LIMIT 200`,
    );
    return result.rows.map(rowToChallenge);
  }

  async findAbandonedActive(): Promise<Challenge[]> {
    const result = await this.pg.query(
      `SELECT * FROM challenges
       WHERE status = 'accepted'
         AND started_at + (duration_seconds * INTERVAL '1 second') + INTERVAL '30 seconds' < NOW()
       ORDER BY started_at ASC LIMIT 100`,
    );
    return result.rows.map(rowToChallenge);
  }

  /** Check if there is already a pending challenge between two users. */
  async existsPendingBetween(userA: string, userB: string): Promise<boolean> {
    const result = await this.pg.query(
      `SELECT 1 FROM challenges
       WHERE status = 'pending'
         AND ((creator_id = $1 AND opponent_id = $2)
           OR (creator_id = $2 AND opponent_id = $1))
       LIMIT 1`,
      [userA, userB],
    );
    return result.rows.length > 0;
  }

  async updateStatus(id: string, status: ChallengeStatus, extra?: Partial<{
    startedAt: Date;
    endedAt: Date;
  }>): Promise<void> {
    const sets = ['status = $2', 'updated_at = NOW()'];
    const vals: unknown[] = [id, status];
    let idx = 3;
    if (extra?.startedAt) {
      sets.push(`started_at = $${idx++}`);
      vals.push(extra.startedAt);
    }
    if (extra?.endedAt) {
      sets.push(`ended_at = $${idx++}`);
      vals.push(extra.endedAt);
    }
    await this.pg.query(
      `UPDATE challenges SET ${sets.join(', ')} WHERE id = $1`,
      vals,
    );
  }

  async setFinalScores(
    id: string,
    creatorScore: number,
    opponentScore: number,
    winnerId: string | null,
  ): Promise<void> {
    await this.pg.query(
      `UPDATE challenges
       SET creator_score = $2, opponent_score = $3, winner_id = $4,
           status = 'completed', ended_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [id, creatorScore, opponentScore, winnerId],
    );
  }

  // ═══════════════════════════════════════════════════════
  // FRIENDSHIPS
  // ═══════════════════════════════════════════════════════

  async createFriendRequest(requesterId: string, addresseeId: string): Promise<Friendship> {
    const result = await this.pg.query(
      `INSERT INTO friendships (requester_id, addressee_id, status)
       VALUES ($1, $2, 'pending')
       RETURNING *`,
      [requesterId, addresseeId],
    );
    return rowToFriendship(result.rows[0]);
  }

  async findFriendshipById(id: string): Promise<Friendship | null> {
    const result = await this.pg.query(
      `SELECT * FROM friendships WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return null;
    return rowToFriendship(result.rows[0]);
  }

  async findRelationship(userA: string, userB: string): Promise<Friendship | null> {
    const result = await this.pg.query(
      `SELECT * FROM friendships
       WHERE (requester_id = $1 AND addressee_id = $2)
          OR (requester_id = $2 AND addressee_id = $1)
       LIMIT 1`,
      [userA, userB],
    );
    if (result.rows.length === 0) return null;
    return rowToFriendship(result.rows[0]);
  }

  async updateFriendshipStatus(id: string, status: FriendshipStatus): Promise<void> {
    await this.pg.query(
      `UPDATE friendships SET status = $2, updated_at = NOW() WHERE id = $1`,
      [id, status],
    );
  }

  async deleteFriendship(id: string): Promise<void> {
    await this.pg.query(`DELETE FROM friendships WHERE id = $1`, [id]);
  }

  async listFriends(userId: string): Promise<UserSummary[]> {
    const result = await this.pg.query(
      `SELECT u.id, u.firebase_uid, u.display_name, u.avatar_url, u.enrollment_id
       FROM friendships f
       JOIN users u ON (
         CASE
           WHEN f.requester_id = $1 THEN u.id = f.addressee_id
           WHEN f.addressee_id = $1 THEN u.id = f.requester_id
         END
       )
       WHERE (f.requester_id = $1 OR f.addressee_id = $1) AND f.status = 'accepted'
       ORDER BY u.display_name ASC`,
      [userId],
    );
    return result.rows.map(rowToUserSummary);
  }

  async listPendingReceived(userId: string): Promise<any[]> {
    const result = await this.pg.query(
      `SELECT f.*, u.display_name as requester_name
       FROM friendships f
       JOIN users u ON u.id = f.requester_id
       WHERE f.addressee_id = $1 AND f.status = 'pending'
       ORDER BY f.created_at DESC`,
      [userId],
    );
    return result.rows.map(row => ({
      ...rowToFriendship(row),
      requesterName: row.requester_name as string,
    }));
  }

  async listPendingSent(userId: string): Promise<any[]> {
    const result = await this.pg.query(
      `SELECT f.*, u.display_name as addressee_name
       FROM friendships f
       JOIN users u ON u.id = f.addressee_id
       WHERE f.requester_id = $1 AND f.status = 'pending'
       ORDER BY f.created_at DESC`,
      [userId],
    );
    return result.rows.map(row => ({
      ...rowToFriendship(row),
      addresseeName: row.addressee_name as string,
    }));
  }

  async searchUsers(query: string, requestingUserId: string, limit = 20): Promise<UserSummary[]> {
    // Allow searching by display name (fuzzy) OR exact enrollment ID (e.g. QP-8F2A9C)
    const isEnrollmentSearch = /^QP-[A-F0-9]+$/i.test(query.trim());

    const result = await this.pg.query(
      `SELECT u.id, u.firebase_uid, u.display_name, u.avatar_url, u.enrollment_id
       FROM users u
       WHERE (
         ${isEnrollmentSearch
           ? `u.enrollment_id = $1`
           : `u.display_name ILIKE '%' || $1 || '%'`
         }
       )
         AND u.id <> $2
         AND u.id NOT IN (
           SELECT CASE
             WHEN f.requester_id = $2 THEN f.addressee_id
             ELSE f.requester_id
           END
           FROM friendships f
           WHERE (f.requester_id = $2 OR f.addressee_id = $2)
             AND f.status = 'blocked'
         )
       ORDER BY u.display_name ASC
       LIMIT $3`,
      [isEnrollmentSearch ? query.trim().toUpperCase() : escapeIlike(query), requestingUserId, limit],
    );
    return result.rows.map(rowToUserSummary);
  }

  // ─── Helper: resolve firebase_uid → PG UUID ───────────────

  async resolveUserId(firebaseUid: string): Promise<string | null> {
    const result = await this.pg.query(
      `SELECT id FROM users WHERE firebase_uid = $1`,
      [firebaseUid],
    );
    return result.rows[0]?.id ?? null;
  }

  async resolveUserDisplayName(userId: string): Promise<string> {
    const result = await this.pg.query(
      `SELECT display_name FROM users WHERE id = $1`,
      [userId],
    );
    return (result.rows[0]?.display_name as string) ?? 'Unknown';
  }
}

export const challengeRepository = new ChallengeRepository();
