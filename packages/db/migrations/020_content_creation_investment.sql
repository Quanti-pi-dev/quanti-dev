-- ─── Migration 020: Content Creation Investment ─────────────────────────────
-- Adds MongoDB collection indexes for user-created content (user decks and
-- card annotations). These are NoSQL collections managed via the MongoDB
-- driver — this SQL migration tracks the intent for consistency with the
-- rest of the migration journal.
--
-- Psychology: Blueprint §4.2 — Investment Loop
--   Every annotation and custom card is locked-in stored value that raises
--   the switching cost for students who consider leaving the platform.
--
-- NOTE: Actual index creation is performed via the MongoDB driver on startup
-- (packages/db/src/clients/database.ts → ensureMongoIndexes).
-- This file documents the schema intent only.

-- Card annotations: one note per user per card
-- Index: { userId: 1, cardId: 1 } UNIQUE
-- TTL: none (annotations are permanent — part of stored value)
-- Collection: card_annotations

-- User decks: personal study decks
-- Index: { ownerId: 1 }, { sharedWithUserIds: 1 }
-- Collection: user_decks

-- User deck cards: cards inside personal decks
-- Index: { deckId: 1, order: 1 }
-- Collection: user_deck_cards

-- Postgres: no changes in this migration (NoSQL-only feature)
SELECT 1; -- no-op to satisfy migration runner syntax check
