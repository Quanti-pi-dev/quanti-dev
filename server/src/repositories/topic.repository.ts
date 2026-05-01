// ─── Topic Repository ───────────────────────────────────────
// Full CRUD for exam-scoped topics (MongoDB).

import { ObjectId, Document } from 'mongodb';
import { getMongoDb } from '../lib/database.js';
import type { Topic } from '@kd/shared';

// ─── Helpers ────────────────────────────────────────────────

function toId(doc: { _id: ObjectId }): string {
  return doc._id.toHexString();
}

// ─── Repository ─────────────────────────────────────────────

class TopicRepository {
  private get col() {
    return getMongoDb().collection('topics');
  }

  /** Returns all topics for a subject, ordered by `order`. */
  async findBySubjectId(subjectId: string): Promise<Topic[]> {
    const docs = await this.col
      .find({ subjectId: new ObjectId(subjectId) })
      .sort({ order: 1 })
      .toArray();

    return docs.map((doc) => this.toTopic(doc));
  }

  /** Returns all topics for an exam+subject pair, ordered by `order`. */
  async findByExamAndSubject(examId: string, subjectId: string): Promise<Topic[]> {
    const docs = await this.col
      .find({
        examId: new ObjectId(examId),
        subjectId: new ObjectId(subjectId),
      })
      .sort({ order: 1 })
      .toArray();

    return docs.map((doc) => this.toTopic(doc));
  }

  /** Find a single topic by ID. */
  async findById(id: string): Promise<Topic | null> {
    const doc = await this.col.findOne({ _id: new ObjectId(id) });
    if (!doc) return null;
    return this.toTopic(doc);
  }

  /** Find a topic by its slug within an exam+subject scope. */
  async findBySlug(examId: string, subjectId: string, slug: string): Promise<Topic | null> {
    const doc = await this.col.findOne({
      examId: new ObjectId(examId),
      subjectId: new ObjectId(subjectId),
      slug,
    });
    if (!doc) return null;
    return this.toTopic(doc);
  }

  /** Creates a topic. Enforces unique (examId, subjectId, slug) at the application level. */
  async create(input: {
    examId: string;
    subjectId: string;
    slug: string;
    displayName: string;
    order?: number;
  }): Promise<Topic> {
    const now = new Date();
    const examOid = new ObjectId(input.examId);
    const subjectOid = new ObjectId(input.subjectId);

    // Duplicate slug guard (exam-scoped)
    const existing = await this.col.findOne({ examId: examOid, subjectId: subjectOid, slug: input.slug });
    if (existing) {
      throw new Error(`Topic slug "${input.slug}" already exists for this exam/subject`);
    }

    // Auto-assign order if not provided
    const order = input.order ?? await this.col.countDocuments({ examId: examOid, subjectId: subjectOid });

    const result = await this.col.insertOne({
      examId: examOid,
      subjectId: subjectOid,
      slug: input.slug,
      displayName: input.displayName,
      order,
      createdAt: now,
      updatedAt: now,
    });

    return this.toTopic({
      _id: result.insertedId,
      examId: examOid,
      subjectId: subjectOid,
      slug: input.slug,
      displayName: input.displayName,
      order,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Update a topic's fields. */
  async update(
    id: string,
    updates: Partial<{ slug: string; displayName: string; order: number }>,
  ): Promise<Topic | null> {
    const result = await this.col.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { ...updates, updatedAt: new Date() } },
      { returnDocument: 'after' },
    );
    return result ? this.toTopic(result) : null;
  }

  /** Delete a topic by ID. */
  async delete(id: string): Promise<boolean> {
    const result = await this.col.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  }

  /**
   * Bulk-create topics for an exam+subject pair.
   * Skips any topics whose slug already exists in that scope.
   * Returns the number of topics actually inserted and the created Topic objects.
   */
  async bulkCreate(
    examId: string,
    subjectId: string,
    items: { slug: string; displayName: string; order?: number }[],
  ): Promise<{ inserted: number; skipped: number; topics: Topic[] }> {
    if (items.length === 0) return { inserted: 0, skipped: 0, topics: [] };

    const examOid = new ObjectId(examId);
    const subjectOid = new ObjectId(subjectId);

    // Find existing slugs in this scope to skip duplicates
    const existingDocs = await this.col
      .find({ examId: examOid, subjectId: subjectOid }, { projection: { slug: 1 } })
      .toArray();
    const existingSlugs = new Set(existingDocs.map((d) => d['slug'] as string));

    // Also deduplicate within the incoming batch (first occurrence wins)
    const seenInBatch = new Set<string>();
    const toInsert: typeof items = [];
    for (const item of items) {
      if (existingSlugs.has(item.slug) || seenInBatch.has(item.slug)) continue;
      seenInBatch.add(item.slug);
      toInsert.push(item);
    }

    if (toInsert.length === 0) {
      return { inserted: 0, skipped: items.length, topics: [] };
    }

    const now = new Date();
    const baseOrder = await this.col.countDocuments({ examId: examOid, subjectId: subjectOid });

    const docs = toInsert.map((item, i) => ({
      examId: examOid,
      subjectId: subjectOid,
      slug: item.slug,
      displayName: item.displayName,
      order: item.order ?? baseOrder + i,
      createdAt: now,
      updatedAt: now,
    }));

    const result = await this.col.insertMany(docs);
    const insertedIds = Object.values(result.insertedIds);

    const topics: Topic[] = docs.map((doc, i) => this.toTopic({
      _id: insertedIds[i],
      ...doc,
    }));

    return {
      inserted: toInsert.length,
      skipped: items.length - toInsert.length,
      topics,
    };
  }

  // ─── Private Helpers ──────────────────────────────────────

  private toTopic(doc: Document): Topic {
    return {
      id: toId(doc as unknown as { _id: ObjectId }),
      examId: doc['examId'] ? (doc['examId'] as ObjectId).toHexString() : '',
      subjectId: (doc['subjectId'] as ObjectId).toHexString(),
      slug: doc['slug'] as string,
      displayName: doc['displayName'] as string,
      order: (doc['order'] as number) ?? 0,
      createdAt: (doc['createdAt'] as Date).toISOString(),
      updatedAt: (doc['updatedAt'] as Date).toISOString(),
    };
  }
}

// ─── Singleton Export ───────────────────────────────────────

export const topicRepository = new TopicRepository();
