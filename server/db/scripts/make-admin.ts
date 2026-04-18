import { getPostgresPool } from '../../src/lib/database.js';
import { getFirebaseAdmin } from '../../src/lib/firebase-admin.js';

async function makeAdmin() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: npx tsx db/scripts/make-admin.ts <email>');
    process.exit(1);
  }

  console.log(`Elevating ${email} to admin...`);

  try {
    const admin = getFirebaseAdmin();
    const userRecord = await admin.auth().getUserByEmail(email);
    console.log(`Found user in Firebase: ${userRecord.uid}`);

    // Set custom user claims
    await admin.auth().setCustomUserClaims(userRecord.uid, { role: 'admin' });
    console.log('Successfully set Firebase custom claims to admin');

    // Update PostgreSQL users table
    const pool = getPostgresPool();
    const result = await pool.query(
      `UPDATE users SET role = 'admin' WHERE email = $1 RETURNING id`,
      [email]
    );

    if (result.rowCount === 0) {
      console.log('User not found in PostgreSQL. Firebase was updated successfully.');
    } else {
      console.log(`Successfully updated PostgreSQL user ${result.rows[0].id} to admin`);
    }

    process.exit(0);
  } catch (err) {
    console.error('Error making admin:', err);
    process.exit(1);
  }
}

makeAdmin();
