// ─── Flashcard Repository ───────────────────────────────────
// Unified read + write operations for flashcards (MongoDB).
// Includes single create, bulk create, update, and delete.

import { ObjectId, Sort, Document } from 'mongodb';
import { getMongoDb } from '../lib/database.js';
import { bustDeckCacheById } from '../lib/cache.js';
import type { Flashcard, FlashcardSource, PaginationQuery } from '@kd/shared';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@kd/shared';

// ─── Helpers ────────────────────────────────────────────────

function toId(doc: { _id: ObjectId }): string {
  return doc._id.toHexString();
}

function buildPagination(query: PaginationQuery) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
  const skip = (page - 1) * pageSize;
  return { page, pageSize, skip };
}

// ─── Types ──────────────────────────────────────────────────

export interface CreateFlashcardInput {
  question: string;
  options: { id: string; text: string }[];
  correctAnswerId: string;
  explanation?: string | null;
  imageUrl?: string | null;
  source?: FlashcardSource;
  sourceYear?: number;
  sourcePaper?: string;
  tags?: string[];
}

// ─── Repository ─────────────────────────────────────────────

class FlashcardRepository {
  private get col() {
    return getMongoDb().collection('flashcards');
  }

  // ─── Read Operations ────────────────────────────────────────

  /** Find flashcards by deck ID with pagination and optional source filter. */
  async findByDeckId(deckId: string, query: PaginationQuery & { source?: FlashcardSource } = {}) {
    const { page, pageSize, skip } = buildPagination(query);
    const filter: Record<string, unknown> = { deckId: new ObjectId(deckId) };
    if (query.source) filter.source = query.source;
    const sort: Sort = { order: 1 };

    const [docs, totalItems] = await Promise.all([
      this.col.find(filter).sort(sort).skip(skip).limit(pageSize).toArray(),
      this.col.countDocuments(filter),
    ]);

    const data: Flashcard[] = docs.map((doc) => this.toFlashcard(doc));

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

  /** Find flashcards across multiple deck IDs with pagination. */
  async findByDeckIds(deckIds: string[], query: PaginationQuery) {
    const { page, pageSize, skip } = buildPagination(query);
    const filter = { deckId: { $in: deckIds.map((id) => new ObjectId(id)) } };
    const sort: Sort = { order: 1 };

    const [docs, totalItems] = await Promise.all([
      this.col.find(filter).sort(sort).skip(skip).limit(pageSize).toArray(),
      this.col.countDocuments(filter),
    ]);

    const data: Flashcard[] = docs.map((doc) => this.toFlashcard(doc));

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

  /** Find a single flashcard by ID. */
  async findById(id: string): Promise<Flashcard | null> {
    const doc = await this.col.findOne({ _id: new ObjectId(id) });
    if (!doc) return null;
    return this.toFlashcard(doc);
  }

  // ─── Admin Read (returns order field for admin views) ──────

  /** Find flashcards by deck ID without pagination (admin). */
  async findByDeckIdAdmin(deckId: string) {
    const docs = await this.col
      .find({ deckId: new ObjectId(deckId) })
      .sort({ order: 1 })
      .toArray();
    return docs.map((doc) => ({
      ...this.toFlashcard(doc),
      order: (doc['order'] as number) ?? 0,
    }));
  }

  // ─── Write Operations ─────────────────────────────────────

  /** Create a single flashcard with auto-assigned order. */
  async create(deckId: string, input: CreateFlashcardInput): Promise<string> {
    const now = new Date();
    const deckOid = new ObjectId(deckId);

    // Get next order value
    const last = await this.col
      .find({ deckId: deckOid })
      .sort({ order: -1 })
      .limit(1)
      .toArray();
    const order = last.length > 0 ? ((last[0]?.['order'] as number) ?? 0) + 1 : 0;

    const result = await this.col.insertOne({
      deckId: deckOid,
      question: input.question,
      options: input.options,
      correctAnswerId: input.correctAnswerId,
      explanation: input.explanation ?? null,
      imageUrl: input.imageUrl ?? null,
      source: input.source ?? 'original',
      sourceYear: input.sourceYear ?? undefined,
      sourcePaper: input.sourcePaper ?? undefined,
      tags: input.tags ?? [],
      order,
      createdAt: now,
      updatedAt: now,
    });

    // Increment deck card count
    await this.incrementDeckCount(deckId, 1);
    return result.insertedId.toHexString();
  }

  /** Bulk-create flashcards with auto-assigned order. */
  async bulkCreate(deckId: string, cards: CreateFlashcardInput[]): Promise<number> {
    const deckOid = new ObjectId(deckId);
    const last = await this.col
      .find({ deckId: deckOid })
      .sort({ order: -1 })
      .limit(1)
      .toArray();
    let order = last.length > 0 ? ((last[0]?.['order'] as number) ?? 0) + 1 : 0;

    const now = new Date();
    const docs = cards.map((card) => ({
      deckId: deckOid,
      question: card.question,
      options: card.options,
      correctAnswerId: card.correctAnswerId,
      explanation: card.explanation ?? null,
      imageUrl: card.imageUrl ?? null,
      source: card.source ?? 'original',
      sourceYear: card.sourceYear ?? undefined,
      sourcePaper: card.sourcePaper ?? undefined,
      tags: card.tags ?? [],
      order: order++,
      createdAt: now,
      updatedAt: now,
    }));

    const result = await this.col.insertMany(docs);
    // Increment deck card count
    await this.incrementDeckCount(deckId, result.insertedCount);
    return result.insertedCount;
  }

  /** Update a flashcard. */
  async update(cardId: string, updates: Partial<CreateFlashcardInput>): Promise<boolean> {
    const result = await this.col.updateOne(
      { _id: new ObjectId(cardId) },
      { $set: { ...updates, updatedAt: new Date() } },
    );
    return result.matchedCount > 0;
  }

  /** Delete a flashcard (validates deckId to prevent cross-deck deletion). */
  async delete(cardId: string, deckId: string): Promise<boolean> {
    const result = await this.col.deleteOne({
      _id: new ObjectId(cardId),
      deckId: new ObjectId(deckId),
    });
    if (result.deletedCount > 0) {
      await this.incrementDeckCount(deckId, -1);
    }
    return result.deletedCount > 0;
  }

  // ─── Private Helpers ──────────────────────────────────────

  private async incrementDeckCount(deckId: string, amount: number) {
    const db = getMongoDb();
    await db.collection('decks').updateOne(
      { _id: new ObjectId(deckId) },
      { $inc: { cardCount: amount }, $set: { updatedAt: new Date() } },
    );
    // Bust all cache keys: id, legacy subject key, and hierarchy key
    await bustDeckCacheById(deckId, async (id) => {
      const doc = await db.collection('decks').findOne(
        { _id: new ObjectId(id) },
        { projection: { _id: 1, examId: 1, subjectId: 1, topicSlug: 1, tags: 1, level: 1 } },
      );
      if (!doc) return null;
      return {
        id,
        examId: doc['examId'] ? (doc['examId'] as ObjectId).toHexString() : null,
        subjectId: doc['subjectId'] ? (doc['subjectId'] as ObjectId).toHexString() : null,
        topicSlug: (doc['topicSlug'] as string) ?? (doc['tags'] as string[])?.[0] ?? null,
        level: (doc['level'] as string) ?? null,
      };
    });
  }

  private toFlashcard(doc: Document): Flashcard {
    return {
      id: toId(doc as unknown as { _id: ObjectId }),
      deckId: (doc['deckId'] as ObjectId).toHexString(),
      question: doc['question'] as string,
      options: doc['options'] as Flashcard['options'],
      correctAnswerId: doc['correctAnswerId'] as string,
      explanation: (doc['explanation'] as string) ?? null,
      imageUrl: (doc['imageUrl'] as string) ?? null,
      source: (doc['source'] as FlashcardSource) ?? 'original',
      sourceYear: (doc['sourceYear'] as number) ?? undefined,
      sourcePaper: (doc['sourcePaper'] as string) ?? undefined,
      tags: (doc['tags'] as string[]) ?? [],
      createdAt: (doc['createdAt'] as Date).toISOString(),
      updatedAt: (doc['updatedAt'] as Date).toISOString(),
    };
  }
}

// ─── Singleton Export ───────────────────────────────────────

export const flashcardRepository = new FlashcardRepository();
