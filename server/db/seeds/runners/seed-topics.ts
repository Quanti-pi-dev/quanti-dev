// ─── Runner: Seed Topics ──────────────────────────────────────────────────────
// Phase 1b — Populates the `topics` MongoDB collection from the seed taxonomy.
// This is the migration step that makes topics dynamic (stored in DB, not in code).
// Safe to re-run: uses bulkWrite with updateOne + upsert on (subjectId, slug).

import { MongoClient, ObjectId } from 'mongodb';
import { SUBJECTS } from '../data/taxonomy.js';

export async function seedTopics(
  db: ReturnType<MongoClient['db']>,
  subjectMap: Map<string, ObjectId>,
): Promise<void> {
  console.log('\n📖 Phase 1b: Seeding topics...');
  const col = db.collection('topics');
  const now = new Date();

  let totalCreated = 0;

  for (const subject of SUBJECTS) {
    const subjectId = subjectMap.get(subject.name);
    if (!subjectId) {
      console.warn(`  ⚠ SubjectId missing for: ${subject.name}`);
      continue;
    }

    const ops = subject.topics.map((topic, index) => ({
      updateOne: {
        filter: { subjectId, slug: topic.slug },
        update: {
          $setOnInsert: { createdAt: now },
          $set: {
            subjectId,
            slug: topic.slug,
            displayName: topic.displayName,
            order: index,
            updatedAt: now,
          },
        },
        upsert: true,
      },
    }));

    if (ops.length > 0) {
      const result = await col.bulkWrite(ops, { ordered: false });
      const upserted = result.upsertedCount;
      totalCreated += upserted;
      console.log(`  ✓ ${subject.name}: ${subject.topics.length} topics (${upserted} new)`);
    }
  }

  const total = await col.countDocuments();
  console.log(`  ✓ Total topics in collection: ${total} (${totalCreated} newly created)`);
}

// ─── Standalone execution ─────────────────────────────────────────────────────
if (process.argv[1]?.endsWith('seed-topics.ts')) {
  import('dotenv/config').then(async () => {
    const { MongoClient } = await import('mongodb');
    const { seedSubjects } = await import('./seed-subjects.js');
    const client = new MongoClient(process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/kd_dev');
    await client.connect();
    const db = client.db();
    const subjectMap = await seedSubjects(db);
    await seedTopics(db, subjectMap);
    await client.close();
    console.log('\n✅ Topics seeded.');
  });
}
