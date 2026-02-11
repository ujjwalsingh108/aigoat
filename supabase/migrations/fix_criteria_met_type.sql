-- Fix criteria_met column type to accept text descriptions
-- Created: 2026-02-09
-- Scanner sends "Price above EMA20, RSI momentum" but column is integer

-- Drop dependent view
DROP VIEW IF EXISTS public.screener_signals_with_patterns CASCADE;

-- Change criteria_met from integer to text for all breakout tables
ALTER TABLE public.bullish_breakout_nse_eq
ALTER COLUMN criteria_met TYPE text USING criteria_met::text;

ALTER TABLE public.bearish_breakout_nse_eq
ALTER COLUMN criteria_met TYPE text USING criteria_met::text;

ALTER TABLE public.bullish_breakout_bse_eq
ALTER COLUMN criteria_met TYPE text USING criteria_met::text;

ALTER TABLE public.bearish_breakout_bse_eq
ALTER COLUMN criteria_met TYPE text USING criteria_met::text;

-- Force schema refresh
NOTIFY pgrst, 'reload schema';
