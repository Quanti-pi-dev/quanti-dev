// ─── Database Client Initialization ─────────────────────────
// Singleton clients for PostgreSQL, MongoDB, and Redis.
// IMPORTANT: Every EventEmitter-based client MUST have an 'error'
// listener attached. Without one, connection drops emit an unhandled
// 'error' event that crashes the Node.js process immediately.
// Import and call connect/disconnect from server startup.

import pg from 'pg';
import { MongoClient, Db } from 'mongodb';
import { Redis } from 'ioredis';
import { config } from '../config.js';

// ─── PostgreSQL ─────────────────────────────────────────────

let pgPool: pg.Pool | null = null;

export function getPostgresPool(): pg.Pool {
  if (!pgPool) {
    pgPool = new pg.Pool({
      connectionString: config.postgres.url,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    // Absorb background errors from idle clients so they don't crash the process.
    // The pool automatically removes the broken client and creates a replacement.
    pgPool.on('error', (err: Error) => {
      console.error('[PostgreSQL] Idle client error (handled):', err.message);
    });
  }
  return pgPool;
}

// ─── MongoDB ────────────────────────────────────────────────

let mongoClient: MongoClient | null = null;
let mongoDb: Db | null = null;

export function getMongoClient(): MongoClient {
  if (!mongoClient) {
    mongoClient = new MongoClient(config.mongo.url, {
      maxPoolSize: 20,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
    });
  }
  return mongoClient;
}

export function getMongoDb(): Db {
  if (!mongoDb) {
    mongoDb = getMongoClient().db(config.mongo.dbName);
  }
  return mongoDb;
}

// ─── Redis ──────────────────────────────────────────────────

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(config.redis.url, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    // Absorb socket-level errors so the process doesn't crash.
    // ioredis will internally retry the connection per its strategy.
    redisClient.on('error', (err) => {
      console.error('[Redis] Connection error (handled):', err.message);
    });
  }
  return redisClient;
}

// ─── Lifecycle ──────────────────────────────────────────────

export async function connectDatabases(logger: { info: (msg: string) => void }): Promise<void> {
  // PostgreSQL — test connection
  const pool = getPostgresPool();
  const client = await pool.connect();
  client.release();
  logger.info('PostgreSQL connected');

  // MongoDB
  await getMongoClient().connect();
  logger.info('MongoDB connected');

  // Redis
  await getRedisClient().connect();
  logger.info('Redis connected');
}

export async function disconnectDatabases(): Promise<void> {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }
  if (mongoClient) {
    await mongoClient.close();
    mongoClient = null;
    mongoDb = null;
  }
  if (redisClient) {
    redisClient.disconnect();
    redisClient = null;
  }
}
