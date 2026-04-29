import { getPostgresPool } from './src/lib/database.js';

async function check() {
  const pool = getPostgresPool();
  const res = await pool.query('SELECT slug, tier, features FROM plans;');
  console.log(JSON.stringify(res.rows, null, 2));
  process.exit(0);
}

check();
