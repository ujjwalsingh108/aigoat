-- Check latest data timestamp for the 50 symbols scanner loads
SELECT 
  symbol,
  MAX(timestamp) as latest_data,
  MAX(date) as latest_date,
  COUNT(*) as total_candles,
  NOW() - MAX(timestamp) as data_age
FROM historical_prices_nse_fo
WHERE symbol IN (
  SELECT symbol 
  FROM nse_fo_symbols
  WHERE underlying = 'NIFTY'
    AND option_type IN ('CE', 'PE')
    AND is_active = true
    AND expiry >= CURRENT_DATE
  ORDER BY expiry ASC
  LIMIT 50
)
GROUP BY symbol
ORDER BY latest_data DESC
LIMIT 20;
