// ─── Runner: Seed Flashcards ──────────────────────────────────────────────────
// Phase 5 — Inserts real MCQ flashcards into their topic-scoped decks.
//
// Level resolution:
//   • QuestionDef.level set   → inserted into that specific level-deck only.
//   • QuestionDef.level omit  → inserted into ALL 6 level-decks for that topic.
//
// Idempotent: skips decks whose cardCount > 0.
// Performance: chunked insertMany (500 cards/chunk).

import { ObjectId, type Db, type Collection, type Document } from 'mongodb';
import { SUBJECTS, LEVELS } from '../data/taxonomy.js';
import type { SubjectName } from '../data/taxonomy.js';
import type { QuestionDef } from '../data/types.js';

// ─── Question file imports ────────────────────────────────────────────────────

const QUESTION_LOADERS: Record<SubjectName, () => Promise<QuestionDef[]>> = {
  'Physics':                  () => import('../data/questions/physics.js').then((m) => m.physicsQuestions),
  'Chemistry':                () => import('../data/questions/chemistry.js').then((m) => m.chemistryQuestions),
  'Mathematics':              () => import('../data/questions/mathematics.js').then((m) => m.mathematicsQuestions),
  'Botany':                   () => import('../data/questions/botany.js').then((m) => m.botanyQuestions),
  'Zoology':                  () => import('../data/questions/zoology.js').then((m) => m.zoologyQuestions),
  'Quantitative Aptitude':    () => import('../data/questions/quantitative-aptitude.js').then((m) => m.quantitativeAptitudeQuestions),
  'Logical Reasoning':        () => import('../data/questions/logical-reasoning.js').then((m) => m.logicalReasoningQuestions),
  'English & Verbal Ability': () => import('../data/questions/english-verbal.js').then((m) => m.englishVerbalQuestions),
  'Legal Reasoning':          () => import('../data/questions/legal-reasoning.js').then((m) => m.legalReasoningQuestions),
  'Current Affairs & GK':     () => import('../data/questions/current-affairs-gk/index.js').then((m) => m.currentAffairsGkQuestions),
};

const CHUNK_SIZE = 500;

async function chunkInsert(col: Collection<Document>, docs: Document[]): Promise<number> {
  let inserted = 0;
  for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
    const result = await col.insertMany(docs.slice(i, i + CHUNK_SIZE), { ordered: false });
    inserted += result.insertedCount;
  }
  return inserted;
}

// ─── Main seeder ──────────────────────────────────────────────────────────────

export async function seedFlashcards(
  db: Db,
  subjectMap: Map<string, ObjectId>,
): Promise<void> {
  console.log('\n⚡ Phase 5: Seeding flashcards...');
  const decksCol = db.collection('decks');
  const cardsCol: Collection<Document> = db.collection('flashcards');
  const now = new Date();
  let totalInserted = 0;
  let totalSkipped  = 0;

  for (const subject of SUBJECTS) {
    const subjectId = subjectMap.get(subject.name);
    if (!subjectId) continue;

    let allQuestions: QuestionDef[];
    try {
      allQuestions = await QUESTION_LOADERS[subject.name]();
    } catch {
      console.warn(`  ⚠ No question file for ${subject.name} — skipping`);
      continue;
    }

    const levelIndex = new Map<string, Map<string, QuestionDef[]>>();
    const topicIndex = new Map<string, QuestionDef[]>();

    for (const q of allQuestions) {
      if (q.level) {
        if (!levelIndex.has(q.topicSlug)) levelIndex.set(q.topicSlug, new Map());
        const lm = levelIndex.get(q.topicSlug)!;
        if (!lm.has(q.level)) lm.set(q.level, []);
        lm.get(q.level)!.push(q);
      } else {
        if (!topicIndex.has(q.topicSlug)) topicIndex.set(q.topicSlug, []);
        topicIndex.get(q.topicSlug)!.push(q);
      }
    }

    console.log(`\n  📖 ${subject.name}`);

    for (const topic of subject.topics) {
      const topicFallback = topicIndex.get(topic.slug) ?? [];

      for (const level of LEVELS) {
        const deck = await decksCol.findOne({ subjectId, 'tags.0': topic.slug, level });
        if (!deck) { console.warn(`    ⚠ Deck missing: ${topic.slug}/${level}`); continue; }

        const deckId = deck._id as ObjectId;
        if ((deck['cardCount'] as number) > 0) { totalSkipped++; continue; }

        const questions = levelIndex.get(topic.slug)?.get(level) ?? topicFallback;

        if (questions.length === 0) {
          console.warn(`    ⚠ No questions: ${topic.slug}/${level}`);
          continue;
        }

        const docs = questions.map((q, idx) => ({
          deckId,
          question: q.question,
          options: q.options,
          correctAnswerId: q.correctAnswerId,
          explanation: q.explanation,
          tags: [...q.tags, level],
          imageUrl: null,
          order: idx,
          createdAt: now,
          updatedAt: now,
        }));

        const inserted = await chunkInsert(cardsCol, docs);
        await decksCol.updateOne({ _id: deckId }, { $set: { cardCount: inserted, updatedAt: now } });
        totalInserted += inserted;
      }
    }

    console.log(`  ✓ ${subject.name} done`);
  }

  console.log(`\n  ✅ Inserted: ${totalInserted} cards | Skipped (already populated): ${totalSkipped} decks`);
}

// ─── Standalone ───────────────────────────────────────────────────────────────
if (process.argv[1]?.endsWith('seed-flashcards.ts')) {
  import('dotenv/config').then(async () => {
    const { MongoClient } = await import('mongodb');
    const { seedSubjects } = await import('./seed-subjects.js');
    const client = new MongoClient(process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/kd_dev');
    await client.connect();
    const db = client.db();
    const subjectMap = await seedSubjects(db);
    await seedFlashcards(db, subjectMap);
    await client.close();
    console.log('\n✅ Flashcards seeded.');
  });
}
