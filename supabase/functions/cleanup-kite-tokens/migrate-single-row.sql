-- ============================================================================
-- Kite Tokens Table — Migrate to Single-Row Design
-- ============================================================================
-- Kite issues one token per day. No need for history rows or is_active flag.
-- We always upsert into id=1. No cleanup cron required.
-- ============================================================================

-- 1. Clear existing data
TRUNCATE public.kite_tokens;

-- 2. Drop is_active column (no longer needed)
ALTER TABLE public.kite_tokens DROP COLUMN IF EXISTS is_active;

-- 3. Drop the unique constraint on access_token (redundant with single row)
ALTER TABLE public.kite_tokens DROP CONSTRAINT IF EXISTS unique_active_token;

-- 4. Fix the id sequence so the next insert starts at 2
--    (id=1 will always be our single row, managed via upsert)
SELECT setval(pg_get_serial_sequence('public.kite_tokens', 'id'), 1, false);

-- 5. Verify final structure
SELECT column_name, data_type, is_nullable
FROM   information_schema.columns
WHERE  table_schema = 'public'
  AND  table_name   = 'kite_tokens'
ORDER  BY ordinal_position;
