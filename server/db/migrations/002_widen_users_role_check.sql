-- ─── Migration 002 — Widen users.role CHECK constraint ───────────────────────
-- The initial schema only allowed ('student', 'admin') as valid roles.
-- This migration extends the constraint to include the full set of platform
-- roles required by the staff-provisioning flow:
--   educator, examiner, institute_admin
--
-- We drop the old constraint and add the new one in a single transaction.
-- Safe to re-run: the new constraint name differs from the old one
-- (PG named it implicitly; we use DROP CONSTRAINT ... IF EXISTS with
--  the generated name, so we cast via ALTER COLUMN ... ADD CONSTRAINT).
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. Remove the old inline check (implicitly named by Postgres).
--    pg_constraint name for an inline CHECK on a column is
--    "<table>_<column>_check". Override: we iterate and drop by expression.
DO $$
DECLARE
  _constraint_name TEXT;
BEGIN
  SELECT conname INTO _constraint_name
  FROM   pg_constraint
  WHERE  conrelid = 'users'::regclass
    AND  contype  = 'c'
    AND  pg_get_constraintdef(oid) LIKE '%role%';

  IF _constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', _constraint_name);
  END IF;
END;
$$;

-- 2. Add the widened constraint.
ALTER TABLE users
  ADD CONSTRAINT chk_users_role
    CHECK (role IN ('student', 'admin', 'educator', 'examiner', 'institute_admin'));

COMMIT;
