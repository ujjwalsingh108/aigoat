-- Fix NSE Swing Hourly Table for Hourly Data Support
-- The current unique constraint on (symbol, date) only allows 1 record per day
-- We need (symbol, timestamp) to support multiple hourly records per day

-- 1. Drop the old constraint that limits to 1 record per day
ALTER TABLE historical_prices_nse_swing_hourly 
DROP CONSTRAINT IF EXISTS historical_prices_nse_swing_daily_symbol_date_key;

-- 2. Add new unique constraint on (symbol, timestamp) for hourly granularity
ALTER TABLE historical_prices_nse_swing_hourly 
ADD CONSTRAINT historical_prices_nse_swing_hourly_symbol_timestamp_key 
UNIQUE (symbol, timestamp);

-- 3. Verify the constraint
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'historical_prices_nse_swing_hourly'::regclass
  AND contype = 'u';

-- 4. Check table info
SELECT 
  COUNT(*) as total_records,
  COUNT(DISTINCT symbol) as unique_symbols,
  COUNT(DISTINCT date) as unique_dates,
  COUNT(DISTINCT symbol || '_' || timestamp::text) as unique_symbol_timestamps
FROM historical_prices_nse_swing_hourly;
