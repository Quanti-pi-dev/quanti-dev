// ─── Database Client Re-exports ─────────────────────────────
// Single import point for all database client functions.
// Both server-user and server-admin import from here.

export {
  getPostgresPool,
  getMongoClient,
  getMongoDb,
  getRedisClient,
  connectDatabases,
  disconnectDatabases,
} from './database.js';
