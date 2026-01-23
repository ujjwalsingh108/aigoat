-- Enable Row Level Security on zerodha_symbols table
ALTER TABLE public.zerodha_symbols ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (for idempotency)
DROP POLICY IF EXISTS "Public read access to symbols" ON public.zerodha_symbols;
DROP POLICY IF EXISTS "Authenticated read access to symbols" ON public.zerodha_symbols;
DROP POLICY IF EXISTS "Service role can insert symbols" ON public.zerodha_symbols;
DROP POLICY IF EXISTS "Service role can update symbols" ON public.zerodha_symbols;
DROP POLICY IF EXISTS "Service role can delete symbols" ON public.zerodha_symbols;

-- Policy 1: Allow anonymous users to view all symbols
-- This allows unauthenticated users to access symbol reference data
CREATE POLICY "Public read access to symbols"
ON public.zerodha_symbols
FOR SELECT
TO anon
USING (true);

-- Policy 2: Allow authenticated users to view all symbols
-- Logged-in users can see all symbol reference data
CREATE POLICY "Authenticated read access to symbols"
ON public.zerodha_symbols
FOR SELECT
TO authenticated
USING (true);

-- Policy 3: Service role can insert symbols
-- This is typically used by backend services for symbol data updates
CREATE POLICY "Service role can insert symbols"
ON public.zerodha_symbols
FOR INSERT
TO service_role
WITH CHECK (true);

-- Policy 4: Service role can update symbols
-- Allows backend services to update symbol data
CREATE POLICY "Service role can update symbols"
ON public.zerodha_symbols
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- Policy 5: Service role can delete symbols
-- Allows cleanup of outdated or delisted symbols
CREATE POLICY "Service role can delete symbols"
ON public.zerodha_symbols
FOR DELETE
TO service_role
USING (true);

-- Grant necessary permissions
GRANT SELECT ON public.zerodha_symbols TO anon;
GRANT SELECT ON public.zerodha_symbols TO authenticated;
GRANT ALL ON public.zerodha_symbols TO service_role;

-- Add comment for documentation
COMMENT ON TABLE public.zerodha_symbols IS 'Reference table for Zerodha symbols with instrument tokens and trading parameters';
COMMENT ON POLICY "Public read access to symbols" ON public.zerodha_symbols IS 'Allows anonymous users to view all symbol reference data';
COMMENT ON POLICY "Authenticated read access to symbols" ON public.zerodha_symbols IS 'Allows logged-in users to view all symbol reference data';
COMMENT ON POLICY "Service role can insert symbols" ON public.zerodha_symbols IS 'Allows backend services to add new symbols';
