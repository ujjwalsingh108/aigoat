-- Add exchange column to swing_positional_bullish and swing_positional_bearish tables
-- This allows storing both NSE and BSE swing signals in the same tables

-- Add exchange column to bullish table
ALTER TABLE public.swing_positional_bullish 
ADD COLUMN IF NOT EXISTS exchange text DEFAULT 'NSE';

-- Add exchange column to bearish table
ALTER TABLE public.swing_positional_bearish 
ADD COLUMN IF NOT EXISTS exchange text DEFAULT 'NSE';

-- Create index for exchange filtering
CREATE INDEX IF NOT EXISTS idx_swing_positional_bullish_exchange 
  ON public.swing_positional_bullish 
  USING btree (exchange, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_swing_positional_bearish_exchange 
  ON public.swing_positional_bearish 
  USING btree (exchange, created_at DESC);

-- Update unique constraint to include exchange (if any exists)
-- First drop old constraint if it exists
ALTER TABLE public.swing_positional_bullish 
DROP CONSTRAINT IF EXISTS swing_positional_bullish_symbol_key;

ALTER TABLE public.swing_positional_bearish 
DROP CONSTRAINT IF EXISTS swing_positional_bearish_symbol_key;

-- Add new unique constraint with exchange
CREATE UNIQUE INDEX IF NOT EXISTS idx_swing_positional_bullish_symbol_exchange 
  ON public.swing_positional_bullish (symbol, exchange);

CREATE UNIQUE INDEX IF NOT EXISTS idx_swing_positional_bearish_symbol_exchange 
  ON public.swing_positional_bearish (symbol, exchange);

-- Add comments
COMMENT ON COLUMN public.swing_positional_bullish.exchange IS 'Exchange where stock is listed (NSE/BSE)';
COMMENT ON COLUMN public.swing_positional_bearish.exchange IS 'Exchange where stock is listed (NSE/BSE)';
