-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 004 — Platform Config Table
-- Admin-editable key-value store for runtime configuration.
-- Used by: platform Config page, AI Settings page, coin economy, feature flags.
-- Safe to re-run (IF NOT EXISTS).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS platform_config (
  key          TEXT        PRIMARY KEY,
  value        JSONB       NOT NULL DEFAULT 'null',
  category     TEXT        NOT NULL DEFAULT 'general',
  description  TEXT        NOT NULL DEFAULT '',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by   TEXT        -- firebase_uid of admin who last edited, nullable
);

-- Index to speed up category-filtered queries (used by /config/category/:cat)
CREATE INDEX IF NOT EXISTS idx_platform_config_category
  ON platform_config (category);

-- ─── Seed: AI model defaults ─────────────────────────────────────────────────
-- Pre-populate sensible defaults so AI features work out of the box.
-- ON CONFLICT DO NOTHING means re-running won't overwrite admin changes.

INSERT INTO platform_config (key, value, category, description) VALUES
  ('ai_model_tutor',         '"gemini-2.0-flash"',   'ai', 'Model used for conversational AI tutoring'),
  ('ai_model_flashcard_gen', '"gemini-2.0-flash"',   'ai', 'Model used for automated flashcard generation'),
  ('ai_model_explanation',   '"gemini-2.0-flash"',   'ai', 'Model used for step-by-step answer explanations'),
  ('ai_model_quiz_gen',      '"gemini-2.0-flash"',   'ai', 'Model used for adaptive quiz and MCQ generation')
ON CONFLICT (key) DO NOTHING;
