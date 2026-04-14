// ─── Content Repository ─────────────────────────────────────
// MongoDB data access for exams, subjects, decks, flashcards, and questions.

import { ObjectId, Filter, Sort, Document } from 'mongodb';
import { getMongoDb } from '../lib/database.js';
import { getRedisClient } from '../lib/database.js';
import type { Exam, Deck, Flashcard, Question, Subject, ExamSubject, SubjectLevel, PaginationQuery } from '@kd/shared';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@kd/shared';

// ─── Helpers ────────────────────────────────────────────────

function toId(doc: { _id: ObjectId; [key: string]: unknown }): string {
  return doc._id.toHexString();
}

function buildPagination(query: PaginationQuery) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
  const skip = (page - 1) * pageSize;
  const sort: Sort = { [query.sortBy ?? 'createdAt']: query.sortOrder === 'asc' ? 1 : -1 };
  return { page, pageSize, skip, sort };
}

// ─── Exams ──────────────────────────────────────────────────

class ExamRepository {
  private get col() {
    return getMongoDb().collection('exams');
  }

  async findMany(query: PaginationQuery & { category?: string; difficulty?: string }) {
    const { page, pageSize, skip, sort } = buildPagination(query);
    const filter: Filter<Document> = { isPublished: true };
    if (query.category) filter['category'] = query.category;
    if (query.difficulty) filter['difficulty'] = query.difficulty;

    const [docs, totalItems] = await Promise.all([
      this.col.find(filter).sort(sort).skip(skip).limit(pageSize).toArray(),
      this.col.countDocuments(filter),
    ]);

    const data: Exam[] = docs.map((doc) => ({
      id: toId(doc as unknown as { _id: ObjectId }),
      title: doc['title'] as string,
      description: doc['description'] as string,
      category: doc['category'] as string,
      difficulty: doc['difficulty'] as Exam['difficulty'],
      questionCount: (doc['questionIds'] as ObjectId[])?.length ?? 0,
      durationMinutes: doc['durationMinutes'] as number,
      createdBy: doc['createdBy'] as string,
      createdAt: (doc['createdAt'] as Date).toISOString(),
      updatedAt: (doc['updatedAt'] as Date).toISOString(),
    }));

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

  async findById(id: string) {
    const doc = await this.col.findOne({ _id: new ObjectId(id) });
    if (!doc) return null;
    return {
      id: toId(doc as unknown as { _id: ObjectId }),
      title: doc['title'] as string,
      description: doc['description'] as string,
      category: doc['category'] as string,
      difficulty: doc['difficulty'] as Exam['difficulty'],
      questionCount: (doc['questionIds'] as ObjectId[])?.length ?? 0,
      durationMinutes: doc['durationMinutes'] as number,
      createdBy: doc['createdBy'] as string,
      createdAt: (doc['createdAt'] as Date).toISOString(),
      updatedAt: (doc['updatedAt'] as Date).toISOString(),
    } as Exam;
  }
}

// ─── Decks ──────────────────────────────────────────────────

class DeckRepository {
  private get col() {
    return getMongoDb().collection('decks');
  }

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

    const data: Deck[] = docs.map((doc) => ({
      id: toId(doc as unknown as { _id: ObjectId }),
      title: doc['title'] as string,
      description: doc['description'] as string,
      category: doc['category'] as string,
      cardCount: (doc['cardCount'] as number) ?? 0,
      imageUrl: (doc['imageUrl'] as string) ?? null,
      createdBy: doc['createdBy'] as string,
      createdAt: (doc['createdAt'] as Date).toISOString(),
      updatedAt: (doc['updatedAt'] as Date).toISOString(),
    }));

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

  async findById(id: string): Promise<Deck | null> {
    // Check cache first
    const redis = getRedisClient();
    const cached = await redis.get(`cache:deck:${id}`);
    if (cached) {
      try {
        return JSON.parse(cached) as Deck;
      } catch {
        // Corrupted cache — fall through to DB
        await redis.del(`cache:deck:${id}`);
      }
    }

    const doc = await this.col.findOne({ _id: new ObjectId(id) });
    if (!doc) return null;

    const deck: Deck = {
      id: toId(doc as unknown as { _id: ObjectId }),
      title: doc['title'] as string,
      description: doc['description'] as string,
      category: doc['category'] as string,
      cardCount: (doc['cardCount'] as number) ?? 0,
      imageUrl: (doc['imageUrl'] as string) ?? null,
      createdBy: doc['createdBy'] as string,
      subjectId: doc['subjectId'] ? (doc['subjectId'] as ObjectId).toHexString() : undefined,
      level: (doc['level'] as SubjectLevel) ?? undefined,
      topicSlug: (doc['tags'] as string[])?.[0] ?? undefined,
      tags: (doc['tags'] as string[]) ?? [],
      createdAt: (doc['createdAt'] as Date).toISOString(),
      updatedAt: (doc['updatedAt'] as Date).toISOString(),
    };

    // Cache for 5 minutes
    await redis.set(`cache:deck:${id}`, JSON.stringify(deck), 'EX', 300);

    return deck;
  }

  /**
   * Finds a topic-scoped deck by its (subjectId, level, topicSlug) triple.
   * topicSlug is stored as tags[0] by seeding convention.
   * When topicSlug is omitted, returns the first deck matching (subjectId, level) —
   * useful for legacy / admin views.
   */
  async findBySubjectAndLevel(
    subjectId: string,
    level: SubjectLevel,
    topicSlug?: string,
  ): Promise<Deck | null> {
    const redis = getRedisClient();
    const cacheKey = topicSlug
      ? `cache:deck:subject:${subjectId}:${level}:${topicSlug}`
      : `cache:deck:subject:${subjectId}:${level}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as Deck;
      } catch {
        // Corrupted cache — fall through to DB
        await redis.del(cacheKey);
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

    const deck: Deck = {
      id: toId(doc as unknown as { _id: ObjectId }),
      title: doc['title'] as string,
      description: doc['description'] as string,
      category: doc['category'] as string,
      cardCount: (doc['cardCount'] as number) ?? 0,
      imageUrl: (doc['imageUrl'] as string) ?? null,
      createdBy: doc['createdBy'] as string,
      subjectId,
      level,
      topicSlug: (doc['tags'] as string[])?.[0] ?? topicSlug,
      tags: (doc['tags'] as string[]) ?? [],
      createdAt: (doc['createdAt'] as Date).toISOString(),
      updatedAt: (doc['updatedAt'] as Date).toISOString(),
    };

    await redis.set(cacheKey, JSON.stringify(deck), 'EX', 300);
    return deck;
  }
}

// ─── Flashcards ─────────────────────────────────────────────

class FlashcardRepository {
  private get col() {
    return getMongoDb().collection('flashcards');
  }

  async findByDeckId(deckId: string, query: PaginationQuery) {
    const { page, pageSize, skip } = buildPagination(query);
    const filter = { deckId: new ObjectId(deckId) };
    const sort: Sort = { order: 1 };

    const [docs, totalItems] = await Promise.all([
      this.col.find(filter).sort(sort).skip(skip).limit(pageSize).toArray(),
      this.col.countDocuments(filter),
    ]);

    const data: Flashcard[] = docs.map((doc) => ({
      id: toId(doc as unknown as { _id: ObjectId }),
      deckId: (doc['deckId'] as ObjectId).toHexString(),
      question: doc['question'] as string,
      options: doc['options'] as Flashcard['options'],
      correctAnswerId: doc['correctAnswerId'] as string,
      explanation: (doc['explanation'] as string) ?? null,
      imageUrl: (doc['imageUrl'] as string) ?? null,
      tags: (doc['tags'] as string[]) ?? [],
      createdAt: (doc['createdAt'] as Date).toISOString(),
      updatedAt: (doc['updatedAt'] as Date).toISOString(),
    }));

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

  async findByDeckIds(deckIds: string[], query: PaginationQuery) {
    const { page, pageSize, skip } = buildPagination(query);
    const filter = { deckId: { $in: deckIds.map((id) => new ObjectId(id)) } };
    const sort: Sort = { order: 1 }; // Or sorting by difficulty down the line

    const [docs, totalItems] = await Promise.all([
      this.col.find(filter).sort(sort).skip(skip).limit(pageSize).toArray(),
      this.col.countDocuments(filter),
    ]);

    const data: Flashcard[] = docs.map((doc) => ({
      id: toId(doc as unknown as { _id: ObjectId }),
      deckId: (doc['deckId'] as ObjectId).toHexString(),
      question: doc['question'] as string,
      options: doc['options'] as Flashcard['options'],
      correctAnswerId: doc['correctAnswerId'] as string,
      explanation: (doc['explanation'] as string) ?? null,
      imageUrl: (doc['imageUrl'] as string) ?? null,
      tags: (doc['tags'] as string[]) ?? [],
      createdAt: (doc['createdAt'] as Date).toISOString(),
      updatedAt: (doc['updatedAt'] as Date).toISOString(),
    }));

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

  async findById(id: string): Promise<Flashcard | null> {
    const doc = await this.col.findOne({ _id: new ObjectId(id) });
    if (!doc) return null;
    return {
      id: toId(doc as unknown as { _id: ObjectId }),
      deckId: (doc['deckId'] as ObjectId).toHexString(),
      question: doc['question'] as string,
      options: doc['options'] as Flashcard['options'],
      correctAnswerId: doc['correctAnswerId'] as string,
      explanation: (doc['explanation'] as string) ?? null,
      imageUrl: (doc['imageUrl'] as string) ?? null,
      tags: (doc['tags'] as string[]) ?? [],
      createdAt: (doc['createdAt'] as Date).toISOString(),
      updatedAt: (doc['updatedAt'] as Date).toISOString(),
    };
  }
}

// ─── Questions ──────────────────────────────────────────────

class QuestionRepository {
  private get col() {
    return getMongoDb().collection('questions');
  }

  async findByExamId(examId: string): Promise<Question[]> {
    const docs = await this.col.find({ examId: new ObjectId(examId) }).sort({ order: 1 }).toArray();

    return docs.map((doc) => ({
      id: toId(doc as unknown as { _id: ObjectId }),
      examId: (doc['examId'] as ObjectId).toHexString(),
      text: doc['text'] as string,
      options: doc['options'] as Question['options'],
      correctAnswerId: doc['correctAnswerId'] as string,
      explanation: (doc['explanation'] as string) ?? null,
      imageUrl: (doc['imageUrl'] as string) ?? null,
      points: (doc['points'] as number) ?? 1,
    }));
  }
}

// ─── Subjects ──────────────────────────────────────────────────

class SubjectRepository {
  private get col() {
    return getMongoDb().collection('subjects');
  }

  async findAll(): Promise<Subject[]> {
    const docs = await this.col.find({}).sort({ name: 1 }).toArray();
    return docs.map((doc) => this.toSubject(doc));
  }

  async findById(id: string): Promise<Subject | null> {
    const doc = await this.col.findOne({ _id: new ObjectId(id) });
    if (!doc) return null;
    return this.toSubject(doc);
  }

  /** Join through exam_subjects to get all subjects for an exam in order. */
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

    // Preserve the order defined in exam_subjects
    const docMap = new Map(docs.map((d) => [toId(d as unknown as { _id: ObjectId }), d]));
    return mappings
      .map((m) => {
        const doc = docMap.get((m['subjectId'] as ObjectId).toHexString());
        return doc ? this.toSubject(doc) : null;
      })
      .filter((s): s is Subject => s !== null);
  }

  async create(input: { name: string; description?: string; iconName?: string; accent?: string }): Promise<Subject> {
    const now = new Date();
    const result = await this.col.insertOne({
      ...input,
      createdAt: now,
      updatedAt: now,
    });
    return this.toSubject({ _id: result.insertedId, ...input, createdAt: now, updatedAt: now });
  }

  async update(id: string, updates: Partial<{ name: string; description: string; iconName: string; accent: string }>): Promise<Subject | null> {
    const result = await this.col.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { ...updates, updatedAt: new Date() } },
      { returnDocument: 'after' },
    );
    return result ? this.toSubject(result) : null;
  }

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

// ─── ExamSubjects (mapping) ──────────────────────────────────────

class ExamSubjectRepository {
  private get col() {
    return getMongoDb().collection('exam_subjects');
  }

  async findByExamId(examId: string): Promise<ExamSubject[]> {
    const docs = await this.col
      .find({ examId: new ObjectId(examId) })
      .sort({ order: 1 })
      .toArray();

    return docs.map((doc) => ({
      id: toId(doc as unknown as { _id: ObjectId }),
      examId: (doc['examId'] as ObjectId).toHexString(),
      subjectId: (doc['subjectId'] as ObjectId).toHexString(),
      order: doc['order'] as number,
    }));
  }

  async addSubjectToExam(examId: string, subjectId: string, order: number): Promise<ExamSubject> {
    const now = new Date();
    const result = await this.col.insertOne({
      examId: new ObjectId(examId),
      subjectId: new ObjectId(subjectId),
      order,
      createdAt: now,
      updatedAt: now,
    });

    return {
      id: result.insertedId.toHexString(),
      examId,
      subjectId,
      order,
    };
  }

  async removeSubjectFromExam(examId: string, subjectId: string): Promise<void> {
    await this.col.deleteOne({
      examId: new ObjectId(examId),
      subjectId: new ObjectId(subjectId),
    });
  }
}

// ─── Topics ─────────────────────────────────────────────────

export interface TopicDoc {
  id: string;
  subjectId: string;
  slug: string;
  displayName: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

class TopicRepository {
  private get col() {
    return getMongoDb().collection('topics');
  }

  /** Returns all topics for a subject, ordered by `order`. */
  async findBySubjectId(subjectId: string): Promise<TopicDoc[]> {
    const docs = await this.col
      .find({ subjectId: new ObjectId(subjectId) })
      .sort({ order: 1 })
      .toArray();

    return docs.map((doc) => this.toTopic(doc));
  }

  async findById(id: string): Promise<TopicDoc | null> {
    const doc = await this.col.findOne({ _id: new ObjectId(id) });
    if (!doc) return null;
    return this.toTopic(doc);
  }

  /** Creates a topic. Enforces unique (subjectId, slug) at the application level. */
  async create(input: {
    subjectId: string;
    slug: string;
    displayName: string;
    order?: number;
  }): Promise<TopicDoc> {
    const now = new Date();
    const subjectOid = new ObjectId(input.subjectId);

    // Duplicate slug guard
    const existing = await this.col.findOne({ subjectId: subjectOid, slug: input.slug });
    if (existing) {
      throw new Error(`Topic slug "${input.slug}" already exists for this subject`);
    }

    // Auto-assign order if not provided
    const order = input.order ?? await this.col.countDocuments({ subjectId: subjectOid });

    const result = await this.col.insertOne({
      subjectId: subjectOid,
      slug: input.slug,
      displayName: input.displayName,
      order,
      createdAt: now,
      updatedAt: now,
    });

    return this.toTopic({
      _id: result.insertedId,
      subjectId: subjectOid,
      slug: input.slug,
      displayName: input.displayName,
      order,
      createdAt: now,
      updatedAt: now,
    });
  }

  async update(
    id: string,
    updates: Partial<{ slug: string; displayName: string; order: number }>,
  ): Promise<TopicDoc | null> {
    const result = await this.col.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { ...updates, updatedAt: new Date() } },
      { returnDocument: 'after' },
    );
    return result ? this.toTopic(result) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.col.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  }

  private toTopic(doc: Document): TopicDoc {
    return {
      id: toId(doc as unknown as { _id: ObjectId }),
      subjectId: (doc['subjectId'] as ObjectId).toHexString(),
      slug: doc['slug'] as string,
      displayName: doc['displayName'] as string,
      order: (doc['order'] as number) ?? 0,
      createdAt: (doc['createdAt'] as Date).toISOString(),
      updatedAt: (doc['updatedAt'] as Date).toISOString(),
    };
  }
}

// ─── Singleton Exports ──────────────────────────────────────

export const examRepository = new ExamRepository();
export const deckRepository = new DeckRepository();
export const flashcardRepository = new FlashcardRepository();
export const questionRepository = new QuestionRepository();
export const subjectRepository = new SubjectRepository();
export const examSubjectRepository = new ExamSubjectRepository();
export const topicRepository = new TopicRepository();
