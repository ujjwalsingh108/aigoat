-- Create table for NSE actual equity stocks only
-- Filters out bonds, warrants, derivatives, and other non-equity instruments

CREATE TABLE IF NOT EXISTS public.kite_nse_equity_symbols (
  symbol TEXT NOT NULL PRIMARY KEY,
  instrument_token TEXT NOT NULL,
  exchange TEXT NOT NULL DEFAULT 'NSE',
  type TEXT NOT NULL DEFAULT 'EQ',
  segment TEXT NOT NULL DEFAULT 'NSE',
  company_name TEXT,
  isin TEXT,
  lot_size INTEGER DEFAULT 1,
  tick_size NUMERIC DEFAULT 0.05,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_kite_nse_equity_symbol ON public.kite_nse_equity_symbols(symbol);
CREATE INDEX IF NOT EXISTS idx_kite_nse_equity_instrument_token ON public.kite_nse_equity_symbols(instrument_token);
CREATE INDEX IF NOT EXISTS idx_kite_nse_equity_is_active ON public.kite_nse_equity_symbols(is_active);

-- Add comment
COMMENT ON TABLE public.kite_nse_equity_symbols IS 'Filtered NSE equity stocks only - excludes bonds, warrants, derivatives';
