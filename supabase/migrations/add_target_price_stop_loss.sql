-- Add target_price and stop_loss columns to breakout tables
-- Created: 2026-02-09
-- Final missing columns for breakout signal storage

-- NSE Equity Bullish Breakout
ALTER TABLE public.bullish_breakout_nse_eq
ADD COLUMN IF NOT EXISTS target_price numeric(10, 2),
ADD COLUMN IF NOT EXISTS stop_loss numeric(10, 2);

-- NSE Equity Bearish Breakout
ALTER TABLE public.bearish_breakout_nse_eq
ADD COLUMN IF NOT EXISTS target_price numeric(10, 2),
ADD COLUMN IF NOT EXISTS stop_loss numeric(10, 2);

-- BSE Equity Bullish Breakout
ALTER TABLE public.bullish_breakout_bse_eq
ADD COLUMN IF NOT EXISTS target_price numeric(10, 2),
ADD COLUMN IF NOT EXISTS stop_loss numeric(10, 2);

-- BSE Equity Bearish Breakout
ALTER TABLE public.bearish_breakout_bse_eq
ADD COLUMN IF NOT EXISTS target_price numeric(10, 2),
ADD COLUMN IF NOT EXISTS stop_loss numeric(10, 2);

-- Create indexes for target_price and stop_loss
CREATE INDEX IF NOT EXISTS idx_bullish_breakout_nse_eq_target_price ON public.bullish_breakout_nse_eq (target_price);
CREATE INDEX IF NOT EXISTS idx_bearish_breakout_nse_eq_target_price ON public.bearish_breakout_nse_eq (target_price);
CREATE INDEX IF NOT EXISTS idx_bullish_breakout_bse_eq_target_price ON public.bullish_breakout_bse_eq (target_price);
CREATE INDEX IF NOT EXISTS idx_bearish_breakout_bse_eq_target_price ON public.bearish_breakout_bse_eq (target_price);

-- Force schema refresh
NOTIFY pgrst, 'reload schema';
