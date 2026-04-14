// ─── Runner: Seed Exams ───────────────────────────────────────────────────────
// Phase 2 — Upserts 5 exams into the exams collection.
// Safe to re-run: uses bulkWrite with updateOne + upsert.

import { MongoClient, ObjectId } from 'mongodb';
import { EXAMS } from '../data/taxonomy.js';

export async function seedExams(db: ReturnType<MongoClient['db']>): Promise<Map<string, ObjectId>> {
  console.log('\n📝 Phase 2: Seeding exams...');
  const col = db.collection('exams');
  const now = new Date();

  const ops = EXAMS.map((e) => ({
    updateOne: {
      filter: { title: e.title },
      update: {
        $setOnInsert: { createdAt: now, createdBy: 'seed-script' },
        $set: {
          title: e.title,
          description: e.description,
          category: e.category,
          difficulty: e.difficulty,
          durationMinutes: e.durationMinutes,
          isPublished: true,
          updatedAt: now,
        },
      },
      upsert: true,
    },
  }));

  await col.bulkWrite(ops, { ordered: false });

  const docs = await col.find({ title: { $in: EXAMS.map((e) => e.title) } }).toArray();
  const examMap = new Map<string, ObjectId>(
    docs.map((d) => [d['title'] as string, d._id as ObjectId]),
  );

  console.log(`  ✓ ${examMap.size} exams upserted`);
  return examMap;
}

// ─── Standalone execution ─────────────────────────────────────────────────────
if (process.argv[1]?.endsWith('seed-exams.ts')) {
  import('dotenv/config').then(async () => {
    const { MongoClient } = await import('mongodb');
    const client = new MongoClient(process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/kd_dev');
    await client.connect();
    await seedExams(client.db());
    await client.close();
    console.log('\n✅ Exams seeded.');
  });
}
