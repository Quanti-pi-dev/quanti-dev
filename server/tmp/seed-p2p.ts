// ─── Postgres-Only P2P Seed ────────────────────────────────────
// Seeds PostgreSQL users, friendships, and challenges with dummy Mongo IDs.
// Run: npx tsx --env-file=.env tmp/seed-p2p.ts

import pg from 'pg';

const postgresUrl = process.env.POSTGRES_URL || 'postgresql://kd_user:kd_secret_dev@localhost:5432/kd_study';

async function seed() {
  console.log('🌱 Starting Postgres-Only P2P Seed...');
  
  const pgPool = new pg.Pool({ connectionString: postgresUrl });
  const pgClient = await pgPool.connect();

  try {
    // 1. Seed Users
    console.log('👤 Seeding users...');
    
    const aliceAuth0Id = 'auth0|alice-' + Date.now();
    const bobAuth0Id = 'auth0|bob-' + Date.now();

    const aliceRes = await pgClient.query(`
      INSERT INTO users (auth0_id, email, display_name, role)
      VALUES ($1, 'alice@example.com', 'Alice Test', 'student')
      ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
      RETURNING id
    `, [aliceAuth0Id]);

    const bobRes = await pgClient.query(`
      INSERT INTO users (auth0_id, email, display_name, role)
      VALUES ($1, 'bob@example.com', 'Bob Test', 'student')
      ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
      RETURNING id
    `, [bobAuth0Id]);

    const alicePgId = aliceRes.rows[0].id;
    const bobPgId = bobRes.rows[0].id;

    // Ensure preferences
    await pgClient.query('INSERT INTO user_preferences (user_id) VALUES ($1), ($2) ON CONFLICT (user_id) DO NOTHING', [alicePgId, bobPgId]);

    // 2. Seed Friendship
    await pgClient.query(`
      INSERT INTO friendships (requester_id, addressee_id, status)
      VALUES ($1, $2, 'accepted')
      ON CONFLICT (requester_id, addressee_id) DO UPDATE SET status = 'accepted'
    `, [alicePgId, bobPgId]);

    // 3. Seed Challenge
    // Using hardcoded BSON-like strings for MongoDB IDs
    const dummyExamId = '507f1f77bcf86cd799439011';
    const dummySubjectId = '507f1f77bcf86cd799439012';
    const dummyDeckId = '507f1f77bcf86cd799439013';

    await pgClient.query(`
      INSERT INTO challenges (
        creator_id, opponent_id, deck_id, exam_id, subject_id, level, 
        bet_amount, duration_seconds, status, 
        expires_at, started_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'accepted', NOW() + INTERVAL '1 hour', NOW())
    `, [alicePgId, bobPgId, dummyDeckId, dummyExamId, dummySubjectId, 'Beginner', 100, 120]);

    console.log(`✅ Seeded PostgreSQL! \nFriendship: Alice <-> Bob\nActive Challenge pointing to dummy MongoDB IDs.`);

  } catch (err) {
    console.error('❌ Seeding failed:', err);
  } finally {
    pgClient.release();
    await pgPool.end();
  }
}

seed();
