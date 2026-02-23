-- Fix BSE Swing Hourly Table Constraint
-- Change from (symbol, date) to (symbol, timestamp) to allow multiple hourly records per day

-- Check current constraint
SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'historical_prices_bse_swing_hourly'::regclass
AND contype = 'u';

-- Drop the old constraint (symbol, date)
ALTER TABLE historical_prices_bse_swing_hourly
DROP CONSTRAINT IF EXISTS historical_prices_bse_swing_daily_symbol_date_key;

-- Add new constraint (symbol, timestamp) for hourly granularity
ALTER TABLE historical_prices_bse_swing_hourly
ADD CONSTRAINT historical_prices_bse_swing_hourly_symbol_timestamp_key 
UNIQUE (symbol, timestamp);

-- Verify new constraint
SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'historical_prices_bse_swing_hourly'::regclass
AND contype = 'u';

SELECT '✅ BSE Swing Hourly constraint updated: (symbol, date) → (symbol, timestamp)' as status;
