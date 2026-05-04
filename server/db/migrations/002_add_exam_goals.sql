-- Add exam goal fields to user_preferences
-- Run: psql $POSTGRES_URL < server/db/migrations/add-exam-goals.sql

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS exam_date DATE,
  ADD COLUMN IF NOT EXISTS preferred_study_time VARCHAR(10),
  ADD COLUMN IF NOT EXISTS daily_card_target INTEGER;
