// ─── Exam Content Seed Orchestrator ──────────────────────────────────────────
// Run: npx tsx server/db/seeds/exam-seed.ts
//
// Executes all 6 seed phases in order:
//   Phase 1:  Subjects (global pool)
//   Phase 1b: Topics (dynamic, stored in MongoDB)
//   Phase 2:  Exams
//   Phase 3:  Exam-Subject mappings
//   Phase 4:  Topic-scoped Decks
//   Phase 5:  Flashcards (real MCQs)
//
// Safe to re-run — all phases are idempotent.

import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { seedSubjects }   from './runners/seed-subjects.js';
import { seedTopics }      from './runners/seed-topics.js';
import { seedExams }       from './runners/seed-exams.js';
import { seedMappings }    from './runners/seed-mappings.js';
import { seedDecks }       from './runners/seed-decks.js';
import { seedFlashcards }  from './runners/seed-flashcards.js';
import { TOTAL_DECKS, TOTAL_TOPICS } from './data/taxonomy.js';

const MONGODB_URI = process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/kd_dev';

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db();

  console.log('🌱 Connected to MongoDB:', db.databaseName);
  console.log(`   Expected: 10 subjects · ${TOTAL_TOPICS} topics · 5 exams · 17 links · ${TOTAL_DECKS} decks\n`);

  const start = Date.now();

  // Phase 1 + 2 in parallel (no dependencies between them)
  const [subjectMap, examMap] = await Promise.all([
    seedSubjects(db),
    seedExams(db),
  ]);

  // Phase 1b: Topics (needs subjectMap)
  await seedTopics(db, subjectMap);

  // Phase 3 needs both maps
  await seedMappings(db, examMap, subjectMap);

  // Phase 4 needs subjectMap → produces deckMap
  await seedDecks(db, subjectMap);

  // Phase 5 needs subjectMap to resolve deck IDs
  await seedFlashcards(db, subjectMap);

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n✅ Seed complete in ${elapsed}s`);
  console.log('\n─── Final Counts ────────────────────────────────────────');
  const counts = await Promise.all([
    db.collection('subjects').countDocuments(),
    db.collection('topics').countDocuments(),
    db.collection('exams').countDocuments({ isPublished: true }),
    db.collection('exam_subjects').countDocuments(),
    db.collection('decks').countDocuments(),
    db.collection('flashcards').countDocuments(),
  ]);
  console.log(`  subjects:      ${counts[0]}`);
  console.log(`  topics:        ${counts[1]}`);
  console.log(`  exams:         ${counts[2]} (published)`);
  console.log(`  exam_subjects: ${counts[3]}`);
  console.log(`  decks:         ${counts[4]}`);
  console.log(`  flashcards:    ${counts[5]}`);
  console.log('─────────────────────────────────────────────────────────\n');

  await client.close();
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
