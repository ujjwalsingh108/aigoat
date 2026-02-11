-- COMPREHENSIVE FIX: Add all missing columns to breakout tables
-- Created: 2026-02-09
-- This adds ALL columns that scanners expect but tables are missing

-- NSE Equity Bullish Breakout
ALTER TABLE public.bullish_breakout_nse_eq
ADD COLUMN IF NOT EXISTS signal_type text,
ADD COLUMN IF NOT EXISTS volatility numeric(5, 2);

-- NSE Equity Bearish Breakout
ALTER TABLE public.bearish_breakout_nse_eq
ADD COLUMN IF NOT EXISTS signal_type text,
ADD COLUMN IF NOT EXISTS volatility numeric(5, 2);

-- BSE Equity Bullish Breakout
ALTER TABLE public.bullish_breakout_bse_eq
ADD COLUMN IF NOT EXISTS signal_type text,
ADD COLUMN IF NOT EXISTS volatility numeric(5, 2);

-- BSE Equity Bearish Breakout
ALTER TABLE public.bearish_breakout_bse_eq
ADD COLUMN IF NOT EXISTS signal_type text,
ADD COLUMN IF NOT EXISTS volatility numeric(5, 2);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_bullish_breakout_nse_eq_signal_type ON public.bullish_breakout_nse_eq (signal_type);
CREATE INDEX IF NOT EXISTS idx_bearish_breakout_nse_eq_signal_type ON public.bearish_breakout_nse_eq (signal_type);
CREATE INDEX IF NOT EXISTS idx_bullish_breakout_bse_eq_signal_type ON public.bullish_breakout_bse_eq (signal_type);
CREATE INDEX IF NOT EXISTS idx_bearish_breakout_bse_eq_signal_type ON public.bearish_breakout_bse_eq (signal_type);

-- After running this, RESTART PostgREST or wait 2 minutes for schema cache to refresh
-- Or run: NOTIFY pgrst, 'reload schema';
