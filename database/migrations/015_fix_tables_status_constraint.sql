-- ============================================================
-- Migration 015: Fix tables.status check constraint
-- Drops any existing unnamed/named check constraints on tables.status
-- and recreates with the full set of valid statuses including out_of_service and closed.
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Step 1: Drop all check constraints on the tables table that relate to status.
-- The original constraint in 001_initial_schema.sql was defined inline (anonymous),
-- so it has a system-generated name. We need to drop it by querying the catalog.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.tables'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status%'
  LOOP
    EXECUTE 'ALTER TABLE public.tables DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
  END LOOP;
END;
$$;

-- Step 2: Recreate the constraint with all valid statuses.
ALTER TABLE public.tables
  ADD CONSTRAINT tables_status_check
  CHECK (status IN ('available', 'occupied', 'reserved', 'cleaning', 'out_of_service', 'closed'));
