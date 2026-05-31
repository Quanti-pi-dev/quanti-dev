// ─── Card Annotation Service ─────────────────────────────────
// Allows users to attach personal notes to any flashcard.
//
// Psychology (Blueprint §4.2 — Investment Loop):
//   Every annotation is stored value that cannot be exported to
//   a competitor. The more notes a user writes, the more painful
//   it becomes to abandon the platform. Annotations also improve
//   retention through elaborative encoding.
//
// Storage: MongoDB `card_annotations` collection.
//   - Compound unique index on { userId, cardId } (one note per card per user)
//   - Retrieved in O(1) via the index during card hydration

import { ObjectId, Document } from 'mongodb';
import { getMongoDb } from '../clients/database.js';
import { createServiceLogger } from '../lib/logger.js';

const log = createServiceLogger('CardAnnotationService');

// ─── Types ──────────────────────────────────────────────────

export interface CardAnnotation {
  id: string;
  userId: string;      // firebase_uid
  cardId: string;      // MongoDB ObjectId hex
  note: string;        // free-text personal note (max 2000 chars)
  createdAt: string;
  updatedAt: string;
}

// ─── Service ────────────────────────────────────────────────

class CardAnnotationService {
  private get col() {
    return getMongoDb().collection('card_annotations');
  }

  // ─── Upsert: create or replace the note for a card ────────
  // Called on PUT /annotations/:cardId — idempotent.

  async upsert(userId: string, cardId: string, note: string): Promise<CardAnnotation> {
    const now = new Date();
    const trimmed = note.trim().slice(0, 2000);

    const result = await this.col.findOneAndUpdate(
      { userId, cardId },
      {
        $set: { note: trimmed, updatedAt: now },
        $setOnInsert: { userId, cardId, createdAt: now },
      },
      { upsert: true, returnDocument: 'after' },
    );

    log.debug({ userId, cardId }, 'annotation upserted');
    return this.toAnnotation(result!);
  }

  // ─── Find a single annotation ─────────────────────────────

  async findOne(userId: string, cardId: string): Promise<CardAnnotation | null> {
    const doc = await this.col.findOne({ userId, cardId });
    return doc ? this.toAnnotation(doc) : null;
  }

  // ─── Find all annotations for a user (with optional deckId scope) ─

  async findByUser(
    userId: string,
    opts: { cardIds?: string[] } = {},
  ): Promise<CardAnnotation[]> {
    const filter: Record<string, unknown> = { userId };
    if (opts.cardIds && opts.cardIds.length > 0) {
      filter['cardId'] = { $in: opts.cardIds };
    }
    const docs = await this.col
      .find(filter)
      .sort({ updatedAt: -1 })
      .limit(500)
      .toArray();
    return docs.map((d) => this.toAnnotation(d));
  }

  // ─── Delete a user's annotation from a card ───────────────

  async delete(userId: string, cardId: string): Promise<boolean> {
    const result = await this.col.deleteOne({ userId, cardId });
    return result.deletedCount > 0;
  }

  // ─── Count annotations for a user (investment depth metric) ─

  async countByUser(userId: string): Promise<number> {
    return this.col.countDocuments({ userId });
  }

  // ─── Private ──────────────────────────────────────────────

  private toAnnotation(doc: Document): CardAnnotation {
    return {
      id: (doc['_id'] as ObjectId).toHexString(),
      userId: doc['userId'] as string,
      cardId: doc['cardId'] as string,
      note: doc['note'] as string,
      createdAt: (doc['createdAt'] as Date).toISOString(),
      updatedAt: (doc['updatedAt'] as Date).toISOString(),
    };
  }
}

// ─── Singleton Export ───────────────────────────────────────

export const cardAnnotationService = new CardAnnotationService();
