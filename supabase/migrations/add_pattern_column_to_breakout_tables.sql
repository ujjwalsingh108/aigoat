-- Add pattern column to all breakout signal tables
-- Created: 2026-02-09
-- Run this if pattern column was not added in the initial AI columns migration

-- NSE Equity Bullish Breakout
ALTER TABLE public.bullish_breakout_nse_eq
ADD COLUMN IF NOT EXISTS pattern text;

-- NSE Equity Bearish Breakout
ALTER TABLE public.bearish_breakout_nse_eq
ADD COLUMN IF NOT EXISTS pattern text;

-- BSE Equity Bullish Breakout
ALTER TABLE public.bullish_breakout_bse_eq
ADD COLUMN IF NOT EXISTS pattern text;

-- BSE Equity Bearish Breakout
ALTER TABLE public.bearish_breakout_bse_eq
ADD COLUMN IF NOT EXISTS pattern text;

-- NSE F&O Signals
ALTER TABLE public.nse_fo_signals
ADD COLUMN IF NOT EXISTS pattern text;

-- NSE Swing Positional Bullish
ALTER TABLE public.nse_swing_positional_bullish
ADD COLUMN IF NOT EXISTS pattern text;

-- NSE Swing Positional Bearish
ALTER TABLE public.nse_swing_positional_bearish
ADD COLUMN IF NOT EXISTS pattern text;

-- BSE Swing Positional Bullish
ALTER TABLE public.bse_swing_positional_bullish
ADD COLUMN IF NOT EXISTS pattern text;

-- BSE Swing Positional Bearish
ALTER TABLE public.bse_swing_positional_bearish
ADD COLUMN IF NOT EXISTS pattern text;

-- Create indexes on pattern for better query performance
CREATE INDEX IF NOT EXISTS idx_bullish_breakout_nse_eq_pattern ON public.bullish_breakout_nse_eq (pattern);
CREATE INDEX IF NOT EXISTS idx_bearish_breakout_nse_eq_pattern ON public.bearish_breakout_nse_eq (pattern);
CREATE INDEX IF NOT EXISTS idx_bullish_breakout_bse_eq_pattern ON public.bullish_breakout_bse_eq (pattern);
CREATE INDEX IF NOT EXISTS idx_bearish_breakout_bse_eq_pattern ON public.bearish_breakout_bse_eq (pattern);
CREATE INDEX IF NOT EXISTS idx_nse_fo_signals_pattern ON public.nse_fo_signals (pattern);
CREATE INDEX IF NOT EXISTS idx_nse_swing_positional_bullish_pattern ON public.nse_swing_positional_bullish (pattern);
CREATE INDEX IF NOT EXISTS idx_nse_swing_positional_bearish_pattern ON public.nse_swing_positional_bearish (pattern);
CREATE INDEX IF NOT EXISTS idx_bse_swing_positional_bullish_pattern ON public.bse_swing_positional_bullish (pattern);
CREATE INDEX IF NOT EXISTS idx_bse_swing_positional_bearish_pattern ON public.bse_swing_positional_bearish (pattern);
