#!/usr/bin/env npx tsx
// ─── Level Migration: 6-Tier → 4-Tier (Educator Brain Alignment) ─────
//
// Migrates all Redis keys and MongoDB documents from the legacy 6-level
// system (Beginner/Rookie/Skilled/Competent/Expert/Master) to the new
// 4-level BKT-aligned system (Emerging/Developing/Proficient/Master).
//
// Mapping:
//   Beginner  → Emerging     (index 0)
//   Rookie    → Developing   (index 1)
//   Skilled   → Proficient   (index 2)   ← merged up
//   Competent → Proficient   (index 2)   ← merged into same tier
//   Expert    → Master       (index 3)   ← merged up
//   Master    → Master       (index 3)   ← stays
//
// For merged levels (Skilled+Competent → Proficient, Expert+Master → Master),
// progress counters are summed.
//
// Run:  npx tsx server/db/migrations/migrate-levels-4tier.ts
//       npx tsx server/db/migrations/migrate-levels-4tier.ts --dry-run

import 'dotenv/config';
import Redis from 'ioredis';
import { MongoClient } from 'mongodb';

const DRY_RUN = process.argv.includes('--dry-run');

const LEVEL_MAP: Record<string, string> = {
  Beginner:  'Emerging',
  Rookie:    'Developing',
  Skilled:   'Proficient',
  Competent: 'Proficient',
  Expert:    'Master',
  Master:    'Master',
};

const OLD_LEVELS = ['Beginner', 'Rookie', 'Skilled', 'Competent', 'Expert', 'Master'];
const NEW_LEVELS = ['Emerging', 'Developing', 'Proficient', 'Master'];

async function migrateRedis() {
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  let migratedKeys = 0;
  let migratedSets = 0;

  console.log('\n📦 Migrating Redis keys...');

  // 1. Migrate level_progress keys
  //    Pattern: level_progress:{userId}:{examId}:{subjectId}:{topicSlug}:{level}
  const progressKeys = await scanKeys(redis, 'level_progress:*');
  console.log(`   Found ${progressKeys.length} level_progress keys`);

  // Group by prefix (everything except the level suffix)
  const progressGroups = new Map<string, Map<string, string>>();
  for (const key of progressKeys) {
    const parts = key.split(':');
    const level = parts[parts.length - 1];
    const prefix = parts.slice(0, -1).join(':');

    if (!OLD_LEVELS.includes(level)) continue;

    if (!progressGroups.has(prefix)) progressGroups.set(prefix, new Map());
    progressGroups.get(prefix)!.set(level, key);
  }

  for (const [prefix, levelKeys] of progressGroups) {
    // Read all old data
    const pipeline = redis.pipeline();
    for (const [, key] of levelKeys) {
      pipeline.hgetall(key);
    }
    const results = await pipeline.exec();

    // Merge into new levels
    const newData = new Map<string, { correct: number; total: number }>();
    let idx = 0;
    for (const [level] of levelKeys) {
      const [err, data] = results?.[idx++] ?? [null, {}];
      if (err || !data) continue;
      const record = data as Record<string, string>;
      const correct = parseInt(record['correct'] ?? '0', 10);
      const total = parseInt(record['total'] ?? '0', 10);
      const newLevel = LEVEL_MAP[level]!;

      const existing = newData.get(newLevel) ?? { correct: 0, total: 0 };
      existing.correct += correct;
      existing.total += total;
      newData.set(newLevel, existing);
    }

    // Write new keys and delete old ones
    for (const [newLevel, counts] of newData) {
      if (counts.total === 0) continue;
      const newKey = `${prefix}:${newLevel}`;
      if (!DRY_RUN) {
        await redis.hset(newKey, { correct: counts.correct.toString(), total: counts.total.toString() });
      }
      migratedKeys++;
    }

    // Delete old keys
    for (const [, key] of levelKeys) {
      if (!DRY_RUN) await redis.del(key);
    }
  }

  // 2. Migrate unlocked_levels sets
  //    Pattern: unlocked_levels:{userId}:{examId}:{subjectId}:{topicSlug}
  const unlockKeys = await scanKeys(redis, 'unlocked_levels:*');
  console.log(`   Found ${unlockKeys.length} unlocked_levels sets`);

  for (const key of unlockKeys) {
    const members = await redis.smembers(key);
    const oldMembers = members.filter(m => OLD_LEVELS.includes(m));
    if (oldMembers.length === 0) continue;

    const newMembers = new Set(oldMembers.map(m => LEVEL_MAP[m]!));

    if (!DRY_RUN) {
      // Remove old, add new
      if (oldMembers.length > 0) await redis.srem(key, ...oldMembers);
      if (newMembers.size > 0) await redis.sadd(key, ...newMembers);
    }
    migratedSets++;
  }

  // 3. Migrate level_progress_keys tracking sets
  //    Pattern: level_progress_keys:{userId}
  //    Members: "examId:subjectId:topicSlug:level"
  const trackingKeys = await scanKeys(redis, 'level_progress_keys:*');
  console.log(`   Found ${trackingKeys.length} level_progress_keys tracking sets`);

  for (const key of trackingKeys) {
    const members = await redis.smembers(key);
    const toRemove: string[] = [];
    const toAdd: string[] = [];

    for (const member of members) {
      const parts = member.split(':');
      const level = parts[parts.length - 1];
      if (!OLD_LEVELS.includes(level)) continue;

      const newLevel = LEVEL_MAP[level]!;
      const newMember = [...parts.slice(0, -1), newLevel].join(':');

      toRemove.push(member);
      toAdd.push(newMember);
    }

    if (toRemove.length > 0 && !DRY_RUN) {
      await redis.srem(key, ...toRemove);
      // Deduplicate (e.g. Skilled+Competent both map to Proficient)
      const unique = [...new Set(toAdd)];
      if (unique.length > 0) await redis.sadd(key, ...unique);
    }
  }

  console.log(`   ✅ Migrated ${migratedKeys} progress keys, ${migratedSets} unlock sets`);
  await redis.quit();
}

async function migrateMongoDB() {
  const client = new MongoClient(process.env.MONGO_URL ?? process.env.MONGODB_URI ?? 'mongodb://localhost:27017');
  await client.connect();
  const db = client.db();

  console.log('\n📦 Migrating MongoDB decks...');

  const decksCollection = db.collection('decks');

  // Count affected documents
  const count = await decksCollection.countDocuments({
    level: { $in: ['Beginner', 'Rookie', 'Skilled', 'Competent', 'Expert'] },
  });
  console.log(`   Found ${count} decks with legacy level names`);

  if (!DRY_RUN) {
    // Batch update each legacy level to its new name
    for (const [oldLevel, newLevel] of Object.entries(LEVEL_MAP)) {
      if (oldLevel === newLevel) continue; // Skip Master→Master
      const result = await decksCollection.updateMany(
        { level: oldLevel },
        { $set: { level: newLevel } },
      );
      if (result.modifiedCount > 0) {
        console.log(`   ${oldLevel} → ${newLevel}: ${result.modifiedCount} decks`);
      }
    }
  }

  // Also check challenges table in PostgreSQL (if they store level names)
  console.log(`   ✅ MongoDB migration complete (${count} decks affected)`);
  await client.close();
}

async function scanKeys(redis: Redis, pattern: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = '0';
  do {
    const [nextCursor, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
    cursor = nextCursor;
    keys.push(...batch);
  } while (cursor !== '0');
  return keys;
}

async function main() {
  console.log(`\n🔄 Level Migration: 6-Tier → 4-Tier (Educator Brain)`);
  console.log(`   Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes)' : '⚡ LIVE'}`);

  await migrateRedis();
  await migrateMongoDB();

  console.log(`\n✅ Migration complete!${DRY_RUN ? ' (dry run — no changes made)' : ''}\n`);
}

main().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
