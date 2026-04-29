import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';
import fs from 'fs';
import path from 'path';

const MONGODB_URI = process.env['MONGO_URL'] ?? process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/kd_dev';

async function seedJson(filePath: string) {
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`❌ File not found: ${absolutePath}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  if (!data.exams || !Array.isArray(data.exams)) {
    console.error('❌ Invalid JSON: Missing top-level "exams" array.');
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db();
  const now = new Date();

  console.log(`🌱 Seeding from: ${path.basename(filePath)}`);

  for (const examData of data.exams) {
    console.log(`\n▶ Processing Exam: ${examData.title}`);

    // 1. Upsert Exam
    const examResult = await db.collection('exams').findOneAndUpdate(
      { title: examData.title },
      {
        $setOnInsert: { createdAt: now },
        $set: {
          description: examData.description ?? '',
          category: examData.category ?? 'General',
          durationMinutes: examData.durationMinutes ?? 120,
          isPublished: true,
          updatedAt: now,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );
    const examId = examResult?._id as ObjectId;
    console.log(`  ✓ Exam upserted: ${examId}`);

    if (examData.subjects && Array.isArray(examData.subjects)) {
      for (const [sIdx, subjectData] of examData.subjects.entries()) {
        console.log(`  ▶ Subject: ${subjectData.name}`);

        // 2. Upsert Subject
        const subjectResult = await db.collection('subjects').findOneAndUpdate(
          { name: subjectData.name },
          {
            $setOnInsert: { createdAt: now },
            $set: {
              description: subjectData.description ?? '',
              iconName: subjectData.iconName ?? 'book-outline',
              accent: subjectData.accent ?? '#3B82F6',
              updatedAt: now,
            },
          },
          { upsert: true, returnDocument: 'after' }
        );
        const subjectId = subjectResult?._id as ObjectId;

        // 3. Link Exam to Subject
        await db.collection('exam_subjects').updateOne(
          { examId: examId, subjectId: subjectId },
          {
            $setOnInsert: { createdAt: now },
            $set: { order: sIdx, updatedAt: now },
          },
          { upsert: true }
        );

        if (subjectData.topics && Array.isArray(subjectData.topics)) {
          for (const [tIdx, topicData] of subjectData.topics.entries()) {
            console.log(`    ▶ Topic: ${topicData.displayName}`);

            // 4. Upsert Topic
            await db.collection('topics').updateOne(
              { subjectId: subjectId, slug: topicData.slug },
              {
                $setOnInsert: { createdAt: now },
                $set: {
                  displayName: topicData.displayName,
                  order: tIdx,
                  updatedAt: now,
                },
              },
              { upsert: true }
            );

            // 5. Upsert Decks & Flashcards for each level
            if (topicData.levels && typeof topicData.levels === 'object') {
              for (const [level, flashcards] of Object.entries(topicData.levels)) {
                const cards = flashcards as any[];
                if (!cards || cards.length === 0) continue;

                // Create or find Deck
                const deckResult = await db.collection('decks').findOneAndUpdate(
                  { subjectId: subjectId, level: level, "tags": topicData.slug },
                  {
                    $setOnInsert: { createdAt: now, createdBy: 'system' },
                    $set: {
                      title: `${topicData.displayName} — ${level}`,
                      description: `${level}-level questions on ${topicData.displayName} (${subjectData.name})`,
                      category: 'subject',
                      tags: [topicData.slug, subjectData.name, level],
                      isPublished: true,
                      updatedAt: now,
                    },
                  },
                  { upsert: true, returnDocument: 'after' }
                );
                const deckId = deckResult?._id as ObjectId;

                // Bulk insert flashcards (idempotent-ish using question text as unique identifier per deck)
                let cardsInserted = 0;
                for (const card of cards) {
                  const cardUpsert = await db.collection('flashcards').updateOne(
                    { deckId: deckId, question: card.question },
                    {
                      $setOnInsert: { createdAt: now, createdBy: 'system' },
                      $set: {
                        options: card.options,
                        correctAnswerId: card.correctAnswerId,
                        explanation: card.explanation ?? null,
                        tags: card.tags ?? [],
                        imageUrl: card.imageUrl ?? null,
                        updatedAt: now,
                      },
                    },
                    { upsert: true }
                  );
                  if (cardUpsert.upsertedCount > 0) cardsInserted++;
                }

                // Update Deck card count
                const actualCardCount = await db.collection('flashcards').countDocuments({ deckId: deckId });
                await db.collection('decks').updateOne(
                  { _id: deckId },
                  { $set: { cardCount: actualCardCount } }
                );

                console.log(`      ✓ Level ${level}: ${cardsInserted} new cards (${actualCardCount} total in deck)`);
              }
            }
          }
        }
      }
    }
  }

  console.log('\n✅ JSON Seed complete!');
  await client.close();
}

const targetFile = process.argv[2];
if (!targetFile) {
  console.error('Usage: npx tsx seed-json.ts <path-to-json-file>');
  process.exit(1);
}

seedJson(targetFile).catch((err) => {
  console.error('❌ JSON Seed failed:', err);
  process.exit(1);
});
