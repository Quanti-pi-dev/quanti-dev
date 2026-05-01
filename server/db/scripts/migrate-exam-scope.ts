// ─── Exam-Scope Migration Script ───────────────────────────────
// Task 1C: Backfill `examId` on topics and decks that are missing it.
//
// Run this BEFORE running create-mongo-indexes.ts after the index update,
// otherwise the new {examId, subjectId, slug} unique index will fail to
// create if any topic docs have null examId colliding with each other.
//
// Usage:
//   cd server && npx tsx --env-file=../.env db/scripts/migrate-exam-scope.ts
//
// Safe to re-run — skips documents that already have examId set.

import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';

const MONGO_URL = process.env['MONGO_URL'] ?? 'mongodb://localhost:27017/kd_content';
const MONGO_DB  = process.env['MONGO_DB']  ?? 'kd_content';

async function run() {
  console.log('Connecting to MongoDB...');
  const client = new MongoClient(MONGO_URL);

  try {
    await client.connect();
    const db = client.db(MONGO_DB);
    console.log(`✅ Connected: ${db.databaseName}\n`);

    // ── Build a map of subjectId → examId(s) via exam_subjects ──────
    console.log('📋 Building subjectId → examId mapping from exam_subjects...');
    const mappings = await db.collection('exam_subjects')
      .find({}, { projection: { examId: 1, subjectId: 1 } })
      .toArray();

    // subjectId hex → Set<examId hex>
    const subjectToExams = new Map<string, Set<string>>();
    for (const m of mappings) {
      const sid = (m['subjectId'] as ObjectId).toHexString();
      const eid = (m['examId'] as ObjectId).toHexString();
      if (!subjectToExams.has(sid)) subjectToExams.set(sid, new Set());
      subjectToExams.get(sid)!.add(eid);
    }
    console.log(`  → ${subjectToExams.size} subjects mapped across ${mappings.length} exam-subject pairs\n`);

    // ── Migrate Topics ───────────────────────────────────────────────
    console.log('📋 Migrating topics missing examId...');
    const orphanTopics = await db.collection('topics')
      .find({ examId: { $exists: false } }, { projection: { _id: 1, subjectId: 1, slug: 1 } })
      .toArray();

    console.log(`  → Found ${orphanTopics.length} orphaned topic(s)`);

    let topicsFixed = 0;
    let topicsAmbiguous = 0;

    for (const doc of orphanTopics) {
      const sid = (doc['subjectId'] as ObjectId).toHexString();
      const examIds = subjectToExams.get(sid);

      if (!examIds || examIds.size === 0) {
        console.warn(`  ⚠️  Topic ${doc._id} (slug: ${doc['slug']}) — subject ${sid} has no exam mapping. Skipping.`);
        topicsAmbiguous++;
        continue;
      }
      if (examIds.size > 1) {
        console.warn(`  ⚠️  Topic ${doc._id} (slug: ${doc['slug']}) — subject ${sid} belongs to ${examIds.size} exams: [${[...examIds].join(', ')}]. Cannot auto-assign. Skipping.`);
        topicsAmbiguous++;
        continue;
      }

      const examId = new ObjectId([...examIds][0]!);
      await db.collection('topics').updateOne(
        { _id: doc._id },
        { $set: { examId, updatedAt: new Date() } },
      );
      topicsFixed++;
    }

    console.log(`  ✓ Topics fixed: ${topicsFixed}, ambiguous (manual review needed): ${topicsAmbiguous}\n`);

    // ── Migrate Decks ────────────────────────────────────────────────
    console.log('📋 Migrating decks missing examId...');
    const orphanDecks = await db.collection('decks')
      .find(
        { examId: { $exists: false }, subjectId: { $exists: true } },
        { projection: { _id: 1, subjectId: 1, topicSlug: 1, level: 1 } },
      )
      .toArray();

    console.log(`  → Found ${orphanDecks.length} orphaned deck(s)`);

    let decksFixed = 0;
    let decksAmbiguous = 0;

    for (const doc of orphanDecks) {
      const sid = (doc['subjectId'] as ObjectId).toHexString();
      const examIds = subjectToExams.get(sid);

      if (!examIds || examIds.size === 0) {
        console.warn(`  ⚠️  Deck ${doc._id} — subject ${sid} has no exam mapping. Skipping.`);
        decksAmbiguous++;
        continue;
      }
      if (examIds.size > 1) {
        console.warn(`  ⚠️  Deck ${doc._id} (topicSlug: ${doc['topicSlug']}, level: ${doc['level']}) — subject ${sid} belongs to ${examIds.size} exams. Cannot auto-assign. Skipping.`);
        decksAmbiguous++;
        continue;
      }

      const examId = new ObjectId([...examIds][0]!);
      await db.collection('decks').updateOne(
        { _id: doc._id },
        { $set: { examId, updatedAt: new Date() } },
      );
      decksFixed++;
    }

    console.log(`  ✓ Decks fixed: ${decksFixed}, ambiguous (manual review needed): ${decksAmbiguous}\n`);

    // ── Summary ──────────────────────────────────────────────────────
    console.log('─── Migration Summary ───────────────────────────────────');
    console.log(`  Topics:  ${topicsFixed} fixed, ${topicsAmbiguous} need manual review`);
    console.log(`  Decks:   ${decksFixed} fixed, ${decksAmbiguous} need manual review`);
    console.log('─────────────────────────────────────────────────────────');

    if (topicsAmbiguous > 0 || decksAmbiguous > 0) {
      console.log('\n⚠️  Some records need manual review (see warnings above).');
      console.log('   Resolve them before running create-mongo-indexes.ts.\n');
    } else {
      console.log('\n✅ Migration complete! Safe to run create-mongo-indexes.ts.\n');
    }

  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await client.close();
    console.log('Disconnected from MongoDB.');
  }
}

run();
