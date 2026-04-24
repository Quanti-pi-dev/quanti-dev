// ─── Admin Repository ───────────────────────────────────────
// Write operations for content management (MongoDB).
// Only called from admin-protected routes.

import { ObjectId } from 'mongodb';
import { getMongoDb } from '../lib/database.js';
import { getRedisClient } from '../lib/database.js';

// ─── Types ──────────────────────────────────────────────────

interface CreateExamInput {
  title: string;
  description: string;
  category: string;
  durationMinutes: number;
  createdBy: string;
}

interface CreateDeckInput {
  title: string;
  description: string;
  category: string;
  imageUrl?: string | null;
  tags?: string[];
  createdBy: string;
}

interface CreateFlashcardInput {
  deckId: string;
  question: string;
  options: { id: string; text: string }[];
  correctAnswerId: string;
  explanation?: string | null;
  imageUrl?: string | null;
  tags?: string[];
}

// ─── Admin Exam Repository ─────────────────────────────────

class AdminExamRepository {
  private get col() {
    return getMongoDb().collection('exams');
  }

  async findAll({ page = 1, pageSize = 50 }: { page?: number; pageSize?: number } = {}) {
    const skip = (page - 1) * pageSize;
    const [docs, total] = await Promise.all([
      this.col.find({}).sort({ createdAt: -1 }).skip(skip).limit(pageSize).toArray(),
      this.col.countDocuments(),
    ]);
    return {
      data: docs.map((doc) => ({
        id: (doc._id as ObjectId).toHexString(),
        title: doc['title'] as string,
        description: doc['description'] as string,
        category: doc['category'] as string,
        durationMinutes: doc['durationMinutes'] as number,
        isPublished: (doc['isPublished'] as boolean) ?? false,
        createdBy: doc['createdBy'] as string,
        createdAt: (doc['createdAt'] as Date).toISOString(),
        updatedAt: (doc['updatedAt'] as Date).toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  async findById(id: string) {
    const doc = await this.col.findOne({ _id: new ObjectId(id) });
    if (!doc) return null;
    return {
      id: (doc._id as ObjectId).toHexString(),
      title: doc['title'] as string,
      description: doc['description'] as string,
      category: doc['category'] as string,
      durationMinutes: doc['durationMinutes'] as number,
      isPublished: (doc['isPublished'] as boolean) ?? false,
      createdBy: doc['createdBy'] as string,
      createdAt: (doc['createdAt'] as Date).toISOString(),
      updatedAt: (doc['updatedAt'] as Date).toISOString(),
    };
  }

  async togglePublished(id: string): Promise<boolean> {
    const doc = await this.col.findOne({ _id: new ObjectId(id) });
    if (!doc) return false;
    const newVal = !((doc['isPublished'] as boolean) ?? false);
    await this.col.updateOne(
      { _id: new ObjectId(id) },
      { $set: { isPublished: newVal, updatedAt: new Date() } },
    );
    await getRedisClient().del(`cache:exam:${id}`);
    return newVal;
  }

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

  async update(id: string, updates: Partial<CreateExamInput & { isPublished: boolean }>) {
    const result = await this.col.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { ...updates, updatedAt: new Date() } },
      { returnDocument: 'after' },
    );
    // Invalidate cache
    await getRedisClient().del(`cache:exam:${id}`);
    return result;
  }

  async delete(id: string): Promise<boolean> {
    // B3 fix: delete children FIRST to prevent orphans on partial failure
    await Promise.all([
      getMongoDb().collection('questions').deleteMany({ examId: new ObjectId(id) }),
      getMongoDb().collection('exam_subjects').deleteMany({ examId: new ObjectId(id) }),
    ]);
    const result = await this.col.deleteOne({ _id: new ObjectId(id) });
    await getRedisClient().del(`cache:exam:${id}`);
    return result.deletedCount > 0;
  }
}

// ─── Admin Deck Repository ─────────────────────────────────

class AdminDeckRepository {
  private get col() {
    return getMongoDb().collection('decks');
  }

  async findAll({ page = 1, pageSize = 50 }: { page?: number; pageSize?: number } = {}) {
    const skip = (page - 1) * pageSize;
    const [docs, total] = await Promise.all([
      this.col.find({}).sort({ createdAt: -1 }).skip(skip).limit(pageSize).toArray(),
      this.col.countDocuments(),
    ]);
    return {
      data: docs.map((doc) => ({
        id: (doc._id as ObjectId).toHexString(),
        title: doc['title'] as string,
        description: doc['description'] as string,
        category: doc['category'] as string,
        cardCount: (doc['cardCount'] as number) ?? 0,
        imageUrl: (doc['imageUrl'] as string) ?? null,
        isPublished: (doc['isPublished'] as boolean) ?? false,
        createdBy: doc['createdBy'] as string,
        createdAt: (doc['createdAt'] as Date).toISOString(),
        updatedAt: (doc['updatedAt'] as Date).toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  async create(input: CreateDeckInput): Promise<string> {
    const now = new Date();
    const result = await this.col.insertOne({
      ...input,
      cardCount: 0,
      isPublished: false,
      tags: input.tags ?? [],
      imageUrl: input.imageUrl ?? null,
      createdAt: now,
      updatedAt: now,
    });
    return result.insertedId.toHexString();
  }

  async update(id: string, updates: Partial<CreateDeckInput & { isPublished: boolean }>) {
    const result = await this.col.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { ...updates, updatedAt: new Date() } },
      { returnDocument: 'after' },
    );
    await getRedisClient().del(`cache:deck:${id}`);
    return result;
  }

  async delete(id: string): Promise<boolean> {
    // B3 fix: delete children FIRST to prevent orphans on partial failure
    await getMongoDb().collection('flashcards').deleteMany({ deckId: new ObjectId(id) });
    const result = await this.col.deleteOne({ _id: new ObjectId(id) });
    await getRedisClient().del(`cache:deck:${id}`);
    return result.deletedCount > 0;
  }

  async incrementCardCount(deckId: string, amount: number) {
    await this.col.updateOne(
      { _id: new ObjectId(deckId) },
      { $inc: { cardCount: amount }, $set: { updatedAt: new Date() } },
    );
    await getRedisClient().del(`cache:deck:${deckId}`);
  }
}

// ─── Admin Flashcard Repository ─────────────────────────────

class AdminFlashcardRepository {
  private get col() {
    return getMongoDb().collection('flashcards');
  }

  async findByDeckId(deckId: string) {
    const docs = await this.col
      .find({ deckId: new ObjectId(deckId) })
      .sort({ order: 1 })
      .toArray();
    return docs.map((doc) => ({
      id: (doc._id as ObjectId).toHexString(),
      deckId: (doc['deckId'] as ObjectId).toHexString(),
      question: doc['question'] as string,
      options: doc['options'] as { id: string; text: string }[],
      correctAnswerId: doc['correctAnswerId'] as string,
      explanation: (doc['explanation'] as string) ?? null,
      imageUrl: (doc['imageUrl'] as string) ?? null,
      tags: (doc['tags'] as string[]) ?? [],
      order: (doc['order'] as number) ?? 0,
      createdAt: (doc['createdAt'] as Date).toISOString(),
      updatedAt: (doc['updatedAt'] as Date).toISOString(),
    }));
  }

  async updateCard(
    cardId: string,
    updates: Partial<Omit<CreateFlashcardInput, 'deckId'>>,
  ): Promise<boolean> {
    const result = await this.col.updateOne(
      { _id: new ObjectId(cardId) },
      { $set: { ...updates, updatedAt: new Date() } },
    );
    return result.matchedCount > 0;
  }

  async deleteCard(cardId: string, deckId: string): Promise<boolean> {
    // C3 fix: filter by BOTH cardId AND deckId to prevent cross-deck deletion
    const result = await this.col.deleteOne({
      _id: new ObjectId(cardId),
      deckId: new ObjectId(deckId),
    });
    if (result.deletedCount > 0) {
      // Decrement deck card count
      await getMongoDb().collection('decks').updateOne(
        { _id: new ObjectId(deckId) },
        { $inc: { cardCount: -1 }, $set: { updatedAt: new Date() } },
      );
      // Bust deck cache
      await getRedisClient().del(`cache:deck:${deckId}`);
    }
    return result.deletedCount > 0;
  }

  async create(input: CreateFlashcardInput): Promise<string> {
    const now = new Date();
    // Get next order value
    const last = await this.col
      .find({ deckId: new ObjectId(input.deckId) })
      .sort({ order: -1 })
      .limit(1)
      .toArray();
    const order = last.length > 0 ? ((last[0]?.['order'] as number) ?? 0) + 1 : 0;

    const result = await this.col.insertOne({
      deckId: new ObjectId(input.deckId),
      question: input.question,
      options: input.options,
      correctAnswerId: input.correctAnswerId,
      explanation: input.explanation ?? null,
      imageUrl: input.imageUrl ?? null,
      tags: input.tags ?? [],
      order,
      createdAt: now,
      updatedAt: now,
    });

    return result.insertedId.toHexString();
  }

  async bulkCreate(deckId: string, cards: Omit<CreateFlashcardInput, 'deckId'>[]): Promise<number> {
    const last = await this.col
      .find({ deckId: new ObjectId(deckId) })
      .sort({ order: -1 })
      .limit(1)
      .toArray();
    let order = last.length > 0 ? ((last[0]?.['order'] as number) ?? 0) + 1 : 0;

    const now = new Date();
    const docs = cards.map((card) => ({
      deckId: new ObjectId(deckId),
      question: card.question,
      options: card.options,
      correctAnswerId: card.correctAnswerId,
      explanation: card.explanation ?? null,
      imageUrl: card.imageUrl ?? null,
      tags: card.tags ?? [],
      order: order++,
      createdAt: now,
      updatedAt: now,
    }));

    const result = await this.col.insertMany(docs);
    return result.insertedCount;
  }
}

// ─── Admin Badge Repository (PostgreSQL) ────────────────────

import { getPostgresPool } from '../lib/database.js';

class AdminBadgeRepository {
  private get pg() {
    return getPostgresPool();
  }

  async findAll(): Promise<Array<{ id: string; name: string; description: string; iconUrl: string; criteria: string; createdAt: string }>> {
    const result = await this.pg.query(
      `SELECT id, name, description, icon_url, criteria, created_at FROM badges ORDER BY created_at DESC`,
    );
    return result.rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      name: row.name as string,
      description: row.description as string,
      iconUrl: row.icon_url as string,
      criteria: row.criteria as string,
      createdAt: (row.created_at as Date).toISOString(),
    }));
  }

  async create(input: { name: string; description: string; iconUrl: string; criteria: string }): Promise<string> {
    const result = await this.pg.query(
      `INSERT INTO badges (name, description, icon_url, criteria)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [input.name, input.description, input.iconUrl, input.criteria],
    );
    return result.rows[0].id as string;
  }

  async update(
    id: string,
    updates: Partial<{ name: string; description: string; iconUrl: string; criteria: string }>,
  ): Promise<boolean> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (updates.name !== undefined)        { fields.push(`name = $${idx++}`);        values.push(updates.name); }
    if (updates.description !== undefined) { fields.push(`description = $${idx++}`); values.push(updates.description); }
    if (updates.iconUrl !== undefined)     { fields.push(`icon_url = $${idx++}`);    values.push(updates.iconUrl); }
    if (updates.criteria !== undefined)    { fields.push(`criteria = $${idx++}`);    values.push(updates.criteria); }
    if (fields.length === 0) return false;
    values.push(id);
    const result = await this.pg.query(
      `UPDATE badges SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id`,
      values,
    );
    return (result.rowCount ?? 0) > 0;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pg.query(`DELETE FROM badges WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }
}

// ─── Admin Shop Item Repository (PostgreSQL) ────────────────

class AdminShopItemRepository {
  private get pg() {
    return getPostgresPool();
  }

  async create(input: {
    name: string;
    description: string;
    imageUrl: string | null;
    price: number;
    category: string;
    deckId?: string;
    cardCount?: number;
    themeKey?: string;
  }): Promise<string> {
    const result = await this.pg.query(
      `INSERT INTO shop_items (name, description, image_url, price, category, deck_id, card_count, theme_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        input.name, input.description, input.imageUrl, input.price, input.category,
        input.deckId ?? null, input.cardCount ?? null, input.themeKey ?? null,
      ],
    );
    return result.rows[0].id as string;
  }

  async update(
    id: string,
    updates: Partial<{
      name: string; description: string; imageUrl: string; price: number;
      category: string; isAvailable: boolean;
      deckId: string; cardCount: number; themeKey: string;
    }>,
  ): Promise<boolean> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (updates.name !== undefined)        { fields.push(`name = $${idx++}`);         values.push(updates.name); }
    if (updates.description !== undefined) { fields.push(`description = $${idx++}`);  values.push(updates.description); }
    if (updates.imageUrl !== undefined)    { fields.push(`image_url = $${idx++}`);    values.push(updates.imageUrl); }
    if (updates.price !== undefined)       { fields.push(`price = $${idx++}`);        values.push(updates.price); }
    if (updates.category !== undefined)    { fields.push(`category = $${idx++}`);     values.push(updates.category); }
    if (updates.isAvailable !== undefined) { fields.push(`is_available = $${idx++}`); values.push(updates.isAvailable); }
    if (updates.deckId !== undefined)      { fields.push(`deck_id = $${idx++}`);      values.push(updates.deckId); }
    if (updates.cardCount !== undefined)   { fields.push(`card_count = $${idx++}`);   values.push(updates.cardCount); }
    if (updates.themeKey !== undefined)    { fields.push(`theme_key = $${idx++}`);    values.push(updates.themeKey); }
    if (fields.length === 0) return false;
    values.push(id);
    const result = await this.pg.query(
      `UPDATE shop_items SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING id`,
      values,
    );
    return (result.rowCount ?? 0) > 0;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pg.query(`DELETE FROM shop_items WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }
}

// ─── Admin ExamSubject Repository ───────────────────────────

class AdminExamSubjectRepository {
  private get col() {
    return getMongoDb().collection('exam_subjects');
  }

  async reorder(examId: string, subjectId: string, newOrder: number): Promise<boolean> {
    const result = await this.col.updateOne(
      { examId: new ObjectId(examId), subjectId: new ObjectId(subjectId) },
      { $set: { order: newOrder, updatedAt: new Date() } },
    );
    return result.matchedCount > 0;
  }
}

// ─── Exports ────────────────────────────────────────────────

export const adminExamRepository = new AdminExamRepository();
export const adminDeckRepository = new AdminDeckRepository();
export const adminFlashcardRepository = new AdminFlashcardRepository();
export const adminBadgeRepository = new AdminBadgeRepository();
export const adminShopItemRepository = new AdminShopItemRepository();
export const adminExamSubjectRepository = new AdminExamSubjectRepository();
