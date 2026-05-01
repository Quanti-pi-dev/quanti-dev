-- ============================================================
-- Migration 001: Full Initial Schema
-- Quanti-pi Server — Fresh Deploy (April 2026)
--
-- This is the single consolidated migration for a fresh database.
-- It includes all tables, enums, indexes, triggers, and seed data.
-- ============================================================

-- ─── Extensions ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ─── Shared Trigger Function ────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── Enum Types ─────────────────────────────────────────────

CREATE TYPE subscription_status AS ENUM (
    'trialing', 'active', 'past_due', 'canceled', 'expired', 'paused'
);

CREATE TYPE payment_status AS ENUM (
    'created', 'authorized', 'captured', 'failed', 'refunded', 'partially_refunded'
);

CREATE TYPE coupon_discount_type AS ENUM ('percentage', 'fixed_amount');

CREATE TYPE friendship_status AS ENUM ('pending', 'accepted', 'blocked');

CREATE TYPE challenge_status AS ENUM (
    'pending', 'accepted', 'completed', 'declined', 'cancelled', 'expired'
);


-- ═══════════════════════════════════════════════════════════════
-- SECTION 1: Core User Tables
-- ═══════════════════════════════════════════════════════════════

-- ─── Users ──────────────────────────────────────────────────
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firebase_uid    VARCHAR(128) NOT NULL UNIQUE,
    email           CITEXT NOT NULL UNIQUE,
    display_name    VARCHAR(100) NOT NULL,
    avatar_url      TEXT,
    role            VARCHAR(20) NOT NULL DEFAULT 'student'
                    CHECK (role IN ('student', 'admin')),
    enrollment_id   VARCHAR(12) NOT NULL UNIQUE,
    is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_firebase_uid ON users (firebase_uid);
CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_role ON users (role);
CREATE INDEX idx_users_created_at ON users (created_at DESC);
CREATE INDEX idx_users_enrollment_id ON users (enrollment_id);

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── User Preferences ──────────────────────────────────────
CREATE TABLE user_preferences (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                 UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    theme                   VARCHAR(10) NOT NULL DEFAULT 'system'
                            CHECK (theme IN ('light', 'dark', 'system')),
    notifications_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
    study_reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    reminder_time           TIME,
    onboarding_completed    BOOLEAN NOT NULL DEFAULT FALSE,
    selected_exams          TEXT[] NOT NULL DEFAULT '{}',
    selected_subjects       TEXT[] NOT NULL DEFAULT '{}',
    active_theme            VARCHAR(64),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_preferences_user_id ON user_preferences (user_id);

CREATE TRIGGER trg_user_preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ═══════════════════════════════════════════════════════════════
-- SECTION 2: Gamification & Shop
-- ═══════════════════════════════════════════════════════════════

-- ─── Badges ─────────────────────────────────────────────────
CREATE TABLE badges (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(100) NOT NULL UNIQUE,
    description     TEXT NOT NULL,
    icon_url        TEXT NOT NULL,
    criteria        TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── User Badges (junction) ────────────────────────────────
CREATE TABLE user_badges (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_id    UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
    earned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, badge_id)
);

CREATE INDEX idx_user_badges_user_id ON user_badges (user_id);
CREATE INDEX idx_user_badges_badge_id ON user_badges (badge_id);

-- ─── Shop Items ─────────────────────────────────────────────
CREATE TABLE shop_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(100) NOT NULL,
    description     TEXT NOT NULL,
    image_url       TEXT NOT NULL,
    price           INTEGER NOT NULL CHECK (price >= 0),
    category        VARCHAR(20) NOT NULL
                    CHECK (category IN ('flashcard_pack', 'theme', 'power_up')),
    is_available    BOOLEAN NOT NULL DEFAULT TRUE,
    deck_id         VARCHAR(64),
    card_count      INTEGER,
    theme_key       VARCHAR(64),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shop_items_category ON shop_items (category);
CREATE INDEX idx_shop_items_available ON shop_items (is_available) WHERE is_available = TRUE;

CREATE TRIGGER trg_shop_items_updated_at
    BEFORE UPDATE ON shop_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── User Purchases ────────────────────────────────────────
CREATE TABLE user_purchases (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id         UUID NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
    coins_spent     INTEGER NOT NULL CHECK (coins_spent >= 0),
    purchased_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_purchases_user_id ON user_purchases (user_id);

-- ─── Coin Transactions ─────────────────────────────────────
CREATE TABLE coin_transactions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount          INTEGER NOT NULL,
    reason          VARCHAR(100) NOT NULL,
    reference_id    VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_coin_tx_user_date ON coin_transactions (user_id, created_at DESC);

-- ─── User Unlocked Decks ───────────────────────────────────
CREATE TABLE user_unlocked_decks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    deck_id         VARCHAR(64) NOT NULL,
    unlocked_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, deck_id)
);

CREATE INDEX idx_user_unlocked_decks_user ON user_unlocked_decks (user_id);


-- ═══════════════════════════════════════════════════════════════
-- SECTION 3: Study Sessions
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE study_sessions (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    deck_id                 VARCHAR(64) NOT NULL,
    cards_studied           INTEGER NOT NULL DEFAULT 0,
    correct_answers         INTEGER NOT NULL DEFAULT 0,
    incorrect_answers       INTEGER NOT NULL DEFAULT 0,
    avg_response_time_ms    INTEGER,
    started_at              TIMESTAMPTZ NOT NULL,
    ended_at                TIMESTAMPTZ NOT NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_study_sessions_user_id ON study_sessions (user_id);
CREATE INDEX idx_study_sessions_deck_id ON study_sessions (deck_id);
CREATE INDEX idx_study_sessions_started_at ON study_sessions (started_at DESC);
CREATE INDEX idx_study_sessions_user_deck ON study_sessions (user_id, deck_id);
CREATE INDEX idx_sessions_user_started ON study_sessions (user_id, started_at DESC);


-- ═══════════════════════════════════════════════════════════════
-- SECTION 4: Subscription & Payments
-- ═══════════════════════════════════════════════════════════════

-- ─── Plans ──────────────────────────────────────────────────
CREATE TABLE plans (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug            VARCHAR(50) UNIQUE NOT NULL,
    display_name    VARCHAR(100) NOT NULL,
    tier            SMALLINT NOT NULL CHECK (tier IN (1, 2, 3)),
    billing_cycle   VARCHAR(10) NOT NULL CHECK (billing_cycle IN ('weekly', 'monthly')),
    price_paise     INTEGER NOT NULL CHECK (price_paise > 0),
    currency        VARCHAR(3) NOT NULL DEFAULT 'INR',
    features        JSONB NOT NULL DEFAULT '{}',
    trial_days      SMALLINT NOT NULL DEFAULT 0 CHECK (trial_days >= 0),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order      SMALLINT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_plans_active ON plans (is_active, sort_order);
CREATE INDEX idx_plans_slug ON plans (slug);
CREATE INDEX idx_plans_tier ON plans (tier, billing_cycle);

CREATE TRIGGER trg_plans_updated_at
    BEFORE UPDATE ON plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Coupons ────────────────────────────────────────────────
-- (Created before subscriptions so coupon_id FK can reference it)
CREATE TABLE coupons (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code                VARCHAR(32) UNIQUE NOT NULL,
    discount_type       coupon_discount_type NOT NULL,
    discount_value      INTEGER NOT NULL CHECK (discount_value > 0),
    max_discount_paise  INTEGER,
    min_order_paise     INTEGER NOT NULL DEFAULT 0,
    applicable_plans    UUID[] NOT NULL DEFAULT '{}',
    applicable_cycles   VARCHAR(10)[] NOT NULL DEFAULT '{}',
    max_uses            INTEGER,
    max_uses_per_user   SMALLINT NOT NULL DEFAULT 1,
    current_uses        INTEGER NOT NULL DEFAULT 0 CHECK (current_uses >= 0),
    valid_from          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until         TIMESTAMPTZ,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    first_time_only     BOOLEAN NOT NULL DEFAULT FALSE,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_coupons_code ON coupons (code) WHERE is_active = TRUE;
CREATE INDEX idx_coupons_validity ON coupons (valid_from, valid_until) WHERE is_active = TRUE;

CREATE TRIGGER trg_coupons_updated_at
    BEFORE UPDATE ON coupons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Subscriptions ──────────────────────────────────────────
CREATE TABLE subscriptions (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                 VARCHAR(128) NOT NULL,
    plan_id                 UUID NOT NULL REFERENCES plans(id),
    status                  subscription_status NOT NULL DEFAULT 'trialing',
    current_period_start    TIMESTAMPTZ NOT NULL,
    current_period_end      TIMESTAMPTZ NOT NULL,
    trial_start             TIMESTAMPTZ,
    trial_end               TIMESTAMPTZ,
    canceled_at             TIMESTAMPTZ,
    cancel_at_period_end    BOOLEAN NOT NULL DEFAULT FALSE,
    retry_count             SMALLINT NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
    coupon_id               UUID REFERENCES coupons(id),
    metadata                JSONB NOT NULL DEFAULT '{}',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_subscriptions_one_active
    ON subscriptions (user_id)
    WHERE status IN ('trialing', 'active', 'past_due');
CREATE INDEX idx_subscriptions_user ON subscriptions (user_id, created_at DESC);
CREATE INDEX idx_subscriptions_expiry ON subscriptions (current_period_end)
    WHERE status IN ('active', 'trialing', 'past_due');
CREATE INDEX idx_subscriptions_status ON subscriptions (status);
CREATE INDEX idx_subscriptions_plan ON subscriptions (plan_id);

CREATE TRIGGER trg_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Subscription Events (audit log) ────────────────────────
CREATE TABLE subscription_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id),
    user_id         VARCHAR(128) NOT NULL,
    event_type      VARCHAR(50) NOT NULL,
    old_status      subscription_status,
    new_status      subscription_status,
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sub_events_subscription ON subscription_events (subscription_id, created_at DESC);
CREATE INDEX idx_sub_events_user ON subscription_events (user_id, created_at DESC);
CREATE INDEX idx_sub_events_type ON subscription_events (event_type, created_at DESC);

-- ─── Payments ───────────────────────────────────────────────
CREATE TABLE payments (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id         UUID NOT NULL REFERENCES subscriptions(id),
    user_id                 VARCHAR(128) NOT NULL,
    razorpay_order_id       VARCHAR(64) UNIQUE NOT NULL,
    razorpay_payment_id     VARCHAR(64) UNIQUE,
    razorpay_signature      TEXT,
    amount_paise            INTEGER NOT NULL CHECK (amount_paise >= 0),
    currency                VARCHAR(3) NOT NULL DEFAULT 'INR',
    status                  payment_status NOT NULL DEFAULT 'created',
    failure_reason          TEXT,
    refund_amount_paise     INTEGER NOT NULL DEFAULT 0,
    webhook_verified        BOOLEAN NOT NULL DEFAULT FALSE,
    attempt_number          SMALLINT NOT NULL DEFAULT 1,
    metadata                JSONB NOT NULL DEFAULT '{}',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_subscription ON payments (subscription_id, created_at DESC);
CREATE INDEX idx_payments_user ON payments (user_id, created_at DESC);
CREATE INDEX idx_payments_status ON payments (status) WHERE status IN ('created', 'authorized');
CREATE INDEX idx_payments_razorpay_order ON payments (razorpay_order_id);
CREATE INDEX idx_payments_razorpay_payment ON payments (razorpay_payment_id)
    WHERE razorpay_payment_id IS NOT NULL;

CREATE TRIGGER trg_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Coupon Redemptions ─────────────────────────────────────
CREATE TABLE coupon_redemptions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    coupon_id       UUID NOT NULL REFERENCES coupons(id),
    user_id         VARCHAR(128) NOT NULL,
    subscription_id UUID NOT NULL REFERENCES subscriptions(id),
    discount_paise  INTEGER NOT NULL CHECK (discount_paise >= 0),
    redeemed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_redemptions_user ON coupon_redemptions (user_id, coupon_id);
CREATE INDEX idx_redemptions_coupon ON coupon_redemptions (coupon_id);


-- ═══════════════════════════════════════════════════════════════
-- SECTION 5: Social — Friendships & Challenges
-- ═══════════════════════════════════════════════════════════════

-- ─── Friendships ────────────────────────────────────────────
CREATE TABLE friendships (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status          friendship_status NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (requester_id, addressee_id),
    CHECK (requester_id <> addressee_id)
);

CREATE INDEX idx_friendships_requester ON friendships (requester_id, status);
CREATE INDEX idx_friendships_addressee ON friendships (addressee_id, status);
CREATE INDEX idx_friendships_pair ON friendships (requester_id, addressee_id) WHERE status = 'accepted';

CREATE TRIGGER trg_friendships_updated_at
    BEFORE UPDATE ON friendships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Challenges ─────────────────────────────────────────────
CREATE TABLE challenges (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    opponent_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    deck_id             VARCHAR(24) NOT NULL,
    exam_id             VARCHAR(24) NOT NULL,
    subject_id          VARCHAR(24) NOT NULL,
    level               VARCHAR(20) NOT NULL,
    bet_amount          INTEGER NOT NULL CHECK (bet_amount >= 10),
    duration_seconds    SMALLINT NOT NULL CHECK (duration_seconds IN (60, 90, 120, 180)),
    status              challenge_status NOT NULL DEFAULT 'pending',
    creator_score       SMALLINT NOT NULL DEFAULT 0 CHECK (creator_score >= 0),
    opponent_score      SMALLINT NOT NULL DEFAULT 0 CHECK (opponent_score >= 0),
    winner_id           UUID REFERENCES users(id),
    started_at          TIMESTAMPTZ,
    ended_at            TIMESTAMPTZ,
    expires_at          TIMESTAMPTZ NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (creator_id <> opponent_id)
);

CREATE INDEX idx_challenges_creator ON challenges (creator_id, created_at DESC);
CREATE INDEX idx_challenges_opponent ON challenges (opponent_id, created_at DESC);
CREATE INDEX idx_challenges_pending ON challenges (expires_at) WHERE status = 'pending';
CREATE INDEX idx_challenges_active ON challenges (started_at) WHERE status = 'accepted';

CREATE TRIGGER trg_challenges_updated_at
    BEFORE UPDATE ON challenges
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ═══════════════════════════════════════════════════════════════
-- SECTION 6: Platform Config (admin-editable key-value store)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE platform_config (
    key         TEXT        PRIMARY KEY,
    value       JSONB       NOT NULL DEFAULT '""',
    category    TEXT        NOT NULL DEFAULT 'general',
    description TEXT        DEFAULT '',
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by  TEXT        DEFAULT NULL
);

CREATE INDEX idx_platform_config_category ON platform_config (category);

-- ─── Seed: Coin Economy ─────────────────────────────────────
INSERT INTO platform_config (key, value, category, description) VALUES
  ('coin_correct_answer',  '1',  'coin_economy', 'Coins awarded per correct flashcard answer'),
  ('coin_perfect_session', '3',  'coin_economy', 'Coins awarded for a 100% correct session'),
  ('coin_level_unlock',    '5',  'coin_economy', 'Coins awarded when a new level is unlocked'),
  ('coin_master_level',    '20', 'coin_economy', 'Coins awarded for completing Master level'),
  ('coin_streak_3',        '5',  'coin_economy', 'Coins awarded at 3-day streak milestone'),
  ('coin_streak_7',        '10', 'coin_economy', 'Coins awarded at 7-day streak milestone'),
  ('coin_streak_30',       '50', 'coin_economy', 'Coins awarded at 30-day streak milestone'),
  ('coin_daily_cap',       '100','coin_economy', 'Maximum coins a user can earn per day')
ON CONFLICT (key) DO NOTHING;

-- ─── Seed: Marketing Copy ───────────────────────────────────
INSERT INTO platform_config (key, value, category, description) VALUES
  ('locked_feature_title',    '"Upgrade your plan to unlock this feature"',  'marketing', 'Title shown on locked feature overlay'),
  ('locked_feature_subtitle', '""',                                          'marketing', 'Subtitle shown on locked feature overlay'),
  ('social_proof_text',       '"Join 14,000+ students who passed with Pro"', 'marketing', 'Social proof line on lock screens'),
  ('daily_limit_title',       '"Daily Limit Reached"',                       'marketing', 'Title of the daily limit wall'),
  ('daily_limit_subtitle',    '"Upgrade for more daily access."',            'marketing', 'Subtitle of the daily limit wall'),
  ('daily_limit_coin_cta',    '"Or, buy coins instantly →"',                 'marketing', 'Secondary CTA on daily limit wall (Phase 2)'),
  ('upgrade_cta_study',       '"Unlock unlimited exams — upgrade in 30 seconds"', 'marketing', 'Upgrade CTA subtitle on study screen'),
  ('upgrade_cta_shop',        '"Get coins faster with a Pro plan"',          'marketing', 'Upgrade CTA subtitle on shop screen'),
  ('upgrade_cta_profile',     '"You''re one step away from full access"',    'marketing', 'Upgrade CTA subtitle on profile screen'),
  ('subscription_headline',   '"Upgrade Your Learning"',                     'marketing', 'Subscription screen main headline'),
  ('subscription_subheadline','"Unlock the full Quanti-pi experience"',      'marketing', 'Subscription screen sub-headline'),
  ('save_badge_text',         '"Save ~28% monthly"',                         'marketing', 'Text on the billing cycle save badge')
ON CONFLICT (key) DO NOTHING;

-- ─── Seed: UI Toggles ───────────────────────────────────────
INSERT INTO platform_config (key, value, category, description) VALUES
  ('default_billing_cycle', '"monthly"', 'ui', 'Default billing cycle on subscription screen'),
  ('promo_banner_enabled',  'false',     'ui', 'Whether the promo banner is shown on home screen'),
  ('promo_banner_title',    '""',        'marketing', 'Promo banner title text'),
  ('promo_banner_subtitle', '""',        'marketing', 'Promo banner subtitle text'),
  ('promo_banner_cta',      '""',        'marketing', 'Promo banner CTA button text')
ON CONFLICT (key) DO NOTHING;

-- ─── Seed: Trial Pass / Retention ───────────────────────────
INSERT INTO platform_config (key, value, category, description) VALUES
  ('trial_pass_duration_days', '7',                                           'retention', 'Duration of streak-triggered Pro trial pass (days)'),
  ('trial_expired_title',      '"Your 7-day Pro trial has ended"',            'retention', 'Modal title when trial expires'),
  ('trial_expired_subtitle',   '"Upgrade to keep studying without limits."',  'retention', 'Modal subtitle when trial expires')
ON CONFLICT (key) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════
-- SECTION 7: Coin Packs (fiat purchase)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE coin_packs (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL,
    description TEXT        NOT NULL DEFAULT '',
    coins       INTEGER     NOT NULL CHECK (coins > 0),
    price_paise INTEGER     NOT NULL CHECK (price_paise > 0),
    badge_text  TEXT        DEFAULT NULL,
    is_active   BOOLEAN     NOT NULL DEFAULT true,
    sort_order  INTEGER     NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_coin_packs_active ON coin_packs (is_active, sort_order);

-- ─── Coin Pack Purchase Ledger ──────────────────────────────
CREATE TABLE coin_pack_purchases (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             TEXT        NOT NULL REFERENCES users(firebase_uid),
    coin_pack_id        UUID        REFERENCES coin_packs(id),
    razorpay_order_id   TEXT        NOT NULL,
    razorpay_payment_id TEXT        DEFAULT NULL,
    razorpay_signature  TEXT        DEFAULT NULL,
    amount_paise        INTEGER     NOT NULL,
    coins_credited      INTEGER     NOT NULL,
    status              TEXT        NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'captured', 'failed')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    captured_at         TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX idx_coin_pack_purchases_user ON coin_pack_purchases (user_id, created_at DESC);
CREATE INDEX idx_coin_pack_purchases_order ON coin_pack_purchases (razorpay_order_id);

-- ─── Seed: Default Coin Packs ───────────────────────────────
INSERT INTO coin_packs (name, description, coins, price_paise, badge_text, sort_order) VALUES
  ('Starter Pack',    'A small boost to get you going',          200,   9900, NULL,           1),
  ('Popular Pack',    'The most popular choice for learners',    600,  24900, 'Most Popular', 2),
  ('Best Value Pack', 'Maximum coins at the best price per coin', 1500, 49900, 'Best Value',  3)
ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════
-- SECTION 8: Seed Data — Shop Items
-- ═══════════════════════════════════════════════════════════════

-- Streak Freeze (power_up category)
INSERT INTO shop_items (name, description, image_url, price, category, is_available)
VALUES (
  'Streak Freeze',
  'Protects your streak for 1 missed day. Max 3 in inventory.',
  '',
  500,
  'power_up',
  true
) ON CONFLICT DO NOTHING;
