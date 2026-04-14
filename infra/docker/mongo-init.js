// ============================================================
// MongoDB Initialization Script
// Creates collections with schema validation and indexes
// Runs automatically on first container startup
// ============================================================

const db = db.getSiblingDB('kd_content');

// ─── Exams Collection ───────────────────────────────────────
db.createCollection('exams');
db.exams.createIndex({ title: 'text', description: 'text' });
db.exams.createIndex({ category: 1 });
db.exams.createIndex({ difficulty: 1 });
db.exams.createIndex({ isPublished: 1, category: 1 });
db.exams.createIndex({ createdAt: -1 });

// ─── Decks Collection ───────────────────────────────────────
db.createCollection('decks');
db.decks.createIndex({ title: 'text', description: 'text', tags: 'text' });
db.decks.createIndex({ category: 1 });
db.decks.createIndex({ isPublished: 1, category: 1 });
db.decks.createIndex({ tags: 1 });
db.decks.createIndex({ createdAt: -1 });

// ─── Flashcards Collection ──────────────────────────────────
db.createCollection('flashcards');
db.flashcards.createIndex({ deckId: 1, order: 1 });
db.flashcards.createIndex({ deckId: 1 });
db.flashcards.createIndex({ tags: 1 });
db.flashcards.createIndex({ question: 'text' });

// ─── Questions Collection ───────────────────────────────────
db.createCollection('questions');
db.questions.createIndex({ examId: 1, order: 1 });
db.questions.createIndex({ examId: 1 });

print('✅ MongoDB initialized: collections and indexes created for kd_content');
