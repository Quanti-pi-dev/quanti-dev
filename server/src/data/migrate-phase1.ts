// ─── MongoDB Migration: Phase 1 — Backfill New Fields ───────
// Run this script against your MongoDB database to:
// 1. Backfill `type`, `topicSlug`, `topicId` on existing decks
// 2. Backfill `examId` on decks via exam_subjects mapping
// 3. Backfill `source` on existing flashcards (default: 'original')
// 4. Backfill `examId` on existing topics (from exam_subjects)
// 5. Create compound indexes for the new hierarchy queries
//
// Usage: node --loader ts-node/esm server/src/data/migrate-phase1.ts
// Or:    npx tsx server/src/data/migrate-phase1.ts

import { MongoClient } from 'mongodb';
import { config } from '../config.js';

async function main() {
  const client = new MongoClient(config.mongo.url);
  await client.connect();
  const db = client.db(config.mongo.dbName);

  console.log('═══════════════════════════════════════════════════════');
  console.log('Phase 1 Migration: Backfill new hierarchy fields');
  console.log('═══════════════════════════════════════════════════════');

  // ─── Step 1: Backfill `type` and `topicSlug` on decks ─────────
  console.log('\n[1/5] Backfilling type, topicSlug, topicId on decks...');

  const decks = await db.collection('decks').find({}).toArray();
  let deckUpdates = 0;

  for (const deck of decks) {
    const updates: Record<string, unknown> = {};

    // Derive `type` from legacy `category`
    if (!deck.type) {
      if (deck.category === 'subject') {
        updates.type = 'mastery';
      } else if (deck.category === 'shop') {
        updates.type = 'shop';
      } else {
        updates.type = 'standalone';
      }
    }

    // Extract `topicSlug` from tags[0] if not already set
    if (!deck.topicSlug && deck.tags && deck.tags.length > 0) {
      updates.topicSlug = deck.tags[0];
    }

    // Resolve `topicId` from the topics collection
    if (!deck.topicId && deck.subjectId && (deck.topicSlug || updates.topicSlug)) {
      const slug = deck.topicSlug || updates.topicSlug;
      const topic = await db.collection('topics').findOne({
        subjectId: deck.subjectId,
        slug: slug,
      });
      if (topic) {
        updates.topicId = topic._id;
      }
    }

    if (Object.keys(updates).length > 0) {
      await db.collection('decks').updateOne(
        { _id: deck._id },
        { $set: updates },
      );
      deckUpdates++;
    }
  }
  console.log(`   Updated ${deckUpdates}/${decks.length} decks`);

  // ─── Step 2: Backfill `examId` on decks via exam_subjects ─────
  console.log('\n[2/5] Backfilling examId on mastery decks...');

  const examSubjects = await db.collection('exam_subjects').find({}).toArray();
  let examIdUpdates = 0;

  for (const mapping of examSubjects) {
    const result = await db.collection('decks').updateMany(
      {
        subjectId: mapping.subjectId,
        $or: [{ type: 'mastery' }, { category: 'subject' }],
        examId: { $exists: false },
      },
      { $set: { examId: mapping.examId } },
    );
    examIdUpdates += result.modifiedCount;
  }
  console.log(`   Stamped examId on ${examIdUpdates} decks`);

  // ─── Step 3: Backfill `source` on existing flashcards ─────────
  console.log('\n[3/5] Backfilling source on flashcards...');

  const flashcardResult = await db.collection('flashcards').updateMany(
    { source: { $exists: false } },
    { $set: { source: 'original' } },
  );
  console.log(`   Set source='original' on ${flashcardResult.modifiedCount} flashcards`);

  // ─── Step 4: Backfill `examId` on existing topics ─────────────
  console.log('\n[4/5] Backfilling examId on topics...');

  let topicUpdates = 0;
  for (const mapping of examSubjects) {
    const result = await db.collection('topics').updateMany(
      {
        subjectId: mapping.subjectId,
        examId: { $exists: false },
      },
      { $set: { examId: mapping.examId } },
    );
    topicUpdates += result.modifiedCount;
  }
  console.log(`   Stamped examId on ${topicUpdates} topics`);

  // ─── Step 5: Create compound indexes (idempotent) ─────────────
  console.log('\n[5/5] Creating compound indexes...');

  type IndexDef = {
    collection: string;
    spec: Record<string, unknown>;
    options: Record<string, unknown>;
    label: string;
  };

  const indexes: IndexDef[] = [
    {
      collection: 'decks',
      spec: { examId: 1, subjectId: 1, topicSlug: 1, level: 1 },
      options: { unique: true, partialFilterExpression: { type: 'mastery' }, name: 'idx_deck_hierarchy' },
      label: 'decks: idx_deck_hierarchy (examId, subjectId, topicSlug, level) UNIQUE',
    },
    {
      collection: 'decks',
      spec: { subjectId: 1, level: 1 },
      options: { name: 'idx_deck_subject_level' },
      label: 'decks: idx_deck_subject_level',
    },
    {
      collection: 'topics',
      spec: { examId: 1, subjectId: 1, slug: 1 },
      options: { unique: true, name: 'idx_topic_exam_subject_slug' },
      label: 'topics: idx_topic_exam_subject_slug (unique)',
    },
    {
      collection: 'flashcards',
      spec: { deckId: 1, order: 1 },
      options: { name: 'idx_flashcard_deck_order' },
      label: 'flashcards: idx_flashcard_deck_order',
    },
    {
      collection: 'flashcards',
      spec: { deckId: 1, source: 1, order: 1 },
      options: { sparse: true, name: 'idx_flashcard_deck_source_order' },
      label: 'flashcards: idx_flashcard_deck_source_order (PYQ filter)',
    },
    {
      collection: 'flashcards',
      spec: { source: 1 },
      options: { sparse: true, name: 'idx_flashcard_source' },
      label: 'flashcards: idx_flashcard_source (sparse)',
    },
    {
      collection: 'flashcards',
      spec: { source: 1, deckId: 1, sourceYear: -1 },
      options: { sparse: true, name: 'idx_flashcard_pyq_deck_year' },
      label: 'flashcards: idx_flashcard_pyq_deck_year',
    },
    {
      collection: 'flashcards',
      spec: { source: 1, sourceYear: 1, sourcePaper: 1 },
      options: { sparse: true, name: 'idx_flashcard_pyq_year_paper' },
      label: 'flashcards: idx_flashcard_pyq_year_paper (meta aggregation)',
    },
    {
      collection: 'exam_subjects',
      spec: { examId: 1, subjectId: 1 },
      options: { unique: true, name: 'idx_exam_subject_unique' },
      label: 'exam_subjects: idx_exam_subject_unique',
    },
  ];

  let created = 0;
  let skipped = 0;

  for (const idx of indexes) {
    try {
      await db.collection(idx.collection).createIndex(idx.spec as never, idx.options as never);
      console.log(`   ✓ ${idx.label}`);
      created++;
    } catch (err: unknown) {
      const code = (err as { code?: number }).code;
      if (code === 85 || code === 86) {
        // IndexOptionsConflict / IndexKeySpecsConflict — same key spec, different name already exists
        console.log(`   ↩ SKIPPED (already exists): ${idx.label}`);
        skipped++;
      } else {
        throw err;  // re-throw unexpected errors
      }
    }
  }

  // ─── Summary ──────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('Migration complete!');
  console.log(`  Decks updated:      ${deckUpdates}`);
  console.log(`  ExamId stamps:      ${examIdUpdates}`);
  console.log(`  Flashcard source:   ${flashcardResult.modifiedCount}`);
  console.log(`  Topic examId:       ${topicUpdates}`);
  console.log(`  Indexes created:    ${created}`);
  console.log(`  Indexes skipped:    ${skipped} (already existed)`);
  console.log('═══════════════════════════════════════════════════════');

  await client.close();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
