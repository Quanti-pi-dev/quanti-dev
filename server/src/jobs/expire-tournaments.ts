// ─── Cron: Tournament Completion ────────────────────────────
// Runs every 5 minutes. Finds active tournaments past their
// endsAt date, marks them completed, and awards prizeCoins
// to the #1 leaderboard entry.
//
// Pattern: identical to expire-challenges.ts

import { tournamentRepository } from '../repositories/tournament.repository.js';
import { gamificationRepository } from '../repositories/gamification.repository.js';
import { getPostgresPool } from '../lib/database.js';
import { createServiceLogger } from '../lib/logger.js';
import type { FastifyBaseLogger } from 'fastify';

const log = createServiceLogger('TournamentWorker');

/**
 * Completes tournaments that have passed their endsAt date.
 * Awards prizeCoins to the top-scoring participant.
 * Run every 5 minutes.
 */
export async function completeTournaments(logger: FastifyBaseLogger): Promise<void> {
  logger.info('Cron: completeTournaments starting');

  const expired = await tournamentRepository.findExpiredActive();
  let completed = 0;
  let prizesAwarded = 0;

  for (const tournament of expired) {
    try {
      // 1. Get the leaderboard — winner is rank #1
      const leaderboard = await tournamentRepository.getLeaderboard(tournament._id, 1);
      const winner = leaderboard[0];

      // 2. Award prize to winner (if any participants and prize > 0)
      // NOTE: winner.userId is an Auth0 ID (stored by the route via request.user!.id),
      // so we pass it directly to creditCoins — no PG resolution needed.
      if (winner && tournament.prizeCoins > 0) {
        await gamificationRepository.creditCoins(winner.userId, tournament.prizeCoins);
        await recordCoinTx(winner.userId, tournament.prizeCoins, 'tournament_prize', tournament._id);
        prizesAwarded++;
        logger.info(
          { tournamentId: tournament._id, winnerId: winner.userId, prize: tournament.prizeCoins },
          'Tournament prize awarded',
        );
      }

      // 3. Mark tournament as completed
      await tournamentRepository.markCompleted(tournament._id);
      completed++;

      logger.info({ tournamentId: tournament._id, name: tournament.name }, 'Tournament completed');
    } catch (err) {
      logger.error({ tournamentId: tournament._id, err }, 'Failed to complete tournament');
    }
  }

  if (expired.length > 0) {
    logger.info({ found: expired.length, completed, prizesAwarded }, 'Cron: completeTournaments complete');
  }
}

// ─── Helpers ────────────────────────────────────────────────

async function recordCoinTx(auth0Id: string, amount: number, reason: string, referenceId: string | null): Promise<void> {
  try {
    const pg = getPostgresPool();
    await pg.query(
      `INSERT INTO coin_transactions (user_id, amount, reason, reference_id)
       VALUES ((SELECT id FROM users WHERE auth0_id = $1), $2, $3, $4)`,
      [auth0Id, amount, reason, referenceId],
    );
  } catch (err) {
    log.error({ auth0Id, reason, err }, 'failed to record coin transaction in cron');
  }
}
