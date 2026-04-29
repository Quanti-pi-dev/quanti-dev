import { MongoClient } from 'mongodb';
async function run() {
  const c = new MongoClient('mongodb+srv://quantipi_user:pimong8008@cluster0.bywwckk.mongodb.net/kd_content?appName=Cluster0');
  await c.connect();
  const deck = await c.db().collection('decks').findOne({});
  console.log(deck);
  process.exit(0);
}
run();
