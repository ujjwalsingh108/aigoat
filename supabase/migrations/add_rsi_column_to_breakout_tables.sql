-- Add rsi column to all breakout tables
-- Created: 2026-02-09
-- Scanners use 'rsi' but tables have 'rsi_value'

-- NSE Equity Bullish Breakout
ALTER TABLE public.bullish_breakout_nse_eq
ADD COLUMN IF NOT EXISTS rsi numeric(5, 2);

-- NSE Equity Bearish Breakout
ALTER TABLE public.bearish_breakout_nse_eq
ADD COLUMN IF NOT EXISTS rsi numeric(5, 2);

-- BSE Equity Bullish Breakout
ALTER TABLE public.bullish_breakout_bse_eq
ADD COLUMN IF NOT EXISTS rsi numeric(5, 2);

-- BSE Equity Bearish Breakout
ALTER TABLE public.bearish_breakout_bse_eq
ADD COLUMN IF NOT EXISTS rsi numeric(5, 2);

-- Create indexes on rsi for filtering
CREATE INDEX IF NOT EXISTS idx_bullish_breakout_nse_eq_rsi ON public.bullish_breakout_nse_eq (rsi);
CREATE INDEX IF NOT EXISTS idx_bearish_breakout_nse_eq_rsi ON public.bearish_breakout_nse_eq (rsi);
CREATE INDEX IF NOT EXISTS idx_bullish_breakout_bse_eq_rsi ON public.bullish_breakout_bse_eq (rsi);
CREATE INDEX IF NOT EXISTS idx_bearish_breakout_bse_eq_rsi ON public.bearish_breakout_bse_eq (rsi);
