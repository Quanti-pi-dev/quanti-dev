import { Client } from 'pg';
import { config } from 'dotenv';
config({ path: '../../.env' });

async function run() {
  const client = new Client({ connectionString: process.env.POSTGRES_URL });
  await client.connect();
  const res = await client.query(`
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND (column_name = 'user_id' OR column_name = 'creator_id' OR column_name = 'opponent_id' OR column_name = 'requester_id' OR column_name = 'addressee_id')
    ORDER BY table_name;
  `);
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
}
run();
