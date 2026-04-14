#!/usr/bin/env tsx
// ─── Migration Runner ────────────────────────────────────────
// Applies pending PostgreSQL migrations in order.
// Usage: tsx server/db/scripts/migrate.ts [--dry-run]
//
// Tracks applied migrations in `schema_migrations` table.

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../../src/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, '../migrations');
const DRY_RUN = process.argv.includes('--dry-run');

// ─── Bootstrap migrations tracking table ─────────────────────

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
    console.log(`🗄️  Migration runner (${DRY_RUN ? 'DRY RUN' : 'LIVE'})`);
    console.log(`📁 Migrations dir: ${MIGRATIONS_DIR}\n`);

    // Ensure tracking table exists
    await client.query(INIT_SQL);

    // Get already-applied migrations
    const applied = await client.query<{ filename: string }>(
      `SELECT filename FROM schema_migrations ORDER BY filename ASC`,
    );
    const appliedSet = new Set(applied.rows.map((r) => r.filename));

    // Discover migration files (sorted)
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql') && !f.startsWith('.'))
      .sort();

    const pending = files.filter((f) => !appliedSet.has(f));

    if (pending.length === 0) {
      console.log('✅ No pending migrations. Database is up to date.');
      return;
    }

    console.log(`📋 ${pending.length} pending migration(s):\n`);

    for (const file of pending) {
      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      console.log(`⏳ Applying: ${file}`);

      if (DRY_RUN) {
        console.log(`   [DRY RUN] Would execute ${sql.split('\n').length} lines`);
        continue;
      }

      // Run entire migration in a transaction
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO schema_migrations (filename) VALUES ($1)`,
          [file],
        );
        await client.query('COMMIT');
        console.log(`✅ Applied: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`❌ Failed: ${file}`, err);
        process.exit(1);
      }
    }

    console.log('\n🎉 All migrations applied successfully.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Migration runner error:', err);
  process.exit(1);
});
