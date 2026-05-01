import { getPostgresPool, getMongoDb, getRedisClient } from '../../src/lib/database.js';
import { userRepository } from '../../src/repositories/user.repository.js';
import { createServiceLogger } from '../../src/lib/logger.js';
import admin from 'firebase-admin';
import { config } from '../../src/config.js';

// Initialize firebase admin if not already
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(config.firebase.serviceAccountPath),
  });
}

const log = createServiceLogger('PurgeUsers');

async function purge() {
  const pg = getPostgresPool();
  const redis = getRedisClient();

  log.info('🚨 Starting User Purge...');

  // 1. Get all users
  const result = await pg.query(`SELECT id, firebase_uid, role FROM users`);
  const users = result.rows;

  const adminUsers = users.filter(u => u.role === 'admin');
  const nonAdminUsers = users.filter(u => u.role !== 'admin');

  log.info({
    totalUsers: users.length,
    adminsToKeep: adminUsers.length,
    usersToPurge: nonAdminUsers.length
  }, 'User stats');

  if (nonAdminUsers.length > 0) {
    // 2. Map of IDs
    const uuidsToPurge = nonAdminUsers.map(u => u.id);
    const firebaseUidsToPurge = nonAdminUsers.map(u => u.firebase_uid);

    // 3. PostgreSQL cleanup
    try {
      await pg.query('BEGIN');

      const tablesWithFirebaseUid = [
        'subscription_events',
        'coupon_redemptions',
        'payments',
        'subscriptions',
        'coin_pack_purchases',
      ];

      for (const table of tablesWithFirebaseUid) {
        const res = await pg.query(`DELETE FROM ${table} WHERE user_id = ANY($1)`, [firebaseUidsToPurge]);
        log.info(`Deleted ${res.rowCount} rows from ${table}`);
      }

      const tablesWithUuid = [
        'user_badges',
        'user_unlocked_decks',
        'coin_transactions',
        'study_sessions'
      ];

      for (const table of tablesWithUuid) {
        const res = await pg.query(`DELETE FROM ${table} WHERE user_id = ANY($1)`, [uuidsToPurge]).catch(e => ({ rowCount: 0 }));
        log.info(`Deleted ${res.rowCount} rows from ${table}`);
      }

      const resChallengesCreator = await pg.query(`DELETE FROM challenges WHERE creator_id = ANY($1)`, [uuidsToPurge]);
      const resChallengesOpponent = await pg.query(`DELETE FROM challenges WHERE opponent_id = ANY($1)`, [uuidsToPurge]);
      log.info(`Deleted ${resChallengesCreator.rowCount + resChallengesOpponent.rowCount} challenges`);

      const resFriendshipsReq = await pg.query(`DELETE FROM friendships WHERE requester_id = ANY($1)`, [uuidsToPurge]);
      const resFriendshipsAdd = await pg.query(`DELETE FROM friendships WHERE addressee_id = ANY($1)`, [uuidsToPurge]);
      log.info(`Deleted ${resFriendshipsReq.rowCount + resFriendshipsAdd.rowCount} friendships`);

      // The user_preferences table has ON DELETE CASCADE from users, so we just delete users.
      const resUsers = await pg.query(`DELETE FROM users WHERE id = ANY($1)`, [uuidsToPurge]);
      log.info(`Deleted ${resUsers.rowCount} users`);

      await pg.query('COMMIT');
      log.info('✅ PostgreSQL cleanup completed successfully.');
    } catch (err) {
      await pg.query('ROLLBACK');
      log.error({ err }, 'Failed to purge PostgreSQL data');
    }

    // 4. Redis cleanup
    try {
      log.info('🧹 Cleaning up Redis...');
      for (const uid of firebaseUidsToPurge) {
        // Keys using firebase_uid
        const pattern = `*${uid}*`;
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      }
      for (const id of uuidsToPurge) {
        // Keys using uuid (if any)
        const pattern = `*${id}*`;
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      }
      log.info('✅ Redis cleanup completed.');
    } catch (err) {
      log.warn({ err }, 'Failed to connect to Redis. Skipping Redis cleanup.');
    }
  } else {
    log.info('No non-admin users left in PostgreSQL. Proceeding to Firebase Auth cleanup.');
  }

  // 5. Firebase Auth cleanup
  log.info('🔥 Deleting orphaned/non-admin users from Firebase Auth...');
  
  const adminFirebaseUids = new Set(adminUsers.map(u => u.firebase_uid));
  const firebaseUidsToDelete: string[] = [];

  let pageToken: string | undefined = undefined;
  do {
    const listUsersResult = await admin.auth().listUsers(1000, pageToken);
    for (const userRecord of listUsersResult.users) {
      if (!adminFirebaseUids.has(userRecord.uid)) {
        firebaseUidsToDelete.push(userRecord.uid);
      }
    }
    pageToken = listUsersResult.pageToken;
  } while (pageToken);

  log.info(`Found ${firebaseUidsToDelete.length} non-admin users in Firebase Auth to delete.`);

  const batchSize = 1000;
  for (let i = 0; i < firebaseUidsToDelete.length; i += batchSize) {
    const batch = firebaseUidsToDelete.slice(i, i + batchSize);
    try {
      const deleteResult = await admin.auth().deleteUsers(batch);
      log.info(`Deleted ${deleteResult.successCount} users from Firebase Auth. Failed: ${deleteResult.failureCount}`);
      if (deleteResult.failureCount > 0) {
        deleteResult.errors.forEach((err) => {
          log.error(err.error.toJSON(), `Failed to delete user at index ${err.index}`);
        });
      }
    } catch (err) {
      log.error({ err }, 'Failed to delete users from Firebase Auth');
    }
  }

  log.info('🎉 All user data purged successfully (except admins)!');
  process.exit(0);
}

purge();
