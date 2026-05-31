// ─── User Deck Service ────────────────────────────────────────
// Allows users to create, manage, and share personal study decks.
//
// Psychology (Blueprint §4.2 — Investment Loop):
//   Every card a student adds to a custom deck is effort invested that
//   cannot be replicated elsewhere. Sharing decks with friends adds a
//   social dimension — the user becomes a content creator AND gains
//   social capital within their friend group. The combination of
//   effort + social identity makes abandonment progressively more costly.
//
// Data model:
//   - `user_decks` collection (MongoDB): deck metadata + owner
//   - `user_deck_cards` collection (MongoDB): cards in user decks
//   - `user_deck_shares` collection (MongoDB): share links/friends
//
// All write operations are owner-gated. Read access is extended to
// users with an active share record.

import { ObjectId, Document } from 'mongodb';
import { getMongoDb } from '../clients/database.js';
import { createServiceLogger } from '../lib/logger.js';

const log = createServiceLogger('UserDeckService');

// ─── Types ──────────────────────────────────────────────────

export interface UserDeckCard {
  id: string;
  deckId: string;
  question: string;
  options: Array<{ id: string; text: string }>;
  correctAnswerId: string;
  explanation: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserDeck {
  id: string;
  ownerId: string;       // firebase_uid
  title: string;
  description: string;
  cardCount: number;
  /** Whether the deck can be found/cloned by friends. */
  isShared: boolean;
  /** Friends who have been explicitly granted access. */
  sharedWithUserIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserDeckInput {
  title: string;
  description?: string;
}

export interface CreateUserDeckCardInput {
  question: string;
  options: Array<{ id: string; text: string }>;
  correctAnswerId: string;
  explanation?: string | null;
}

// ─── Service ────────────────────────────────────────────────

class UserDeckService {
  private get decks() {
    return getMongoDb().collection('user_decks');
  }

  private get cards() {
    return getMongoDb().collection('user_deck_cards');
  }

  // ═══════════════════════════════════════════════════════════
  // DECK OPERATIONS
  // ═══════════════════════════════════════════════════════════

  /** Create a new personal study deck for the given user. */
  async createDeck(ownerId: string, input: CreateUserDeckInput): Promise<UserDeck> {
    const now = new Date();
    const result = await this.decks.insertOne({
      ownerId,
      title: input.title.trim().slice(0, 200),
      description: (input.description ?? '').trim().slice(0, 1000),
      cardCount: 0,
      isShared: false,
      sharedWithUserIds: [],
      createdAt: now,
      updatedAt: now,
    });

    log.info({ ownerId, deckId: result.insertedId.toHexString() }, 'user deck created');

    return {
      id: result.insertedId.toHexString(),
      ownerId,
      title: input.title.trim().slice(0, 200),
      description: (input.description ?? '').trim().slice(0, 1000),
      cardCount: 0,
      isShared: false,
      sharedWithUserIds: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
  }

  /** List all decks owned by the user (most recently updated first). */
  async listByOwner(ownerId: string): Promise<UserDeck[]> {
    const docs = await this.decks
      .find({ ownerId })
      .sort({ updatedAt: -1 })
      .limit(100)
      .toArray();
    return docs.map((d) => this.toDeck(d));
  }

  /** List all decks explicitly shared WITH this user by others. */
  async listSharedWithUser(userId: string): Promise<UserDeck[]> {
    const docs = await this.decks
      .find({ sharedWithUserIds: userId, isShared: true })
      .sort({ updatedAt: -1 })
      .limit(50)
      .toArray();
    return docs.map((d) => this.toDeck(d));
  }

  /** Find a single deck — asserts read access (owner or shared recipient). */
  async findByIdWithAccess(deckId: string, requesterId: string): Promise<UserDeck | null> {
    const doc = await this.decks.findOne({ _id: new ObjectId(deckId) });
    if (!doc) return null;

    const deck = this.toDeck(doc);
    const isOwner = deck.ownerId === requesterId;
    const isRecipient = deck.sharedWithUserIds.includes(requesterId);

    if (!isOwner && !isRecipient) return null; // access denied
    return deck;
  }

  /** Update title or description. Only the owner can update. */
  async update(
    deckId: string,
    ownerId: string,
    updates: Partial<Pick<UserDeck, 'title' | 'description'>>,
  ): Promise<boolean> {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.title !== undefined) set['title'] = updates.title.trim().slice(0, 200);
    if (updates.description !== undefined) set['description'] = updates.description.trim().slice(0, 1000);

    const result = await this.decks.updateOne(
      { _id: new ObjectId(deckId), ownerId },
      { $set: set },
    );
    return result.matchedCount > 0;
  }

  /** Delete the deck and all its cards. Only the owner can delete. */
  async deleteDeck(deckId: string, ownerId: string): Promise<boolean> {
    const result = await this.decks.deleteOne({ _id: new ObjectId(deckId), ownerId });
    if (result.deletedCount > 0) {
      await this.cards.deleteMany({ deckId });
      log.info({ ownerId, deckId }, 'user deck deleted');
    }
    return result.deletedCount > 0;
  }

  // ═══════════════════════════════════════════════════════════
  // SHARE OPERATIONS
  // ═══════════════════════════════════════════════════════════

  /**
   * Share a deck with a specific friend (by firebase_uid).
   * Sets isShared=true and adds the recipient to sharedWithUserIds.
   * Capped at 20 recipients to prevent abuse.
   *
   * Psychology: Social Identity — the owner becomes a "content creator"
   * within their study group, deepening platform identity.
   */
  async shareWithFriend(
    deckId: string,
    ownerId: string,
    recipientId: string,
  ): Promise<{ ok: boolean; reason?: string }> {
    const deck = await this.decks.findOne({ _id: new ObjectId(deckId), ownerId });
    if (!deck) return { ok: false, reason: 'deck_not_found' };

    const current: string[] = (deck['sharedWithUserIds'] as string[]) ?? [];
    if (current.length >= 20) return { ok: false, reason: 'share_limit_reached' };
    if (current.includes(recipientId)) return { ok: true }; // idempotent

    await this.decks.updateOne(
      { _id: new ObjectId(deckId), ownerId },
      {
        $set: { isShared: true, updatedAt: new Date() },
        $addToSet: { sharedWithUserIds: recipientId },
      },
    );

    log.info({ ownerId, deckId, recipientId }, 'deck shared with friend');
    return { ok: true };
  }

  /** Remove a specific friend's access to a shared deck. */
  async revokeShare(deckId: string, ownerId: string, recipientId: string): Promise<boolean> {
    const result = await this.decks.updateOne(
      { _id: new ObjectId(deckId), ownerId },
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        $pull: { sharedWithUserIds: recipientId } as any,
        $set: { updatedAt: new Date() },
      },
    );
    return result.modifiedCount > 0;
  }

  // ═══════════════════════════════════════════════════════════
  // CARD OPERATIONS
  // ═══════════════════════════════════════════════════════════

  /** Add a card to a user's own deck (max 200 cards per deck). */
  async addCard(
    deckId: string,
    ownerId: string,
    input: CreateUserDeckCardInput,
  ): Promise<UserDeckCard | null> {
    // Verify ownership + card count limit
    const deck = await this.decks.findOne(
      { _id: new ObjectId(deckId), ownerId },
      { projection: { cardCount: 1 } },
    );
    if (!deck) return null;
    if ((deck['cardCount'] as number ?? 0) >= 200) return null;

    const now = new Date();
    const lastCard = await this.cards
      .find({ deckId })
      .sort({ order: -1 })
      .limit(1)
      .toArray();
    const order = lastCard.length > 0 ? ((lastCard[0]?.['order'] as number) ?? 0) + 1 : 0;

    const result = await this.cards.insertOne({
      deckId,
      question: input.question.trim().slice(0, 2000),
      options: input.options,
      correctAnswerId: input.correctAnswerId,
      explanation: input.explanation?.trim().slice(0, 2000) ?? null,
      order,
      createdAt: now,
      updatedAt: now,
    });

    // Keep cardCount in sync
    await this.decks.updateOne(
      { _id: new ObjectId(deckId) },
      { $inc: { cardCount: 1 }, $set: { updatedAt: now } },
    );

    return {
      id: result.insertedId.toHexString(),
      deckId,
      question: input.question.trim().slice(0, 2000),
      options: input.options,
      correctAnswerId: input.correctAnswerId,
      explanation: input.explanation?.trim().slice(0, 2000) ?? null,
      order,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
  }

  /** List all cards in a deck (owner or recipient). Sorted by order asc. */
  async listCards(deckId: string, requesterId: string): Promise<UserDeckCard[] | null> {
    const access = await this.findByIdWithAccess(deckId, requesterId);
    if (!access) return null;

    const docs = await this.cards
      .find({ deckId })
      .sort({ order: 1 })
      .toArray();
    return docs.map((d) => this.toCard(d));
  }

  /** Update a card's content. Only the deck owner can update. */
  async updateCard(
    cardId: string,
    deckId: string,
    ownerId: string,
    updates: Partial<CreateUserDeckCardInput>,
  ): Promise<boolean> {
    // Confirm ownership of deck
    const deck = await this.decks.findOne({ _id: new ObjectId(deckId), ownerId });
    if (!deck) return false;

    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.question !== undefined) set['question'] = updates.question.trim().slice(0, 2000);
    if (updates.options !== undefined) set['options'] = updates.options;
    if (updates.correctAnswerId !== undefined) set['correctAnswerId'] = updates.correctAnswerId;
    if (updates.explanation !== undefined) set['explanation'] = updates.explanation?.trim().slice(0, 2000) ?? null;

    const result = await this.cards.updateOne(
      { _id: new ObjectId(cardId), deckId },
      { $set: set },
    );
    return result.matchedCount > 0;
  }

  /** Delete a card from a deck. Only the deck owner can delete. */
  async deleteCard(cardId: string, deckId: string, ownerId: string): Promise<boolean> {
    const deck = await this.decks.findOne({ _id: new ObjectId(deckId), ownerId });
    if (!deck) return false;

    const result = await this.cards.deleteOne({ _id: new ObjectId(cardId), deckId });
    if (result.deletedCount > 0) {
      await this.decks.updateOne(
        { _id: new ObjectId(deckId) },
        { $inc: { cardCount: -1 }, $set: { updatedAt: new Date() } },
      );
    }
    return result.deletedCount > 0;
  }

  // ─── Count total investment: decks + cards + annotations ──
  // Used by the progressive profile service as an "investment depth" signal.

  async countDecksByOwner(ownerId: string): Promise<number> {
    return this.decks.countDocuments({ ownerId });
  }

  // ─── Private mappers ──────────────────────────────────────

  private toDeck(doc: Document): UserDeck {
    return {
      id: (doc['_id'] as ObjectId).toHexString(),
      ownerId: doc['ownerId'] as string,
      title: doc['title'] as string,
      description: (doc['description'] as string) ?? '',
      cardCount: (doc['cardCount'] as number) ?? 0,
      isShared: (doc['isShared'] as boolean) ?? false,
      sharedWithUserIds: (doc['sharedWithUserIds'] as string[]) ?? [],
      createdAt: (doc['createdAt'] as Date).toISOString(),
      updatedAt: (doc['updatedAt'] as Date).toISOString(),
    };
  }

  private toCard(doc: Document): UserDeckCard {
    return {
      id: (doc['_id'] as ObjectId).toHexString(),
      deckId: doc['deckId'] as string,
      question: doc['question'] as string,
      options: doc['options'] as Array<{ id: string; text: string }>,
      correctAnswerId: doc['correctAnswerId'] as string,
      explanation: (doc['explanation'] as string) ?? null,
      order: (doc['order'] as number) ?? 0,
      createdAt: (doc['createdAt'] as Date).toISOString(),
      updatedAt: (doc['updatedAt'] as Date).toISOString(),
    };
  }
}

// ─── Singleton Export ───────────────────────────────────────

export const userDeckService = new UserDeckService();
