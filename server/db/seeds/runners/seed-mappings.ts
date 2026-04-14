// ─── Runner: Seed Exam-Subject Mappings ───────────────────────────────────────
// Phase 3 — Creates exam_subjects join records.
// Idempotent: unique index on (examId, subjectId) prevents duplicates.

import { MongoClient, ObjectId } from 'mongodb';
import { EXAM_SUBJECT_MAP } from '../data/taxonomy.js';

export async function seedMappings(
  db: ReturnType<MongoClient['db']>,
  examMap: Map<string, ObjectId>,
  subjectMap: Map<string, ObjectId>,
): Promise<void> {
  console.log('\n🔗 Phase 3: Seeding exam-subject mappings...');
  const col = db.collection('exam_subjects');
  const now = new Date();

  let created = 0;
  let skipped = 0;

  for (const [examTitle, subjectNames] of Object.entries(EXAM_SUBJECT_MAP)) {
    const examId = examMap.get(examTitle);
    if (!examId) { console.warn(`  ⚠ Exam not found: ${examTitle}`); continue; }

    for (let order = 0; order < subjectNames.length; order++) {
      const subjectName = subjectNames[order]!;
      const subjectId = subjectMap.get(subjectName);
      if (!subjectId) { console.warn(`  ⚠ Subject not found: ${subjectName}`); continue; }

      const exists = await col.findOne({ examId, subjectId });
      if (exists) {
        skipped++;
        continue;
      }

      await col.insertOne({ examId, subjectId, order, createdAt: now, updatedAt: now });
      created++;
      console.log(`  ✓ ${examTitle} ← ${subjectName} (order ${order})`);
    }
  }

  console.log(`  ✓ ${created} mappings created, ${skipped} already existed`);
}

// ─── Standalone execution ─────────────────────────────────────────────────────
if (process.argv[1]?.endsWith('seed-mappings.ts')) {
  import('dotenv/config').then(async () => {
    const { MongoClient } = await import('mongodb');
    const { seedSubjects } = await import('./seed-subjects.js');
    const { seedExams } = await import('./seed-exams.js');
    const client = new MongoClient(process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/kd_dev');
    await client.connect();
    const db = client.db();
    const [subjectMap, examMap] = await Promise.all([seedSubjects(db), seedExams(db)]);
    await seedMappings(db, examMap, subjectMap);
    await client.close();
    console.log('\n✅ Mappings seeded.');
  });
}
