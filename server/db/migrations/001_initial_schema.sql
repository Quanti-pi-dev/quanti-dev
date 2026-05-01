-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 001 — Initial Schema (Consolidated)
-- Covers: users, plans, subscriptions, payments, coupons, gamification,
--         challenges, friendships, coin packs.
-- All statements use IF NOT EXISTS / DO NOTHING so this is safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Extensions ──────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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
  user_id          UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  active_theme     TEXT,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   TEXT        NOT NULL,  -- firebase_uid
  plan_id                   UUID        NOT NULL REFERENCES plans(id),
  status                    TEXT        NOT NULL
                                        CHECK (status IN (
                                          'trialing', 'active', 'past_due',
                                          'canceled', 'expired', 'pending'
                                        )),
  current_period_start      TIMESTAMPTZ NOT NULL,
  current_period_end        TIMESTAMPTZ NOT NULL,
  trial_start               TIMESTAMPTZ,
  trial_end                 TIMESTAMPTZ,
  canceled_at               TIMESTAMPTZ,
  cancel_at_period_end      BOOLEAN     NOT NULL DEFAULT FALSE,
  retry_count               SMALLINT    NOT NULL DEFAULT 0,
  coupon_id                 UUID        REFERENCES coupons(id),
  razorpay_subscription_id  TEXT        UNIQUE,
  razorpay_customer_id      TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id
  ON subscriptions (user_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status
  ON subscriptions (status);

CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end
  ON subscriptions (current_period_end);

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

CREATE INDEX IF NOT EXISTS idx_sub_events_subscription_id
  ON subscription_events (subscription_id);

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

CREATE INDEX IF NOT EXISTS idx_payments_subscription_id
  ON payments (subscription_id);

CREATE INDEX IF NOT EXISTS idx_payments_user_id
  ON payments (user_id);

-- ─── Gamification — Badges ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS badges (
  id          TEXT        PRIMARY KEY,
  name        TEXT        NOT NULL,
  description TEXT        NOT NULL,
  icon_url    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_badges (
  user_id     TEXT        NOT NULL,
  badge_id    TEXT        NOT NULL REFERENCES badges(id),
  earned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, badge_id)
);

-- ─── Gamification — Shop Items ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shop_items (
  id           TEXT        PRIMARY KEY,
  name         TEXT        NOT NULL,
  description  TEXT,
  price        INTEGER     NOT NULL,
  effect_type  TEXT        NOT NULL,  -- 'theme' | 'deck_unlock' | etc.
  effect_data  JSONB       NOT NULL DEFAULT '{}',
  is_available BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_unlocked_decks (
  user_id   TEXT  NOT NULL,
  deck_id   TEXT  NOT NULL,
  PRIMARY KEY (user_id, deck_id)
);

-- ─── Gamification — Coin Transactions ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS coin_transactions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT        NOT NULL,
  amount       INTEGER     NOT NULL,
  reason       TEXT        NOT NULL,
  reference_id TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coin_transactions_user_id
  ON coin_transactions (user_id);

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
  user_id             TEXT        NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_coin_pack_purchases_user_id
  ON coin_pack_purchases (user_id);

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

CREATE INDEX IF NOT EXISTS idx_challenges_creator_id
  ON challenges (creator_id);

CREATE INDEX IF NOT EXISTS idx_challenges_opponent_id
  ON challenges (opponent_id);

CREATE INDEX IF NOT EXISTS idx_challenges_status
  ON challenges (status);

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

CREATE INDEX IF NOT EXISTS idx_friendships_requester_id
  ON friendships (requester_id);

CREATE INDEX IF NOT EXISTS idx_friendships_addressee_id
  ON friendships (addressee_id);
