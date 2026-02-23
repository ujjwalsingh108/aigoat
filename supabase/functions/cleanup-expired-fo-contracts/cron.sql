-- ============================================================================
-- Supabase Cron Job Setup for F&O Contract Cleanup
-- ============================================================================
-- This SQL sets up a daily cron job using pg_cron to automatically clean up
-- expired F&O contracts by calling the edge function.
--
-- SETUP INSTRUCTIONS:
-- 1. Enable pg_cron extension in Supabase Dashboard:
--    Database → Extensions → Enable "pg_cron"
--
-- 2. Run this SQL in the Supabase SQL Editor
--
-- 3. The cron job will run daily at 7:00 AM IST (1:30 AM UTC)
-- ============================================================================

-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Drop existing job if it exists (to update it)
SELECT cron.unschedule('nse_cleanup-expired-fo-contracts');

-- Schedule the cleanup job to run daily at 7:00 AM IST (1:30 AM UTC)
-- Cron format: minute hour day month dayofweek
SELECT cron.schedule(
  'nse_cleanup-expired-fo-contracts',           -- Job name
  '30 1 * * *',                             -- Run at 1:30 AM UTC (7:00 AM IST)
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
-- ALTERNATIVE: Use Supabase secret for service role key
-- ============================================================================
-- If you want to store the service role key as a Supabase secret:
-- 
-- 1. Create secret in Supabase Dashboard: Settings → Vault → New Secret
--    Name: service_role_key
--    Value: your-service-role-key
--
-- 2. Use this version instead:
/*
SELECT cron.schedule(
  'nse_cleanup-expired-fo-contracts',
  '30 1 * * *',
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
-- MANUAL EXECUTION (for testing)
-- ============================================================================

-- To test the cron job immediately without waiting:
/*
SELECT cron.schedule(
  'cleanup-test',
  '* * * * *',  -- Run every minute
  $$
  SELECT
    net.http_post(
      url := 'https://kowxpazskkigzwdwzwyq.supabase.co/functions/v1/nse_cleanup-expired-fo-contracts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvd3hwYXpza2tpZ3p3ZHd6d3lxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDkwNjA2OSwiZXhwIjoyMDcwNDgyMDY5fQ.K6Z9uMXOmAGNKPUN4tKdjFLtqUIJa-KSCe3H1ustti4'
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- After testing, remove the test job:
SELECT cron.unschedule('cleanup-test');
*/

-- ============================================================================
-- TROUBLESHOOTING
-- ============================================================================

-- If the cron job is not running:
-- 1. Check if pg_cron extension is enabled:
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- 2. Check if the job is scheduled:
SELECT * FROM cron.job;

-- 3. Check execution logs:
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;

-- 4. Manually test the edge function with curl:
/*
curl -X POST "https://kowxpazskkigzwdwzwyq.supabase.co/functions/v1/nse_cleanup-expired-fo-contracts" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
*/

-- ============================================================================
-- UNINSTALL (if needed)
-- ============================================================================

-- To remove the cron job:
-- SELECT cron.unschedule('nse_cleanup-expired-fo-contracts');
