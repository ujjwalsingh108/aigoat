-- ============================================================================
-- BSE Equity Top 1000 Symbols Table
-- ============================================================================
-- Purpose: Store BSE-specific instrument tokens and symbol information
-- Exchange: BSE only
-- ============================================================================

-- Drop table if exists (optional - comment out if you want to preserve data)
-- DROP TABLE IF EXISTS public.bse_equity_top_1000_symbols CASCADE;

-- Create table
CREATE TABLE IF NOT EXISTS public.bse_equity_top_1000_symbols (
  symbol text NOT NULL,
  instrument_token text NOT NULL,
  exchange text NOT NULL DEFAULT 'BSE'::text,
  type text NOT NULL DEFAULT 'EQ'::text,
  segment text NOT NULL DEFAULT 'BSE'::text,
  company_name text NULL,
  isin text NULL,
  lot_size integer NULL DEFAULT 1,
  tick_size numeric NULL DEFAULT 0.05,
  is_active boolean NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  constraint bse_equity_top_1000_symbols_pkey PRIMARY KEY (symbol)
) TABLESPACE pg_default;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bse_equity_top_1000_symbol 
  ON public.bse_equity_top_1000_symbols 
  USING btree (symbol) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_bse_equity_top_1000_instrument_token 
  ON public.bse_equity_top_1000_symbols 
  USING btree (instrument_token) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_bse_equity_top_1000_exchange 
  ON public.bse_equity_top_1000_symbols 
  USING btree (exchange) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_bse_equity_top_1000_is_active 
  ON public.bse_equity_top_1000_symbols 
  USING btree (is_active) 
  TABLESPACE pg_default;

-- Add comment to table
COMMENT ON TABLE public.bse_equity_top_1000_symbols IS 'Top 1000 BSE equity symbols with instrument tokens for Zerodha Kite API';

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE public.bse_equity_top_1000_symbols ENABLE ROW LEVEL SECURITY;

-- Policy 1: Allow public read access (SELECT)
CREATE POLICY "Allow public read access"
  ON public.bse_equity_top_1000_symbols
  FOR SELECT
  TO public
  USING (true);

-- Policy 2: Allow authenticated users read access
CREATE POLICY "Allow authenticated read access"
  ON public.bse_equity_top_1000_symbols
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy 3: Allow service role full access
CREATE POLICY "Allow service role full access"
  ON public.bse_equity_top_1000_symbols
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy 4: Allow anon users read access
CREATE POLICY "Allow anon read access"
  ON public.bse_equity_top_1000_symbols
  FOR SELECT
  TO anon
  USING (true);

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant permissions to postgres role
GRANT ALL ON TABLE public.bse_equity_top_1000_symbols TO postgres;

-- Grant full access to service_role (for backend scripts)
GRANT ALL ON TABLE public.bse_equity_top_1000_symbols TO service_role;

-- Grant read access to authenticated users
GRANT SELECT ON TABLE public.bse_equity_top_1000_symbols TO authenticated;

-- Grant read access to anon users
GRANT SELECT ON TABLE public.bse_equity_top_1000_symbols TO anon;

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

-- Create or replace function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic updated_at updates
DROP TRIGGER IF EXISTS update_bse_equity_top_1000_symbols_updated_at ON public.bse_equity_top_1000_symbols;

CREATE TRIGGER update_bse_equity_top_1000_symbols_updated_at
  BEFORE UPDATE ON public.bse_equity_top_1000_symbols
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- End of BSE Equity Top 1000 Symbols Table Creation
-- ============================================================================
