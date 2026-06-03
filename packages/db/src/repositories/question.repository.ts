// ─── Question Repository ─────────────────────────────────────
// MongoDB data access for exam questions.

import { ObjectId } from 'mongodb';
import { getMongoDb } from '../clients/database.js';
import type { Question } from '@kd/shared';

// ─── Helpers ────────────────────────────────────────────────

function toId(doc: { _id: ObjectId }): string {
  return doc._id.toHexString();
}

// ─── Repository ──────────────────────────────────────────────

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

export const questionRepository = new QuestionRepository();
