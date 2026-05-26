-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 001 — Complete Schema (Consolidated)
-- Single file for first-time database creation.
-- Covers every table, index, trigger, and seed required by the platform.
-- Idempotent: uses IF NOT EXISTS / DO NOTHING throughout.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Extensions ──────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── updated_at trigger function ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ─── Users ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid     TEXT        NOT NULL UNIQUE,
  email            TEXT,
  display_name     TEXT        NOT NULL,
  avatar_url       TEXT,
  role             TEXT        NOT NULL DEFAULT 'student'
                               CHECK (role IN ('student', 'admin')),
  enrollment_id    TEXT        UNIQUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id                UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme                  TEXT,
  active_theme           TEXT,
  notifications_enabled  BOOLEAN     NOT NULL DEFAULT TRUE,
  study_reminders_enabled BOOLEAN    NOT NULL DEFAULT FALSE,
  reminder_time          TIME,
  onboarding_completed   BOOLEAN     NOT NULL DEFAULT FALSE,
  selected_exams         TEXT[]      NOT NULL DEFAULT '{}',
  selected_subjects      TEXT[]      NOT NULL DEFAULT '{}',
  exam_date              DATE,
  preferred_study_time   VARCHAR(10),
  daily_card_target      INTEGER,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Plans ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS plans (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             TEXT        NOT NULL UNIQUE,
  display_name     TEXT        NOT NULL,
  tier             SMALLINT    NOT NULL CHECK (tier IN (1, 2, 3)),
  billing_cycle    TEXT        NOT NULL CHECK (billing_cycle IN ('weekly', 'monthly')),
  price_paise      INTEGER     NOT NULL,
  currency         TEXT        NOT NULL DEFAULT 'INR',
  features         JSONB       NOT NULL DEFAULT '{}',
  trial_days       SMALLINT    NOT NULL DEFAULT 0,
  is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order       SMALLINT    NOT NULL DEFAULT 0,
  razorpay_plan_id TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Coupons ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS coupons (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code                TEXT        NOT NULL UNIQUE,
  discount_type       TEXT        NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value      INTEGER     NOT NULL,
  max_discount_paise  INTEGER,
  min_order_paise     INTEGER     NOT NULL DEFAULT 0,
  applicable_plans    TEXT[]      NOT NULL DEFAULT '{}',
  applicable_cycles   TEXT[]      NOT NULL DEFAULT '{}',
  max_uses            INTEGER,
  max_uses_per_user   SMALLINT    NOT NULL DEFAULT 1,
  current_uses        INTEGER     NOT NULL DEFAULT 0,
  valid_from          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until         TIMESTAMPTZ,
  is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
  first_time_only     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Subscriptions ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subscriptions (
  id                           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                      TEXT        NOT NULL,  -- firebase_uid
  plan_id                      UUID        NOT NULL REFERENCES plans(id),
  status                       TEXT        NOT NULL
                                           CHECK (status IN (
                                             'trialing', 'active', 'past_due',
                                             'canceled', 'expired', 'pending'
                                           )),
  current_period_start         TIMESTAMPTZ NOT NULL,
  current_period_end           TIMESTAMPTZ NOT NULL,
  trial_start                  TIMESTAMPTZ,
  trial_end                    TIMESTAMPTZ,
  canceled_at                  TIMESTAMPTZ,
  cancel_at_period_end         BOOLEAN     NOT NULL DEFAULT FALSE,
  retry_count                  SMALLINT    NOT NULL DEFAULT 0,
  coupon_id                    UUID        REFERENCES coupons(id),
  institute_subscription_id    UUID,       -- FK added after institute_subscriptions table
  enrolled_by                  TEXT        DEFAULT 'self'
                                           CHECK (enrolled_by IN ('self', 'institute')),
  razorpay_subscription_id     TEXT        UNIQUE,
  razorpay_customer_id         TEXT,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id      ON subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status       ON subscriptions (status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end   ON subscriptions (current_period_end);

-- ─── Subscription Events ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subscription_events (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id  UUID        NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  user_id          TEXT        NOT NULL,
  event_type       TEXT        NOT NULL,
  old_status       TEXT,
  new_status       TEXT,
  metadata         JSONB       NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_events_subscription_id ON subscription_events (subscription_id);

-- ─── Coupon Redemptions ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id        UUID        NOT NULL REFERENCES coupons(id),
  user_id          TEXT        NOT NULL,
  subscription_id  UUID        REFERENCES subscriptions(id),
  redeemed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon_user
  ON coupon_redemptions (coupon_id, user_id);

-- ─── Payments ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payments (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id           UUID        NOT NULL REFERENCES subscriptions(id),
  user_id                   TEXT        NOT NULL,
  razorpay_order_id         TEXT        NOT NULL UNIQUE,
  razorpay_payment_id       TEXT,
  razorpay_subscription_id  TEXT,
  amount_paise              INTEGER     NOT NULL,
  currency                  TEXT        NOT NULL DEFAULT 'INR',
  status                    TEXT        NOT NULL DEFAULT 'pending'
                                        CHECK (status IN ('pending', 'captured', 'failed', 'refunded')),
  failure_reason            TEXT,
  refund_amount_paise       INTEGER     NOT NULL DEFAULT 0,
  webhook_verified          BOOLEAN     NOT NULL DEFAULT FALSE,
  attempt_number            SMALLINT    NOT NULL DEFAULT 1,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_subscription_id ON payments (subscription_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id         ON payments (user_id);

-- ─── Gamification — Badges ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS badges (
  id          TEXT        PRIMARY KEY,
  name        TEXT        NOT NULL,
  description TEXT        NOT NULL,
  criteria    TEXT,
  icon_url    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_badges (
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id    TEXT        NOT NULL REFERENCES badges(id),
  earned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, badge_id)
);

-- ─── Gamification — Shop Items ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shop_items (
  id           TEXT        PRIMARY KEY,
  name         TEXT        NOT NULL,
  description  TEXT,
  image_url    TEXT,
  price        INTEGER     NOT NULL,
  category     TEXT        NOT NULL DEFAULT 'other'
                           CHECK (category IN ('flashcard_pack', 'theme', 'power_up', 'other')),
  deck_id      TEXT,        -- populated for flashcard_pack items
  card_count   INTEGER,     -- populated for flashcard_pack items
  theme_key    TEXT,        -- populated for theme items
  effect_type  TEXT,        -- legacy field, prefer category
  effect_data  JSONB        NOT NULL DEFAULT '{}',
  is_available BOOLEAN      NOT NULL DEFAULT TRUE,
  sort_order   SMALLINT     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_purchases (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id      TEXT        NOT NULL REFERENCES shop_items(id),
  coins_spent  INTEGER     NOT NULL,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_purchases_user_id ON user_purchases (user_id);

CREATE TABLE IF NOT EXISTS user_unlocked_decks (
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deck_id     TEXT        NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, deck_id)
);

-- ─── Gamification — Coin Transactions ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS coin_transactions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount       INTEGER     NOT NULL,
  reason       TEXT        NOT NULL,
  reference_id TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coin_transactions_user_id ON coin_transactions (user_id);

-- ─── Coin Packs ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS coin_packs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL,
  description  TEXT,
  coins        INTEGER     NOT NULL,
  price_paise  INTEGER     NOT NULL,
  badge_text   TEXT,
  is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order   SMALLINT    NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coin_pack_purchases (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  coin_pack_id        UUID        NOT NULL REFERENCES coin_packs(id),
  razorpay_order_id   TEXT        NOT NULL UNIQUE,
  amount_paise        INTEGER     NOT NULL,
  coins_credited      INTEGER     NOT NULL,
  status              TEXT        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending', 'completed', 'failed')),
  razorpay_payment_id TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coin_pack_purchases_user_id ON coin_pack_purchases (user_id);

-- ─── Study Sessions ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS study_sessions (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deck_id               TEXT        NOT NULL,  -- MongoDB ObjectId hex
  cards_studied         INTEGER     NOT NULL DEFAULT 0,
  correct_answers       INTEGER     NOT NULL DEFAULT 0,
  incorrect_answers     INTEGER     NOT NULL DEFAULT 0,
  avg_response_time_ms  INTEGER     NOT NULL DEFAULT 0,
  started_at            TIMESTAMPTZ NOT NULL,
  ended_at              TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_study_sessions_user_id    ON study_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_started_at ON study_sessions (user_id, started_at DESC);

-- ─── Challenges ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS challenges (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id       TEXT        NOT NULL,
  opponent_id      TEXT        NOT NULL,
  deck_id          TEXT        NOT NULL,
  exam_id          TEXT        NOT NULL,
  subject_id       TEXT        NOT NULL,
  level            TEXT        NOT NULL,
  bet_amount       INTEGER     NOT NULL DEFAULT 0,
  duration_seconds INTEGER     NOT NULL DEFAULT 60,
  status           TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'active', 'completed', 'expired', 'declined')),
  creator_score    INTEGER     NOT NULL DEFAULT 0,
  opponent_score   INTEGER     NOT NULL DEFAULT 0,
  winner_id        TEXT,
  started_at       TIMESTAMPTZ,
  ended_at         TIMESTAMPTZ,
  expires_at       TIMESTAMPTZ NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_challenges_creator_id  ON challenges (creator_id);
CREATE INDEX IF NOT EXISTS idx_challenges_opponent_id ON challenges (opponent_id);
CREATE INDEX IF NOT EXISTS idx_challenges_status      ON challenges (status);

-- ─── Friendships ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS friendships (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id  TEXT        NOT NULL,
  addressee_id  TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (requester_id, addressee_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_requester_id ON friendships (requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee_id ON friendships (addressee_id);

-- ─── Institutes ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS institutes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  -- Short unique code (uppercase, no spaces) e.g. "ALLEN", "FIITJEE". Max 12 chars.
  code          TEXT        NOT NULL UNIQUE CHECK (char_length(code) <= 12 AND code = upper(code)),
  type          TEXT        NOT NULL DEFAULT 'coaching'
                            CHECK (type IN ('coaching', 'school', 'university')),
  logo_url      TEXT,
  contact_email TEXT        NOT NULL,
  contact_phone TEXT,
  address       JSONB,      -- { line1, line2?, city, state, pin }
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  metadata      JSONB       NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_institutes_code   ON institutes(code);
CREATE INDEX IF NOT EXISTS idx_institutes_active ON institutes(is_active) WHERE is_active = TRUE;

-- ─── Institute Members ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS institute_members (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id   UUID        NOT NULL REFERENCES institutes(id)  ON DELETE CASCADE,
  user_id        UUID        NOT NULL REFERENCES users(id)       ON DELETE CASCADE,
  -- firebase_uid denormalized to avoid JOIN on leaderboard/Redis writes
  firebase_uid   TEXT        NOT NULL,
  role           TEXT        NOT NULL CHECK (role IN (
                               'institute_admin', 'educator', 'examiner', 'student'
                             )),
  -- Institute-assigned student ID. Format: {CODE}-{YEAR}-{SEQ} e.g. "ALLEN-2026-0042"
  student_uid    TEXT        UNIQUE,
  -- For educators/examiners: their subject department (e.g. "Physics")
  department     TEXT,
  is_active      BOOLEAN     NOT NULL DEFAULT TRUE,
  joined_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (institute_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_im_institute    ON institute_members(institute_id);
CREATE INDEX IF NOT EXISTS idx_im_user         ON institute_members(user_id);
CREATE INDEX IF NOT EXISTS idx_im_firebase_uid ON institute_members(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_im_role         ON institute_members(institute_id, role);
CREATE INDEX IF NOT EXISTS idx_im_student_uid  ON institute_members(student_uid) WHERE student_uid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_im_active       ON institute_members(institute_id, is_active) WHERE is_active = TRUE;

-- ─── Institute Join Codes ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS institute_join_codes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id  UUID        NOT NULL REFERENCES institutes(id)  ON DELETE CASCADE,
  code          TEXT        NOT NULL UNIQUE,   -- 6-char alphanumeric e.g. "ALLEN7"
  role          TEXT        NOT NULL DEFAULT 'student'
                            CHECK (role IN ('institute_admin', 'educator', 'examiner', 'student')),
  department    TEXT,                           -- Pre-assigns department for educators
  max_uses      INT,                            -- NULL = unlimited
  used_count    INT         NOT NULL DEFAULT 0,
  expires_at    TIMESTAMPTZ,                    -- NULL = never expires
  created_by    TEXT        NOT NULL,           -- firebase_uid
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_join_codes_institute ON institute_join_codes(institute_id);
CREATE INDEX IF NOT EXISTS idx_join_codes_code      ON institute_join_codes(code) WHERE is_active = TRUE;

-- ─── Institute Subscriptions ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS institute_subscriptions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id    UUID        NOT NULL REFERENCES institutes(id) ON DELETE RESTRICT,
  plan_id         UUID        NOT NULL REFERENCES plans(id),
  max_seats       INT         NOT NULL CHECK (max_seats > 0),
  used_seats      INT         NOT NULL DEFAULT 0 CHECK (used_seats >= 0),
  status          TEXT        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'expired', 'canceled', 'pending')),
  billing_contact TEXT,
  period_start    TIMESTAMPTZ NOT NULL,
  period_end      TIMESTAMPTZ NOT NULL,
  amount_paise    BIGINT      NOT NULL CHECK (amount_paise >= 0),
  razorpay_order_id TEXT,
  metadata        JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_used_lte_max   CHECK (used_seats <= max_seats),
  CONSTRAINT chk_period_order   CHECK (period_end > period_start)
);

CREATE INDEX IF NOT EXISTS idx_inst_subs_institute ON institute_subscriptions(institute_id);
CREATE INDEX IF NOT EXISTS idx_inst_subs_status    ON institute_subscriptions(status, period_end);

-- ─── Back-fill FK on subscriptions → institute_subscriptions ─────────────────

ALTER TABLE subscriptions
  ADD CONSTRAINT fk_subs_inst_sub
    FOREIGN KEY (institute_subscription_id)
    REFERENCES institute_subscriptions(id)
    ON DELETE SET NULL
  NOT VALID;  -- NOT VALID = skips row scan, valid for new rows immediately

CREATE INDEX IF NOT EXISTS idx_subs_inst_sub
  ON subscriptions(institute_subscription_id)
  WHERE institute_subscription_id IS NOT NULL;

-- ─── Institute UID Sequences ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS institute_uid_sequences (
  institute_id  UUID  NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
  year          INT   NOT NULL,
  last_seq      INT   NOT NULL DEFAULT 0,
  PRIMARY KEY (institute_id, year)
);

-- ─── Platform Config ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS platform_config (
  key          TEXT        PRIMARY KEY,
  value        JSONB       NOT NULL DEFAULT 'null',
  category     TEXT        NOT NULL DEFAULT 'general',
  description  TEXT        NOT NULL DEFAULT '',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by   TEXT        -- firebase_uid of admin who last edited, nullable
);

CREATE INDEX IF NOT EXISTS idx_platform_config_category
  ON platform_config (category);

-- ─── Triggers ────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_institutes_updated_at') THEN
    CREATE TRIGGER trg_institutes_updated_at
      BEFORE UPDATE ON institutes
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_inst_subs_updated_at') THEN
    CREATE TRIGGER trg_inst_subs_updated_at
      BEFORE UPDATE ON institute_subscriptions
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ─── Seed: Platform Config defaults ──────────────────────────────────────────
-- Pre-populate AI model defaults so features work out of the box.
-- ON CONFLICT DO NOTHING means re-running won't overwrite admin changes.

INSERT INTO platform_config (key, value, category, description) VALUES
  ('ai_model_tutor',         '"gemini-2.0-flash"',   'ai', 'Model used for conversational AI tutoring'),
  ('ai_model_flashcard_gen', '"gemini-2.0-flash"',   'ai', 'Model used for automated flashcard generation'),
  ('ai_model_explanation',   '"gemini-2.0-flash"',   'ai', 'Model used for step-by-step answer explanations'),
  ('ai_model_quiz_gen',      '"gemini-2.0-flash"',   'ai', 'Model used for adaptive quiz and MCQ generation')
ON CONFLICT (key) DO NOTHING;
