# Historical Data Ingestion Guide

## Overview

This guide covers fetching and storing 3 months of 5-minute interval historical data for top 1000 symbols across all market segments using Zerodha Kite Historical API.

---

## 📊 Data Structure

### Target Tables

| Segment | Table Name | Symbols | Expected Rows | Storage |
|---------|-----------|---------|---------------|---------|
| NSE Equity | `historical_prices_nse_equity` | 1000 | ~5 million | ~1.2 GB |
| BSE Equity | `historical_prices_bse_equity` | 1000 | ~5 million | ~1.2 GB |
| NSE F&O | `historical_prices_nse_fo` | 1000 | ~5 million | ~1.5 GB |
| BSE F&O | `historical_prices_bse_fo` | 1000 | ~5 million | ~1.5 GB |

**Total Storage**: ~5-6 GB for 3 months of data

---

## 🔑 Prerequisites

### 1. Environment Variables

Add to your `.env` file:

```bash
# Zerodha KiteConnect
KITE_API_KEY=your_api_key
KITE_ACCESS_TOKEN=your_access_token

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 2. Kite Access Token

Get a fresh access token (valid for 24 hours):

```bash
npm run kite-auth
```

### 3. Run Database Migrations

Apply historical price table migrations:

```bash
# Via Supabase CLI
supabase db push

# Or manually via Supabase Studio SQL Editor:
# 1. 20260128_rename_historical_prices_table.sql
# 2. 20260128_create_historical_prices_bse_equity.sql
# 3. 20260128_create_historical_prices_nse_fo.sql
# 4. 20260128_create_historical_prices_bse_fo.sql
```

---

## 🚀 Usage

### Fetch NSE Equity Historical Data

```bash
npm run fetch-historical-nse-equity
```

**What it does**:
- Fetches top 1000 NSE equity symbols from `kite_nse_equity_symbols`
- Downloads 5-minute candles for last 90 days (3 months)
- Stores in `historical_prices_nse_equity` table
- Skips symbols that already have data (idempotent)

**Duration**: ~2-3 hours (rate limited to 2 requests/second)

---

### Fetch BSE Equity Historical Data

```bash
npm run fetch-historical-bse-equity
```

**What it does**:
- Fetches top 1000 BSE equity symbols from `kite_bse_equity_symbols`
- Downloads 5-minute candles for last 90 days
- Stores in `historical_prices_bse_equity` table

**Duration**: ~2-3 hours

---

### Fetch NSE F&O Historical Data

```bash
npm run fetch-historical-nse-fo
```

**What it does**:
- Fetches NSE F&O instruments from `kite_nse_fo_symbols`
- **Filters**: NIFTY, BANKNIFTY, FINNIFTY (configurable)
- **Strategy**: Near-month expiries only (next 2 expiries)
- Downloads 5-minute candles for last 90 days
- Stores in `historical_prices_nse_fo` table

**Duration**: ~2-3 hours

**Configuration** (in `fetch-historical-nse-fo.ts`):
```typescript
FOCUS_UNDERLYINGS: ["NIFTY", "BANKNIFTY", "FINNIFTY"],
NEAR_MONTH_ONLY: true,
MAX_STRIKES_PER_EXPIRY: 10,
```

---

### Fetch All (Sequential)

```bash
npm run fetch-historical-all
```

**What it does**:
- Runs all fetchers sequentially
- NSE Equity → BSE Equity → NSE F&O

**Duration**: ~6-9 hours (run overnight)

⚠️ **Warning**: This uses your Kite access token, which expires after 24 hours. Ensure token is fresh before starting.

---

## 📋 Features

### Rate Limiting
- **2 requests per second** (conservative to avoid hitting Zerodha limits)
- **100ms delay** between individual requests
- **2 second delay** between batches
- Automatic retry with 10s wait on rate limit errors

### Idempotency
- Checks existing data before fetching
- Skips symbols that already have historical data
- Uses `upsert` with `ON CONFLICT (symbol, timestamp)` to handle duplicates

### Batch Processing
- **50 symbols per batch** (configurable)
- Progress logging per batch
- Graceful error handling (continues on individual failures)

### Caching
- No caching during fetch (always fresh from Zerodha)
- Data stored permanently in database
- Scanner uses 5-minute cache for historical queries

---

## 🔍 Monitoring

### Check Data Availability

```sql
-- NSE Equity
SELECT * FROM get_historical_prices_stats();

-- Or manually
SELECT 
  COUNT(*) as total_candles,
  MIN(date) as oldest_date,
  MAX(date) as latest_date,
  COUNT(DISTINCT symbol) as unique_symbols
FROM historical_prices_nse_equity;
```

### Check Symbol-Specific Data

```sql
-- Get symbol summary
SELECT * FROM get_symbol_data_summary('RELIANCE', 'historical_prices_nse_equity');

-- Or manually
SELECT 
  symbol,
  COUNT(*) as candles,
  MIN(date) as first_date,
  MAX(date) as last_date
FROM historical_prices_nse_equity
WHERE symbol = 'RELIANCE'
GROUP BY symbol;
```

### Storage Usage

```sql
SELECT 
  pg_size_pretty(pg_total_relation_size('historical_prices_nse_equity')) as total_size,
  pg_size_pretty(pg_relation_size('historical_prices_nse_equity')) as table_size,
  pg_size_pretty(pg_indexes_size('historical_prices_nse_equity')) as index_size;
```

---

## 🛠️ Maintenance

### Cleanup Old Data (Older than 3 Months)

```sql
SELECT cleanup_old_historical_data();
```

**What it does**:
- Removes data older than 3 months from all tables
- Frees up database storage
- Keeps rolling 3-month window

**Schedule**: Run monthly via cron or edge function

### Vacuum Tables

```sql
SELECT vacuum_historical_tables();
```

**What it does**:
- Runs `VACUUM ANALYZE` on all historical price tables
- Reclaims storage after deletions
- Updates query planner statistics

**Schedule**: Run after cleanup or bulk deletions

---

## ⚠️ Common Issues

### Issue: "Rate limit exceeded"

**Cause**: Too many requests to Zerodha API  
**Solution**: Script automatically waits 10s and retries. No action needed.

---

### Issue: "Invalid access token"

**Cause**: Kite access token expired (24-hour validity)  
**Solution**: Generate new token:

```bash
npm run kite-auth
# Update KITE_ACCESS_TOKEN in .env
# Restart fetch script
```

---

### Issue: "No symbols found"

**Cause**: Symbol tables (`kite_*_symbols`) are empty  
**Solution**: Run symbol fetchers first:

```bash
npm run fetch-nse-symbols
npm run fetch-bse-symbols
npm run fetch-nse-fo
npm run fetch-bse-fo
```

---

### Issue: "Duplicate key error"

**Cause**: Attempting to insert data that already exists  
**Solution**: Script uses `upsert` with `ignoreDuplicates: true`. Should not happen. If it does, check unique constraint on `(symbol, timestamp)`.

---

### Issue: "Out of memory"

**Cause**: Fetching too many rows in one batch  
**Solution**: Reduce `BATCH_SIZE` in script config:

```typescript
const CONFIG = {
  BATCH_SIZE: 25, // Reduce from 50
  // ...
};
```

---

## 🔧 Configuration

### Adjust Fetch Parameters

Edit scripts to customize:

```typescript
const CONFIG = {
  DAYS_TO_FETCH: 90,              // Change to 30 for 1 month
  TOP_STOCKS_LIMIT: 1000,         // Change to 500 for fewer stocks
  BATCH_SIZE: 50,                 // Reduce for memory constraints
  DELAY_BETWEEN_BATCHES: 2000,    // Increase for more conservative rate limiting
  MAX_REQUESTS_PER_SECOND: 2,     // Reduce to 1 for ultra-safe mode
};
```

### NSE F&O Filters

For F&O data, customize underlyings and expiries:

```typescript
const CONFIG = {
  FOCUS_UNDERLYINGS: ["NIFTY", "BANKNIFTY", "FINNIFTY", "RELIANCE"], 
  NEAR_MONTH_ONLY: true,          // false = all expiries
  MAX_STRIKES_PER_EXPIRY: 10,     // Increase for more strikes
};
```

---

## 📊 Expected Timeline

| Phase | Task | Duration | Storage Added |
|-------|------|----------|---------------|
| 1 | NSE Equity (1000 symbols) | 2-3 hours | ~1.2 GB |
| 2 | BSE Equity (1000 symbols) | 2-3 hours | ~1.2 GB |
| 3 | NSE F&O (1000 instruments) | 2-3 hours | ~1.5 GB |
| 4 | BSE F&O (if needed) | 2-3 hours | ~1.5 GB |

**Total**: 8-12 hours for complete historical data ingestion

---

## 🎯 Best Practices

### 1. Run During Off-Market Hours
- Fetch historical data when markets are closed
- Reduces API load and rate limit chances

### 2. Monitor Progress
- Check console output for errors
- Keep terminal logs for troubleshooting
- Monitor database storage growth

### 3. Incremental Fetching
- Start with NSE Equity (most critical)
- Add BSE and F&O as needed
- Test with smaller `DAYS_TO_FETCH` first (e.g., 30 days)

### 4. Token Management
- Generate fresh token before long fetches
- Consider running in batches if > 24 hours needed
- Save token securely (never commit to git)

### 5. Database Backup
- Take Supabase backup before first fetch
- Monitor storage quotas on your plan
- Clean up old data regularly

---

## 🚦 Next Steps

After fetching historical data:

1. **Update Scanner**: Ensure `breakout-scanner.js` uses new table names (✅ Done)
2. **Test Queries**: Verify data with sample queries
3. **Run Scanners**: Start breakout scanner with historical data
4. **Implement BSE Scanner**: Clone NSE logic for BSE
5. **Implement F&O Scanners**: Build F&O-specific strategies

---

## 📞 Support

If you encounter issues:

1. Check console logs for specific error messages
2. Verify environment variables are set correctly
3. Ensure database migrations are applied
4. Check Zerodha API status: https://status.kite.trade
5. Review Zerodha API docs: https://kite.trade/docs/connect/v3/

---

## 📚 Related Documentation

- [Complete System Analysis](./COMPLETE-SYSTEM-ANALYSIS.md)
- [Historical Prices Schema](./HISTORICAL-PRICES-SCHEMA.md)
- [Strategy Table Mapping](./STRATEGY-TABLE-MAPPING.md)
- [Zerodha Kite API Docs](https://kite.trade/docs/connect/v3/historical/)

---

_Last Updated: January 28, 2026_
