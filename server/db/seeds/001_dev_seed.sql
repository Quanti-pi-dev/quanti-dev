-- ============================================================
-- Seed Data for Development
-- Run after migrations to populate test data
-- ============================================================

-- ─── Admin User ─────────────────────────────────────────────
INSERT INTO users (id, auth0_id, email, display_name, role, is_verified)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'auth0|admin001',
    'admin@studyplatform.dev',
    'Trinetra',
    'admin',
    TRUE
) ON CONFLICT (email) DO NOTHING;

-- ─── Test Students ──────────────────────────────────────────
INSERT INTO users (id, auth0_id, email, display_name, role, is_verified)
VALUES
    ('b0000000-0000-0000-0000-000000000001', 'auth0|student001', 'alice@test.dev', 'Alice Chen', 'student', TRUE),
    ('b0000000-0000-0000-0000-000000000002', 'auth0|student002', 'bob@test.dev', 'Bob Kumar', 'student', TRUE),
    ('b0000000-0000-0000-0000-000000000003', 'auth0|student003', 'carol@test.dev', 'Carol Okafor', 'student', TRUE)
ON CONFLICT (email) DO NOTHING;

-- ─── User Preferences ──────────────────────────────────────
INSERT INTO user_preferences (user_id, theme, notifications_enabled, study_reminders_enabled, reminder_time, onboarding_completed, selected_exams, selected_subjects)
VALUES
    ('b0000000-0000-0000-0000-000000000001', 'dark',   TRUE,  TRUE,  '09:00', FALSE, '{}', '{}'),
    ('b0000000-0000-0000-0000-000000000002', 'light',  TRUE,  FALSE, NULL,    FALSE, '{}', '{}'),
    ('b0000000-0000-0000-0000-000000000003', 'system', TRUE,  TRUE,  '18:00', FALSE, '{}', '{}')
ON CONFLICT (user_id) DO NOTHING;

-- ─── Badges ─────────────────────────────────────────────────
INSERT INTO badges (id, name, description, icon_url, criteria)
VALUES
    ('c0000000-0000-0000-0000-000000000001', 'First Steps', 'Complete your first flashcard!', '/badges/first-steps.png', 'Complete 1 flashcard'),
    ('c0000000-0000-0000-0000-000000000002', 'Week Warrior', 'Study 7 days in a row', '/badges/week-warrior.png', '7-day study streak'),
    ('c0000000-0000-0000-0000-000000000003', 'Century Club', 'Complete 100 flashcards', '/badges/century-club.png', 'Complete 100 flashcards'),
    ('c0000000-0000-0000-0000-000000000004', 'Perfect Score', 'Get 100% on an exam', '/badges/perfect-score.png', 'Score 100% on any exam'),
    ('c0000000-0000-0000-0000-000000000005', 'Night Owl', 'Study after 10 PM', '/badges/night-owl.png', 'Study session after 22:00')
ON CONFLICT (name) DO NOTHING;

-- ─── Shop Items ─────────────────────────────────────────────
INSERT INTO shop_items (name, description, image_url, price, category, theme_key, deck_id, card_count)
VALUES
    ('Galaxy Theme', 'Deep space dark theme', '/shop/galaxy-theme.png', 250, 'theme', 'galaxy', NULL, NULL),
    ('Ocean Theme', 'Calm ocean-blue theme', '/shop/ocean-theme.png', 200, 'theme', 'ocean', NULL, NULL),
    ('Sunset Theme', 'Warm sunset colors', '/shop/sunset-theme.png', 150, 'theme', 'sunset', NULL, NULL),
    ('Bonus CAT QA Pack', 'Advanced CAT questions', '/shop/cat-pack.png', 500, 'flashcard_pack', NULL, '507f1f77bcf86cd799439011', 50);
