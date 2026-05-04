import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || 'postgresql://postgres:postgres@localhost:5432/kd',
});

async function run() {
  const res = await pool.query('SELECT COUNT(*) FROM study_sessions');
  console.log(`Total study sessions: ${res.rows[0].count}`);
  
  const sample = await pool.query('SELECT * FROM study_sessions ORDER BY created_at DESC LIMIT 5');
  console.log('Sample sessions:');
  console.log(JSON.stringify(sample.rows, null, 2));

  pool.end();
}

run().catch(console.error);
