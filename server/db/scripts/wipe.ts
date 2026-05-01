import { MongoClient } from 'mongodb';
import { config } from '../../src/config.js';

async function wipe() {
  console.log('🚨 Wiping MongoDB Content Collections...');
  const client = new MongoClient(config.mongo.url);
  await client.connect();
  const db = client.db(config.mongo.dbName);

  const collections = ['exams', 'subjects', 'exam_subjects', 'topics', 'decks', 'flashcards'];
  
  for (const name of collections) {
    try {
      await db.collection(name).drop();
      console.log(`  🗑️  Dropped collection: ${name}`);
    } catch (err: any) {
      if (err.code === 26) {
        console.log(`  ⏭️  Collection ${name} didn't exist, skipped`);
      } else {
        throw err;
      }
    }
  }

  console.log('✅ Wipe complete!\n');
  await client.close();
}
wipe();
