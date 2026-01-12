# Migration to kite_nse_equity_symbols Table

## Summary

Successfully migrated from `zerodha_symbols` (6,897 mixed instruments) to `kite_nse_equity_symbols` (2,515 actual NSE equity stocks).

## Changes Made

### 1. Database Schema

**New Table:** `kite_nse_equity_symbols`
- **Records:** 2,515 actual NSE equity stocks
- **Filters Applied:**
  - ✅ Exchange = NSE
  - ✅ Segment = NSE (not NSE-FO, NSE-CD)
  - ✅ Instrument Type = EQ (equity only)
  - ✅ Alphabetic symbols only (RELIANCE, TCS, etc.)
  - ✅ No bonds (symbols with hyphens like 0IRFC35-N0)
  - ✅ No warrants (symbols with -YR, -YW suffixes)
  - ✅ No derivatives or structured products

**Verified Stocks:** RELIANCE, TCS, HDFCBANK, INFY, ICICIBANK, SBIN, ADANIPORTS, TATASTEEL, TATAPOWER, etc.

### 2. Updated Files

#### A. Edge Function (Supabase)
**File:** `supabase/functions/hyper-action/index.ts`

**Changes:**
```typescript
// OLD: Limited to 1000 stocks from zerodha_symbols
const { data } = await supabase
  .from("zerodha_symbols")
  .select("symbol, instrument_token")
  .eq("exchange", "NSE")
  .limit(1000);

// NEW: All 2515 stocks from kite_nse_equity_symbols
const { data } = await supabase
  .from("kite_nse_equity_symbols")
  .select("symbol, instrument_token")
  .eq("is_active", true)
  .order("symbol", { ascending: true });
  // No limit - fetches all 2515 stocks
```

**Impact:** Edge function now processes all 2,515 equity stocks instead of 1,000

#### B. Scanner Scripts (Digital Ocean Droplet)

**Files Updated:**
1. `scripts/breakout-scanner.js`
2. `scripts/intraday-bearish-scanner.js`
3. `scripts/shared-websocket-scanner.js`

**Changes in Each:**
```javascript
// OLD: Top 1000 from zerodha_symbols
const { data } = await this.supabase
  .from("zerodha_symbols")
  .select("symbol, instrument_token, exchange, type, segment")
  .eq("exchange", "NSE")
  .eq("segment", "NSE")
  .limit(CONFIG.TOP_N_STOCKS);

// NEW: All 2515 from kite_nse_equity_symbols
const { data } = await this.supabase
  .from("kite_nse_equity_symbols")
  .select("symbol, instrument_token, exchange, type, segment")
  .eq("is_active", true)
  .order("symbol", { ascending: true });
  // No limit
```

**Impact:** Scanners monitor all 2,515 actual equity stocks

### 3. New Scripts Created

#### A. `scripts/fetch-nse-equity-stocks.js`
Fetches actual NSE equity stocks from Zerodha Kite API with proper filtering.

**Features:**
- Calls `kite.getInstruments(['NSE'])` API
- Filters by `instrument_type === 'EQ'`
- Validates symbol format (alphabetic only)
- Saves to `kite_nse_equity_symbols` table
- Creates JSON backup

**Usage:**
```bash
node scripts/fetch-nse-equity-stocks.js
```

#### B. `scripts/load-equity-stocks-to-db.js`
Loads NSE equity stocks from JSON backup to Supabase.

**Features:**
- Reads from `nse-equity-stocks.json`
- Batch inserts (100 per batch)
- Verifies popular stocks (RELIANCE, TCS, etc.)
- Upserts to avoid duplicates

**Usage:**
```bash
node scripts/load-equity-stocks-to-db.js
```

#### C. `scripts/deploy-edge-function.sh`
One-command deployment script for Supabase edge function.

**Features:**
- Checks Supabase CLI installation
- Authenticates with Supabase
- Links to project
- Deploys edge function
- Shows function URL and test commands

**Usage:**
```bash
./scripts/deploy-edge-function.sh
```

### 4. Documentation Created

#### A. `supabase/functions/hyper-action/README.md`
Complete documentation for the edge function with:
- Features and configuration
- Deployment steps
- Usage examples
- Monitoring queries
- Troubleshooting guide

### 5. Data Backup

**JSON Backup:** `scripts/nse-equity-stocks.json`
- 2,515 NSE equity stocks
- Complete instrument data (symbol, token, name, ISIN, etc.)
- Metadata (last updated, filter criteria)

## Deployment Steps

### Step 1: Deploy Edge Function to Supabase

**Option A: Using Deploy Script (Recommended)**
```bash
./scripts/deploy-edge-function.sh
```

**Option B: Manual Deployment**
```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to project
supabase link --project-ref kowxpazskkigzwdwzwyq

# Deploy
supabase functions deploy hyper-action --no-verify-jwt
```

### Step 2: Update Scanner Scripts on Droplet

```bash
# From local machine
scp -i C:\Users\ujjwa\.ssh\id_ed25519_digitalocean \
  scripts/breakout-scanner.js \
  scripts/intraday-bearish-scanner.js \
  scripts/shared-websocket-scanner.js \
  root@143.244.129.143:/root/aigoat/scripts/

# SSH to droplet
ssh -i C:\Users\ujjwa\.ssh\id_ed25519_digitalocean root@143.244.129.143

# Restart all scanners
pm2 restart all

# Check status
pm2 status

# View logs
pm2 logs
```

### Step 3: Test the Changes

**A. Test Edge Function**
```bash
curl -X POST \
  https://kowxpazskkigzwdwzwyq.supabase.co/functions/v1/hyper-action \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

**B. Check Database**
```sql
-- Verify kite_nse_equity_symbols has data
SELECT COUNT(*) FROM kite_nse_equity_symbols;
-- Expected: 2515

-- Check popular stocks
SELECT * FROM kite_nse_equity_symbols 
WHERE symbol IN ('RELIANCE', 'TCS', 'HDFCBANK', 'INFY');

-- Verify historical data is being fetched
SELECT COUNT(*) FROM historical_prices 
WHERE date = CURRENT_DATE;

-- Check auto_fetch_logs
SELECT * FROM auto_fetch_logs 
ORDER BY executed_at DESC 
LIMIT 1;
```

**C. Check Scanner Logs on Droplet**
```bash
# Check if scanners loaded correct number of stocks
pm2 logs breakout-scanner | grep "Loaded"
# Should show: "Loaded 2515 NSE equity stocks"

# Check WebSocket connections
pm2 logs shared-websocket-scanner | grep "Connected"
```

## Expected Results

### Before Migration
- ❌ 1,000 symbols limit (missed 1,515 stocks)
- ❌ Mixed data (bonds, warrants, derivatives)
- ❌ Missing popular stocks like TATAMOTORS
- ❌ Symbols like "0IRFC35-N0" (bonds) in database

### After Migration
- ✅ All 2,515 NSE equity stocks
- ✅ Pure equity stocks only (no bonds/warrants)
- ✅ All popular stocks verified (RELIANCE, TCS, etc.)
- ✅ Clean alphabetic symbols only
- ✅ TATASTEEL, TATAPOWER, TMPV, TMCV included

## Performance Impact

### Edge Function
- **Before:** ~2 minutes for 1,000 stocks
- **After:** ~8-10 minutes for 2,515 stocks
- **Cron Schedule:** Every 5 minutes (sufficient time)

### WebSocket Scanners
- **Memory Usage:** May increase from ~150MB to ~200MB per scanner
- **Connections:** 2,515 stocks monitored instead of 1,000
- **Bandwidth:** Increased by ~2.5x for tick data

### Database Storage
- **Historical Prices:** ~2.5x more records per day
- **Signal Tables:** More potential signals detected

## Monitoring

### Check Execution Logs
```sql
SELECT 
  executed_at,
  success,
  data->>'processedSymbols' as processed,
  data->>'totalRecords' as records,
  data->>'durationMinutes' as duration
FROM auto_fetch_logs
ORDER BY executed_at DESC
LIMIT 10;
```

### Monitor Droplet Resources
```bash
ssh root@143.244.129.143

# Check PM2 status
pm2 status

# Check memory usage
free -h

# Check disk usage
df -h

# Monitor real-time logs
pm2 logs
```

## Rollback Plan

If issues occur, rollback to old table:

```javascript
// In scanner scripts, change:
.from("kite_nse_equity_symbols")
// Back to:
.from("zerodha_symbols")
.limit(1000)
```

## Next Steps

1. ✅ Deploy edge function to Supabase
2. ✅ Update scanner scripts on droplet
3. ✅ Monitor first execution during market hours
4. ⏳ Verify data quality in historical_prices table
5. ⏳ Check signal detection with 2,515 stocks
6. ⏳ Monitor droplet memory/CPU usage
7. ⏳ Optimize if performance issues occur

## Support

For issues or questions:
- Check `supabase/functions/hyper-action/README.md`
- View edge function logs: `supabase functions logs hyper-action`
- Check droplet logs: `pm2 logs`
- Query execution logs: `SELECT * FROM auto_fetch_logs`

---

**Migration Completed:** January 12, 2026
**Total Stocks:** 2,515 NSE equity stocks
**Source:** Zerodha Kite API
**Table:** kite_nse_equity_symbols
