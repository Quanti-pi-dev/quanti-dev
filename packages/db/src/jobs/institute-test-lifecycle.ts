// ─── Cron: Institute Test Lifecycle ──────────────────────────────
// Runs every 5 minutes.
//
// Transitions:
//   1. 'scheduled' → 'live'   when scheduledAt <= now
//   2. 'live'     → 'closed'  when closesAt <= now
//
// Applies to both custom_tests AND institute_mock_tests collections.
// Uses MongoDB's direct update with $set to batch-transition all
// qualifying documents in a single query per collection.

import type { FastifyBaseLogger } from 'fastify';
import { getMongoDb } from '../clients/database.js';
import { createServiceLogger } from '../lib/logger.js';

const log = createServiceLogger('InstituteTestLifecycleCron');

export async function runInstituteTestLifecycle(logger?: FastifyBaseLogger): Promise<void> {
  const db = getMongoDb();
  const now = new Date();
  const l = logger ?? log;

  // ── 1. Activate scheduled tests that have reached their start time ──

  const collections = ['custom_tests', 'institute_mock_tests'] as const;
  let totalActivated = 0;
  let totalClosed = 0;

  for (const col of collections) {
    // scheduled → live
    const activateResult = await db.collection(col).updateMany(
      {
        status: 'scheduled',
        scheduledAt: { $lte: now },
        // Only transition if not already past closesAt
        $or: [{ closesAt: { $gt: now } }, { closesAt: null }],
      },
      { $set: { status: 'live', updatedAt: now } },
    );
    totalActivated += activateResult.modifiedCount;

    // live → closed
    const closeResult = await db.collection(col).updateMany(
      {
        status: { $in: ['live', 'scheduled'] },
        closesAt: { $lte: now },
      },
      { $set: { status: 'closed', updatedAt: now } },
    );
    totalClosed += closeResult.modifiedCount;
  }

  if (totalActivated > 0 || totalClosed > 0) {
    l.info({ totalActivated, totalClosed }, 'Cron: institute test lifecycle updated');
  }
}
