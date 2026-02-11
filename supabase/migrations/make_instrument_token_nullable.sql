-- Make instrument_token nullable for equity breakout tables
-- Created: 2026-02-09
-- Equity scanners don't have instrument_token, only F&O scanners do

-- Make instrument_token nullable for BSE equity tables
ALTER TABLE public.bullish_breakout_bse_eq
ALTER COLUMN instrument_token DROP NOT NULL;

ALTER TABLE public.bearish_breakout_bse_eq
ALTER COLUMN instrument_token DROP NOT NULL;

-- Make instrument_token nullable for NSE equity tables  
ALTER TABLE public.bullish_breakout_nse_eq
ALTER COLUMN instrument_token DROP NOT NULL;

ALTER TABLE public.bearish_breakout_nse_eq
ALTER COLUMN instrument_token DROP NOT NULL;

-- Force schema refresh
NOTIFY pgrst, 'reload schema';
