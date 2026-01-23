-- RLS configuration for screener_signals_with_patterns view
-- Note: Views inherit RLS policies from their underlying tables
-- (bullish_breakout_nse_eq and bearish_breakout_nse_eq)

-- Grant necessary permissions on the view
GRANT SELECT ON public.screener_signals_with_patterns TO anon;
GRANT SELECT ON public.screener_signals_with_patterns TO authenticated;
GRANT SELECT ON public.screener_signals_with_patterns TO service_role;

-- Add comment for documentation
COMMENT ON VIEW public.screener_signals_with_patterns IS 'Combined view of bullish and bearish breakout signals from the last 15 minutes with pattern detection and AI validation. Inherits RLS policies from underlying tables.';

-- Note: This view automatically respects the RLS policies defined on:
-- 1. bullish_breakout_nse_eq (anonymous users see public signals, authenticated see all)
-- 2. bearish_breakout_nse_eq (anonymous users see public signals, authenticated see all)
--
-- The view will filter results based on:
-- - For anonymous users: Only signals where is_public = true
-- - For authenticated users: All signals
-- - For service_role: All signals with full access
