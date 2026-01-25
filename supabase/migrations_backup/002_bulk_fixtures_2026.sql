-- 002_bulk_fixtures_2026.sql
-- Safe no-op bulk load placeholder.
-- This migration intentionally does nothing unless fixture rows are provided.

DO $$
BEGIN
  -- If you want to bulk load fixtures later, replace this migration with
  -- a real INSERT ... VALUES ... ON CONFLICT ... statement that includes
  -- at least one row.
  RAISE NOTICE 'Skipping bulk fixture load (no rows provided).';
END $$;
