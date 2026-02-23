-- Check NSE F&O Historical Data Availability

-- 1. Total records in historical_prices_nse_fo
SELECT 'Total Records' as metric, COUNT(*) as value
FROM historical_prices_nse_fo;

-- 2. Unique symbols with data
SELECT 'Unique Symbols' as metric, COUNT(DISTINCT symbol) as value
FROM historical_prices_nse_fo;

-- 3. Date range covered
SELECT 
  'Date Range' as metric,
  MIN(date)::text || ' to ' || MAX(date)::text as value
FROM historical_prices_nse_fo;

-- 4. Latest timestamp
SELECT 
  'Latest Data Time' as metric,
  MAX(timestamp)::text as value
FROM historical_prices_nse_fo;

-- 5. Candles per symbol (top 20 most populated)
SELECT 
  symbol,
  COUNT(*) as total_candles,
  MIN(date) as first_date,
  MAX(date) as last_date,
  MAX(timestamp) as latest_timestamp
FROM historical_prices_nse_fo
GROUP BY symbol
ORDER BY total_candles DESC
LIMIT 20;

-- 6. Check if we have recent data (today or yesterday)
SELECT 
  'Recent Data Check' as metric,
  COUNT(DISTINCT symbol) as symbols_with_recent_data
FROM historical_prices_nse_fo
WHERE date >= CURRENT_DATE - INTERVAL '1 day';

-- 7. Symbols from nse_fo_symbols that match what scanner loads (NIFTY CE/PE, top 50)
SELECT 
  s.symbol,
  s.option_type,
  s.expiry,
  s.strike,
  COALESCE(h.candle_count, 0) as historical_candles
FROM (
  SELECT 
    symbol, 
    option_type, 
    expiry, 
    strike
  FROM nse_fo_symbols
  WHERE underlying = 'NIFTY'
    AND option_type IN ('CE', 'PE')
    AND is_active = true
    AND expiry >= CURRENT_DATE
  ORDER BY expiry ASC
  LIMIT 50
) s
LEFT JOIN (
  SELECT symbol, COUNT(*) as candle_count
  FROM historical_prices_nse_fo
  GROUP BY symbol
) h ON s.symbol = h.symbol
ORDER BY s.expiry ASC, s.option_type, s.strike;
