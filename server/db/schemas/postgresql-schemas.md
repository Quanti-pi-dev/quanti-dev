# PostgreSQL Schema Documentation

> PostgreSQL stores **transactional, relational data**: users, subscriptions,
> payments, gamification records, social features, and platform configuration.
>
> **Migration**: `server/db/migrations/001_initial_schema.sql`
> **Extensions**: `uuid-ossp` (UUID generation), `citext` (case-insensitive text)

---

## Table: `users`
> **Owner**: Auth Service + User Service

```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth0_id        VARCHAR(128) NOT NULL UNIQUE,
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
```

**Columns of note:**
- `enrollment_id` — Unique, human-readable identifier (e.g. `QP-8F2A9C`). Generated during onboarding. Used for friend search disambiguation.

**Indexes:**
- `idx_users_auth0_id` — `(auth0_id)` — primary auth lookup
- `idx_users_email` — `(email)` — email-based search (admin)
- `idx_users_role` — `(role)` — role-based filtering
- `idx_users_created_at` — `(created_at DESC)` — admin user list
- `idx_users_enrollment_id` — `(enrollment_id)` — exact-match friend search

**Trigger:** `trg_users_updated_at` — auto-updates `updated_at`

---

## Table: `user_preferences`
> **Owner**: User Service

```sql
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
    active_theme            VARCHAR(64),    -- theme_key from shop_items, NULL = default
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Indexes:**
- `idx_user_preferences_user_id` — `(user_id)` — preference lookup by user

**Trigger:** `trg_user_preferences_updated_at` — auto-updates `updated_at`

---

## Table: `plans`
> **Owner**: Subscription Service

```sql
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
```

**Indexes:**
- `idx_plans_active` — `(is_active, sort_order)` — active plans in display order
- `idx_plans_slug` — `(slug)` — slug lookup
- `idx_plans_tier` — `(tier, billing_cycle)` — tier+cycle filtering

**Trigger:** `trg_plans_updated_at` — auto-updates `updated_at`

**Note:** `is_active = FALSE` is used for soft-delete. Existing subscriptions referencing
deactivated plans continue to work; the plan simply isn't shown to new subscribers.

---

## Table: `subscriptions`
> **Owner**: Subscription Service

```sql
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
```

**Enum `subscription_status`:** `trialing | active | past_due | canceled | expired | paused`

**Indexes:**
- `idx_subscriptions_one_active` — UNIQUE partial `(user_id) WHERE status IN ('trialing', 'active', 'past_due')` — enforces at most one active subscription per user at the DB level
- `idx_subscriptions_user` — `(user_id, created_at DESC)` — user history
- `idx_subscriptions_expiry` — `(current_period_end) WHERE status IN (...)` — cron expiration sweep
- `idx_subscriptions_status` — `(status)` — admin filtering
- `idx_subscriptions_plan` — `(plan_id)` — per-plan reporting

**Trigger:** `trg_subscriptions_updated_at` — auto-updates `updated_at`

---

## Table: `subscription_events`
> **Owner**: Subscription Service (audit log)

```sql
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
```

**Event types:** `created | activated | trial_started | trial_expired | payment_failed | cancel_requested | canceled | reactivated | expired | renewed | manual_grant`

**Indexes:**
- `idx_sub_events_subscription` — `(subscription_id, created_at DESC)`
- `idx_sub_events_user` — `(user_id, created_at DESC)`
- `idx_sub_events_type` — `(event_type, created_at DESC)`

---

## Table: `payments`
> **Owner**: Payment Service

```sql
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
```

**Enum `payment_status`:** `created | authorized | captured | failed | refunded | partially_refunded`

**Indexes:**
- `idx_payments_subscription` — `(subscription_id, created_at DESC)`
- `idx_payments_user` — `(user_id, created_at DESC)`
- `idx_payments_status` — `(status) WHERE status IN ('created', 'authorized')`
- `idx_payments_razorpay_order` — `(razorpay_order_id)`
- `idx_payments_razorpay_payment` — `(razorpay_payment_id) WHERE NOT NULL`

**Trigger:** `trg_payments_updated_at` — auto-updates `updated_at`

---

## Table: `coupons`
> **Owner**: Coupon Service

```sql
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
```

**Enum `coupon_discount_type`:** `percentage | fixed_amount`

**Indexes:**
- `idx_coupons_code` — `(code) WHERE is_active = TRUE`
- `idx_coupons_validity` — `(valid_from, valid_until) WHERE is_active = TRUE`

**Trigger:** `trg_coupons_updated_at` — auto-updates `updated_at`

---

## Table: `coupon_redemptions`
> **Owner**: Coupon Service

```sql
CREATE TABLE coupon_redemptions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    coupon_id       UUID NOT NULL REFERENCES coupons(id),
    user_id         VARCHAR(128) NOT NULL,
    subscription_id UUID NOT NULL REFERENCES subscriptions(id),
    discount_paise  INTEGER NOT NULL CHECK (discount_paise >= 0),
    redeemed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Indexes:**
- `idx_redemptions_user` — `(user_id, coupon_id)` — per-user usage check
- `idx_redemptions_coupon` — `(coupon_id)` — coupon usage count

---

## Table: `badges`
> **Owner**: Gamification Service

```sql
CREATE TABLE badges (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(100) NOT NULL UNIQUE,
    description     TEXT NOT NULL,
    icon_url        TEXT NOT NULL,
    criteria        TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Table: `user_badges`
> **Owner**: Gamification Service

```sql
CREATE TABLE user_badges (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_id    UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
    earned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, badge_id)
);
```

**Indexes:**
- `idx_user_badges_user_id` — `(user_id)`
- `idx_user_badges_badge_id` — `(badge_id)`

---

## Table: `shop_items`
> **Owner**: Gamification Service

```sql
CREATE TABLE shop_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(100) NOT NULL,
    description     TEXT NOT NULL,
    image_url       TEXT NOT NULL,
    price           INTEGER NOT NULL CHECK (price >= 0),
    category        VARCHAR(20) NOT NULL
                    CHECK (category IN ('flashcard_pack', 'theme', 'power_up')),
    is_available    BOOLEAN NOT NULL DEFAULT TRUE,
    deck_id         VARCHAR(64),        -- MongoDB ObjectId (for flashcard_pack items)
    card_count      INTEGER,            -- denormalized count (for flashcard_pack items)
    theme_key       VARCHAR(64),        -- unique key (for theme items)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Categories:**
- `flashcard_pack` — premium flashcard decks, unlocked via coin purchase. Must have `deck_id`.
- `theme` — UI themes. Must have `theme_key`.
- `power_up` — consumable items (e.g. Streak Freeze).

**Indexes:**
- `idx_shop_items_category` — `(category)`
- `idx_shop_items_available` — `(is_available) WHERE is_available = TRUE`

**Trigger:** `trg_shop_items_updated_at` — auto-updates `updated_at`

---

## Table: `user_purchases`
> **Owner**: Gamification Service

```sql
CREATE TABLE user_purchases (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id         UUID NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
    coins_spent     INTEGER NOT NULL CHECK (coins_spent >= 0),
    purchased_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Indexes:**
- `idx_user_purchases_user_id` — `(user_id)`

---

## Table: `study_sessions`
> **Owner**: Progress Service

```sql
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
```

**Indexes:**
- `idx_study_sessions_user_id` — `(user_id)`
- `idx_study_sessions_deck_id` — `(deck_id)`
- `idx_study_sessions_started_at` — `(started_at DESC)`
- `idx_study_sessions_user_deck` — `(user_id, deck_id)` — recommendation queries
- `idx_sessions_user_started` — `(user_id, started_at DESC)` — optimal study time (AI)

---

## Table: `coin_transactions`
> **Owner**: Gamification Service

```sql
CREATE TABLE coin_transactions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount          INTEGER NOT NULL,       -- positive = earned, negative = spent
    reason          VARCHAR(100) NOT NULL,  -- e.g. 'correct_answer', 'shop_purchase'
    reference_id    VARCHAR(255),           -- optional context: cardId, itemId, etc.
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Indexes:**
- `idx_coin_tx_user_date` — `(user_id, created_at DESC)` — user transaction history

---

## Table: `user_unlocked_decks`
> **Owner**: Gamification Service

```sql
CREATE TABLE user_unlocked_decks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    deck_id         VARCHAR(64) NOT NULL,   -- MongoDB ObjectId reference
    unlocked_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, deck_id)
);
```

**Indexes:**
- `idx_user_unlocked_decks_user` — `(user_id)`

---

## Table: `friendships`
> **Owner**: Challenge Service (Social)

```sql
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
```

**Enum `friendship_status`:** `pending | accepted | blocked`

**Indexes:**
- `idx_friendships_requester` — `(requester_id, status)`
- `idx_friendships_addressee` — `(addressee_id, status)`
- `idx_friendships_pair` — `(requester_id, addressee_id) WHERE status = 'accepted'`

**Trigger:** `trg_friendships_updated_at` — auto-updates `updated_at`

---

## Table: `challenges`
> **Owner**: Challenge Service

```sql
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
```

**Enum `challenge_status`:** `pending | accepted | completed | declined | cancelled | expired`

**Indexes:**
- `idx_challenges_creator` — `(creator_id, created_at DESC)`
- `idx_challenges_opponent` — `(opponent_id, created_at DESC)`
- `idx_challenges_pending` — `(expires_at) WHERE status = 'pending'` — cron expiry sweep
- `idx_challenges_active` — `(started_at) WHERE status = 'accepted'` — abandoned game detection

**Trigger:** `trg_challenges_updated_at` — auto-updates `updated_at`

---

## Table: `platform_config`
> **Owner**: Config Repository (Admin Service)

```sql
CREATE TABLE platform_config (
    key         TEXT        PRIMARY KEY,
    value       JSONB       NOT NULL DEFAULT '""',
    category    TEXT        NOT NULL DEFAULT 'general',
    description TEXT        DEFAULT '',
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by  TEXT        DEFAULT NULL
);
```

**Categories:** `coin_economy | marketing | ui | retention | general`

**Indexes:**
- `idx_platform_config_category` — `(category)`

**Seeded keys:** Coin economy values (8 keys), marketing copy (12 keys), UI toggles (5 keys), trial/retention (3 keys). All inserted with `ON CONFLICT (key) DO NOTHING`.

---

## Table: `coin_packs`
> **Owner**: Gamification Service (Monetization)

```sql
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
```

**Indexes:**
- `idx_coin_packs_active` — `(is_active, sort_order)`

**Seeded packs:** Starter (200 coins / ₹99), Popular (600 / ₹249), Best Value (1500 / ₹499).

---

## Table: `coin_pack_purchases`
> **Owner**: Gamification Service (Monetization)

```sql
CREATE TABLE coin_pack_purchases (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             TEXT        NOT NULL REFERENCES users(auth0_id),
    coin_pack_id        UUID        REFERENCES coin_packs(id),  -- nullable for custom purchases
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
```

**Note:** `coin_pack_id` is nullable to support custom coin purchases (arbitrary amount, no pre-defined pack).

**Indexes:**
- `idx_coin_pack_purchases_user` — `(user_id, created_at DESC)`
- `idx_coin_pack_purchases_order` — `(razorpay_order_id)`

---

## Shared Utilities

### Trigger function: `update_updated_at_column()`

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Used by: `users`, `user_preferences`, `plans`, `subscriptions`, `payments`, `coupons`, `shop_items`, `friendships`, `challenges`
