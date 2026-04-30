// ─── Subject Repository ─────────────────────────────────────
// Full CRUD for subjects + ExamSubject M:N mapping (MongoDB).

import { ObjectId, Document } from 'mongodb';
import { getMongoDb } from '../lib/database.js';
import type { Subject, ExamSubject } from '@kd/shared';

// ─── Helpers ────────────────────────────────────────────────

function toId(doc: { _id: ObjectId }): string {
  return doc._id.toHexString();
}

// ─── Subject Repository ─────────────────────────────────────

class SubjectRepository {
  private get col() {
    return getMongoDb().collection('subjects');
  }

  /** Find all subjects. */
  async findAll(): Promise<Subject[]> {
    const docs = await this.col.find({}).sort({ name: 1 }).toArray();
    return docs.map((doc) => this.toSubject(doc));
  }

  /** Find a subject by ID. */
  async findById(id: string): Promise<Subject | null> {
    const doc = await this.col.findOne({ _id: new ObjectId(id) });
    if (!doc) return null;
    return this.toSubject(doc);
  }

  /**
   * Join through exam_subjects to get all subjects for an exam in display order.
   * Used by the student-facing /exams/:id/subjects endpoint.
   */
  async findByExamId(examId: string): Promise<Subject[]> {
    const db = getMongoDb();
    const mappings = await db
      .collection('exam_subjects')
      .find({ examId: new ObjectId(examId) })
      .sort({ order: 1 })
      .toArray();

    if (mappings.length === 0) return [];

    const subjectIds = mappings.map((m) => m['subjectId'] as ObjectId);
    const docs = await this.col.find({ _id: { $in: subjectIds } }).toArray();

    // Preserve exam_subjects order
    const docMap = new Map(docs.map((d) => [toId(d as unknown as { _id: ObjectId }), d]));
    return mappings
      .map((m) => {
        const doc = docMap.get((m['subjectId'] as ObjectId).toHexString());
        return doc ? this.toSubject(doc) : null;
      })
      .filter((s): s is Subject => s !== null);
  }

  /** Create a subject. */
  async create(input: { name: string; description?: string; iconName?: string; accent?: string }): Promise<Subject> {
    const now = new Date();
    const result = await this.col.insertOne({
      ...input,
      createdAt: now,
      updatedAt: now,
    });
    return this.toSubject({
      _id: result.insertedId,
      ...input,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Update a subject. */
  async update(id: string, updates: Partial<{ name: string; description: string; iconName: string; accent: string }>): Promise<Subject | null> {
    const result = await this.col.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { ...updates, updatedAt: new Date() } },
      { returnDocument: 'after' },
    );
    return result ? this.toSubject(result) : null;
  }

  /** Delete a subject. */
  async delete(id: string): Promise<boolean> {
    const result = await this.col.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  }

  // ─── Private ──────────────────────────────────────────────

  private toSubject(doc: Document): Subject {
    return {
      id: toId(doc as unknown as { _id: ObjectId }),
      name: doc['name'] as string,
      description: (doc['description'] as string) ?? undefined,
      iconName: (doc['iconName'] as string) ?? undefined,
      accent: (doc['accent'] as string) ?? undefined,
      createdAt: (doc['createdAt'] as Date).toISOString(),
      updatedAt: (doc['updatedAt'] as Date).toISOString(),
    };
  }
}

// ─── ExamSubject Repository ─────────────────────────────────
// Manages the M:N mapping between exams and subjects.

class ExamSubjectRepository {
  private get col() {
    return getMongoDb().collection('exam_subjects');
  }

  /** Find all subject mappings for an exam. */
  async findByExamId(examId: string): Promise<ExamSubject[]> {
    const docs = await this.col
      .find({ examId: new ObjectId(examId) })
      .sort({ order: 1 })
      .toArray();
    return docs.map((doc) => this.toExamSubject(doc));
  }

  /** Find a single mapping. */
  async findOne(examId: string, subjectId: string): Promise<ExamSubject | null> {
    const doc = await this.col.findOne({
      examId: new ObjectId(examId),
      subjectId: new ObjectId(subjectId),
    });
    if (!doc) return null;
    return this.toExamSubject(doc);
  }

  /** Create a new exam-subject mapping. */
  async create(examId: string, subjectId: string, order?: number): Promise<ExamSubject> {
    const now = new Date();
    const count = order ?? await this.col.countDocuments({ examId: new ObjectId(examId) });
    const result = await this.col.insertOne({
      examId: new ObjectId(examId),
      subjectId: new ObjectId(subjectId),
      order: count,
      createdAt: now,
      updatedAt: now,
    });
    return {
      id: result.insertedId.toHexString(),
      examId,
      subjectId,
      order: count,
    };
  }

  /** Remove a mapping. */
  async remove(examId: string, subjectId: string): Promise<void> {
    await this.col.deleteOne({
      examId: new ObjectId(examId),
      subjectId: new ObjectId(subjectId),
    });
  }

  /** Reorder a mapping. */
  async reorder(examId: string, subjectId: string, newOrder: number): Promise<boolean> {
    const result = await this.col.updateOne(
      { examId: new ObjectId(examId), subjectId: new ObjectId(subjectId) },
      { $set: { order: newOrder, updatedAt: new Date() } },
    );
    return result.matchedCount > 0;
  }

  // ─── Private ──────────────────────────────────────────────

  private toExamSubject(doc: Document): ExamSubject {
    return {
      id: toId(doc as unknown as { _id: ObjectId }),
      examId: (doc['examId'] as ObjectId).toHexString(),
      subjectId: (doc['subjectId'] as ObjectId).toHexString(),
      order: (doc['order'] as number) ?? 0,
    };
  }
}

// ─── Singleton Exports ──────────────────────────────────────

export const subjectRepository = new SubjectRepository();
export const examSubjectRepository = new ExamSubjectRepository();
