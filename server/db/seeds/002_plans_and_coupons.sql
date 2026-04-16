-- ============================================================
-- Seed 002: Subscription Plans
-- Basic, Pro, Master plans — weekly & monthly pricing
--
-- ⚠️  AUTHORITATIVE source: server/db/seeds/plans-seed.ts
-- This SQL seed must stay in sync with that file.
--
-- Pricing (in paise, ₹1 = 100 paise):
--   Basic   monthly = ₹99    →  9900  (trial: 7 days)
--   Basic   weekly  = ₹29    →  2900  (trial: 7 days)
--   Pro     monthly = ₹199   → 19900  (no trial)
--   Pro     weekly  = ₹59    →  5900  (no trial)
--   Master  monthly = ₹299   → 29900  (no trial)
--   Master  weekly  = ₹89    →  8900  (no trial)
--
-- features JSON fields (MUST include all fields read by the frontend):
--   max_decks              -1 = unlimited
--   max_exams_per_day      -1 = unlimited
--   max_subjects_per_exam  -1 = unlimited; 3 = Basic cap
--   max_level              -1 = all 6 levels; 2 = Beginner+Rookie; 4 = up to Competent
--   ai_explanations        boolean
--   offline_access         boolean
--   priority_support       boolean
--   advanced_analytics     boolean
-- ============================================================

INSERT INTO plans (id, slug, display_name, tier, billing_cycle, price_paise, currency, features, trial_days, is_active, sort_order)
VALUES
    -- ─── Basic Monthly ──────────────────────────────────────
    (
        'e1000000-0000-0000-0000-000000000002',
        'basic-monthly',
        'Basic',
        1,
        'monthly',
        9900,
        'INR',
        '{
            "max_decks": -1,
            "max_exams_per_day": -1,
            "max_subjects_per_exam": 3,
            "max_level": 2,
            "ai_explanations": true,
            "offline_access": false,
            "priority_support": false,
            "advanced_analytics": false
        }',
        7,
        TRUE,
        1
    ),
    -- ─── Basic Weekly ───────────────────────────────────────
    (
        'e1000000-0000-0000-0000-000000000001',
        'basic-weekly',
        'Basic',
        1,
        'weekly',
        2900,
        'INR',
        '{
            "max_decks": -1,
            "max_exams_per_day": -1,
            "max_subjects_per_exam": 3,
            "max_level": 2,
            "ai_explanations": true,
            "offline_access": false,
            "priority_support": false,
            "advanced_analytics": false
        }',
        7,
        TRUE,
        2
    ),
    -- ─── Pro Monthly ────────────────────────────────────────
    (
        'e2000000-0000-0000-0000-000000000002',
        'pro-monthly',
        'Pro',
        2,
        'monthly',
        19900,
        'INR',
        '{
            "max_decks": -1,
            "max_exams_per_day": -1,
            "max_subjects_per_exam": -1,
            "max_level": 4,
            "ai_explanations": true,
            "offline_access": false,
            "priority_support": false,
            "advanced_analytics": true
        }',
        0,
        TRUE,
        3
    ),
    -- ─── Pro Weekly ─────────────────────────────────────────
    (
        'e2000000-0000-0000-0000-000000000001',
        'pro-weekly',
        'Pro',
        2,
        'weekly',
        5900,
        'INR',
        '{
            "max_decks": -1,
            "max_exams_per_day": -1,
            "max_subjects_per_exam": -1,
            "max_level": 4,
            "ai_explanations": true,
            "offline_access": false,
            "priority_support": false,
            "advanced_analytics": true
        }',
        0,
        TRUE,
        4
    ),
    -- ─── Master Monthly ─────────────────────────────────────
    (
        'e3000000-0000-0000-0000-000000000002',
        'master-monthly',
        'Master',
        3,
        'monthly',
        29900,
        'INR',
        '{
            "max_decks": -1,
            "max_exams_per_day": -1,
            "max_subjects_per_exam": -1,
            "max_level": -1,
            "ai_explanations": true,
            "offline_access": true,
            "priority_support": true,
            "advanced_analytics": true
        }',
        0,
        TRUE,
        5
    ),
    -- ─── Master Weekly ──────────────────────────────────────
    (
        'e3000000-0000-0000-0000-000000000001',
        'master-weekly',
        'Master',
        3,
        'weekly',
        8900,
        'INR',
        '{
            "max_decks": -1,
            "max_exams_per_day": -1,
            "max_subjects_per_exam": -1,
            "max_level": -1,
            "ai_explanations": true,
            "offline_access": true,
            "priority_support": true,
            "advanced_analytics": true
        }',
        0,
        TRUE,
        6
    )
ON CONFLICT (slug) DO UPDATE SET
    display_name  = EXCLUDED.display_name,
    price_paise   = EXCLUDED.price_paise,
    features      = EXCLUDED.features,
    trial_days    = EXCLUDED.trial_days,
    is_active     = EXCLUDED.is_active,
    sort_order    = EXCLUDED.sort_order;

-- ─── Sample Coupons (dev only) ─────────────────────────────
INSERT INTO coupons (code, discount_type, discount_value, max_uses, valid_until, first_time_only)
VALUES
    ('WELCOME50', 'percentage',  50,   1000, NOW() + INTERVAL '1 year', TRUE),
    ('FLAT100',   'fixed_amount', 10000, NULL, NULL,                    FALSE),
    ('LAUNCH20',  'percentage',  20,   500,  NOW() + INTERVAL '6 months', FALSE)
ON CONFLICT (code) DO NOTHING;
