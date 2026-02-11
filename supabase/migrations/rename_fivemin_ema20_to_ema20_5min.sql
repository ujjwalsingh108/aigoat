-- Rename fivemin_ema20 column to ema20_5min for NSE breakout tables
-- Created: 2026-02-09
-- This makes the column names compatible with the scanner code

-- NSE Equity Bullish Breakout
ALTER TABLE public.bullish_breakout_nse_eq
RENAME COLUMN fivemin_ema20 TO ema20_5min;

-- NSE Equity Bearish Breakout
ALTER TABLE public.bearish_breakout_nse_eq
RENAME COLUMN fivemin_ema20 TO ema20_5min;
