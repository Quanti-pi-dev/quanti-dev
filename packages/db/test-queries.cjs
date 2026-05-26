const fs = require('fs');
const env = fs.readFileSync('../../.env', 'utf8');
const urlMatch = env.match(/POSTGRES_URL=([^\\n]+)/);
if (!urlMatch) process.exit(1);
const url = urlMatch[1].trim();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: url });
async function run() {
  const res = await pool.query('SELECT id, firebase_uid FROM users LIMIT 1');
  const id = res.rows[0].id;
  const firebaseUid = res.rows[0].firebase_uid;
  
  try {
    await pool.query(`
         SELECT p.id, p.amount_paise, p.status, p.created_at, p.razorpay_payment_id
         FROM payments p
         WHERE p.user_id = $1
         ORDER BY p.created_at DESC
         LIMIT 10`,
        [firebaseUid]
    );
    console.log('Query 3A Success');
  } catch(e) { console.error('Query 3A Error:', e.message); }

  try {
    await pool.query(`
         SELECT firebase_uid FROM users WHERE id = $1`,
        [id]
    );
    console.log('Query 3B Success');
  } catch(e) { console.error('Query 3B Error:', e.message); }

  try {
    await pool.query(`
         SELECT s.id, s.status, s.start_date, s.end_date, s.cancel_at_period_end, s.created_at,
              p.display_name AS plan_name, p.tier AS plan_tier, p.billing_cycle
         FROM subscriptions s
         JOIN plans p ON p.id = s.plan_id
         WHERE s.user_id = $1
         ORDER BY s.created_at DESC
         LIMIT 10`,
        [firebaseUid]
    );
    console.log('Query 3C Success');
  } catch(e) { console.error('Query 3C Error:', e.message); }

  try {
    await pool.query(`
          SELECT DISTINCT ON (s.user_id) u.id as uuid, p.tier 
           FROM subscriptions s 
           JOIN users u ON u.firebase_uid = s.user_id
           JOIN plans p ON p.id = s.plan_id 
           WHERE u.id = ANY($1) AND s.status IN ('active', 'trialing', 'past_due')
           ORDER BY s.user_id, s.created_at DESC
    `, [[id]]);
    console.log('Query 2 Success');
  } catch(e) { console.error('Query 2 Error:', e.message); }

  pool.end();
}
run();
