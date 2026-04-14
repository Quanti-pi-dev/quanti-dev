// ─── Tournament Repository ───────────────────────────────────
// MongoDB-backed tournament management with admin CRUD and
// user-facing list/enter/leaderboard endpoints.

import { getMongoDb } from '../lib/database.js';
import { ObjectId } from 'mongodb';

const COLLECTION = 'tournaments';
const ENTRIES_COLLECTION = 'tournament_entries';

// ─── Types ───────────────────────────────────────────────────

export interface Tournament {
  _id: string;
  name: string;
  description: string;
  entryFeeCoins: number;
  requiredTier: number; // 0 = free, 1 = Basic, 2 = Pro, 3 = Master
  maxParticipants: number; // 0 = unlimited
  startsAt: string;
  endsAt: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  prizeDescription: string;
  prizeCoins: number; // coins awarded to winner
  rules: string;
  deckId: string | null; // optional: specific deck for the tournament
  examId: string | null; // optional: specific exam
  entryCount: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface TournamentEntry {
  _id: string;
  tournamentId: string;
  userId: string;
  score: number;
  answersCorrect: number;
  answersTotal: number;
  completedAt: string | null;
  joinedAt: string;
}

// ─── Repository ─────────────────────────────────────────────

class TournamentRepository {
  private get db() {
    return getMongoDb();
  }

  private get col() {
    return this.db.collection(COLLECTION);
  }

  private get entries() {
    return this.db.collection(ENTRIES_COLLECTION);
  }

  // ─── Admin CRUD ────────────────────────────────────────────

  async create(input: {
    name: string;
    description?: string;
    entryFeeCoins: number;
    requiredTier?: number;
    maxParticipants?: number;
    startsAt: string;
    endsAt: string;
    prizeDescription?: string;
    prizeCoins?: number;
    rules?: string;
    deckId?: string | null;
    examId?: string | null;
    createdBy: string;
  }): Promise<string> {
    const doc = {
      name: input.name,
      description: input.description ?? '',
      entryFeeCoins: input.entryFeeCoins,
      requiredTier: input.requiredTier ?? 0,
      maxParticipants: input.maxParticipants ?? 0,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      status: 'draft' as const,
      prizeDescription: input.prizeDescription ?? '',
      prizeCoins: input.prizeCoins ?? 0,
      rules: input.rules ?? '',
      deckId: input.deckId ?? null,
      examId: input.examId ?? null,
      entryCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: input.createdBy,
    };

    const result = await this.col.insertOne(doc);
    return result.insertedId.toString();
  }

  async update(id: string, updates: Partial<{
    name: string;
    description: string;
    entryFeeCoins: number;
    requiredTier: number;
    maxParticipants: number;
    startsAt: string;
    endsAt: string;
    status: Tournament['status'];
    prizeDescription: string;
    prizeCoins: number;
    rules: string;
    deckId: string | null;
    examId: string | null;
  }>): Promise<boolean> {
    const result = await this.col.updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...updates, updatedAt: new Date().toISOString() } },
    );
    return result.modifiedCount > 0;
  }

  async delete(id: string): Promise<boolean> {
    // Clean up participant entries first to prevent orphans
    await this.entries.deleteMany({ tournamentId: id });
    const result = await this.col.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  }

  async findById(id: string): Promise<Tournament | null> {
    const doc = await this.col.findOne({ _id: new ObjectId(id) });
    if (!doc) return null;
    return { ...doc, _id: doc._id.toString() } as unknown as Tournament;
  }

  /** Admin: list all tournaments */
  async listAll(): Promise<Tournament[]> {
    const docs = await this.col.find({}).sort({ startsAt: -1 }).limit(50).toArray();
    return docs.map((d) => ({ ...d, _id: d._id.toString() })) as unknown as Tournament[];
  }

  // ─── Public reads ─────────────────────────────────────────

  /** User: list active tournaments (excludes draft/completed/cancelled) */
  async listActive(): Promise<Tournament[]> {
    const docs = await this.col.find({
      status: 'active',
      endsAt: { $gte: new Date().toISOString() },
    }).sort({ startsAt: 1 }).limit(20).toArray();
    return docs.map((d) => ({ ...d, _id: d._id.toString() })) as unknown as Tournament[];
  }

  // ─── Entry Management ─────────────────────────────────────

  /** Enter a tournament — returns the entry ID, null if already entered, or 'FULL' if cap hit.
   *  H5 fix: Atomic cap enforcement via findOneAndUpdate to prevent TOCTOU race. */
  async enter(tournamentId: string, userId: string, maxParticipants: number = 0): Promise<string | null | 'FULL'> {
    // Step 1: Atomically check cap + increment entryCount
    // Only increment if below cap (or cap is 0 = unlimited)
    const capFilter: Record<string, unknown> = { _id: new ObjectId(tournamentId) };
    if (maxParticipants > 0) {
      capFilter['entryCount'] = { $lt: maxParticipants };
    }

    const capResult = await this.col.findOneAndUpdate(
      capFilter,
      { $inc: { entryCount: 1 } },
      { returnDocument: 'after' },
    );

    if (!capResult) {
      // Either tournament not found or cap was reached
      const exists = await this.col.findOne({ _id: new ObjectId(tournamentId) });
      if (!exists) return null;
      return 'FULL';
    }

    // Step 2: Insert entry (unique index prevents duplicates)
    const entry = {
      tournamentId,
      userId,
      score: 0,
      answersCorrect: 0,
      answersTotal: 0,
      completedAt: null,
      joinedAt: new Date().toISOString(),
    };

    try {
      const result = await this.entries.insertOne(entry);
      return result.insertedId.toString();
    } catch (err: unknown) {
      // Duplicate key error (code 11000) means user already entered
      // Roll back the entryCount increment
      await this.col.updateOne(
        { _id: new ObjectId(tournamentId) },
        { $inc: { entryCount: -1 } },
      );
      if (err && typeof err === 'object' && 'code' in err && (err as { code: number }).code === 11000) {
        return null;
      }
      throw err;
    }
  }

  /** Get leaderboard for a tournament */
  async getLeaderboard(tournamentId: string, limit = 20): Promise<TournamentEntry[]> {
    const docs = await this.entries.find({ tournamentId })
      .sort({ score: -1, answersCorrect: -1 })
      .limit(limit)
      .toArray();
    return docs.map((d) => ({ ...d, _id: d._id.toString() })) as unknown as TournamentEntry[];
  }

  /** Check if a user has already entered a tournament */
  async hasEntered(tournamentId: string, userId: string): Promise<boolean> {
    const count = await this.entries.countDocuments({ tournamentId, userId });
    return count > 0;
  }

  /** Update a user's score in a tournament — scores can only increase ($max) */
  async updateScore(tournamentId: string, userId: string, score: number, correct: number, total: number): Promise<boolean> {
    const result = await this.entries.updateOne(
      { tournamentId, userId },
      {
        $max: { score, answersCorrect: correct },
        $inc: { answersTotal: total },
        $set: { completedAt: new Date().toISOString() },
      },
    );
    return result.modifiedCount > 0;
  }

  /** Find expired active tournaments (for CRON completion) */
  async findExpiredActive(): Promise<Tournament[]> {
    const docs = await this.col.find({
      status: 'active',
      endsAt: { $lt: new Date().toISOString() },
    }).toArray();
    return docs.map((d) => ({ ...d, _id: d._id.toString() })) as unknown as Tournament[];
  }

  /** Mark a tournament as completed */
  async markCompleted(id: string): Promise<boolean> {
    const result = await this.col.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: 'completed', updatedAt: new Date().toISOString() } },
    );
    return result.modifiedCount > 0;
  }

  /** Ensure required MongoDB indexes exist */
  async ensureIndexes(): Promise<void> {
    await this.entries.createIndex(
      { tournamentId: 1, userId: 1 },
      { unique: true, background: true },
    );
  }
}

export const tournamentRepository = new TournamentRepository();
