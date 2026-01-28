-- Migration: Create historical_prices_bse_equity table
-- Created: 2026-01-28
-- Purpose: Store 5-minute interval historical price data for BSE equity symbols
-- Storage estimate: ~5 million rows (1000 symbols × 78 candles/day × 65 days)

-- ============================================================================
-- Table: historical_prices_bse_equity
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.historical_prices_bse_equity (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  symbol text NOT NULL,
  date date NOT NULL,
  timestamp timestamp with time zone NOT NULL,
  interval_type text NOT NULL DEFAULT '5min',
  open numeric NOT NULL,
  high numeric NOT NULL,
  low numeric NOT NULL,
  close numeric NOT NULL,
  volume bigint,
  open_interest bigint,
  time text, -- kept for backward compatibility
  CONSTRAINT historical_prices_bse_equity_pkey PRIMARY KEY (id),
  CONSTRAINT historical_prices_bse_equity_symbol_timestamp_key UNIQUE (symbol, timestamp)
);

-- ============================================================================
-- Indexes
-- ============================================================================
CREATE INDEX idx_historical_prices_bse_equity_symbol 
  ON public.historical_prices_bse_equity (symbol);

CREATE INDEX idx_historical_prices_bse_equity_timestamp 
  ON public.historical_prices_bse_equity (timestamp DESC);

CREATE INDEX idx_historical_prices_bse_equity_date 
  ON public.historical_prices_bse_equity (date DESC);

CREATE INDEX idx_historical_prices_bse_equity_symbol_date 
  ON public.historical_prices_bse_equity (symbol, date DESC);

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON TABLE public.historical_prices_bse_equity IS 
  'Stores 5-minute interval historical price data for BSE equity symbols. Designed to hold 3 months of data for ~1000 symbols.';

COMMENT ON COLUMN public.historical_prices_bse_equity.symbol IS 
  'BSE equity symbol (e.g., "RELIANCE", "TCS")';

COMMENT ON COLUMN public.historical_prices_bse_equity.timestamp IS 
  'Precise timestamp with timezone for the 5-minute candle';

COMMENT ON COLUMN public.historical_prices_bse_equity.interval_type IS 
  'Interval type - default is 5min';

-- ============================================================================
-- RLS Policies (Row Level Security)
-- ============================================================================
ALTER TABLE public.historical_prices_bse_equity ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read historical data
CREATE POLICY "Allow authenticated users to read BSE equity historical prices"
  ON public.historical_prices_bse_equity
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow service role to insert/update/delete
CREATE POLICY "Allow service role full access to BSE equity historical prices"
  ON public.historical_prices_bse_equity
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
