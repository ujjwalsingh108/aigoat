-- Delete all BSE Swing Hourly Data and Start Fresh
-- This will completely clear the table so we can fetch 50+ days of clean data

-- Show current data before deletion
SELECT 
  COUNT(*) as total_records,
  COUNT(DISTINCT symbol) as unique_symbols,
  COUNT(DISTINCT date) as unique_dates,
  MIN(date) as earliest_date,
  MAX(date) as latest_date
FROM historical_prices_bse_swing_hourly;

-- Delete all data
TRUNCATE TABLE historical_prices_bse_swing_hourly RESTART IDENTITY CASCADE;

-- Verify deletion
SELECT COUNT(*) as remaining_records 
FROM historical_prices_bse_swing_hourly;

SELECT 'BSE Swing Hourly table truncated successfully. Ready for fresh data fetch.' as status;
