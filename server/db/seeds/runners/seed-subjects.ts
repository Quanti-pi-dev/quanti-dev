// ─── Runner: Seed Subjects ────────────────────────────────────────────────────
// Phase 1 — Upserts 10 subjects into the global subjects collection.
// Safe to re-run: uses bulkWrite with updateOne + upsert.

import { MongoClient, ObjectId } from 'mongodb';
import { SUBJECTS } from '../data/taxonomy.js';

export async function seedSubjects(db: ReturnType<MongoClient['db']>): Promise<Map<string, ObjectId>> {
  console.log('\n📚 Phase 1: Seeding subjects...');
  const col = db.collection('subjects');
  const now = new Date();

  const ops = SUBJECTS.map((s) => ({
    updateOne: {
      filter: { name: s.name },
      update: {
        $setOnInsert: { createdAt: now },
        $set: {
          name: s.name,
          description: s.description,
          iconName: s.iconName,
          accent: s.accent,
          updatedAt: now,
        },
      },
      upsert: true,
    },
  }));

  await col.bulkWrite(ops, { ordered: false });

  const docs = await col.find({ name: { $in: SUBJECTS.map((s) => s.name) } }).toArray();
  const subjectMap = new Map<string, ObjectId>(
    docs.map((d) => [d['name'] as string, d._id as ObjectId]),
  );

  console.log(`  ✓ ${subjectMap.size} subjects upserted`);
  return subjectMap;
}

// ─── Standalone execution ─────────────────────────────────────────────────────
if (process.argv[1]?.endsWith('seed-subjects.ts')) {
  import('dotenv/config').then(async () => {
    const { MongoClient } = await import('mongodb');
    const client = new MongoClient(process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/kd_dev');
    await client.connect();
    await seedSubjects(client.db());
    await client.close();
    console.log('\n✅ Subjects seeded.');
  });
}
