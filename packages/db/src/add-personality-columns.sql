-- Migration: Add study personality columns to user_preferences
-- These columns store the onboarding quiz results captured in the
-- Study Personality Quiz screen (Phase 3 onboarding gamification).
-- Run against the production database before deploying the updated
-- user.repository.ts that SELECTs these columns.

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS study_personality VARCHAR(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS motivation_type VARCHAR(20) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS session_preference VARCHAR(20) DEFAULT NULL;

-- Verify
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'user_preferences'
-- AND column_name IN ('study_personality', 'motivation_type', 'session_preference');
