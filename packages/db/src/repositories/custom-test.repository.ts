// ─── Custom Test Repository ───────────────────────────────────────
// MongoDB storage for educator-created custom tests and student submissions.

import { ObjectId } from 'mongodb';
import { getMongoDb } from '../clients/database.js';
import { createServiceLogger } from '../lib/logger.js';
import type {
  CustomTest,
  CustomTestSettings,
  CustomTestQuestion,
  CustomTestSubmission,
  CustomTestAnswer,
  CustomTestStatus,
} from '@kd/shared';

const log = createServiceLogger('CustomTestRepository');

// ─── Collection helpers ───────────────────────────────────────────

function db() {
  return getMongoDb();
}

function testCol() {
  return db().collection('custom_tests');
}

function submissionCol() {
  return db().collection('custom_test_submissions');
}

// ─── Mappers ─────────────────────────────────────────────────────

function docToTest(doc: Record<string, unknown>): CustomTest {
  return {
    id: (doc['_id'] as ObjectId).toHexString(),
    instituteId: doc['instituteId'] as string,
    createdBy: doc['createdBy'] as string,
    title: doc['title'] as string,
    description: doc['description'] as string,
    subjectId: (doc['subjectId'] as ObjectId).toHexString(),
    topicIds: ((doc['topicIds'] as ObjectId[]) ?? []).map(id => id.toHexString()),
    questionCount: doc['questionCount'] as number,
    durationMinutes: doc['durationMinutes'] as number,
    scheduledAt: doc['scheduledAt'] ? (doc['scheduledAt'] as Date).toISOString() : null,
    closesAt: doc['closesAt'] ? (doc['closesAt'] as Date).toISOString() : null,
    status: doc['status'] as CustomTestStatus,
    settings: doc['settings'] as CustomTestSettings,
    questions: (doc['questions'] as CustomTestQuestion[]) ?? [],
    isPublished: (doc['isPublished'] as boolean) ?? false,
    createdAt: (doc['createdAt'] as Date).toISOString(),
    updatedAt: (doc['updatedAt'] as Date).toISOString(),
  };
}

function docToSubmission(doc: Record<string, unknown>): CustomTestSubmission {
  return {
    id: (doc['_id'] as ObjectId).toHexString(),
    testId: (doc['testId'] as ObjectId).toHexString(),
    studentId: doc['studentId'] as string,
    instituteId: doc['instituteId'] as string,
    answers: (doc['answers'] as CustomTestAnswer[]) ?? [],
    score: (doc['score'] as number) ?? 0,
    totalMarks: (doc['totalMarks'] as number) ?? 0,
    correctCount: (doc['correctCount'] as number) ?? 0,
    incorrectCount: (doc['incorrectCount'] as number) ?? 0,
    unattempted: (doc['unattempted'] as number) ?? 0,
    timeTakenSeconds: (doc['timeTakenSeconds'] as number) ?? 0,
    startedAt: (doc['startedAt'] as Date).toISOString(),
    submittedAt: doc['submittedAt'] ? (doc['submittedAt'] as Date).toISOString() : null,
    status: doc['status'] as CustomTestSubmission['status'],
  };
}

// ─── Custom Test Repository ───────────────────────────────────────

class CustomTestRepository {

  // ── Ensure indexes on first use ───────────────────────────────
  async ensureIndexes(): Promise<void> {
    try {
      await Promise.all([
        testCol().createIndex({ instituteId: 1, status: 1 }),
        testCol().createIndex({ instituteId: 1, createdBy: 1 }),
        testCol().createIndex({ scheduledAt: 1 }, { sparse: true }),
        submissionCol().createIndex({ testId: 1, studentId: 1 }, { unique: true }),
        submissionCol().createIndex({ testId: 1, score: -1 }),
        submissionCol().createIndex({ studentId: 1, instituteId: 1 }),
      ]);
    } catch (err) {
      log.warn({ err }, 'custom-test index creation warning (may already exist)');
    }
  }

  // ── Test CRUD ─────────────────────────────────────────────────

  async create(input: {
    instituteId: string;
    createdBy: string;
    title: string;
    description: string;
    subjectId: string;
    topicIds?: string[];
    durationMinutes: number;
    scheduledAt?: Date | null;
    closesAt?: Date | null;
    settings?: Partial<CustomTestSettings>;
    questions?: CustomTestQuestion[];
  }): Promise<CustomTest> {
    const now = new Date();
    const defaultSettings: CustomTestSettings = {
      shuffleQuestions: true,
      showResults: 'immediate',
      negativeMarking: false,
      negativeMarkValue: 0,
      passingScore: 60,
      ...input.settings,
    };
    const questions = input.questions ?? [];

    const result = await testCol().insertOne({
      instituteId: input.instituteId,
      createdBy: input.createdBy,
      title: input.title,
      description: input.description,
      subjectId: new ObjectId(input.subjectId),
      topicIds: (input.topicIds ?? []).map(id => new ObjectId(id)),
      questionCount: questions.length,
      durationMinutes: input.durationMinutes,
      scheduledAt: input.scheduledAt ?? null,
      closesAt: input.closesAt ?? null,
      status: 'draft' as CustomTestStatus,
      settings: defaultSettings,
      questions,
      isPublished: false,
      createdAt: now,
      updatedAt: now,
    });

    const doc = await testCol().findOne({ _id: result.insertedId });
    return docToTest(doc as Record<string, unknown>);
  }

  async findById(id: string): Promise<CustomTest | null> {
    if (!ObjectId.isValid(id)) return null;
    const doc = await testCol().findOne({ _id: new ObjectId(id) });
    if (!doc) return null;
    return docToTest(doc as Record<string, unknown>);
  }

  async findByInstituteId(
    instituteId: string,
    options: {
      createdBy?: string;
      status?: CustomTestStatus;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ data: CustomTest[]; total: number }> {
    const { createdBy, status, limit = 20, offset = 0 } = options;
    const query: Record<string, unknown> = { instituteId };
    if (createdBy) query['createdBy'] = createdBy;
    if (status) query['status'] = status;

    const [docs, total] = await Promise.all([
      testCol().find(query).sort({ createdAt: -1 }).skip(offset).limit(limit).toArray(),
      testCol().countDocuments(query),
    ]);

    return { data: docs.map(d => docToTest(d as Record<string, unknown>)), total };
  }

  /** Tests visible to a specific student: published, within schedule window */
  async findAssignedToStudent(
    instituteId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<{ data: CustomTest[]; total: number }> {
    const { limit = 20, offset = 0 } = options;
    const now = new Date();
    const query = {
      instituteId,
      isPublished: true,
      status: { $in: ['scheduled', 'live', 'closed', 'graded'] as CustomTestStatus[] },
      $or: [
        { scheduledAt: { $lte: now } },
        { scheduledAt: null },
      ],
    };

    const [docs, total] = await Promise.all([
      testCol().find(query).sort({ scheduledAt: -1 }).skip(offset).limit(limit).toArray(),
      testCol().countDocuments(query),
    ]);

    return { data: docs.map(d => docToTest(d as Record<string, unknown>)), total };
  }

  async update(
    id: string,
    instituteId: string,
    updates: Partial<{
      title: string;
      description: string;
      subjectId: string;
      topicIds: string[];
      durationMinutes: number;
      scheduledAt: Date | null;
      closesAt: Date | null;
      settings: Partial<CustomTestSettings>;
      questions: CustomTestQuestion[];
    }>,
  ): Promise<CustomTest | null> {
    if (!ObjectId.isValid(id)) return null;

    const setFields: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.title !== undefined)         setFields['title'] = updates.title;
    if (updates.description !== undefined)   setFields['description'] = updates.description;
    if (updates.durationMinutes !== undefined) setFields['durationMinutes'] = updates.durationMinutes;
    if (updates.scheduledAt !== undefined)   setFields['scheduledAt'] = updates.scheduledAt;
    if (updates.closesAt !== undefined)      setFields['closesAt'] = updates.closesAt;
    if (updates.settings !== undefined)      setFields['settings'] = updates.settings;
    if (updates.subjectId !== undefined)     setFields['subjectId'] = new ObjectId(updates.subjectId);
    if (updates.topicIds !== undefined)      setFields['topicIds'] = updates.topicIds.map(id => new ObjectId(id));
    if (updates.questions !== undefined) {
      setFields['questions'] = updates.questions;
      setFields['questionCount'] = updates.questions.length;
    }

    const doc = await testCol().findOneAndUpdate(
      { _id: new ObjectId(id), instituteId },
      { $set: setFields },
      { returnDocument: 'after' },
    );
    if (!doc) return null;
    return docToTest(doc as Record<string, unknown>);
  }

  async updateStatus(id: string, instituteId: string, status: CustomTestStatus): Promise<boolean> {
    if (!ObjectId.isValid(id)) return false;
    const result = await testCol().updateOne(
      { _id: new ObjectId(id), instituteId },
      { $set: { status, updatedAt: new Date() } },
    );
    return result.matchedCount > 0;
  }

  async publish(id: string, instituteId: string): Promise<CustomTest | null> {
    if (!ObjectId.isValid(id)) return null;
    const now = new Date();
    const doc = await testCol().findOne({ _id: new ObjectId(id), instituteId });
    if (!doc) return null;

    const scheduledAt = doc['scheduledAt'] as Date | null;
    const newStatus: CustomTestStatus = scheduledAt && scheduledAt > now
      ? 'scheduled'
      : 'live';

    const updated = await testCol().findOneAndUpdate(
      { _id: new ObjectId(id), instituteId },
      { $set: { isPublished: true, status: newStatus, updatedAt: now } },
      { returnDocument: 'after' },
    );
    if (!updated) return null;
    return docToTest(updated as Record<string, unknown>);
  }

  async delete(id: string, instituteId: string): Promise<boolean> {
    if (!ObjectId.isValid(id)) return false;
    // Delete all submissions first
    await submissionCol().deleteMany({ testId: new ObjectId(id) });
    const result = await testCol().deleteOne({ _id: new ObjectId(id), instituteId });
    return result.deletedCount > 0;
  }

  // ── Question Pool Integration ─────────────────────────────────
  // Fetch existing flashcards/questions from the platform pool for reuse

  async searchQuestionPool(
    subjectId: string,
    topicSlug?: string,
    limit: number = 50,
  ): Promise<Array<{ id: string; question: string; options: { id: string; text: string }[]; correctAnswerId: string; explanation: string | null; topicSlug: string | null }>> {
    const query: Record<string, unknown> = {};

    // Try to find via decks in the subject
    const decks = await db().collection('decks').find(
      { subjectId: new ObjectId(subjectId) },
      { projection: { _id: 1 } },
    ).toArray();

    if (decks.length === 0) return [];

    const deckIds = decks.map(d => d['_id'] as ObjectId);
    query['deckId'] = { $in: deckIds };
    if (topicSlug) query['tags'] = topicSlug;

    const cards = await db().collection('flashcards').find(query).limit(limit).toArray();
    return cards.map(c => ({
      id: (c['_id'] as ObjectId).toHexString(),
      question: c['question'] as string,
      options: c['options'] as { id: string; text: string }[],
      correctAnswerId: c['correctAnswerId'] as string,
      explanation: (c['explanation'] as string | null) ?? null,
      topicSlug: ((c['tags'] as string[]) ?? [])[0] ?? null,
    }));
  }

  // ── Submissions ───────────────────────────────────────────────

  async startSubmission(input: {
    testId: string;
    studentId: string;
    instituteId: string;
  }): Promise<CustomTestSubmission> {
    const now = new Date();
    // Upsert: only create if not already started
    const existing = await submissionCol().findOne({
      testId: new ObjectId(input.testId),
      studentId: input.studentId,
    });
    if (existing) return docToSubmission(existing as Record<string, unknown>);

    const test = await this.findById(input.testId);
    if (!test) throw Object.assign(new Error('TEST_NOT_FOUND'), { statusCode: 404 });

    const totalMarks = test.questions.reduce((sum, q) => sum + q.marks, 0);

    const result = await submissionCol().insertOne({
      testId: new ObjectId(input.testId),
      studentId: input.studentId,
      instituteId: input.instituteId,
      answers: [],
      score: 0,
      totalMarks,
      correctCount: 0,
      incorrectCount: 0,
      unattempted: test.questions.length,
      timeTakenSeconds: 0,
      startedAt: now,
      submittedAt: null,
      status: 'in_progress',
    });

    const doc = await submissionCol().findOne({ _id: result.insertedId });
    return docToSubmission(doc as Record<string, unknown>);
  }

  async submitAnswers(input: {
    testId: string;
    studentId: string;
    answers: CustomTestAnswer[];
    timeTakenSeconds: number;
  }): Promise<CustomTestSubmission> {
    const test = await this.findById(input.testId);
    if (!test) throw Object.assign(new Error('TEST_NOT_FOUND'), { statusCode: 404 });

    // Grade answers
    const questionMap = new Map(test.questions.map(q => [q.id, q]));
    let score = 0;
    let correctCount = 0;
    let incorrectCount = 0;

    for (const answer of input.answers) {
      if (!answer.selectedOptionId) continue;
      const question = questionMap.get(answer.questionId);
      if (!question) continue;

      if (answer.selectedOptionId === question.correctAnswerId) {
        score += question.marks;
        correctCount++;
      } else {
        incorrectCount++;
        if (test.settings.negativeMarking) {
          score -= test.settings.negativeMarkValue;
        }
      }
    }

    const attemptedCount = input.answers.filter(a => a.selectedOptionId !== null).length;
    const unattempted = test.questions.length - attemptedCount;
    const totalMarks = test.questions.reduce((sum, q) => sum + q.marks, 0);
    const finalScore = Math.max(0, score);

    const now = new Date();
    const doc = await submissionCol().findOneAndUpdate(
      { testId: new ObjectId(input.testId), studentId: input.studentId },
      {
        $set: {
          answers: input.answers,
          score: finalScore,
          totalMarks,
          correctCount,
          incorrectCount,
          unattempted,
          timeTakenSeconds: input.timeTakenSeconds,
          submittedAt: now,
          status: 'submitted',
        },
      },
      { returnDocument: 'after', upsert: false },
    );

    if (!doc) throw Object.assign(new Error('SUBMISSION_NOT_FOUND'), { statusCode: 404 });
    return docToSubmission(doc as Record<string, unknown>);
  }

  async findSubmission(testId: string, studentId: string): Promise<CustomTestSubmission | null> {
    const doc = await submissionCol().findOne({
      testId: new ObjectId(testId),
      studentId,
    });
    if (!doc) return null;
    return docToSubmission(doc as Record<string, unknown>);
  }

  async findSubmissionsByTest(
    testId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<{ data: CustomTestSubmission[]; total: number }> {
    const { limit = 50, offset = 0 } = options;
    const query = { testId: new ObjectId(testId) };
    const [docs, total] = await Promise.all([
      submissionCol().find(query).sort({ score: -1 }).skip(offset).limit(limit).toArray(),
      submissionCol().countDocuments(query),
    ]);
    return {
      data: docs.map(d => docToSubmission(d as Record<string, unknown>)),
      total,
    };
  }

  async findSubmissionsByStudent(
    studentId: string,
    instituteId: string,
  ): Promise<CustomTestSubmission[]> {
    const docs = await submissionCol()
      .find({ studentId, instituteId })
      .sort({ submittedAt: -1 })
      .toArray();
    return docs.map(d => docToSubmission(d as Record<string, unknown>));
  }

  // ── Educator Analytics ────────────────────────────────────────

  async getTestAnalytics(testId: string): Promise<{
    totalSubmissions: number;
    averageScore: number;
    averageAccuracy: number;
    averageTimeSec: number;
    passRate: number;
    scoreDistribution: { range: string; count: number }[];
    topStudents: { studentId: string; score: number; correctCount: number }[];
    questionAnalytics: { questionId: string; correctRate: number; attemptRate: number }[];
  }> {
    const test = await this.findById(testId);
    if (!test) throw new Error('TEST_NOT_FOUND');

    const submissions = await submissionCol()
      .find({ testId: new ObjectId(testId), status: { $in: ['submitted', 'graded'] } })
      .toArray();

    if (submissions.length === 0) {
      return {
        totalSubmissions: 0,
        averageScore: 0,
        averageAccuracy: 0,
        averageTimeSec: 0,
        passRate: 0,
        scoreDistribution: [],
        topStudents: [],
        questionAnalytics: [],
      };
    }

    const totalMarks = test.questions.reduce((s, q) => s + q.marks, 0);
    const passThreshold = (test.settings.passingScore / 100) * totalMarks;

    const scores = submissions.map(s => s['score'] as number);
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

    const averageScore = avg(scores);
    const passRate = (submissions.filter(s => (s['score'] as number) >= passThreshold).length / submissions.length) * 100;
    const averageAccuracy = avg(submissions.map(s => {
      const total = s['correctCount'] as number + (s['incorrectCount'] as number);
      return total === 0 ? 0 : ((s['correctCount'] as number) / total) * 100;
    }));
    const averageTimeSec = avg(submissions.map(s => s['timeTakenSeconds'] as number));

    // Score distribution (10 buckets)
    const bucketSize = totalMarks / 10;
    const scoreDistribution = Array.from({ length: 10 }, (_, i) => {
      const low = Math.round(i * bucketSize);
      const high = Math.round((i + 1) * bucketSize);
      return {
        range: `${low}–${high}`,
        count: scores.filter(s => s >= low && s < high).length,
      };
    });

    // Top 10 students
    const topStudents = submissions
      .sort((a, b) => (b['score'] as number) - (a['score'] as number))
      .slice(0, 10)
      .map(s => ({
        studentId: s['studentId'] as string,
        score: s['score'] as number,
        correctCount: s['correctCount'] as number,
      }));

    // Per-question analytics
    const questionAnalytics = test.questions.map(q => {
      const attempts = submissions.filter(s =>
        (s['answers'] as CustomTestAnswer[]).some(a => a.questionId === q.id && a.selectedOptionId !== null),
      );
      const correct = submissions.filter(s =>
        (s['answers'] as CustomTestAnswer[]).some(a => a.questionId === q.id && a.selectedOptionId === q.correctAnswerId),
      );
      return {
        questionId: q.id,
        correctRate: attempts.length === 0 ? 0 : (correct.length / attempts.length) * 100,
        attemptRate: (attempts.length / submissions.length) * 100,
      };
    });

    return {
      totalSubmissions: submissions.length,
      averageScore,
      averageAccuracy,
      averageTimeSec,
      passRate,
      scoreDistribution,
      topStudents,
      questionAnalytics,
    };
  }
}

export const customTestRepository = new CustomTestRepository();
