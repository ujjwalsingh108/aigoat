-- Enable Row Level Security on kite_nse_equity_symbols table
ALTER TABLE public.kite_nse_equity_symbols ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (for idempotency)
DROP POLICY IF EXISTS "Public read access to symbols" ON public.kite_nse_equity_symbols;
DROP POLICY IF EXISTS "Authenticated read access to symbols" ON public.kite_nse_equity_symbols;
DROP POLICY IF EXISTS "Service role can insert symbols" ON public.kite_nse_equity_symbols;
DROP POLICY IF EXISTS "Service role can update symbols" ON public.kite_nse_equity_symbols;
DROP POLICY IF EXISTS "Service role can delete symbols" ON public.kite_nse_equity_symbols;

-- Policy 1: Allow anonymous users to view all symbols
-- This allows unauthenticated users to access symbol reference data
CREATE POLICY "Public read access to symbols"
ON public.kite_nse_equity_symbols
FOR SELECT
TO anon
USING (true);

-- Policy 2: Allow authenticated users to view all symbols
-- Logged-in users can see all symbol reference data
CREATE POLICY "Authenticated read access to symbols"
ON public.kite_nse_equity_symbols
FOR SELECT
TO authenticated
USING (true);

-- Policy 3: Service role can insert symbols
-- This is typically used by backend services for symbol data updates
CREATE POLICY "Service role can insert symbols"
ON public.kite_nse_equity_symbols
FOR INSERT
TO service_role
WITH CHECK (true);

-- Policy 4: Service role can update symbols
-- Allows backend services to update symbol data (e.g., activation status, company names)
CREATE POLICY "Service role can update symbols"
ON public.kite_nse_equity_symbols
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- Policy 5: Service role can delete symbols
-- Allows cleanup of outdated or delisted symbols
CREATE POLICY "Service role can delete symbols"
ON public.kite_nse_equity_symbols
FOR DELETE
TO service_role
USING (true);

-- Grant necessary permissions
GRANT SELECT ON public.kite_nse_equity_symbols TO anon;
GRANT SELECT ON public.kite_nse_equity_symbols TO authenticated;
GRANT ALL ON public.kite_nse_equity_symbols TO service_role;

-- Add comment for documentation
COMMENT ON TABLE public.kite_nse_equity_symbols IS 'Reference table for NSE equity symbols with Kite instrument tokens and trading parameters';
COMMENT ON POLICY "Public read access to symbols" ON public.kite_nse_equity_symbols IS 'Allows anonymous users to view all symbol reference data';
COMMENT ON POLICY "Authenticated read access to symbols" ON public.kite_nse_equity_symbols IS 'Allows logged-in users to view all symbol reference data';
COMMENT ON POLICY "Service role can insert symbols" ON public.kite_nse_equity_symbols IS 'Allows backend services to add new symbols';
