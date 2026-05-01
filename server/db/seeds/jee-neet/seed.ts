#!/usr/bin/env tsx
// ─── JEE & NEET Master Seed ──────────────────────────────────
// Populates MongoDB from scratch with:
//   2 exams · 5 subjects · 7 exam-subject links
//   89 exam-scoped topics · 534 decks
//   5 Gemini-generated MCQs per deck = 2,670 flashcards
//
// Usage:
//   cd server && npx tsx --env-file=../.env db/seeds/jee-neet/seed.ts
//
// Progress is saved to seed-progress.json so the script can be
// safely interrupted and resumed without re-generating content.

import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  EXAMS, SUBJECTS, EXAM_SUBJECT_MAP, TOPICS, LEVELS,
  type Level, type TopicDef,
} from './taxonomy.js';
import { generateWithRetry } from './generator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROGRESS_FILE = path.join(__dirname, 'seed-progress.json');
const CARDS_PER_DECK = 21;
const CONCURRENCY = 2; // parallel Gemini calls per batch

// ─── MongoDB connection ───────────────────────────────────────
const MONGODB_URI = process.env['MONGO_URL'] ?? process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/kd_dev';

// ─── Progress tracking ────────────────────────────────────────
// Tracks which decks have already been generated so we can resume.
interface Progress {
  completedDeckIds: string[]; // deckId strings
}

function loadProgress(): Progress {
  if (fs.existsSync(PROGRESS_FILE)) {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')) as Progress;
  }
  return { completedDeckIds: [] };
}

function saveProgress(p: Progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2));
}

// ─── Batch helper ─────────────────────────────────────────────
async function runBatch<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const slice = items.slice(i, i + concurrency);
    const batch = await Promise.all(slice.map((item, j) => fn(item, i + j)));
    results.push(...batch);
  }
  return results;
}

// ─── Main ─────────────────────────────────────────────────────
async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db();

  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  JEE & NEET Master Seed');
  console.log(`  MongoDB: ${db.databaseName}`);
  console.log('═══════════════════════════════════════════════════════\n');

  const progress = loadProgress();
  const completedSet = new Set(progress.completedDeckIds);

  // ── Phase 1: Upsert Exams ──────────────────────────────────
  console.log('📋 Phase 1/6 — Exams');
  const examIdMap: Record<string, ObjectId> = {};
  for (const exam of EXAMS) {
    const now = new Date();
    const result = await db.collection('exams').findOneAndUpdate(
      { slug: exam.slug },
      {
        $setOnInsert: { slug: exam.slug, createdAt: now },
        $set: {
          title: exam.title,
          description: exam.description,
          category: exam.category,
          durationMinutes: exam.durationMinutes,
          isPublished: true,
          updatedAt: now,
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
    examIdMap[exam.slug] = result!._id as ObjectId;
    console.log(`  ✓ ${exam.title} → ${result!._id}`);
  }

  // ── Phase 2: Upsert Subjects ───────────────────────────────
  console.log('\n📋 Phase 2/6 — Subjects');
  const subjectIdMap: Record<string, ObjectId> = {};
  for (const sub of SUBJECTS) {
    const now = new Date();
    const result = await db.collection('subjects').findOneAndUpdate(
      { slug: sub.slug },
      {
        $setOnInsert: { slug: sub.slug, createdAt: now },
        $set: { name: sub.name, description: sub.description, updatedAt: now },
      },
      { upsert: true, returnDocument: 'after' },
    );
    subjectIdMap[sub.slug] = result!._id as ObjectId;
    console.log(`  ✓ ${sub.name} → ${result!._id}`);
  }

  // ── Phase 3: Exam-Subject Mappings ─────────────────────────
  console.log('\n📋 Phase 3/6 — Exam-Subject Mappings');
  let order = 0;
  for (const [examSlug, subjectSlugs] of Object.entries(EXAM_SUBJECT_MAP)) {
    const examId = examIdMap[examSlug]!;
    for (const subjectSlug of subjectSlugs) {
      const subjectId = subjectIdMap[subjectSlug]!;
      await db.collection('exam_subjects').updateOne(
        { examId, subjectId },
        { $setOnInsert: { examId, subjectId, order: order++, createdAt: new Date() } },
        { upsert: true },
      );
      console.log(`  ✓ ${examSlug} → ${subjectSlug}`);
    }
  }

  // ── Phase 4: Topics (exam-scoped) ─────────────────────────
  console.log('\n📋 Phase 4/6 — Topics');
  const topicIdMap: Record<string, ObjectId> = {}; // key: `${examSlug}:${subjectSlug}:${topicSlug}`

  for (const [key, topicDefs] of Object.entries(TOPICS)) {
    const [examSlug, subjectSlug] = key.split(':') as [string, string];
    const examId = examIdMap[examSlug]!;
    const subjectId = subjectIdMap[subjectSlug]!;

    for (let i = 0; i < topicDefs.length; i++) {
      const t = topicDefs[i]!;
      const now = new Date();
      const result = await db.collection('topics').findOneAndUpdate(
        { examId, subjectId, slug: t.slug },
        {
          $setOnInsert: { examId, subjectId, slug: t.slug, createdAt: now },
          $set: { displayName: t.displayName, order: i, updatedAt: now },
        },
        { upsert: true, returnDocument: 'after' },
      );
      topicIdMap[`${examSlug}:${subjectSlug}:${t.slug}`] = result!._id as ObjectId;
    }
    console.log(`  ✓ ${key}: ${topicDefs.length} topics`);
  }

  // ── Phase 5: Decks ─────────────────────────────────────────
  console.log('\n📋 Phase 5/6 — Decks');
  interface DeckJob {
    deckId: ObjectId;
    examSlug: string;
    subjectSlug: string;
    subjectName: string;
    topic: TopicDef;
    level: Level;
  }
  const deckJobs: DeckJob[] = [];

  for (const [key, topicDefs] of Object.entries(TOPICS)) {
    const [examSlug, subjectSlug] = key.split(':') as [string, string];
    const examId = examIdMap[examSlug]!;
    const subjectId = subjectIdMap[subjectSlug]!;
    const subjectName = SUBJECTS.find((s) => s.slug === subjectSlug)?.name ?? subjectSlug;

    for (const topic of topicDefs) {
      const topicId = topicIdMap[`${examSlug}:${subjectSlug}:${topic.slug}`]!;

      for (const level of LEVELS) {
        const now = new Date();
        const result = await db.collection('decks').findOneAndUpdate(
          { examId, subjectId, topicSlug: topic.slug, level },
          {
            $setOnInsert: { createdAt: now },
            $set: {
              title: `${topic.displayName} — ${level}`,
              description: `${level}-level ${examSlug.toUpperCase()} questions on ${topic.displayName} (${subjectName})`,
              type: 'mastery',
              examId,
              subjectId,
              topicId,
              topicSlug: topic.slug,
              level,
              tags: [topic.slug, subjectName, level, examSlug],
              cardCount: 0,
              isPublished: true,
              updatedAt: now,
            },
          },
          { upsert: true, returnDocument: 'after' },
        );
        deckJobs.push({
          deckId: result!._id as ObjectId,
          examSlug, subjectSlug, subjectName, topic, level,
        });
      }
    }
  }
  console.log(`  ✓ ${deckJobs.length} decks upserted`);

  // ── Phase 6: Flashcards (Gemini-generated) ─────────────────
  console.log('\n📋 Phase 6/6 — Flashcards (Gemini-generated)');
  console.log(`  Generating ${CARDS_PER_DECK} cards × ${deckJobs.length} decks = ${CARDS_PER_DECK * deckJobs.length} total\n`);

  const pendingJobs = deckJobs.filter((j) => !completedSet.has(j.deckId.toHexString()));
  console.log(`  ${completedSet.size} decks already done, ${pendingJobs.length} remaining\n`);

  let done = 0;
  let skipped = 0;
  let errors = 0;

  await runBatch(pendingJobs, CONCURRENCY, async (job) => {
    const deckIdStr = job.deckId.toHexString();
    const subjectName = SUBJECTS.find((s) => s.slug === job.subjectSlug)?.name ?? job.subjectSlug;

    try {
      // Skip if deck already has cards
      const existing = await db.collection('flashcards').countDocuments({ deckId: job.deckId });
      if (existing >= CARDS_PER_DECK) {
        completedSet.add(deckIdStr);
        skipped++;
        return;
      }

      const cards = await generateWithRetry({
        exam: job.examSlug,
        subject: subjectName,
        topic: job.topic.displayName,
        level: job.level,
        style: job.topic.style,
        count: CARDS_PER_DECK,
      });

      // Insert cards
      const now = new Date();
      const docs = cards.map((card, i) => ({
        deckId: job.deckId,
        question: card.question,
        options: card.options,
        correctAnswerId: card.correctAnswerId,
        explanation: card.explanation,
        imageUrl: null,
        source: 'original' as const,
        tags: [job.topic.slug, subjectName.toLowerCase(), job.level],
        order: existing + i,
        createdAt: now,
        updatedAt: now,
      }));

      if (docs.length > 0) {
        await db.collection('flashcards').insertMany(docs);
        await db.collection('decks').updateOne(
          { _id: job.deckId },
          { $inc: { cardCount: docs.length } },
        );
      }

      completedSet.add(deckIdStr);
      progress.completedDeckIds = [...completedSet];
      saveProgress(progress);
      done++;

      const total = pendingJobs.length;
      const pct = Math.round(((done + skipped + errors) / total) * 100);
      process.stdout.write(
        `\r  [${pct}%] ${done + skipped}/${total} decks  ` +
        `(${job.examSlug.toUpperCase()} ${subjectName} ${job.topic.displayName} ${job.level})    `
      );
    } catch (err) {
      errors++;
      console.error(`\n  ✗ FAILED: ${job.examSlug} ${job.topic.slug} ${job.level}: ${err}`);
    }
  });

  console.log('\n');

  // ── Final counts ───────────────────────────────────────────
  const counts = await Promise.all([
    db.collection('exams').countDocuments(),
    db.collection('subjects').countDocuments(),
    db.collection('exam_subjects').countDocuments(),
    db.collection('topics').countDocuments(),
    db.collection('decks').countDocuments(),
    db.collection('flashcards').countDocuments(),
  ]);

  console.log('─── Final Counts ────────────────────────────────────────');
  console.log(`  exams:         ${counts[0]}`);
  console.log(`  subjects:      ${counts[1]}`);
  console.log(`  exam_subjects: ${counts[2]}`);
  console.log(`  topics:        ${counts[3]}`);
  console.log(`  decks:         ${counts[4]}`);
  console.log(`  flashcards:    ${counts[5]}`);
  console.log('─────────────────────────────────────────────────────────');
  console.log(`  Generated: ${done} | Skipped (existing): ${skipped} | Errors: ${errors}`);
  console.log('═══════════════════════════════════════════════════════\n');

  if (errors > 0) {
    console.log(`  ⚠  ${errors} decks failed. Re-run the script to retry — progress is saved.`);
  } else {
    console.log('  ✅ Seed complete!');
    // Clean up progress file on full success
    if (fs.existsSync(PROGRESS_FILE)) fs.unlinkSync(PROGRESS_FILE);
  }

  await client.close();
}

main().catch((err) => {
  console.error('\n❌ Seed failed:', err);
  process.exit(1);
});
