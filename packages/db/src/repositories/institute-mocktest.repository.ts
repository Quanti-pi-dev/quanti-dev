// ─── Institute Mock Test Repository ──────────────────────────────
// MongoDB storage for examiner-created mock tests that mirror official
// exam formats (NEET, JEE, etc.). Separate from custom_tests because
// mock tests have section rules locked to exam templates.

import { ObjectId } from 'mongodb';
import { getMongoDb } from '../clients/database.js';
import { createServiceLogger } from '../lib/logger.js';
import type {
  InstituteMockTest,
  InstituteMockTestSection,
  InstituteMockTestStatus,
} from '@kd/shared';

const log = createServiceLogger('InstituteMockTestRepository');

function db() { return getMongoDb(); }
function col() { return db().collection('institute_mock_tests'); }

function docToMockTest(doc: Record<string, unknown>): InstituteMockTest {
  return {
    id: (doc['_id'] as ObjectId).toHexString(),
    instituteId: doc['instituteId'] as string,
    createdBy: doc['createdBy'] as string,
    examTemplateId: (doc['examTemplateId'] as ObjectId).toHexString(),
    examTemplateName: doc['examTemplateName'] as string | undefined,
    title: doc['title'] as string,
    sections: ((doc['sections'] as Array<Record<string, unknown>>) ?? []).map(s => ({
      subjectId: (s['subjectId'] as ObjectId).toHexString(),
      subjectName: s['subjectName'] as string | undefined,
      questionCount: s['questionCount'] as number,
      questionIds: ((s['questionIds'] as ObjectId[]) ?? []).map(id => id.toHexString()),
      marksPerCorrect: s['marksPerCorrect'] as number,
      marksPerIncorrect: s['marksPerIncorrect'] as number,
    })) as InstituteMockTestSection[],
    totalQuestions: doc['totalQuestions'] as number,
    totalMarks: doc['totalMarks'] as number,
    durationMinutes: doc['durationMinutes'] as number,
    scheduledAt: doc['scheduledAt'] ? (doc['scheduledAt'] as Date).toISOString() : null,
    closesAt: doc['closesAt'] ? (doc['closesAt'] as Date).toISOString() : null,
    status: doc['status'] as InstituteMockTestStatus,
    settings: doc['settings'] as InstituteMockTest['settings'],
    createdAt: (doc['createdAt'] as Date).toISOString(),
    updatedAt: (doc['updatedAt'] as Date).toISOString(),
  };
}

class InstituteMockTestRepository {

  async ensureIndexes(): Promise<void> {
    try {
      await Promise.all([
        col().createIndex({ instituteId: 1, status: 1 }),
        col().createIndex({ instituteId: 1, createdBy: 1 }),
        col().createIndex({ examTemplateId: 1 }),
      ]);
    } catch (err) {
      log.warn({ err }, 'mock-test index creation warning');
    }
  }

  async create(input: {
    instituteId: string;
    createdBy: string;
    examTemplateId: string;
    examTemplateName?: string;
    title: string;
    sections: Omit<InstituteMockTestSection, 'subjectName'>[];
    durationMinutes: number;
    scheduledAt?: Date | null;
    closesAt?: Date | null;
    settings?: Partial<InstituteMockTest['settings']>;
  }): Promise<InstituteMockTest> {
    const now = new Date();

    // Compute totals from sections
    const totalQuestions = input.sections.reduce((s, sec) => s + sec.questionCount, 0);
    const totalMarks = input.sections.reduce(
      (s, sec) => s + sec.questionCount * sec.marksPerCorrect,
      0,
    );

    const result = await col().insertOne({
      instituteId: input.instituteId,
      createdBy: input.createdBy,
      examTemplateId: new ObjectId(input.examTemplateId),
      examTemplateName: input.examTemplateName ?? null,
      title: input.title,
      sections: input.sections.map(sec => ({
        subjectId: new ObjectId(sec.subjectId),
        questionCount: sec.questionCount,
        questionIds: sec.questionIds.map(id => new ObjectId(id)),
        marksPerCorrect: sec.marksPerCorrect,
        marksPerIncorrect: sec.marksPerIncorrect,
      })),
      totalQuestions,
      totalMarks,
      durationMinutes: input.durationMinutes,
      scheduledAt: input.scheduledAt ?? null,
      closesAt: input.closesAt ?? null,
      status: 'draft' as InstituteMockTestStatus,
      settings: {
        sectionSwitching: false,
        calculatorAllowed: false,
        ...input.settings,
      },
      createdAt: now,
      updatedAt: now,
    });

    const doc = await col().findOne({ _id: result.insertedId });
    return docToMockTest(doc as Record<string, unknown>);
  }

  async findById(id: string): Promise<InstituteMockTest | null> {
    if (!ObjectId.isValid(id)) return null;
    const doc = await col().findOne({ _id: new ObjectId(id) });
    if (!doc) return null;
    return docToMockTest(doc as Record<string, unknown>);
  }

  async findByInstituteId(
    instituteId: string,
    options: { status?: InstituteMockTestStatus; limit?: number; offset?: number } = {},
  ): Promise<{ data: InstituteMockTest[]; total: number }> {
    const { status, limit = 20, offset = 0 } = options;
    const query: Record<string, unknown> = { instituteId };
    if (status) query['status'] = status;

    const [docs, total] = await Promise.all([
      col().find(query).sort({ createdAt: -1 }).skip(offset).limit(limit).toArray(),
      col().countDocuments(query),
    ]);
    return { data: docs.map(d => docToMockTest(d as Record<string, unknown>)), total };
  }

  async update(
    id: string,
    instituteId: string,
    updates: Partial<{
      title: string;
      sections: Omit<InstituteMockTestSection, 'subjectName'>[];
      durationMinutes: number;
      scheduledAt: Date | null;
      closesAt: Date | null;
      settings: Partial<InstituteMockTest['settings']>;
    }>,
  ): Promise<InstituteMockTest | null> {
    if (!ObjectId.isValid(id)) return null;

    const setFields: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.title !== undefined)           setFields['title'] = updates.title;
    if (updates.durationMinutes !== undefined) setFields['durationMinutes'] = updates.durationMinutes;
    if (updates.scheduledAt !== undefined)     setFields['scheduledAt'] = updates.scheduledAt;
    if (updates.closesAt !== undefined)        setFields['closesAt'] = updates.closesAt;
    if (updates.settings !== undefined)        setFields['settings'] = updates.settings;
    if (updates.sections !== undefined) {
      setFields['sections'] = updates.sections.map(sec => ({
        subjectId: new ObjectId(sec.subjectId),
        questionCount: sec.questionCount,
        questionIds: sec.questionIds.map(id => new ObjectId(id)),
        marksPerCorrect: sec.marksPerCorrect,
        marksPerIncorrect: sec.marksPerIncorrect,
      }));
      setFields['totalQuestions'] = updates.sections.reduce((s, sec) => s + sec.questionCount, 0);
      setFields['totalMarks'] = updates.sections.reduce(
        (s, sec) => s + sec.questionCount * sec.marksPerCorrect, 0,
      );
    }

    const doc = await col().findOneAndUpdate(
      { _id: new ObjectId(id), instituteId },
      { $set: setFields },
      { returnDocument: 'after' },
    );
    if (!doc) return null;
    return docToMockTest(doc as Record<string, unknown>);
  }

  async publish(id: string, instituteId: string): Promise<InstituteMockTest | null> {
    if (!ObjectId.isValid(id)) return null;
    const now = new Date();
    const doc = await col().findOne({ _id: new ObjectId(id), instituteId });
    if (!doc) return null;

    const scheduledAt = doc['scheduledAt'] as Date | null;
    const newStatus: InstituteMockTestStatus = scheduledAt && scheduledAt > now
      ? 'scheduled'
      : 'live';

    const updated = await col().findOneAndUpdate(
      { _id: new ObjectId(id), instituteId },
      { $set: { status: newStatus, updatedAt: now } },
      { returnDocument: 'after' },
    );
    if (!updated) return null;
    return docToMockTest(updated as Record<string, unknown>);
  }

  async delete(id: string, instituteId: string): Promise<boolean> {
    if (!ObjectId.isValid(id)) return false;
    const result = await col().deleteOne({ _id: new ObjectId(id), instituteId });
    return result.deletedCount > 0;
  }
}

export const instituteMockTestRepository = new InstituteMockTestRepository();
