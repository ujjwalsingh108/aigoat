-- Add unique indexes on (symbol, timestamp) for both F&O historical tables.
-- Required for upsert ON CONFLICT to work correctly in edge functions and scanners.
-- Without these, repeated upsert calls insert duplicates instead of ignoring them.

CREATE UNIQUE INDEX IF NOT EXISTS idx_bse_fo_hist_symbol_timestamp
  ON public.historical_prices_bse_fo (symbol, timestamp);

CREATE UNIQUE INDEX IF NOT EXISTS idx_nse_fo_hist_symbol_timestamp
  ON public.historical_prices_nse_fo (symbol, timestamp);
