-- Check NSE Swing Hourly Data Status
-- Run this in Supabase SQL Editor to see current data coverage

-- 1. Overall statistics
SELECT 
  '1. OVERALL STATISTICS' as section,
  COUNT(*) as total_records,
  COUNT(DISTINCT symbol) as unique_symbols,
  COUNT(DISTINCT date) as unique_dates,
  MIN(date) as earliest_date,
  MAX(date) as latest_date,
  MAX(date)::date - MIN(date)::date as date_range_days
FROM historical_prices_nse_swing_hourly;

-- 2. Symbols with sufficient data (50+ days)
SELECT 
  '2. SYMBOLS WITH 50+ DAYS' as section,
  COUNT(*) as symbols_with_50plus_days
FROM (
  SELECT 
    symbol,
    COUNT(DISTINCT date) as days_count
  FROM historical_prices_nse_swing_hourly
  GROUP BY symbol
  HAVING COUNT(DISTINCT date) >= 50
) subquery;

-- 3. Symbols with insufficient data (<50 days)
SELECT 
  '3. SYMBOLS NEEDING MORE DATA' as section,
  symbol,
  COUNT(DISTINCT date) as days_count,
  MIN(date) as earliest_date,
  MAX(date) as latest_date
FROM historical_prices_nse_swing_hourly
GROUP BY symbol
HAVING COUNT(DISTINCT date) < 50
ORDER BY days_count DESC
LIMIT 20;

-- 4. Data coverage by date (last 60 days)
SELECT 
  '4. DAILY COVERAGE (LAST 60 DAYS)' as section,
  date,
  COUNT(DISTINCT symbol) as symbols_with_data,
  COUNT(*) as total_records
FROM historical_prices_nse_swing_hourly
WHERE date >= CURRENT_DATE - INTERVAL '60 days'
GROUP BY date
ORDER BY date DESC
LIMIT 60;

-- 5. Top 10 symbols by data coverage
SELECT 
  '5. TOP 10 SYMBOLS BY DATA COVERAGE' as section,
  symbol,
  COUNT(DISTINCT date) as days_count,
  COUNT(*) as total_records,
  MIN(date) as earliest_date,
  MAX(date) as latest_date
FROM historical_prices_nse_swing_hourly
GROUP BY symbol
ORDER BY days_count DESC
LIMIT 10;

-- 6. Symbols with NO data (from nse_equity_top_1000_symbols)
SELECT 
  '6. SYMBOLS WITH NO DATA' as section,
  n.symbol,
  n.company_name
FROM nse_equity_top_1000_symbols n
LEFT JOIN historical_prices_nse_swing_hourly h ON n.symbol = h.symbol
WHERE h.symbol IS NULL
  AND n.is_active = true
ORDER BY n.symbol
LIMIT 20;

-- 7. Summary by data adequacy
SELECT 
  '7. SUMMARY' as section,
  SUM(CASE WHEN days_count >= 50 THEN 1 ELSE 0 END) as ready_for_scanning,
  SUM(CASE WHEN days_count >= 20 AND days_count < 50 THEN 1 ELSE 0 END) as partial_data,
  SUM(CASE WHEN days_count < 20 THEN 1 ELSE 0 END) as insufficient_data,
  COUNT(*) as total_symbols_with_data
FROM (
  SELECT 
    symbol,
    COUNT(DISTINCT date) as days_count
  FROM historical_prices_nse_swing_hourly
  GROUP BY symbol
) subquery;
