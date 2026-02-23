-- ============================================================================
-- Migration: Setup cron job to DELETE expired FO contracts
-- ============================================================================
-- Purpose: Auto-delete NSE/BSE FO symbols where expiry < today to minimize storage
-- Schedule: Runs daily at 00:01 IST (18:31 UTC previous day)
-- 
-- METHOD: Calls nse_cleanup-expired-fo-contracts Edge Function
-- ============================================================================

-- Enable pg_cron extension (already enabled on Supabase)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant necessary permissions to postgres user
GRANT USAGE ON SCHEMA cron TO postgres;

-- Drop the old cron job if it exists (function-based approach)
DO $$
BEGIN
  PERFORM cron.unschedule('delete-expired-fo-contracts');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Drop the new cron job if it exists (to update it)
DO $$
BEGIN
  PERFORM cron.unschedule('nse_cleanup-expired-fo-contracts');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- ============================================================================
-- SCHEDULE EDGE FUNCTION CALL
-- ============================================================================
-- Schedule cron job to run daily at 00:01 IST (18:31 UTC previous day)
-- Calls the nse_cleanup-expired-fo-contracts edge function via HTTP POST
SELECT cron.schedule(
  'nse_cleanup-expired-fo-contracts',           -- Job name
  '31 18 * * *',                                 -- Run at 18:31 UTC (00:01 IST next day)
  $$
  SELECT
    net.http_post(
      url := 'https://kowxpazskkigzwdwzwyq.supabase.co/functions/v1/nse_cleanup-expired-fo-contracts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- ============================================================================
-- ALTERNATIVE: Use Supabase Vault for service role key (More Secure)
-- ============================================================================
-- If you want to store the service role key as a Supabase secret:
-- 
-- 1. Create secret in Supabase Dashboard: Settings → Vault → New Secret
--    Name: service_role_key
--    Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvd3hwYXpza2tpZ3p3ZHd6d3lxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDkwNjA2OSwiZXhwIjoyMDcwNDgyMDY5fQ.K6Z9uMXOmAGNKPUN4tKdjFLtqUIJa-KSCe3H1ustti4
--
-- 2. Then use this version instead:
/*
SELECT cron.schedule(
  'nse_cleanup-expired-fo-contracts',
  '31 18 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://kowxpazskkigzwdwzwyq.supabase.co/functions/v1/nse_cleanup-expired-fo-contracts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || vault.read_secret('service_role_key').secret
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);
*/

-- ============================================================================
-- CLEANUP OLD FUNCTIONS (Optional)
-- ============================================================================
-- If you want to remove the old database functions:
/*
DROP FUNCTION IF EXISTS delete_expired_nse_fo_contracts();
DROP FUNCTION IF EXISTS delete_expired_bse_fo_contracts();
DROP FUNCTION IF EXISTS delete_all_expired_fo_contracts();
*/

-- ============================================================================
-- VERIFY SETUP
-- ============================================================================

-- Check if cron job is scheduled
SELECT * FROM cron.job WHERE jobname = 'nse_cleanup-expired-fo-contracts';

-- View cron job execution history
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'nse_cleanup-expired-fo-contracts')
ORDER BY start_time DESC 
LIMIT 10;

-- ============================================================================
-- MANUAL TESTING
-- ============================================================================

-- To manually test the edge function (replace YOUR_SERVICE_ROLE_KEY):
/*
curl -X POST "https://kowxpazskkigzwdwzwyq.supabase.co/functions/v1/nse_cleanup-expired-fo-contracts" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvd3hwYXpza2tpZ3p3ZHd6d3lxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDkwNjA2OSwiZXhwIjoyMDcwNDgyMDY5fQ.K6Z9uMXOmAGNKPUN4tKdjFLtqUIJa-KSCe3H1ustti4"
*/

-- ============================================================================
-- UNINSTALL (if needed)
-- ============================================================================

-- To remove the cron job:
-- SELECT cron.unschedule('nse_cleanup-expired-fo-contracts');

-- ============================================================================
-- NOTES
-- ============================================================================
-- 
-- ADVANTAGES OF EDGE FUNCTION APPROACH:
-- 1. Better logging and monitoring in Edge Function logs
-- 2. More detailed cleanup reports (marks inactive before deleting old)
-- 3. Can be called via HTTP for manual testing
-- 4. Returns JSON response with cleanup statistics
-- 5. Safer approach: marks as inactive first, only deletes very old contracts
--
-- WHAT THE EDGE FUNCTION DOES:
-- 1. Marks contracts with expiry < today as is_active = false
-- 2. Deletes contracts expired more than 90 days ago
-- 3. Returns detailed statistics for both NSE and BSE FO symbols
--
-- SCHEDULE:
-- - Daily at 00:01 IST (18:31 UTC previous day)
-- - Runs 7 days a week for safety
-- ============================================================================
