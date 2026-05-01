#!/usr/bin/env tsx
// ─── PostgreSQL Migration Runner ─────────────────────────────
// Applies pending .sql migrations from db/migrations/ in order.
// Tracks applied migrations in the `schema_migrations` table.
//
// Usage:
//   npm run db:migrate          — apply all pending migrations
//   npm run db:migrate:dry      — preview without executing SQL

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../../src/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, '../migrations');
const DRY_RUN = process.argv.includes('--dry-run');

// ─── Tracking table ──────────────────────────────────────────

const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename   VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

async function run() {
  const pool = new pg.Pool({ connectionString: config.postgres.url });
  const client = await pool.connect();

  try {
    console.log(`\n🗄️  PostgreSQL Migration Runner (${DRY_RUN ? 'DRY RUN' : 'LIVE'})`);
    console.log(`📁  Migrations dir: ${MIGRATIONS_DIR}\n`);

    // Ensure tracking table exists
    await client.query(INIT_SQL);

    // Fetch already-applied migrations
    const applied = await client.query<{ filename: string }>(
      `SELECT filename FROM schema_migrations ORDER BY filename ASC`,
    );
    const appliedSet = new Set(applied.rows.map((r) => r.filename));

    // Discover pending .sql files (sorted lexicographically)
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql') && !f.startsWith('.'))
      .sort();

    const pending = files.filter((f) => !appliedSet.has(f));

    if (pending.length === 0) {
      console.log('✅  No pending migrations — database is up to date.\n');
      return;
    }

    console.log(`📋  ${pending.length} pending migration(s):\n`);

    for (const file of pending) {
      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      console.log(`⏳  Applying: ${file}`);

      if (DRY_RUN) {
        console.log(`    [DRY RUN] Would execute ${sql.split('\n').length} lines\n`);
        continue;
      }

      // Run entire migration inside a transaction
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO schema_migrations (filename) VALUES ($1)`,
          [file],
        );
        await client.query('COMMIT');
        console.log(`✅  Applied: ${file}\n`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`❌  Failed: ${file}`, err);
        process.exit(1);
      }
    }

    console.log('🎉  All migrations applied successfully.\n');
  } catch (err) {
    console.error('Migration runner error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
