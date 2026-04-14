// ─── Runner: Seed Decks ───────────────────────────────────────────────────────
// Phase 4 — Creates topic-scoped decks: one per (topic × level) pair.
// Convention: tags[0] = topicSlug (used as uniqueness key alongside subjectId+level).
// Uses bulkWrite upsert per subject batch for performance.

import { MongoClient, ObjectId } from 'mongodb';
import { SUBJECTS, LEVELS } from '../data/taxonomy.js';

export async function seedDecks(
  db: ReturnType<MongoClient['db']>,
  subjectMap: Map<string, ObjectId>,
): Promise<Map<string, ObjectId>> {
  console.log('\n🃏 Phase 4: Seeding topic-scoped decks...');
  const col = db.collection('decks');
  const now = new Date();

  const deckMap = new Map<string, ObjectId>();

  await Promise.all(
    SUBJECTS.map(async (subject) => {
      const subjectId = subjectMap.get(subject.name);
      if (!subjectId) { console.warn(`  ⚠ SubjectId missing for: ${subject.name}`); return; }

      const ops = [];

      for (const topic of subject.topics) {
        for (const level of LEVELS) {
          const title = `${topic.displayName} — ${level}`;
          const description = `${level}-level questions on ${topic.displayName} (${subject.name})`;
          const tags = [topic.slug, subject.name, ...topic.examTags, level];

          ops.push({
            updateOne: {
              filter: { subjectId, 'tags.0': topic.slug, level },
              update: {
                $setOnInsert: { createdAt: now, createdBy: 'seed-script' },
                $set: {
                  title,
                  description,
                  category: 'subject',
                  subjectId,
                  level,
                  tags,
                  cardCount: 0,
                  imageUrl: null,
                  isPublished: true,
                  updatedAt: now,
                },
              },
              upsert: true,
            },
          });
        }
      }

      await col.bulkWrite(ops, { ordered: false });

      const docs = await col.find({ subjectId }).toArray();
      for (const doc of docs) {
        const docTags = doc['tags'] as string[];
        const topicSlug = docTags?.[0];
        const docLevel = doc['level'] as string;
        if (topicSlug && docLevel) {
          deckMap.set(`${subject.name}::${topicSlug}::${docLevel}`, doc._id as ObjectId);
        }
      }

      console.log(`  ✓ ${subject.name}: ${subject.topics.length * LEVELS.length} decks upserted`);
    }),
  );

  console.log(`  ✓ Total decks in deckMap: ${deckMap.size}`);
  return deckMap;
}

// ─── Standalone execution ─────────────────────────────────────────────────────
if (process.argv[1]?.endsWith('seed-decks.ts')) {
  import('dotenv/config').then(async () => {
    const { MongoClient } = await import('mongodb');
    const { seedSubjects } = await import('./seed-subjects.js');
    const client = new MongoClient(process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/kd_dev');
    await client.connect();
    const db = client.db();
    const subjectMap = await seedSubjects(db);
    await seedDecks(db, subjectMap);
    await client.close();
    console.log('\n✅ Decks seeded.');
  });
}
