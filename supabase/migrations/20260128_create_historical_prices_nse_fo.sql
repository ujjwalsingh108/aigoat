-- Migration: Create historical_prices_nse_fo table
-- Created: 2026-01-28
-- Purpose: Store 5-minute interval historical price data for NSE F&O instruments
-- Storage estimate: ~5 million rows (1000 instruments × 78 candles/day × 65 days)

-- ============================================================================
-- Table: historical_prices_nse_fo
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.historical_prices_nse_fo (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  symbol text NOT NULL,
  instrument_token text,
  underlying text, -- e.g., NIFTY, BANKNIFTY, RELIANCE
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

-- ============================================================================
-- Indexes
-- ============================================================================
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

CREATE INDEX idx_historical_prices_nse_fo_instrument_type 
  ON public.historical_prices_nse_fo (instrument_type);

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON TABLE public.historical_prices_nse_fo IS 
  'Stores 5-minute interval historical price data for NSE F&O instruments (futures and options). Designed to hold 3 months of data for ~1000 instruments.';

COMMENT ON COLUMN public.historical_prices_nse_fo.symbol IS 
  'Full NSE F&O symbol (e.g., "NIFTY26FEB25000CE")';

COMMENT ON COLUMN public.historical_prices_nse_fo.underlying IS 
  'Underlying asset (e.g., "NIFTY", "BANKNIFTY", "RELIANCE")';

COMMENT ON COLUMN public.historical_prices_nse_fo.instrument_type IS 
  'Type of instrument: FUT (Futures), CE (Call Option), PE (Put Option)';

COMMENT ON COLUMN public.historical_prices_nse_fo.expiry IS 
  'Expiry date of the F&O contract';

COMMENT ON COLUMN public.historical_prices_nse_fo.strike IS 
  'Strike price for options (NULL for futures)';

COMMENT ON COLUMN public.historical_prices_nse_fo.timestamp IS 
  'Precise timestamp with timezone for the 5-minute candle';

COMMENT ON COLUMN public.historical_prices_nse_fo.interval_type IS 
  'Interval type - default is 5min';

-- ============================================================================
-- RLS Policies (Row Level Security)
-- ============================================================================
ALTER TABLE public.historical_prices_nse_fo ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read historical data
CREATE POLICY "Allow authenticated users to read NSE F&O historical prices"
  ON public.historical_prices_nse_fo
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow service role to insert/update/delete
CREATE POLICY "Allow service role full access to NSE F&O historical prices"
  ON public.historical_prices_nse_fo
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
