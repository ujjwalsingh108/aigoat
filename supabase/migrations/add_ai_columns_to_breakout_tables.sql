-- Add AI validation columns to all breakout signal tables
-- Created: 2026-02-09

-- NSE Equity Bullish Breakout
ALTER TABLE public.bullish_breakout_nse_eq
ADD COLUMN IF NOT EXISTS ai_verdict text,
ADD COLUMN IF NOT EXISTS ai_confidence numeric,
ADD COLUMN IF NOT EXISTS ai_reasoning text,
ADD COLUMN IF NOT EXISTS ai_risk_factors text,
ADD COLUMN IF NOT EXISTS ai_validated boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS pattern text;

-- NSE Equity Bearish Breakout
ALTER TABLE public.bearish_breakout_nse_eq
ADD COLUMN IF NOT EXISTS ai_verdict text,
ADD COLUMN IF NOT EXISTS ai_confidence numeric,
ADD COLUMN IF NOT EXISTS ai_reasoning text,
ADD COLUMN IF NOT EXISTS ai_risk_factors text,
ADD COLUMN IF NOT EXISTS ai_validated boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS pattern text;

-- BSE Equity Bullish Breakout
ALTER TABLE public.bullish_breakout_bse_eq
ADD COLUMN IF NOT EXISTS ai_verdict text,
ADD COLUMN IF NOT EXISTS ai_confidence numeric,
ADD COLUMN IF NOT EXISTS ai_reasoning text,
ADD COLUMN IF NOT EXISTS ai_risk_factors text,
ADD COLUMN IF NOT EXISTS ai_validated boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS pattern text;

-- BSE Equity Bearish Breakout
ALTER TABLE public.bearish_breakout_bse_eq
ADD COLUMN IF NOT EXISTS ai_verdict text,
ADD COLUMN IF NOT EXISTS ai_confidence numeric,
ADD COLUMN IF NOT EXISTS ai_reasoning text,
ADD COLUMN IF NOT EXISTS ai_risk_factors text,
ADD COLUMN IF NOT EXISTS ai_validated boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS pattern text;

-- NSE F&O Signals
ALTER TABLE public.nse_fo_signals
ADD COLUMN IF NOT EXISTS ai_verdict text,
ADD COLUMN IF NOT EXISTS ai_confidence numeric,
ADD COLUMN IF NOT EXISTS ai_reasoning text,
ADD COLUMN IF NOT EXISTS ai_risk_factors text,
ADD COLUMN IF NOT EXISTS ai_validated boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS pattern text;

-- NSE Swing Positional Bullish
ALTER TABLE public.nse_swing_positional_bullish
ADD COLUMN IF NOT EXISTS ai_verdict text,
ADD COLUMN IF NOT EXISTS ai_confidence numeric,
ADD COLUMN IF NOT EXISTS ai_reasoning text,
ADD COLUMN IF NOT EXISTS ai_risk_factors text,
ADD COLUMN IF NOT EXISTS ai_validated boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS pattern text;

-- NSE Swing Positional Bearish
ALTER TABLE public.nse_swing_positional_bearish
ADD COLUMN IF NOT EXISTS ai_verdict text,
ADD COLUMN IF NOT EXISTS ai_confidence numeric,
ADD COLUMN IF NOT EXISTS ai_reasoning text,
ADD COLUMN IF NOT EXISTS ai_risk_factors text,
ADD COLUMN IF NOT EXISTS ai_validated boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS pattern text;

-- BSE Swing Positional Bullish
ALTER TABLE public.bse_swing_positional_bullish
ADD COLUMN IF NOT EXISTS ai_verdict text,
ADD COLUMN IF NOT EXISTS ai_confidence numeric,
ADD COLUMN IF NOT EXISTS ai_reasoning text,
ADD COLUMN IF NOT EXISTS ai_risk_factors text,
ADD COLUMN IF NOT EXISTS ai_validated boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS pattern text;

-- BSE Swing Positional Bearish
ALTER TABLE public.bse_swing_positional_bearish
ADD COLUMN IF NOT EXISTS ai_verdict text,
ADD COLUMN IF NOT EXISTS ai_confidence numeric,
ADD COLUMN IF NOT EXISTS ai_reasoning text,
ADD COLUMN IF NOT EXISTS ai_risk_factors text,
ADD COLUMN IF NOT EXISTS ai_validated boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS pattern text;

-- Create indexes on ai_confidence for better query performance
CREATE INDEX IF NOT EXISTS idx_bullish_breakout_nse_eq_ai_confidence ON public.bullish_breakout_nse_eq (ai_confidence DESC);
CREATE INDEX IF NOT EXISTS idx_bearish_breakout_nse_eq_ai_confidence ON public.bearish_breakout_nse_eq (ai_confidence DESC);
CREATE INDEX IF NOT EXISTS idx_bullish_breakout_bse_eq_ai_confidence ON public.bullish_breakout_bse_eq (ai_confidence DESC);
CREATE INDEX IF NOT EXISTS idx_bearish_breakout_bse_eq_ai_confidence ON public.bearish_breakout_bse_eq (ai_confidence DESC);
CREATE INDEX IF NOT EXISTS idx_nse_fo_signals_ai_confidence ON public.nse_fo_signals (ai_confidence DESC);
CREATE INDEX IF NOT EXISTS idx_nse_swing_positional_bullish_ai_confidence ON public.nse_swing_positional_bullish (ai_confidence DESC);
CREATE INDEX IF NOT EXISTS idx_nse_swing_positional_bearish_ai_confidence ON public.nse_swing_positional_bearish (ai_confidence DESC);
CREATE INDEX IF NOT EXISTS idx_bse_swing_positional_bullish_ai_confidence ON public.bse_swing_positional_bullish (ai_confidence DESC);
CREATE INDEX IF NOT EXISTS idx_bse_swing_positional_bearish_ai_confidence ON public.bse_swing_positional_bearish (ai_confidence DESC);

-- Create indexes on ai_validated for filtering
CREATE INDEX IF NOT EXISTS idx_bullish_breakout_nse_eq_ai_validated ON public.bullish_breakout_nse_eq (ai_validated);
CREATE INDEX IF NOT EXISTS idx_bearish_breakout_nse_eq_ai_validated ON public.bearish_breakout_nse_eq (ai_validated);
CREATE INDEX IF NOT EXISTS idx_bullish_breakout_bse_eq_ai_validated ON public.bullish_breakout_bse_eq (ai_validated);
CREATE INDEX IF NOT EXISTS idx_bearish_breakout_bse_eq_ai_validated ON public.bearish_breakout_bse_eq (ai_validated);
CREATE INDEX IF NOT EXISTS idx_nse_fo_signals_ai_validated ON public.nse_fo_signals (ai_validated);
CREATE INDEX IF NOT EXISTS idx_nse_swing_positional_bullish_ai_validated ON public.nse_swing_positional_bullish (ai_validated);
CREATE INDEX IF NOT EXISTS idx_nse_swing_positional_bearish_ai_validated ON public.nse_swing_positional_bearish (ai_validated);
CREATE INDEX IF NOT EXISTS idx_bse_swing_positional_bullish_ai_validated ON public.bse_swing_positional_bullish (ai_validated);
CREATE INDEX IF NOT EXISTS idx_bse_swing_positional_bearish_ai_validated ON public.bse_swing_positional_bearish (ai_validated);
