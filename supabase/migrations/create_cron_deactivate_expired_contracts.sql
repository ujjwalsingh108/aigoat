-- Migration: Setup cron job to DELETE expired FO contracts
-- Purpose: Auto-delete NSE/BSE FO symbols where expiry < today to minimize storage
-- Schedule: Runs daily at 00:01 IST (18:31 UTC previous day)

-- Enable pg_cron extension (already enabled on Supabase)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant necessary permissions to postgres user
GRANT USAGE ON SCHEMA cron TO postgres;

-- Create function to delete expired NSE FO contracts
CREATE OR REPLACE FUNCTION delete_expired_nse_fo_contracts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  nse_count INTEGER;
BEGIN
  DELETE FROM public.nse_fo_symbols
  WHERE expiry < CURRENT_DATE;
  
  GET DIAGNOSTICS nse_count = ROW_COUNT;
  
  -- Log the operation
  RAISE NOTICE 'Deleted % expired NSE FO contracts', nse_count;
END;
$$;

-- Create function to delete expired BSE FO contracts
CREATE OR REPLACE FUNCTION delete_expired_bse_fo_contracts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  bse_count INTEGER;
BEGIN
  DELETE FROM public.bse_fo_symbols
  WHERE expiry < CURRENT_DATE;
  
  GET DIAGNOSTICS bse_count = ROW_COUNT;
  
  -- Log the operation
  RAISE NOTICE 'Deleted % expired BSE FO contracts', bse_count;
END;
$$;

-- Create combined function to delete both NSE and BSE expired contracts
CREATE OR REPLACE FUNCTION delete_all_expired_fo_contracts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  nse_count INTEGER;
  bse_count INTEGER;
BEGIN
  -- Delete expired NSE FO contracts
  DELETE FROM public.nse_fo_symbols
  WHERE expiry < CURRENT_DATE;
  
  GET DIAGNOSTICS nse_count = ROW_COUNT;
  
  -- Delete expired BSE FO contracts
  DELETE FROM public.bse_fo_symbols
  WHERE expiry < CURRENT_DATE;
  
  GET DIAGNOSTICS bse_count = ROW_COUNT;
  
  -- Log the operation
  RAISE NOTICE 'Deleted % NSE and % BSE expired FO contracts', nse_count, bse_count;
END;
$$;

-- Schedule cron job to run daily at 00:01 IST (18:31 UTC previous day)
-- Note: Supabase uses UTC timezone
SELECT cron.schedule(
  'delete-expired-fo-contracts',      -- Job name
  '31 18 * * *',                       -- Cron expression: 18:31 UTC = 00:01 IST (daily)
  $$SELECT delete_all_expired_fo_contracts();$$
);

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION delete_expired_nse_fo_contracts() TO authenticated;
GRANT EXECUTE ON FUNCTION delete_expired_bse_fo_contracts() TO authenticated;
GRANT EXECUTE ON FUNCTION delete_all_expired_fo_contracts() TO authenticated;

-- View scheduled cron jobs
-- Run this query to verify the cron job is scheduled:
-- SELECT * FROM cron.job;

-- View cron job run history
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- To manually trigger the deletion (for testing):
-- SELECT delete_all_expired_fo_contracts();

-- To unschedule the cron job (if needed):
-- SELECT cron.unschedule('delete-expired-fo-contracts');

COMMENT ON FUNCTION delete_expired_nse_fo_contracts() IS 'Deletes NSE FO contracts where expiry < today to minimize storage';
COMMENT ON FUNCTION delete_expired_bse_fo_contracts() IS 'Deletes BSE FO contracts where expiry < today to minimize storage';
COMMENT ON FUNCTION delete_all_expired_fo_contracts() IS 'Deletes all expired FO contracts (NSE + BSE) daily at 00:01 IST to minimize storage';
