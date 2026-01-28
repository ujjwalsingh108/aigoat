-- Migration: Create helper functions for historical prices management
-- Created: 2026-01-28
-- Purpose: Utility functions for cleanup and monitoring of historical price tables

-- ============================================================================
-- Function: cleanup_old_historical_data
-- Purpose: Remove historical data older than 3 months from all tables
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_old_historical_data()
RETURNS void AS $$
DECLARE
  cutoff_date date := CURRENT_DATE - INTERVAL '3 months';
  deleted_nse_eq bigint;
  deleted_bse_eq bigint;
  deleted_nse_fo bigint;
  deleted_bse_fo bigint;
BEGIN
  -- Clean NSE Equity
  DELETE FROM public.historical_prices_nse_equity WHERE date < cutoff_date;
  GET DIAGNOSTICS deleted_nse_eq = ROW_COUNT;
  
  -- Clean BSE Equity
  DELETE FROM public.historical_prices_bse_equity WHERE date < cutoff_date;
  GET DIAGNOSTICS deleted_bse_eq = ROW_COUNT;
  
  -- Clean NSE F&O
  DELETE FROM public.historical_prices_nse_fo WHERE date < cutoff_date;
  GET DIAGNOSTICS deleted_nse_fo = ROW_COUNT;
  
  -- Clean BSE F&O
  DELETE FROM public.historical_prices_bse_fo WHERE date < cutoff_date;
  GET DIAGNOSTICS deleted_bse_fo = ROW_COUNT;
  
  RAISE NOTICE 'Cleaned up historical data older than %', cutoff_date;
  RAISE NOTICE 'NSE Equity: % rows deleted', deleted_nse_eq;
  RAISE NOTICE 'BSE Equity: % rows deleted', deleted_bse_eq;
  RAISE NOTICE 'NSE F&O: % rows deleted', deleted_nse_fo;
  RAISE NOTICE 'BSE F&O: % rows deleted', deleted_bse_fo;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_old_historical_data() IS 
  'Removes historical price data older than 3 months from all tables to maintain storage limits. Returns the number of rows deleted from each table.';

-- ============================================================================
-- Function: get_historical_prices_stats
-- Purpose: Get storage and row count statistics for all historical price tables
-- ============================================================================
CREATE OR REPLACE FUNCTION get_historical_prices_stats()
RETURNS TABLE (
  table_name text,
  row_count bigint,
  total_size text,
  table_size text,
  indexes_size text,
  oldest_date date,
  newest_date date
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.table_name::text,
    t.row_count,
    pg_size_pretty(t.total_bytes) AS total_size,
    pg_size_pretty(t.table_bytes) AS table_size,
    pg_size_pretty(t.index_bytes) AS indexes_size,
    t.oldest_date,
    t.newest_date
  FROM (
    SELECT 
      'historical_prices_nse_equity' AS table_name,
      (SELECT COUNT(*) FROM public.historical_prices_nse_equity) AS row_count,
      pg_total_relation_size('public.historical_prices_nse_equity') AS total_bytes,
      pg_relation_size('public.historical_prices_nse_equity') AS table_bytes,
      pg_indexes_size('public.historical_prices_nse_equity') AS index_bytes,
      (SELECT MIN(date) FROM public.historical_prices_nse_equity) AS oldest_date,
      (SELECT MAX(date) FROM public.historical_prices_nse_equity) AS newest_date
    UNION ALL
    SELECT 
      'historical_prices_bse_equity',
      (SELECT COUNT(*) FROM public.historical_prices_bse_equity),
      pg_total_relation_size('public.historical_prices_bse_equity'),
      pg_relation_size('public.historical_prices_bse_equity'),
      pg_indexes_size('public.historical_prices_bse_equity'),
      (SELECT MIN(date) FROM public.historical_prices_bse_equity),
      (SELECT MAX(date) FROM public.historical_prices_bse_equity)
    UNION ALL
    SELECT 
      'historical_prices_nse_fo',
      (SELECT COUNT(*) FROM public.historical_prices_nse_fo),
      pg_total_relation_size('public.historical_prices_nse_fo'),
      pg_relation_size('public.historical_prices_nse_fo'),
      pg_indexes_size('public.historical_prices_nse_fo'),
      (SELECT MIN(date) FROM public.historical_prices_nse_fo),
      (SELECT MAX(date) FROM public.historical_prices_nse_fo)
    UNION ALL
    SELECT 
      'historical_prices_bse_fo',
      (SELECT COUNT(*) FROM public.historical_prices_bse_fo),
      pg_total_relation_size('public.historical_prices_bse_fo'),
      pg_relation_size('public.historical_prices_bse_fo'),
      pg_indexes_size('public.historical_prices_bse_fo'),
      (SELECT MIN(date) FROM public.historical_prices_bse_fo),
      (SELECT MAX(date) FROM public.historical_prices_bse_fo)
  ) t
  ORDER BY t.table_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_historical_prices_stats() IS 
  'Returns storage statistics, row counts, and date ranges for all historical price tables. Useful for monitoring and capacity planning.';

-- ============================================================================
-- Function: get_symbol_data_summary
-- Purpose: Get data availability summary for a specific symbol
-- ============================================================================
CREATE OR REPLACE FUNCTION get_symbol_data_summary(
  p_symbol text,
  p_table_name text DEFAULT 'historical_prices_nse_equity'
)
RETURNS TABLE (
  symbol text,
  total_candles bigint,
  date_range_days integer,
  oldest_date date,
  newest_date date,
  avg_candles_per_day numeric,
  missing_dates bigint
) AS $$
DECLARE
  sql_query text;
BEGIN
  -- Validate table name to prevent SQL injection
  IF p_table_name NOT IN (
    'historical_prices_nse_equity',
    'historical_prices_bse_equity',
    'historical_prices_nse_fo',
    'historical_prices_bse_fo'
  ) THEN
    RAISE EXCEPTION 'Invalid table name: %', p_table_name;
  END IF;

  sql_query := format('
    SELECT 
      $1::text,
      COUNT(*)::bigint,
      (MAX(date) - MIN(date))::integer,
      MIN(date),
      MAX(date),
      ROUND(COUNT(*)::numeric / NULLIF(COUNT(DISTINCT date), 0), 2),
      (MAX(date) - MIN(date) + 1) - COUNT(DISTINCT date)::bigint
    FROM public.%I
    WHERE symbol = $1
  ', p_table_name);

  RETURN QUERY EXECUTE sql_query USING p_symbol;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_symbol_data_summary(text, text) IS 
  'Returns a summary of data availability for a specific symbol in a historical price table. Shows total candles, date range, and potential gaps.';

-- ============================================================================
-- Function: vacuum_historical_tables
-- Purpose: Run VACUUM ANALYZE on all historical price tables
-- ============================================================================
CREATE OR REPLACE FUNCTION vacuum_historical_tables()
RETURNS void AS $$
BEGIN
  EXECUTE 'VACUUM ANALYZE public.historical_prices_nse_equity';
  EXECUTE 'VACUUM ANALYZE public.historical_prices_bse_equity';
  EXECUTE 'VACUUM ANALYZE public.historical_prices_nse_fo';
  EXECUTE 'VACUUM ANALYZE public.historical_prices_bse_fo';
  
  RAISE NOTICE 'Vacuum completed for all historical price tables';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION vacuum_historical_tables() IS 
  'Runs VACUUM ANALYZE on all historical price tables to reclaim space and update statistics. Should be run periodically after bulk deletions.';
