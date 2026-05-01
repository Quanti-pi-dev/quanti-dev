import { MongoClient } from 'mongodb';
import { config } from '../../src/config.js';

async function run() {
  const client = new MongoClient(config.mongo.url);
  await client.connect();
  const db = client.db(config.mongo.dbName);

  const orphanedDecks = await db.collection('decks').countDocuments({ type: 'mastery', examId: { $exists: false } });
  const orphanedTopics = await db.collection('topics').countDocuments({ examId: { $exists: false } });

  console.log(`Decks missing examId: ${orphanedDecks}`);
  console.log(`Topics missing examId: ${orphanedTopics}`);

  await client.close();
}
run();
