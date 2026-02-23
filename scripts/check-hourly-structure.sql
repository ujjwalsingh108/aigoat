-- Check the structure of hourly data
SELECT 
  symbol, 
  date, 
  to_char(timestamp, 'HH24:MI:SS') as time, 
  close 
FROM historical_prices_nse_swing_hourly 
WHERE symbol = '5PAISA' 
ORDER BY timestamp DESC 
LIMIT 10;

-- Check records per day
SELECT 
  date, 
  COUNT(*) as records_per_day 
FROM historical_prices_nse_swing_hourly 
WHERE symbol = '5PAISA' 
GROUP BY date 
ORDER BY date DESC 
LIMIT 10;
