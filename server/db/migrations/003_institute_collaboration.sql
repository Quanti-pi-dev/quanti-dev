-- ─── Migration 003: Institute Collaboration — Phase 1 ─────────────────────────
-- Adds: institutes, institute_members, institute_join_codes,
--       institute_subscriptions, and FK columns on subscriptions.
--
-- Run: psql $DATABASE_URL -f server/db/migrations/003_institute_collaboration.sql
-- Rollback: server/db/migrations/003_institute_collaboration.down.sql

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. institutes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE institutes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  -- Short unique code (uppercase, no spaces) used in student UIDs and join codes.
  -- E.g. "ALLEN", "FIITJEE". Max 12 chars enforced by CHECK.
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

CREATE INDEX idx_institutes_code     ON institutes(code);
CREATE INDEX idx_institutes_active   ON institutes(is_active) WHERE is_active = TRUE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. institute_members
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE institute_members (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id   UUID        NOT NULL REFERENCES institutes(id)  ON DELETE CASCADE,
  user_id        UUID        NOT NULL REFERENCES users(id)       ON DELETE CASCADE,
  -- firebase_uid denormalized here to avoid JOIN on leaderboard/Redis writes
  firebase_uid   TEXT        NOT NULL,
  role           TEXT        NOT NULL CHECK (role IN (
                               'institute_admin', 'educator', 'examiner', 'student'
                             )),
  -- Institute-assigned student ID, auto-generated for student role.
  -- Format: {INSTITUTE_CODE}-{YEAR}-{SEQ} e.g. "ALLEN-2026-0042"
  student_uid    TEXT        UNIQUE,
  -- For educators/examiners: their subject department (e.g. "Physics")
  department     TEXT,
  is_active      BOOLEAN     NOT NULL DEFAULT TRUE,
  joined_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (institute_id, user_id)
);

CREATE INDEX idx_im_institute        ON institute_members(institute_id);
CREATE INDEX idx_im_user             ON institute_members(user_id);
CREATE INDEX idx_im_firebase_uid     ON institute_members(firebase_uid);
CREATE INDEX idx_im_role             ON institute_members(institute_id, role);
CREATE INDEX idx_im_student_uid      ON institute_members(student_uid) WHERE student_uid IS NOT NULL;
CREATE INDEX idx_im_active           ON institute_members(institute_id, is_active) WHERE is_active = TRUE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. institute_join_codes
-- Students/staff enter a short code to self-enroll into an institute.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE institute_join_codes (
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

CREATE INDEX idx_join_codes_institute ON institute_join_codes(institute_id);
CREATE INDEX idx_join_codes_code      ON institute_join_codes(code) WHERE is_active = TRUE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. institute_subscriptions
-- Bulk seat-based subscriptions purchased by the institute.
-- Individual students are linked via subscriptions.institute_subscription_id.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE institute_subscriptions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id    UUID        NOT NULL REFERENCES institutes(id)  ON DELETE RESTRICT,
  plan_id         UUID        NOT NULL REFERENCES plans(id),
  max_seats       INT         NOT NULL CHECK (max_seats > 0),
  used_seats      INT         NOT NULL DEFAULT 0 CHECK (used_seats >= 0),
  status          TEXT        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'expired', 'canceled', 'pending')),
  billing_contact TEXT,
  period_start    TIMESTAMPTZ NOT NULL,
  period_end      TIMESTAMPTZ NOT NULL,
  amount_paise    BIGINT      NOT NULL CHECK (amount_paise >= 0),
  -- Razorpay order/invoice ID for this bulk purchase
  razorpay_order_id TEXT,
  metadata        JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_used_lte_max CHECK (used_seats <= max_seats),
  CONSTRAINT chk_period_order CHECK (period_end > period_start)
);

CREATE INDEX idx_inst_subs_institute ON institute_subscriptions(institute_id);
CREATE INDEX idx_inst_subs_status    ON institute_subscriptions(status, period_end);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Extend subscriptions table
-- Links a student's individual subscription row back to the institute bulk purchase
-- that granted it, and tracks whether they enrolled via institute or self-signup.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS institute_subscription_id UUID
    REFERENCES institute_subscriptions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS enrolled_by TEXT DEFAULT 'self'
    CHECK (enrolled_by IN ('self', 'institute'));

CREATE INDEX IF NOT EXISTS idx_subs_inst_sub
  ON subscriptions(institute_subscription_id)
  WHERE institute_subscription_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Sequence table for auto-generating sequential student UIDs
-- e.g. ALLEN-2026-0042 where 42 is the sequence number for ALLEN in 2026
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE institute_uid_sequences (
  institute_id  UUID  NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
  year          INT   NOT NULL,
  last_seq      INT   NOT NULL DEFAULT 0,
  PRIMARY KEY (institute_id, year)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. updated_at trigger helper (reuse pattern from existing schema)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_institutes_updated_at'
  ) THEN
    CREATE TRIGGER trg_institutes_updated_at
      BEFORE UPDATE ON institutes
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_inst_subs_updated_at'
  ) THEN
    CREATE TRIGGER trg_inst_subs_updated_at
      BEFORE UPDATE ON institute_subscriptions
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

COMMIT;
