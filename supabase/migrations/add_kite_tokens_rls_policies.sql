-- Enable Row Level Security on kite_tokens table
ALTER TABLE public.kite_tokens ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (for idempotency)
DROP POLICY IF EXISTS "Service role can view tokens" ON public.kite_tokens;
DROP POLICY IF EXISTS "Service role can insert tokens" ON public.kite_tokens;
DROP POLICY IF EXISTS "Service role can update tokens" ON public.kite_tokens;
DROP POLICY IF EXISTS "Service role can delete tokens" ON public.kite_tokens;

-- Policy 1: Service role can view tokens
-- Only backend services can read token data
CREATE POLICY "Service role can view tokens"
ON public.kite_tokens
FOR SELECT
TO service_role
USING (true);

-- Policy 2: Service role can insert tokens
-- Allows backend services to store new tokens
CREATE POLICY "Service role can insert tokens"
ON public.kite_tokens
FOR INSERT
TO service_role
WITH CHECK (true);

-- Policy 3: Service role can update tokens
-- Allows backend services to update token status (e.g., marking inactive)
CREATE POLICY "Service role can update tokens"
ON public.kite_tokens
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- Policy 4: Service role can delete tokens
-- Allows cleanup of expired or invalid tokens
CREATE POLICY "Service role can delete tokens"
ON public.kite_tokens
FOR DELETE
TO service_role
USING (true);

-- Grant necessary permissions
-- NOTE: Only service_role has access - no anon or authenticated access for security
GRANT ALL ON public.kite_tokens TO service_role;

-- Grant usage on sequence for inserts
GRANT USAGE, SELECT ON SEQUENCE public.kite_tokens_id_seq TO service_role;

-- Add comment for documentation
COMMENT ON TABLE public.kite_tokens IS 'Stores Kite API access tokens - RESTRICTED ACCESS for security';
COMMENT ON POLICY "Service role can view tokens" ON public.kite_tokens IS 'Only backend services can read token data';
COMMENT ON POLICY "Service role can insert tokens" ON public.kite_tokens IS 'Allows backend services to store new tokens';
