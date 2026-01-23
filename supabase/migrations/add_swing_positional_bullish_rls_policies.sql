-- Enable Row Level Security on swing_positional_bullish table
ALTER TABLE public.swing_positional_bullish ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (for idempotency)
DROP POLICY IF EXISTS "Public signals are viewable by everyone" ON public.swing_positional_bullish;
DROP POLICY IF EXISTS "Authenticated users can view all signals" ON public.swing_positional_bullish;
DROP POLICY IF EXISTS "Service role can insert signals" ON public.swing_positional_bullish;
DROP POLICY IF EXISTS "Service role can update signals" ON public.swing_positional_bullish;
DROP POLICY IF EXISTS "Service role can delete signals" ON public.swing_positional_bullish;
DROP POLICY IF EXISTS "System can manage all signals" ON public.swing_positional_bullish;

-- Policy 1: Allow anonymous users to view public signals
-- This allows unauthenticated users to see signals marked as public
CREATE POLICY "Public signals are viewable by everyone"
ON public.swing_positional_bullish
FOR SELECT
TO anon
USING (is_public = true);

-- Policy 2: Allow authenticated users to view all signals
-- Logged-in users can see both public and private signals
CREATE POLICY "Authenticated users can view all signals"
ON public.swing_positional_bullish
FOR SELECT
TO authenticated
USING (true);

-- Policy 3: Service role can insert signals
-- This is typically used by backend services/cron jobs
CREATE POLICY "Service role can insert signals"
ON public.swing_positional_bullish
FOR INSERT
TO service_role
WITH CHECK (true);

-- Policy 4: Service role can update signals
-- Allows backend services to update signal data (e.g., AI validation)
CREATE POLICY "Service role can update signals"
ON public.swing_positional_bullish
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- Policy 5: Service role can delete signals
-- Allows cleanup of old or invalid signals
CREATE POLICY "Service role can delete signals"
ON public.swing_positional_bullish
FOR DELETE
TO service_role
USING (true);

-- Policy 6: Allow system-created entries to be managed
-- This policy allows the 'system' creator to manage signals
CREATE POLICY "System can manage all signals"
ON public.swing_positional_bullish
FOR ALL
TO authenticated
USING (created_by = 'system')
WITH CHECK (created_by = 'system');

-- Grant necessary permissions
GRANT SELECT ON public.swing_positional_bullish TO anon;
GRANT SELECT ON public.swing_positional_bullish TO authenticated;
GRANT ALL ON public.swing_positional_bullish TO service_role;

-- Grant usage on sequence for inserts
GRANT USAGE, SELECT ON SEQUENCE public.swing_positional_bullish_id_seq TO service_role;

-- Add comment for documentation
COMMENT ON TABLE public.swing_positional_bullish IS 'Stores swing/positional bullish trading signals with pattern detection and AI validation';
COMMENT ON POLICY "Public signals are viewable by everyone" ON public.swing_positional_bullish IS 'Allows anonymous users to view signals marked as public';
COMMENT ON POLICY "Authenticated users can view all signals" ON public.swing_positional_bullish IS 'Allows logged-in users to view all signals regardless of public status';
COMMENT ON POLICY "Service role can insert signals" ON public.swing_positional_bullish IS 'Allows backend services to create new signals';

-- Create index on is_public for better RLS performance
CREATE INDEX IF NOT EXISTS idx_swing_positional_bullish_is_public 
ON public.swing_positional_bullish USING btree (is_public) 
TABLESPACE pg_default
WHERE is_public = true;

-- Create index on created_by for filtering
CREATE INDEX IF NOT EXISTS idx_swing_positional_bullish_created_by 
ON public.swing_positional_bullish USING btree (created_by) 
TABLESPACE pg_default;
