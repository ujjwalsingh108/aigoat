-- Migration: Create historical price tables for BSE equity, NSE F&O, and BSE F&O
-- Created: 2026-01-28
-- Purpose: Create separate tables for different exchanges and instrument types
-- Storage estimate: ~5 million rows per table (1000 symbols × 78 candles/day × 65 days)

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

-- Indexes for BSE equity
CREATE INDEX idx_historical_prices_bse_equity_symbol 
  ON public.historical_prices_bse_equity (symbol);

CREATE INDEX idx_historical_prices_bse_equity_timestamp 
  ON public.historical_prices_bse_equity (timestamp DESC);

CREATE INDEX idx_historical_prices_bse_equity_date 
  ON public.historical_prices_bse_equity (date DESC);

CREATE INDEX idx_historical_prices_bse_equity_symbol_date 
  ON public.historical_prices_bse_equity (symbol, date DESC);

COMMENT ON TABLE public.historical_prices_bse_equity IS 
  'Stores 5-minute interval historical price data for BSE equity symbols. Designed to hold 3 months of data for ~1000 symbols.';

-- ============================================================================
-- Table: historical_prices_nse_fo
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.historical_prices_nse_fo (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  symbol text NOT NULL,
  instrument_token text,
  underlying text, -- e.g., NIFTY, BANKNIFTY
  instrument_type text, -- FUT, CE, PE
  expiry date,
  strike numeric,
  option_type text, -- CE or PE
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
  CONSTRAINT historical_prices_nse_fo_pkey PRIMARY KEY (id),
  CONSTRAINT historical_prices_nse_fo_symbol_timestamp_key UNIQUE (symbol, timestamp)
);

-- Indexes for NSE F&O
CREATE INDEX idx_historical_prices_nse_fo_symbol 
  ON public.historical_prices_nse_fo (symbol);

CREATE INDEX idx_historical_prices_nse_fo_timestamp 
  ON public.historical_prices_nse_fo (timestamp DESC);

CREATE INDEX idx_historical_prices_nse_fo_date 
  ON public.historical_prices_nse_fo (date DESC);

CREATE INDEX idx_historical_prices_nse_fo_underlying 
  ON public.historical_prices_nse_fo (underlying);

CREATE INDEX idx_historical_prices_nse_fo_expiry 
  ON public.historical_prices_nse_fo (expiry DESC);

CREATE INDEX idx_historical_prices_nse_fo_symbol_date 
  ON public.historical_prices_nse_fo (symbol, date DESC);

CREATE INDEX idx_historical_prices_nse_fo_underlying_expiry 
  ON public.historical_prices_nse_fo (underlying, expiry DESC);

COMMENT ON TABLE public.historical_prices_nse_fo IS 
  'Stores 5-minute interval historical price data for NSE F&O instruments (futures and options). Designed to hold 3 months of data for ~1000 instruments.';

-- ============================================================================
-- Table: historical_prices_bse_fo
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.historical_prices_bse_fo (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  symbol text NOT NULL,
  instrument_token text,
  underlying text, -- e.g., SENSEX, BANKEX
  instrument_type text, -- FUT, CE, PE
  expiry date,
  strike numeric,
  option_type text, -- CE or PE
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
  CONSTRAINT historical_prices_bse_fo_pkey PRIMARY KEY (id),
  CONSTRAINT historical_prices_bse_fo_symbol_timestamp_key UNIQUE (symbol, timestamp)
);

-- Indexes for BSE F&O
CREATE INDEX idx_historical_prices_bse_fo_symbol 
  ON public.historical_prices_bse_fo (symbol);

CREATE INDEX idx_historical_prices_bse_fo_timestamp 
  ON public.historical_prices_bse_fo (timestamp DESC);

CREATE INDEX idx_historical_prices_bse_fo_date 
  ON public.historical_prices_bse_fo (date DESC);

CREATE INDEX idx_historical_prices_bse_fo_underlying 
  ON public.historical_prices_bse_fo (underlying);

CREATE INDEX idx_historical_prices_bse_fo_expiry 
  ON public.historical_prices_bse_fo (expiry DESC);

CREATE INDEX idx_historical_prices_bse_fo_symbol_date 
  ON public.historical_prices_bse_fo (symbol, date DESC);

CREATE INDEX idx_historical_prices_bse_fo_underlying_expiry 
  ON public.historical_prices_bse_fo (underlying, expiry DESC);

COMMENT ON TABLE public.historical_prices_bse_fo IS 
  'Stores 5-minute interval historical price data for BSE F&O instruments (futures and options). Designed to hold 3 months of data for ~1000 instruments.';

-- ============================================================================
-- RLS Policies (Row Level Security)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.historical_prices_bse_equity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historical_prices_nse_fo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historical_prices_bse_fo ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read historical data
CREATE POLICY "Allow authenticated users to read BSE equity historical prices"
  ON public.historical_prices_bse_equity
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to read NSE F&O historical prices"
  ON public.historical_prices_nse_fo
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to read BSE F&O historical prices"
  ON public.historical_prices_bse_fo
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

CREATE POLICY "Allow service role full access to NSE F&O historical prices"
  ON public.historical_prices_nse_fo
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service role full access to BSE F&O historical prices"
  ON public.historical_prices_bse_fo
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to clean up old historical data (older than 3 months)
CREATE OR REPLACE FUNCTION cleanup_old_historical_data()
RETURNS void AS $$
DECLARE
  cutoff_date date := CURRENT_DATE - INTERVAL '3 months';
BEGIN
  DELETE FROM public.historical_prices_nse_equity WHERE date < cutoff_date;
  DELETE FROM public.historical_prices_bse_equity WHERE date < cutoff_date;
  DELETE FROM public.historical_prices_nse_fo WHERE date < cutoff_date;
  DELETE FROM public.historical_prices_bse_fo WHERE date < cutoff_date;
  
  RAISE NOTICE 'Cleaned up historical data older than %', cutoff_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get storage statistics for historical price tables
CREATE OR REPLACE FUNCTION get_historical_prices_stats()
RETURNS TABLE (
  table_name text,
  row_count bigint,
  total_size text,
  table_size text,
  indexes_size text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.table_name::text,
    t.row_count,
    pg_size_pretty(t.total_bytes) AS total_size,
    pg_size_pretty(t.table_bytes) AS table_size,
    pg_size_pretty(t.index_bytes) AS indexes_size
  FROM (
    SELECT 
      'historical_prices_nse_equity' AS table_name,
      (SELECT COUNT(*) FROM public.historical_prices_nse_equity) AS row_count,
      pg_total_relation_size('public.historical_prices_nse_equity') AS total_bytes,
      pg_relation_size('public.historical_prices_nse_equity') AS table_bytes,
      pg_indexes_size('public.historical_prices_nse_equity') AS index_bytes
    UNION ALL
    SELECT 
      'historical_prices_bse_equity',
      (SELECT COUNT(*) FROM public.historical_prices_bse_equity),
      pg_total_relation_size('public.historical_prices_bse_equity'),
      pg_relation_size('public.historical_prices_bse_equity'),
      pg_indexes_size('public.historical_prices_bse_equity')
    UNION ALL
    SELECT 
      'historical_prices_nse_fo',
      (SELECT COUNT(*) FROM public.historical_prices_nse_fo),
      pg_total_relation_size('public.historical_prices_nse_fo'),
      pg_relation_size('public.historical_prices_nse_fo'),
      pg_indexes_size('public.historical_prices_nse_fo')
    UNION ALL
    SELECT 
      'historical_prices_bse_fo',
      (SELECT COUNT(*) FROM public.historical_prices_bse_fo),
      pg_total_relation_size('public.historical_prices_bse_fo'),
      pg_relation_size('public.historical_prices_bse_fo'),
      pg_indexes_size('public.historical_prices_bse_fo')
  ) t;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_old_historical_data() IS 
  'Removes historical price data older than 3 months from all tables to maintain storage limits.';

COMMENT ON FUNCTION get_historical_prices_stats() IS 
  'Returns storage and row count statistics for all historical price tables.';
