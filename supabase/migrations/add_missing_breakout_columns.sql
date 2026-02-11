-- Add missing columns to breakout tables
-- Created: 2026-02-09
-- Adds entry_price and pattern_confidence columns that scanners expect

-- NSE Equity Bullish Breakout
ALTER TABLE public.bullish_breakout_nse_eq
ADD COLUMN IF NOT EXISTS entry_price numeric(10, 2),
ADD COLUMN IF NOT EXISTS pattern_confidence numeric(5, 2);

-- NSE Equity Bearish Breakout
ALTER TABLE public.bearish_breakout_nse_eq
ADD COLUMN IF NOT EXISTS entry_price numeric(10, 2),
ADD COLUMN IF NOT EXISTS pattern_confidence numeric(5, 2);

-- BSE Equity Bullish Breakout
ALTER TABLE public.bullish_breakout_bse_eq
ADD COLUMN IF NOT EXISTS entry_price numeric(10, 2),
ADD COLUMN IF NOT EXISTS pattern_confidence numeric(5, 2);

-- BSE Equity Bearish Breakout
ALTER TABLE public.bearish_breakout_bse_eq
ADD COLUMN IF NOT EXISTS entry_price numeric(10, 2),
ADD COLUMN IF NOT EXISTS pattern_confidence numeric(5, 2);

-- NSE Swing Positional Bullish (if needed)
ALTER TABLE public.nse_swing_positional_bullish
ADD COLUMN IF NOT EXISTS entry_price numeric(10, 2),
ADD COLUMN IF NOT EXISTS pattern_confidence numeric(5, 2);

-- NSE Swing Positional Bearish (if needed)
ALTER TABLE public.nse_swing_positional_bearish
ADD COLUMN IF NOT EXISTS entry_price numeric(10, 2),
ADD COLUMN IF NOT EXISTS pattern_confidence numeric(5, 2);

-- BSE Swing Positional Bullish (if needed)
ALTER TABLE public.bse_swing_positional_bullish
ADD COLUMN IF NOT EXISTS entry_price numeric(10, 2),
ADD COLUMN IF NOT EXISTS pattern_confidence numeric(5, 2);

-- BSE Swing Positional Bearish (if needed)
ALTER TABLE public.bse_swing_positional_bearish
ADD COLUMN IF NOT EXISTS entry_price numeric(10, 2),
ADD COLUMN IF NOT EXISTS pattern_confidence numeric(5, 2);

-- Create indexes for entry_price (commonly used for filtering)
CREATE INDEX IF NOT EXISTS idx_bullish_breakout_nse_eq_entry_price ON public.bullish_breakout_nse_eq (entry_price);
CREATE INDEX IF NOT EXISTS idx_bearish_breakout_nse_eq_entry_price ON public.bearish_breakout_nse_eq (entry_price);
CREATE INDEX IF NOT EXISTS idx_bullish_breakout_bse_eq_entry_price ON public.bullish_breakout_bse_eq (entry_price);
CREATE INDEX IF NOT EXISTS idx_bearish_breakout_bse_eq_entry_price ON public.bearish_breakout_bse_eq (entry_price);
