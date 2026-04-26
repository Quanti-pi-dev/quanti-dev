-- ============================================================
-- Fix: Admin-granted subscriptions stored PG UUID in user_id
-- instead of Firebase UID.
-- ============================================================

-- First, for any subscriptions we are about to fix, if the user ALREADY has an active
-- subscription under their firebase_uid (which is why the admin grant bug occurred),
-- we expire the old one so the new admin-granted one can take its place without 
-- violating the unique index.
UPDATE subscriptions s
SET status = 'expired', 
    updated_at = NOW()
FROM users u
WHERE s.user_id = u.firebase_uid
  AND s.status IN ('trialing', 'active', 'past_due')
  AND EXISTS (
    SELECT 1 FROM subscriptions s2 
    WHERE s2.user_id = u.id::TEXT 
      AND s2.status IN ('trialing', 'active', 'past_due')
  );

-- Now safely fix the incorrectly granted subscriptions
UPDATE subscriptions s
SET user_id = u.firebase_uid,
    updated_at = NOW()
FROM users u
WHERE s.user_id = u.id::TEXT
  AND s.user_id != u.firebase_uid;

-- Fix subscription_events table
UPDATE subscription_events se
SET user_id = u.firebase_uid
FROM users u
WHERE se.user_id = u.id::TEXT
  AND se.user_id != u.firebase_uid;
