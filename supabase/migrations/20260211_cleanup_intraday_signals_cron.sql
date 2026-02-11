-- =====================================================
-- Cleanup Intraday Signals Cron Job
-- Deletes previous day data from equity breakout tables
-- Runs daily at 4:00 PM IST (10:30 AM UTC)
-- =====================================================

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Drop existing function if exists
DROP FUNCTION IF EXISTS public.cleanup_intraday_signals();

-- Create the cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_intraday_signals()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  bullish_nse_deleted INTEGER := 0;
  bearish_nse_deleted INTEGER := 0;
  bullish_bse_deleted INTEGER := 0;
  bearish_bse_deleted INTEGER := 0;
  result JSONB;
  cutoff_time TIMESTAMPTZ;
BEGIN
  -- Calculate cutoff time (start of current day in IST)
  -- IST is UTC+5:30, so we convert current time to IST and get start of day
  cutoff_time := date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata';
  
  -- Delete from bullish_breakout_nse_eq (previous day data)
  DELETE FROM public.bullish_breakout_nse_eq
  WHERE created_at < cutoff_time;
  
  GET DIAGNOSTICS bullish_nse_deleted = ROW_COUNT;
  
  -- Delete from bearish_breakout_nse_eq (previous day data)
  DELETE FROM public.bearish_breakout_nse_eq
  WHERE created_at < cutoff_time;
  
  GET DIAGNOSTICS bearish_nse_deleted = ROW_COUNT;
  
  -- Delete from bullish_breakout_bse_eq (previous day data)
  DELETE FROM public.bullish_breakout_bse_eq
  WHERE created_at < cutoff_time;
  
  GET DIAGNOSTICS bullish_bse_deleted = ROW_COUNT;
  
  -- Delete from bearish_breakout_bse_eq (previous day data)
  DELETE FROM public.bearish_breakout_bse_eq
  WHERE created_at < cutoff_time;
  
  GET DIAGNOSTICS bearish_bse_deleted = ROW_COUNT;
  
  -- Build result JSON
  result := jsonb_build_object(
    'success', true,
    'timestamp', NOW(),
    'cutoff_time', cutoff_time,
    'deleted_counts', jsonb_build_object(
      'nse_bullish', bullish_nse_deleted,
      'nse_bearish', bearish_nse_deleted,
      'bse_bullish', bullish_bse_deleted,
      'bse_bearish', bearish_bse_deleted,
      'total', bullish_nse_deleted + bearish_nse_deleted + bullish_bse_deleted + bearish_bse_deleted
    )
  );
  
  -- Log the cleanup
  RAISE NOTICE 'Cleanup completed: NSE(% bullish, % bearish), BSE(% bullish, % bearish)', 
    bullish_nse_deleted, bearish_nse_deleted, bullish_bse_deleted, bearish_bse_deleted;
  
  RETURN result;
  
EXCEPTION WHEN OTHERS THEN
  -- Return error details
  RETURN jsonb_build_object(
    'success', false,
    'timestamp', NOW(),
    'error', SQLERRM,
    'error_detail', SQLSTATE
  );
END;
$$;

-- Add comment to function
COMMENT ON FUNCTION public.cleanup_intraday_signals() IS 
'Deletes intraday equity signals (NSE & BSE) created before today (IST timezone). Runs daily at 4:00 PM IST via pg_cron.';

-- Unschedule existing job if exists (to avoid duplicates)
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-intraday-signals-daily')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'cleanup-intraday-signals-daily'
  );
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignore if job doesn't exist
END $$;

-- Schedule the cron job
-- Runs daily at 10:30 AM UTC = 4:00 PM IST (UTC+5:30)
SELECT cron.schedule(
  'cleanup-intraday-signals-daily',            -- Job name
  '30 10 * * *',                               -- Cron expression: 10:30 AM UTC daily
  $$SELECT public.cleanup_intraday_signals()$$ -- SQL command
);

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.cleanup_intraday_signals() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_intraday_signals() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_intraday_signals() TO anon;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- View all scheduled cron jobs
SELECT 
  jobid,
  jobname,
  schedule,
  command,
  active,
  nodename,
  nodeport,
  database,
  username
FROM cron.job 
WHERE jobname = 'cleanup-intraday-signals-daily';

-- =====================================================
-- MANUAL TESTING (uncomment to test)
-- =====================================================
-- Test the cleanup function
-- SELECT public.cleanup_intraday_signals();

-- Check current signal counts
-- SELECT 
--   'NSE Bullish' as type,
--   COUNT(*) as total,
--   COUNT(*) FILTER (WHERE created_at >= date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata') as today
-- FROM public.bullish_breakout_nse_eq
-- UNION ALL
-- SELECT 
--   'NSE Bearish' as type,
--   COUNT(*) as total,
--   COUNT(*) FILTER (WHERE created_at >= date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata') as today
-- FROM public.bearish_breakout_nse_eq
-- UNION ALL
-- SELECT 
--   'BSE Bullish' as type,
--   COUNT(*) as total,
--   COUNT(*) FILTER (WHERE created_at >= date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata') as today
-- FROM public.bullish_breakout_bse_eq
-- UNION ALL
-- SELECT 
--   'BSE Bearish' as type,
--   COUNT(*) as total,
--   COUNT(*) FILTER (WHERE created_at >= date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata') as today
-- FROM public.bearish_breakout_bse_eq;

-- =====================================================
-- CRON JOB MANAGEMENT
-- =====================================================
-- To view cron job execution history:
-- SELECT 
--   runid,
--   jobid,
--   job_pid,
--   database,
--   username,
--   command,
--   status,
--   return_message,
--   start_time,
--   end_time
-- FROM cron.job_run_details 
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'cleanup-intraday-signals-daily')
-- ORDER BY start_time DESC 
-- LIMIT 10;

-- To unschedule the job:
-- SELECT cron.unschedule('cleanup-intraday-signals-daily');

-- To manually trigger cleanup:
-- SELECT public.cleanup_intraday_signals();
