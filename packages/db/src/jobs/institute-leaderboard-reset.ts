// ─── Cron: Institute Weekly Leaderboard Reset ─────────────────────
// Runs Sunday midnight UTC.
// Deletes all Redis keys matching `leaderboard:institute:*:weekly`
// so each institute's weekly ranking restarts fresh every week.
//
// The global leaderboard (`leaderboard:institute:*:global`) is
// intentionally preserved — it's the all-time ranking.

import type { FastifyBaseLogger } from 'fastify';
import { instituteService } from '../services/institute.service.js';
import { createServiceLogger } from '../lib/logger.js';

const log = createServiceLogger('InstituteLeaderboardResetCron');

export async function resetInstituteWeeklyLeaderboards(logger?: FastifyBaseLogger): Promise<void> {
  const l = logger ?? log;
  l.info('Cron: resetInstituteWeeklyLeaderboards starting');
  await instituteService.resetWeeklyLeaderboards();
  l.info('Cron: resetInstituteWeeklyLeaderboards complete');
}
