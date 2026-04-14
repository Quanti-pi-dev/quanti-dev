-- Migration: Add partial unique index to prevent duplicate active subscriptions
-- This is a database-level safety net in addition to the Redis distributed lock.
-- A user should never have more than one subscription with status IN ('trialing', 'active', 'past_due').

-- Create the partial unique index (idempotent via IF NOT EXISTS)
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_active_user
  ON subscriptions (user_id)
  WHERE status IN ('trialing', 'active', 'past_due');

-- Verify the index was created
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'subscriptions';
