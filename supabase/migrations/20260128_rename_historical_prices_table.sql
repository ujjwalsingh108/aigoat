-- Migration: Rename historical_prices to historical_prices_nse_equity
-- Created: 2026-01-28
-- Purpose: Restructure historical data storage to separate by exchange and instrument type

-- Step 1: Rename the existing table
ALTER TABLE IF EXISTS public.historical_prices 
  RENAME TO historical_prices_nse_equity;

-- Step 2: Rename the primary key constraint
ALTER TABLE public.historical_prices_nse_equity 
  RENAME CONSTRAINT historical_prices_pkey TO historical_prices_nse_equity_pkey;

-- Step 3: Drop the old id sequence if exists and create new one
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'historical_prices_id_seq') THEN
    ALTER SEQUENCE public.historical_prices_id_seq RENAME TO historical_prices_nse_equity_id_seq;
  END IF;
END $$;

-- Step 4: Add timestamp column for better time handling (combines date + time)
ALTER TABLE public.historical_prices_nse_equity 
  ADD COLUMN IF NOT EXISTS timestamp timestamp with time zone;

-- Step 5: Populate timestamp from date + time if data exists
UPDATE public.historical_prices_nse_equity 
SET timestamp = (date::text || ' ' || COALESCE(time, '00:00:00'))::timestamp with time zone
WHERE timestamp IS NULL AND date IS NOT NULL;

-- Step 6: Add interval type column
ALTER TABLE public.historical_prices_nse_equity 
  ADD COLUMN IF NOT EXISTS interval_type text DEFAULT '5min';

-- Step 7: Create composite unique index to prevent duplicate entries
CREATE UNIQUE INDEX IF NOT EXISTS idx_historical_prices_nse_equity_symbol_timestamp 
  ON public.historical_prices_nse_equity (symbol, timestamp);

-- Step 8: Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_historical_prices_nse_equity_symbol 
  ON public.historical_prices_nse_equity (symbol);

CREATE INDEX IF NOT EXISTS idx_historical_prices_nse_equity_timestamp 
  ON public.historical_prices_nse_equity (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_historical_prices_nse_equity_date 
  ON public.historical_prices_nse_equity (date DESC);

-- Step 9: Add comment
COMMENT ON TABLE public.historical_prices_nse_equity IS 
  'Stores 5-minute interval historical price data for NSE equity symbols. Designed to hold 3 months of data for ~1000 symbols.';
