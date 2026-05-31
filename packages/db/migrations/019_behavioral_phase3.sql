-- ─── Phase 3: Behavioral Psychology Schema ──────────────────
-- Tables for Study Pacts and Flash Events.

-- ═══════════════════════════════════════════════════════
-- STUDY PACTS (Social Accountability Contracts)
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS study_pacts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  daily_target  INT NOT NULL CHECK (daily_target > 0 AND daily_target <= 100),
  duration_days INT NOT NULL CHECK (duration_days IN (3, 7, 14)),
  start_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date      DATE NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed')),
  completion_bonus INT NOT NULL DEFAULT 0,
  perfect_bonus    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS study_pact_members (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pact_id   UUID NOT NULL REFERENCES study_pacts(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pact_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_study_pacts_status ON study_pacts(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_study_pact_members_pact ON study_pact_members(pact_id);
CREATE INDEX IF NOT EXISTS idx_study_pact_members_user ON study_pact_members(user_id);

-- ═══════════════════════════════════════════════════════
-- FLASH EVENTS (Time-Limited Bonus Periods)
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS flash_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type            TEXT NOT NULL CHECK (type IN ('subject_boost', 'global_boost', 'speed_challenge', 'community_goal')),
  name            TEXT NOT NULL,
  description     TEXT NOT NULL,
  multiplier      NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')),
  subject_id      TEXT,  -- NULL = all subjects
  community_target INT,  -- For community_goal type
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flash_events_status ON flash_events(status, starts_at);
CREATE INDEX IF NOT EXISTS idx_flash_events_active ON flash_events(status, ends_at) WHERE status = 'active';
