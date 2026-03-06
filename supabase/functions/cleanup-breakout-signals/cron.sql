-- ============================================================================
-- Cron Job: Cleanup Breakout Signals
-- ============================================================================
-- Deletes previous trading session signals from all signal tables.
-- Runs daily at 3:00 AM IST (9:30 PM UTC).
--
-- Tables cleaned:
--   bearish_breakout_bse_eq       bullish_breakout_bse_eq
--   bearish_breakout_nse_eq       bullish_breakout_nse_eq
--   bse_fo_signals                nse_fo_signals
--   bse_swing_positional_bearish  nse_swing_positional_bearish
--   bse_swing_positional_bullish  nse_swing_positional_bullish
--
-- SETUP:
--   1. Enable pg_cron: Database → Extensions → pg_cron
--   2. Run this file in the Supabase SQL Editor
-- ============================================================================

-- Remove existing job if present (safe to re-run)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-breakout-signals') THEN
    PERFORM cron.unschedule('cleanup-breakout-signals');
  END IF;
END $$;

-- Schedule: 9:30 PM UTC = 3:00 AM IST
SELECT cron.schedule(
  'cleanup-breakout-signals',
  '30 21 * * *',
  $$
  SELECT
    net.http_post(
      url     := 'https://kowxpazskkigzwdwzwyq.supabase.co/functions/v1/cleanup-breakout-signals',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body    := '{}'::jsonb
    ) AS request_id;
  $$
);

-- ============================================================================
-- Verify
-- ============================================================================
SELECT jobid, jobname, schedule, active
FROM   cron.job
WHERE  jobname = 'cleanup-breakout-signals';
