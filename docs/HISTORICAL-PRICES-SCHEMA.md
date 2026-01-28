# Historical Prices Database Schema

## Overview

This document describes the restructured historical prices database schema designed to store 5-minute interval data for approximately 1000 symbols across different exchanges and instrument types for a rolling 3-month period.

## Tables

### 1. `historical_prices_nse_equity`
**Purpose**: NSE equity symbols (Cash/Equity segment)

**Columns**:
- `id`: Primary key (auto-generated)
- `symbol`: Stock symbol (e.g., "RELIANCE", "TCS")
- `date`: Trading date
- `timestamp`: Precise timestamp with timezone
- `interval_type`: Interval type (default: "5min")
- `open`: Opening price
- `high`: Highest price in interval
- `low`: Lowest price in interval
- `close`: Closing price
- `volume`: Trading volume
- `open_interest`: Open interest (usually NULL for equity)
- `time`: Legacy time field (text)

**Indexes**:
- `symbol, timestamp` (UNIQUE)
- `symbol`
- `timestamp` (DESC)
- `date` (DESC)

---

### 2. `historical_prices_bse_equity`
**Purpose**: BSE equity symbols (Cash/Equity segment)

**Structure**: Same as NSE equity table
**Indexes**: Same as NSE equity table

---

### 3. `historical_prices_nse_fo`
**Purpose**: NSE Futures & Options (NFO segment)

**Additional Columns**:
- `instrument_token`: Unique instrument identifier
- `underlying`: Underlying asset (e.g., "NIFTY", "BANKNIFTY", "RELIANCE")
- `instrument_type`: Type of instrument ("FUT", "CE", "PE")
- `expiry`: Expiry date
- `strike`: Strike price (for options)
- `option_type`: Option type ("CE" or "PE")

**Indexes**:
- `symbol, timestamp` (UNIQUE)
- `symbol`
- `timestamp` (DESC)
- `date` (DESC)
- `underlying`
- `expiry` (DESC)
- `symbol, date` (DESC)
- `underlying, expiry` (DESC)

---

### 4. `historical_prices_bse_fo`
**Purpose**: BSE Futures & Options (BFO segment)

**Structure**: Same as NSE F&O table
**Indexes**: Same as NSE F&O table

---

## Storage Estimates

### Per Table (1000 symbols × 3 months)

- **Trading days**: ~65 days per quarter
- **Candles per day**: 78 (5-minute intervals in 6.5 hour trading session)
- **Candles per symbol**: ~5,070
- **Total rows per table**: ~5,070,000 rows (for 1000 symbols)

### Storage Size Estimates

- **Row size**: ~100-150 bytes per row (with indexes)
- **Table data**: ~500-750 MB per table
- **Indexes**: ~200-300 MB per table
- **Total per table**: ~700-1050 MB
- **All 4 tables**: ~2.8-4.2 GB (for 3 months of data)

---

## Data Retention Policy

Historical data older than **3 months** should be automatically cleaned up using the provided function:

```sql
SELECT cleanup_old_historical_data();
```

This function can be scheduled via a cron job or edge function.

---

## Row Level Security (RLS)

All tables have RLS enabled with the following policies:

1. **Authenticated users**: READ access
2. **Service role**: Full access (INSERT, UPDATE, DELETE)

---

## Helper Functions

### 1. `cleanup_old_historical_data()`
Removes data older than 3 months from all historical price tables.

**Usage**:
```sql
SELECT cleanup_old_historical_data();
```

---

### 2. `get_historical_prices_stats()`
Returns storage and row count statistics for all tables.

**Usage**:
```sql
SELECT * FROM get_historical_prices_stats();
```

**Returns**:
- `table_name`: Name of the table
- `row_count`: Number of rows
- `total_size`: Total size (table + indexes)
- `table_size`: Size of table data only
- `indexes_size`: Size of indexes only

---

## Query Examples

### Get latest 5-minute data for a symbol
```sql
SELECT * FROM historical_prices_nse_equity
WHERE symbol = 'RELIANCE'
ORDER BY timestamp DESC
LIMIT 78; -- Last day
```

### Get data for a specific date range
```sql
SELECT * FROM historical_prices_nse_equity
WHERE symbol = 'TCS'
  AND date BETWEEN '2026-01-01' AND '2026-01-31'
ORDER BY timestamp;
```

### Get F&O data for a specific underlying
```sql
SELECT * FROM historical_prices_nse_fo
WHERE underlying = 'NIFTY'
  AND expiry = '2026-02-27'
  AND instrument_type = 'FUT'
ORDER BY timestamp DESC;
```

### Aggregate to daily candles
```sql
SELECT 
  symbol,
  date,
  MIN(open) as open,
  MAX(high) as high,
  MIN(low) as low,
  MAX(close) as close,
  SUM(volume) as volume
FROM historical_prices_nse_equity
WHERE symbol = 'RELIANCE'
  AND date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY symbol, date
ORDER BY date DESC;
```

---

## Migration Files

1. **20260128_rename_historical_prices_table.sql**
   - Renames existing `historical_prices` to `historical_prices_nse_equity`
   - Adds `timestamp` and `interval_type` columns
   - Creates indexes

2. **20260128_create_historical_prices_tables.sql**
   - Creates `historical_prices_bse_equity`
   - Creates `historical_prices_nse_fo`
   - Creates `historical_prices_bse_fo`
   - Creates RLS policies
   - Creates helper functions

---

## Best Practices

1. **Use prepared statements** when inserting data to improve performance
2. **Batch inserts** in chunks of 1000-5000 rows for optimal performance
3. **Use transactions** when inserting large batches
4. **Monitor table sizes** regularly using `get_historical_prices_stats()`
5. **Run cleanup** monthly or weekly to maintain storage limits
6. **Create partitions** if data grows beyond expectations (advanced)

---

## Performance Considerations

### Index Usage
- Queries filtering by `symbol` and/or `timestamp` will use indexes efficiently
- F&O queries on `underlying` and `expiry` are optimized
- Avoid `SELECT *` on large date ranges without proper WHERE clauses

### Connection Pooling
- Use connection pooling for high-frequency inserts
- Consider using Supabase realtime for live price updates instead of polling

### Maintenance
```sql
-- Vacuum tables periodically
VACUUM ANALYZE historical_prices_nse_equity;
VACUUM ANALYZE historical_prices_bse_equity;
VACUUM ANALYZE historical_prices_nse_fo;
VACUUM ANALYZE historical_prices_bse_fo;

-- Reindex if needed
REINDEX TABLE historical_prices_nse_equity;
```

---

## Integration with Existing Tables

The historical price tables can be linked with:

- `kite_nse_equity_symbols` (via `symbol`)
- `kite_bse_equity_symbols` (via `symbol`)
- `kite_nse_fo_symbols` (via `symbol` or `instrument_token`)
- `kite_bse_fo_symbols` (via `symbol` or `instrument_token`)

---

## Automation Scripts

You can create scripts to:
1. Fetch 5-minute data from Zerodha Kite API
2. Store in appropriate table based on exchange/segment
3. Run cleanup function weekly
4. Monitor storage using stats function

---

Last Updated: January 28, 2026
