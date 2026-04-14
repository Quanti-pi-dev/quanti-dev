// ─── Platform Config Repository ──────────────────────────────
// CRUD for the platform_config table. Admin-editable key-value
// store for marketing copy, coin economy, and UI toggles.
// Redis-cached with 5-minute TTL for public reads.

import { getPostgresPool, getRedisClient } from '../lib/database.js';
import { createServiceLogger } from '../lib/logger.js';

const log = createServiceLogger('ConfigRepository');

const CACHE_KEY = 'platform_config:all';
const CACHE_TTL = 300; // 5 minutes

export interface PlatformConfigEntry {
  key: string;
  value: unknown; // JSONB — parsed
  category: string;
  description: string;
  updatedAt: string;
  updatedBy: string | null;
}

export type PlatformConfigMap = Record<string, unknown>;

class ConfigRepository {
  private get pg() {
    return getPostgresPool();
  }

  private get redis() {
    return getRedisClient();
  }

  // ─── Public Read (cached) ──────────────────────────────────

  /** Returns a flat { key: value } map. Cached in Redis for 5 mins. */
  async getPublicMap(): Promise<PlatformConfigMap> {
    try {
      const cached = await this.redis.get(CACHE_KEY);
      if (cached) return JSON.parse(cached) as PlatformConfigMap;
    } catch {
      log.warn('Redis cache miss for platform_config');
    }

    const result = await this.pg.query(
      `SELECT key, value FROM platform_config ORDER BY key`,
    );

    const map: PlatformConfigMap = {};
    for (const row of result.rows) {
      map[row.key as string] = row.value;
    }

    // Cache for 5 minutes
    try {
      await this.redis.set(CACHE_KEY, JSON.stringify(map), 'EX', CACHE_TTL);
    } catch {
      log.warn('Failed to cache platform_config');
    }

    return map;
  }

  /** Get a single config value by key. Reads from the cached map. */
  async get<T = unknown>(key: string): Promise<T | undefined> {
    const map = await this.getPublicMap();
    return map[key] as T | undefined;
  }

  /** Get a number config value with a fallback default. */
  async getNumber(key: string, fallback: number): Promise<number> {
    const val = await this.get<number>(key);
    return typeof val === 'number' ? val : fallback;
  }

  /** Get a string config value with a fallback default. */
  async getString(key: string, fallback: string): Promise<string> {
    const val = await this.get<string>(key);
    return typeof val === 'string' ? val : fallback;
  }

  // ─── Admin Read (full metadata) ───────────────────────────

  /** Returns all config entries with metadata. For admin panel. */
  async getAll(): Promise<PlatformConfigEntry[]> {
    const result = await this.pg.query(
      `SELECT key, value, category, description, updated_at, updated_by
       FROM platform_config ORDER BY category, key`,
    );

    return result.rows.map((row: Record<string, unknown>) => ({
      key: row.key as string,
      value: row.value,
      category: row.category as string,
      description: (row.description as string) ?? '',
      updatedAt: (row.updated_at as Date).toISOString(),
      updatedBy: (row.updated_by as string) ?? null,
    }));
  }

  /** Returns all config entries for a given category. */
  async getByCategory(category: string): Promise<PlatformConfigEntry[]> {
    const result = await this.pg.query(
      `SELECT key, value, category, description, updated_at, updated_by
       FROM platform_config WHERE category = $1 ORDER BY key`,
      [category],
    );

    return result.rows.map((row: Record<string, unknown>) => ({
      key: row.key as string,
      value: row.value,
      category: row.category as string,
      description: (row.description as string) ?? '',
      updatedAt: (row.updated_at as Date).toISOString(),
      updatedBy: (row.updated_by as string) ?? null,
    }));
  }

  // ─── Admin Write ──────────────────────────────────────────

  /** Upsert a config value. Invalidates cache immediately. */
  async upsert(
    key: string,
    value: unknown,
    category: string,
    description: string,
    updatedBy: string,
  ): Promise<PlatformConfigEntry> {
    const result = await this.pg.query(
      `INSERT INTO platform_config (key, value, category, description, updated_at, updated_by)
       VALUES ($1, $2, $3, $4, NOW(), $5)
       ON CONFLICT (key) DO UPDATE SET
         value = EXCLUDED.value,
         category = EXCLUDED.category,
         description = EXCLUDED.description,
         updated_at = NOW(),
         updated_by = EXCLUDED.updated_by
       RETURNING key, value, category, description, updated_at, updated_by`,
      [key, JSON.stringify(value), category, description, updatedBy],
    );

    await this.invalidateCache();

    const row = result.rows[0] as Record<string, unknown>;
    return {
      key: row.key as string,
      value: row.value,
      category: row.category as string,
      description: (row.description as string) ?? '',
      updatedAt: (row.updated_at as Date).toISOString(),
      updatedBy: (row.updated_by as string) ?? null,
    };
  }

  /** Delete a config key. Invalidates cache immediately. */
  async delete(key: string): Promise<boolean> {
    const result = await this.pg.query(
      `DELETE FROM platform_config WHERE key = $1`,
      [key],
    );
    await this.invalidateCache();
    return (result.rowCount ?? 0) > 0;
  }

  // ─── Cache Management ──────────────────────────────────────

  async invalidateCache(): Promise<void> {
    try {
      await this.redis.del(CACHE_KEY);
    } catch {
      log.warn('Failed to invalidate platform_config cache');
    }
  }
}

export const configRepository = new ConfigRepository();
