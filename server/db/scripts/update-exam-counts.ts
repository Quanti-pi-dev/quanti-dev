import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function run() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kd_dev';
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db();

  const exams = await db.collection('exams').find({}).toArray();

  for (const exam of exams) {
    const mappings = await db.collection('exam_subjects').find({ examId: exam._id }).toArray();
    const subjectIds = mappings.map(m => m.subjectId);
    
    if (subjectIds.length === 0) continue;

    const decks = await db.collection('decks').find({ subjectId: { $in: subjectIds } }).toArray();
    const totalCards = decks.reduce((sum, d) => sum + (d.cardCount || 0), 0);

    await db.collection('exams').updateOne(
      { _id: exam._id },
      { $set: { questionCount: totalCards, subjectCount: subjectIds.length } }
    );
    console.log(`Updated ${exam.title}: ${totalCards} flashcards, ${subjectIds.length} subjects`);
  }

  await client.close();
}

run().catch(console.error);
