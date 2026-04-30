// ─── Exam Repository ────────────────────────────────────────
// Unified read + write operations for exams (MongoDB).
// Read operations used by content routes, write operations by admin routes.

import { ObjectId, Document } from 'mongodb';
import { getMongoDb } from '../lib/database.js';
import { getRedisClient } from '../lib/database.js';
import { CacheKey } from '../lib/cache.js';
import type { Exam, PaginationQuery } from '@kd/shared';
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

interface CreateExamInput {
  title: string;
  description: string;
  category: string;
  durationMinutes: number;
  createdBy: string;
}

// ─── Repository ─────────────────────────────────────────────

class ExamRepository {
  private get col() {
    return getMongoDb().collection('exams');
  }

  // ─── Read Operations ────────────────────────────────────────

  /** List published exams (student-facing). */
  async findMany(query: PaginationQuery & { category?: string }) {
    return this.findPublished(query);
  }

  /** List published exams (student-facing). */
  async findPublished(query: PaginationQuery) {
    const { page, pageSize, skip, sort } = buildPagination(query);
    const filter = { isPublished: true };
    const [docs, totalItems] = await Promise.all([
      this.col.find(filter).sort(sort).skip(skip).limit(pageSize).toArray(),
      this.col.countDocuments(filter),
    ]);
    return {
      data: docs.map((doc) => this.toExam(doc)),
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

  /** Find a single exam by ID. */
  async findById(id: string): Promise<Exam | null> {
    const doc = await this.col.findOne({ _id: new ObjectId(id) });
    if (!doc) return null;
    return this.toExam(doc);
  }

  // ─── Admin Write Operations ────────────────────────────────

  /** List all exams (admin — includes unpublished). */
  async findAll({ page = 1, pageSize = 50 }: { page?: number; pageSize?: number } = {}) {
    const skip = (page - 1) * pageSize;
    const [docs, total] = await Promise.all([
      this.col.find({}).sort({ createdAt: -1 }).skip(skip).limit(pageSize).toArray(),
      this.col.countDocuments(),
    ]);
    return {
      data: docs.map((doc) => ({
        ...this.toExam(doc),
        isPublished: (doc['isPublished'] as boolean) ?? false,
      })),
      total,
      page,
      pageSize,
    };
  }

  /** Toggle published state. Returns new published value. */
  async togglePublished(id: string): Promise<boolean> {
    const doc = await this.col.findOne({ _id: new ObjectId(id) });
    if (!doc) return false;
    const newVal = !((doc['isPublished'] as boolean) ?? false);
    await this.col.updateOne(
      { _id: new ObjectId(id) },
      { $set: { isPublished: newVal, updatedAt: new Date() } },
    );
    await getRedisClient().unlink(CacheKey.exam(id));
    return newVal;
  }

  /** Create an exam. */
  async create(input: CreateExamInput): Promise<string> {
    const now = new Date();
    const result = await this.col.insertOne({
      ...input,
      questionIds: [],
      isPublished: false,
      createdAt: now,
      updatedAt: now,
    });
    return result.insertedId.toHexString();
  }

  /** Update an exam. */
  async update(id: string, updates: Partial<CreateExamInput & { isPublished: boolean }>) {
    const result = await this.col.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { ...updates, updatedAt: new Date() } },
      { returnDocument: 'after' },
    );
    await getRedisClient().unlink(CacheKey.exam(id));
    return result;
  }

  /** Delete an exam and cascade to questions + exam_subjects. */
  async delete(id: string): Promise<boolean> {
    await Promise.all([
      getMongoDb().collection('questions').deleteMany({ examId: new ObjectId(id) }),
      getMongoDb().collection('exam_subjects').deleteMany({ examId: new ObjectId(id) }),
    ]);
    const result = await this.col.deleteOne({ _id: new ObjectId(id) });
    await getRedisClient().unlink(CacheKey.exam(id));
    return result.deletedCount > 0;
  }

  // ─── Private Helpers ──────────────────────────────────────

  private toExam(doc: Document): Exam {
    return {
      id: toId(doc as unknown as { _id: ObjectId }),
      title: doc['title'] as string,
      description: doc['description'] as string,
      category: doc['category'] as string,
      questionCount: ((doc['questionIds'] as unknown[]) ?? []).length,
      subjectCount: (doc['subjectCount'] as number) ?? 0,
      durationMinutes: doc['durationMinutes'] as number,
      createdBy: doc['createdBy'] as string,
      createdAt: (doc['createdAt'] as Date).toISOString(),
      updatedAt: (doc['updatedAt'] as Date).toISOString(),
    };
  }
}

// ─── Singleton Export ───────────────────────────────────────

export const examRepository = new ExamRepository();
