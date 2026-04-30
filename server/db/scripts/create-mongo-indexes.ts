import { MongoClient } from 'mongodb';
import { config } from '../../src/config.js';

// ─── MongoDB Index Creation Script ────────────────────────────
// Idempotent — safe to re-run at any time.
// Run: npx tsx server/db/scripts/create-mongo-indexes.ts
//
// NOTE: analytics_events indexes are listed here for reference but are
// managed by the AI Service seed (exam-seed.ts handles content indexes).
// Both are safe to re-run from here.

async function run() {
  console.log('Connecting to MongoDB...');
  const client = new MongoClient(config.mongo.url);

  try {
    await client.connect();
    const db = client.db(config.mongo.dbName);
    console.log(`✅ Connected to database: ${db.databaseName}\n`);

    // ─── 1. Exams ─────────────────────────────────────────────
    console.log('📋 Creating indexes for exams...');
    await db.collection('exams').createIndex(
      { isPublished: 1, createdAt: -1 },
      { name: 'exams_published_date' }
    );
    await db.collection('exams').createIndex(
      { category: 1 },
      { name: 'exams_category' }
    );
    await db.collection('exams').createIndex(
      { difficulty: 1 },
      { name: 'exams_difficulty' }
    );
    await db.collection('exams').createIndex(
      { title: 'text', description: 'text' },
      { name: 'exams_text_search' }
    );
    console.log('  ✓ exams indexes done');

    // ─── 2. Subjects ──────────────────────────────────────────
    console.log('📋 Creating indexes for subjects...');
    await db.collection('subjects').createIndex(
      { name: 1 },
      { unique: true, name: 'subjects_name_unique' }
    );
    await db.collection('subjects').createIndex(
      { name: 'text' },
      { name: 'subjects_text_search' }
    );
    console.log('  ✓ subjects indexes done');

    // ─── 3. Exam Subjects (join table) ────────────────────────
    console.log('📋 Creating indexes for exam_subjects...');
    await db.collection('exam_subjects').createIndex(
      { examId: 1, subjectId: 1 },
      { unique: true, name: 'exam_subjects_unique_pair' }
    );
    await db.collection('exam_subjects').createIndex(
      { examId: 1, order: 1 },
      { name: 'exam_subjects_ordered' }
    );
    console.log('  ✓ exam_subjects indexes done');

    // ─── 3b. Topics ───────────────────────────────────────────
    console.log('📋 Creating indexes for topics...');
    await db.collection('topics').createIndex(
      { subjectId: 1, slug: 1 },
      { unique: true, name: 'topics_subject_slug_unique' }
    );
    await db.collection('topics').createIndex(
      { subjectId: 1, order: 1 },
      { name: 'topics_subject_ordered' }
    );
    console.log('  ✓ topics indexes done');

    // ─── 4. Decks ─────────────────────────────────────────────
    console.log('📋 Creating indexes for decks...');
    // Non-unique compound index for subject+level queries (many topics per level now)
    await db.collection('decks').createIndex(
      { subjectId: 1, level: 1 },
      { name: 'decks_subject_level' }
    );
    // Unique per (subject, topicSlug, level) — tags[0] is always topicSlug by convention
    // This is the canonical uniqueness constraint for topic-scoped decks
    await db.collection('decks').createIndex(
      { subjectId: 1, 'tags.0': 1, level: 1 },
      { unique: true, sparse: true, name: 'decks_subject_topic_level_unique' }
    );
    await db.collection('decks').createIndex(
      { category: 1 },
      { name: 'decks_category' }
    );
    await db.collection('decks').createIndex(
      { isPublished: 1, category: 1 },
      { name: 'decks_published_category' }
    );
    await db.collection('decks').createIndex(
      { title: 'text', description: 'text' },
      { name: 'decks_text_search' }
    );
    console.log('  ✓ decks indexes done');

    // ─── 5. Flashcards ────────────────────────────────────────
    console.log('📋 Creating indexes for flashcards...');
    await db.collection('flashcards').createIndex(
      { deckId: 1, order: 1 },
      { name: 'flashcards_deck_ordered' }
    );
    await db.collection('flashcards').createIndex(
      { deckId: 1 },
      { name: 'flashcards_deck' }
    );
    await db.collection('flashcards').createIndex(
      { question: 'text', tags: 'text' },
      { name: 'flashcards_text_search' }
    );
    // ── PYQ-specific indexes ─────────────────────────────────
    // Sparse so non-PYQ cards ('original') don't bloat the index.
    await db.collection('flashcards').createIndex(
      { source: 1 },
      { sparse: true, name: 'flashcards_source' }
    );
    // Primary PYQ admin query: filter by source + deckId bucket, sort by year desc
    await db.collection('flashcards').createIndex(
      { source: 1, deckId: 1, sourceYear: -1 },
      { sparse: true, name: 'flashcards_pyq_deck_year' }
    );
    // PYQ meta aggregation: distinct years + papers per scope
    await db.collection('flashcards').createIndex(
      { source: 1, sourceYear: 1, sourcePaper: 1 },
      { sparse: true, name: 'flashcards_pyq_year_paper' }
    );
    console.log('  ✓ flashcards indexes done');

    // ─── 6. Analytics Events (AI Service) ─────────────────────
    // NOTE: This collection is owned by the AI Service.
    // Indexes are included here for convenience but can also be
    // created independently by the AI Service team.
    console.log('📋 Creating indexes for analytics_events...');
    await db.collection('analytics_events').createIndex(
      { user_id: 1, event_name: 1, timestamp: -1 },
      { name: 'analytics_user_event_time' }
    );
    await db.collection('analytics_events').createIndex(
      { event_name: 1, timestamp: -1 },
      { name: 'analytics_event_time' }
    );
    await db.collection('analytics_events').createIndex(
      { timestamp: -1 },
      { name: 'analytics_time' }
    );
    // TTL: auto-delete analytics events older than 1 year
    await db.collection('analytics_events').createIndex(
      { timestamp: 1 },
      {
        expireAfterSeconds: 365 * 24 * 60 * 60,
        name: 'analytics_ttl_1year',
      }
    );
    console.log('  ✓ analytics_events indexes done');

    console.log('\n✅ All MongoDB indexes created successfully!');
  } catch (error) {
    console.error('❌ Error creating MongoDB indexes:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('Disconnected from MongoDB.');
  }
}

run();
