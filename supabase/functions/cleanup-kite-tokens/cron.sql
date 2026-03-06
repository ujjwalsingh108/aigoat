-- ============================================================================
-- Kite Token Cleanup — NO LONGER NEEDED
-- ============================================================================
-- The kite_tokens table now uses a single-row design (always id=1).
-- Each daily login upserts into id=1, overwriting the previous token.
-- There is nothing to clean up — no cron job required.
--
-- If you previously scheduled this job, remove it with:
-- ============================================================================

SELECT cron.unschedule('cleanup-kite-tokens');

-- Drop the old cleanup function if it exists
DROP FUNCTION IF EXISTS public.cleanup_old_kite_tokens();
