// ─── Deck Repository ────────────────────────────────────────
// Unified read + write operations for decks (MongoDB).
// Includes the new `findByHierarchy()` method for exam-scoped lookups.

import { ObjectId, Filter, Document } from 'mongodb';
import { getMongoDb } from '../lib/database.js';
import { getRedisClient } from '../lib/database.js';
import { CacheKey, CACHE_TTL, bustDeckCache } from '../lib/cache.js';
import type { Deck, DeckType, SubjectLevel, PaginationQuery } from '@kd/shared';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@kd/shared';

// ─── Helpers ────────────────────────────────────────────────

function toId(doc: { _id: ObjectId }): string {
  return doc._id.toHexString();
}

function buildPagination(query: PaginationQuery) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
  const skip = (page - 1) * pageSize;
  const sortField = query.sortBy ?? 'createdAt';
  const sortDir = query.sortOrder === 'asc' ? 1 : -1;
  return { page, pageSize, skip, sort: { [sortField]: sortDir } as Record<string, 1 | -1> };
}

// ─── Types ──────────────────────────────────────────────────

interface CreateDeckInput {
  title: string;
  description: string;
  category: string;
  type?: DeckType;
  examId?: string;
  subjectId?: string;
  topicId?: string;
  topicSlug?: string;
  level?: SubjectLevel;
  imageUrl?: string | null;
  tags?: string[];
  createdBy: string;
}

// ─── Repository ─────────────────────────────────────────────

class DeckRepository {
  private get col() {
    return getMongoDb().collection('decks');
  }

  // ─── Read Operations ────────────────────────────────────────

  /** List published decks with optional category/search filter. */
  async findMany(query: PaginationQuery & { category?: string; categories?: string[]; search?: string }) {
    const { page, pageSize, skip, sort } = buildPagination(query);
    const filter: Filter<Document> = { isPublished: true };
    if (query.categories && query.categories.length > 0) {
      filter['category'] = { $in: query.categories };
    } else if (query.category) {
      filter['category'] = query.category;
    }
    if (query.search) filter['$text'] = { $search: query.search };

    const [docs, totalItems] = await Promise.all([
      this.col.find(filter).sort(sort).skip(skip).limit(pageSize).toArray(),
      this.col.countDocuments(filter),
    ]);

    const data: Deck[] = docs.map((doc) => this.toDeck(doc));

    return {
      data,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
        hasNextPage: page * pageSize < totalItems,
        hasPreviousPage: page > 1,
      },
    };
  }

  /** Find a single deck by ID (cached). */
  async findById(id: string): Promise<Deck | null> {
    const redis = getRedisClient();
    const cached = await redis.get(`cache:deck:${id}`);
    if (cached) {
      try {
        return JSON.parse(cached) as Deck;
      } catch {
        await redis.del(`cache:deck:${id}`);
      }
    }

    const doc = await this.col.findOne({ _id: new ObjectId(id) });
    if (!doc) return null;

    const deck = this.toDeck(doc);
    await redis.set(`cache:deck:${id}`, JSON.stringify(deck), 'EX', 300);
    return deck;
  }

  /** Find deck by subject + level + optional topicSlug (legacy, cached). */
  async findBySubjectAndLevel(
    subjectId: string,
    level: SubjectLevel,
    topicSlug?: string,
  ): Promise<Deck | null> {
    const redis = getRedisClient();
    const legacyKey = CacheKey.deckSubject(subjectId, level, topicSlug);
    const cached = await redis.get(legacyKey);
    if (cached) {
      try {
        return JSON.parse(cached) as Deck;
      } catch {
        await redis.unlink(legacyKey);
      }
    }

    const filter: Record<string, unknown> = {
      subjectId: new ObjectId(subjectId),
      level,
      isPublished: true,
    };
    if (topicSlug) filter['tags'] = topicSlug;

    const doc = await this.col.findOne(filter);
    if (!doc) return null;

    const deck = this.toDeck(doc);

    // Write legacy key (always)
    await redis.set(legacyKey, JSON.stringify(deck), 'EX', CACHE_TTL.DECK);

    // Also write hierarchy key if the deck has full exam-scoped metadata
    if (deck.examId && topicSlug) {
      const hierarchyKey = CacheKey.deckHierarchy(deck.examId, subjectId, topicSlug, level);
      await redis.set(hierarchyKey, JSON.stringify(deck), 'EX', CACHE_TTL.DECK);
    }

    return deck;
  }

  /**
   * Find deck by the full hierarchy path (new, compound-indexed).
   * Uses the `idx_deck_hierarchy` index for O(1) lookup.
   */
  async findByHierarchy(
    examId: string,
    subjectId: string,
    topicSlug: string,
    level: SubjectLevel,
  ): Promise<Deck | null> {
    const redis = getRedisClient();
    const cacheKey = CacheKey.deckHierarchy(examId, subjectId, topicSlug, level);
    const cached = await redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as Deck;
      } catch {
        await redis.unlink(cacheKey);
      }
    }

    const doc = await this.col.findOne({
      examId: new ObjectId(examId),
      subjectId: new ObjectId(subjectId),
      topicSlug,
      level,
      isPublished: true,
    });
    if (!doc) return null;

    const deck = this.toDeck(doc);
    await redis.set(cacheKey, JSON.stringify(deck), 'EX', CACHE_TTL.DECK);
    return deck;
  }

  /**
   * Find the best deck for a given exam+subject+level combination without
   * requiring a topicSlug. Picks the published deck with the most cards
   * (highest cardCount) so challenges always get the richest content pool.
   *
   * Used by: challenge.service.ts — challenges are scoped to subject+level,
   * not to a specific topic.
   */
  async findFirstByExamSubjectLevel(
    examId: string,
    subjectId: string,
    level: SubjectLevel,
  ): Promise<Deck | null> {
    const doc = await this.col.findOne(
      {
        examId: new ObjectId(examId),
        subjectId: new ObjectId(subjectId),
        level,
        isPublished: true,
      },
      { sort: { cardCount: -1 } }, // prefer the deck with the most cards
    );
    if (!doc) return null;
    return this.toDeck(doc);
  }

  /**
   * Find or auto-create a mastery deck for the given hierarchy.
   * Used by admin bulk-import flows. Extracts duplicated logic from admin routes.
   */
  async findOrCreateForHierarchy(
    examId: string,
    subjectId: string,
    topicSlug: string,
    level: SubjectLevel,
    createdBy: string,
    meta?: { subjectName?: string; topicId?: string },
  ): Promise<Deck> {
    // Try to find existing deck (skip the published filter for admin)
    const existing = await this.col.findOne({
      examId: new ObjectId(examId),
      subjectId: new ObjectId(subjectId),
      topicSlug,
      level,
    });

    if (existing) return this.toDeck(existing);

    const now = new Date();
    const subjectName = meta?.subjectName ?? 'Unknown';
    const result = await this.col.insertOne({
      title: `${topicSlug} — ${level}`,
      description: `${level}-level questions on ${topicSlug} (${subjectName})`,
      type: 'mastery',
      category: 'subject',
      examId: new ObjectId(examId),
      subjectId: new ObjectId(subjectId),
      topicId: meta?.topicId ? new ObjectId(meta.topicId) : null,
      topicSlug,
      level,
      tags: [topicSlug, subjectName, level],
      cardCount: 0,
      imageUrl: null,
      isPublished: true,
      createdBy,
      createdAt: now,
      updatedAt: now,
    });

    return this.toDeck({
      _id: result.insertedId,
      title: `${topicSlug} — ${level}`,
      description: `${level}-level questions on ${topicSlug} (${subjectName})`,
      type: 'mastery',
      category: 'subject',
      examId: new ObjectId(examId),
      subjectId: new ObjectId(subjectId),
      topicId: meta?.topicId ? new ObjectId(meta.topicId) : null,
      topicSlug,
      level,
      tags: [topicSlug, subjectName, level],
      cardCount: 0,
      imageUrl: null,
      isPublished: true,
      createdBy,
      createdAt: now,
      updatedAt: now,
    });
  }

  // ─── Admin Write Operations ────────────────────────────────

  /** List all decks (admin — includes unpublished, supports search). */
  async findAllAdmin({ page = 1, pageSize = 50, search }: { page?: number; pageSize?: number; search?: string } = {}) {
    const skip = (page - 1) * pageSize;
    const query: Record<string, unknown> = {};
    if (search) {
      if (ObjectId.isValid(search)) {
        query._id = new ObjectId(search);
      } else {
        query.title = { $regex: search, $options: 'i' };
      }
    }
    const [docs, total] = await Promise.all([
      this.col.find(query).sort({ createdAt: -1 }).skip(skip).limit(pageSize).toArray(),
      this.col.countDocuments(query),
    ]);
    return {
      data: docs.map((doc) => ({
        ...this.toDeck(doc),
        isPublished: (doc['isPublished'] as boolean) ?? false,
      })),
      total,
      page,
      pageSize,
    };
  }

  /** Create a deck. */
  async create(input: CreateDeckInput): Promise<string> {
    const now = new Date();
    const insertDoc: Record<string, unknown> = {
      title: input.title,
      description: input.description,
      type: input.type ?? 'standalone',
      category: input.category,
      cardCount: 0,
      isPublished: false,
      tags: input.tags ?? [],
      imageUrl: input.imageUrl ?? null,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    };
    if (input.examId) insertDoc.examId = new ObjectId(input.examId);
    if (input.subjectId) insertDoc.subjectId = new ObjectId(input.subjectId);
    if (input.topicId) insertDoc.topicId = new ObjectId(input.topicId);
    if (input.topicSlug) insertDoc.topicSlug = input.topicSlug;
    if (input.level) insertDoc.level = input.level;

    const result = await this.col.insertOne(insertDoc);
    return result.insertedId.toHexString();
  }

  /** Update a deck. */
  async update(id: string, updates: Partial<CreateDeckInput & { isPublished: boolean }>) {
    const result = await this.col.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { ...updates, updatedAt: new Date() } },
      { returnDocument: 'after' },
    );
    await this.bustCache(id);
    return result;
  }

  /** Delete a deck and its flashcards. */
  async delete(id: string): Promise<boolean> {
    await getMongoDb().collection('flashcards').deleteMany({ deckId: new ObjectId(id) });
    const result = await this.col.deleteOne({ _id: new ObjectId(id) });
    await this.bustCache(id);
    return result.deletedCount > 0;
  }

  /** Increment or decrement card count. */
  async incrementCardCount(deckId: string, amount: number) {
    await this.col.updateOne(
      { _id: new ObjectId(deckId) },
      { $inc: { cardCount: amount }, $set: { updatedAt: new Date() } },
    );
    await this.bustCache(deckId);
  }

  // ─── Private Helpers ──────────────────────────────────────

  /**
   * Bust all cache keys for a given deck ID.
   * Fetches the deck from Mongo to get hierarchy metadata, then busts all associated keys.
   */
  private async bustCache(deckId: string) {
    const doc = await this.col.findOne({ _id: new ObjectId(deckId) }, {
      projection: { _id: 1, examId: 1, subjectId: 1, topicSlug: 1, tags: 1, level: 1 },
    });

    await bustDeckCache({
      id: deckId,
      examId: doc?.['examId'] ? (doc['examId'] as ObjectId).toHexString() : null,
      subjectId: doc?.['subjectId'] ? (doc['subjectId'] as ObjectId).toHexString() : null,
      topicSlug: (doc?.['topicSlug'] as string) ?? (doc?.['tags'] as string[])?.[0] ?? null,
      level: (doc?.['level'] as string) ?? null,
    });
  }

  private toDeck(doc: Document): Deck {
    return {
      id: toId(doc as unknown as { _id: ObjectId }),
      title: doc['title'] as string,
      description: doc['description'] as string,
      type: (doc['type'] as DeckType) ?? (doc['category'] === 'subject' ? 'mastery' : doc['category'] === 'shop' ? 'shop' : 'standalone'),
      category: doc['category'] as string,
      cardCount: (doc['cardCount'] as number) ?? 0,
      imageUrl: (doc['imageUrl'] as string) ?? null,
      createdBy: doc['createdBy'] as string,
      examId: doc['examId'] ? (doc['examId'] as ObjectId).toHexString() : undefined,
      subjectId: doc['subjectId'] ? (doc['subjectId'] as ObjectId).toHexString() : undefined,
      topicId: doc['topicId'] ? (doc['topicId'] as ObjectId).toHexString() : undefined,
      level: (doc['level'] as SubjectLevel) ?? undefined,
      topicSlug: (doc['topicSlug'] as string) ?? (doc['tags'] as string[])?.[0] ?? undefined,
      tags: (doc['tags'] as string[]) ?? [],
      createdAt: (doc['createdAt'] as Date).toISOString(),
      updatedAt: (doc['updatedAt'] as Date).toISOString(),
    };
  }
}

// ─── Singleton Export ───────────────────────────────────────

export const deckRepository = new DeckRepository();
