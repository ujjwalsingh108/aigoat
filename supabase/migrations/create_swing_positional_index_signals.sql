-- Migration: Create swing_positional_index_signals table for NIFTY/BANKNIFTY swing signals
-- Strategy: Multi-timeframe (1H, 4H, 1D) EMA alignment + Daily RSI
-- Direction: LONG (Buy) and SHORT (Sell)

CREATE TABLE IF NOT EXISTS public.swing_positional_index_signals (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL, -- NIFTY or BANKNIFTY
  signal_type TEXT NOT NULL, -- SWING_INDEX_BUY or SWING_INDEX_SELL
  signal_direction TEXT NOT NULL, -- LONG or SHORT
  entry_price NUMERIC NOT NULL,
  
  -- Multi-timeframe EMA values (20-period)
  ema20_1h NUMERIC NOT NULL,
  ema20_4h NUMERIC NOT NULL,
  ema20_1d NUMERIC NOT NULL,
  
  -- Daily RSI values
  rsi9_daily NUMERIC,
  rsi14_daily NUMERIC NOT NULL,
  
  -- EMA alignment status
  is_above_ema_1h BOOLEAN NOT NULL,
  is_above_ema_4h BOOLEAN NOT NULL,
  is_above_ema_1d BOOLEAN NOT NULL,
  
  -- Signal metadata
  signal_start_date DATE NOT NULL,
  signal_age_days INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  daily_candle_time TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_swing_index_signals_symbol_time ON public.swing_positional_index_signals(symbol, daily_candle_time DESC);
CREATE INDEX idx_swing_index_signals_active ON public.swing_positional_index_signals(is_active);
CREATE INDEX idx_swing_index_signals_created ON public.swing_positional_index_signals(created_at DESC);
CREATE INDEX idx_swing_index_signals_direction ON public.swing_positional_index_signals(signal_direction);

-- Row Level Security (RLS)
ALTER TABLE public.swing_positional_index_signals ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access" ON public.swing_positional_index_signals
  FOR SELECT USING (true);

-- Allow admin write access (authenticated users with specific role)
CREATE POLICY "Allow admin write access" ON public.swing_positional_index_signals
  FOR ALL USING (
    auth.role() = 'authenticated'
  );

-- Comment for documentation
COMMENT ON TABLE public.swing_positional_index_signals IS 'Swing Positional Index signals for NIFTY/BANKNIFTY with multi-timeframe EMA alignment and Daily RSI validation';
