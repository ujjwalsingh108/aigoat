# Hyper-Action Edge Function

This Supabase Edge Function fetches historical 5-minute candle data for **all 2,515 NSE equity stocks** from Zerodha Kite API and stores them in the `historical_prices` table.

## Features

- ✅ Fetches all NSE equity stocks from `kite_nse_equity_symbols` table
- ✅ Processes 2,515 symbols (no limit)
- ✅ Batched processing (5 symbols per batch) with rate limiting
- ✅ Auto-retry logic and error handling
- ✅ Execution logging to `auto_fetch_logs` table
- ✅ CORS support for cross-origin requests
- ✅ Authorization via Bearer token

## Deployment

### 1. Install Supabase CLI

```bash
npm install -g supabase
```

### 2. Login to Supabase

```bash
supabase login
```

### 3. Link to Your Project

```bash
supabase link --project-ref kowxpazskkigzwdwzwyq
```

### 4. Deploy the Function

```bash
supabase functions deploy hyper-action
```

### 5. Set Environment Variables

```bash
supabase secrets set KITE_API_KEY=your_api_key
supabase secrets set SUPABASE_URL=https://kowxpazskkigzwdwzwyq.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Usage

### Trigger from Cron Job (Recommended)

The edge function is automatically triggered every 5 minutes during market hours via the cron job on Digital Ocean droplet.

**Cron schedule:** `*/5 * * * *` (Every 5 minutes)

**Script:** `/root/fetch-historical-cron.sh`

### Manual Trigger

```bash
curl -X POST \
  https://kowxpazskkigzwdwzwyq.supabase.co/functions/v1/hyper-action \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

### Test Locally

```bash
supabase functions serve hyper-action
```

Then trigger:

```bash
curl -X POST http://localhost:54321/functions/v1/hyper-action \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

## Response Format

### Success Response

```json
{
  "success": true,
  "message": "Auto-fetch completed for all 2515 NSE equity stocks",
  "summary": {
    "processedSymbols": 2515,
    "totalSymbols": 2515,
    "totalRecords": 125750,
    "failedSymbols": 0,
    "durationMinutes": 8.42,
    "timestamp": "2026-01-12T12:35:00.000Z"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Auto-fetch failed",
  "message": "No valid access token found",
  "summary": {
    "processedSymbols": 500,
    "totalSymbols": 2515,
    "failedSymbols": 10,
    "errors": ["RELIANCE: HTTP 429: Rate limit exceeded"]
  }
}
```

## Configuration

### Batch Processing

- **Batch size:** 5 symbols per batch
- **Rate limit delay:** 1 second between batches
- **Total time:** ~8-10 minutes for 2,515 symbols

### Data Fetched

- **Interval:** 5-minute candles
- **Market hours:** 9:00 AM to 3:30 PM IST
- **Fields:** Open, High, Low, Close, Volume, Open Interest

### Database Tables

1. **kite_nse_equity_symbols** - Source table with 2,515 NSE equity stocks
2. **historical_prices** - Destination table for OHLCV data
3. **auto_fetch_logs** - Execution logs with timestamps and metrics

## Monitoring

### Check Logs

```bash
supabase functions logs hyper-action
```

### Check Last Execution

```sql
SELECT * FROM auto_fetch_logs 
ORDER BY executed_at DESC 
LIMIT 1;
```

### Verify Data

```sql
-- Check total records inserted today
SELECT COUNT(*) 
FROM historical_prices 
WHERE date = CURRENT_DATE;

-- Check specific stock
SELECT * 
FROM historical_prices 
WHERE symbol = 'RELIANCE' 
  AND date = CURRENT_DATE 
ORDER BY time DESC;
```

## Troubleshooting

### Access Token Expired

**Error:** "Access token has expired"

**Solution:** Update the access token in `kite_tokens` table:

```bash
# On droplet
cd /root/aigoat/scripts
./update-kite-token.sh
```

### No Symbols Found

**Error:** "No symbols found in kite_nse_equity_symbols table"

**Solution:** Run the fetch script to populate the table:

```bash
node scripts/fetch-nse-equity-stocks.js
# or
node scripts/load-equity-stocks-to-db.js
```

### Rate Limit Exceeded

**Error:** "HTTP 429: Rate limit exceeded"

**Solution:** The function already has rate limiting. If this persists:
1. Increase delay between batches (currently 1 second)
2. Reduce batch size (currently 5 symbols)
3. Check Zerodha API limits (3 requests/second)

### Timeout Issues

If the function times out (>60 seconds for Supabase Free tier):
1. Upgrade to Supabase Pro for longer execution time
2. Process symbols in smaller chunks
3. Run multiple smaller edge functions in parallel

## Notes

- Edge function runs in Deno runtime (not Node.js)
- Uses `jsr:@supabase/supabase-js@2` for Deno compatibility
- Authorization required via Bearer token (service role key)
- CORS enabled for cross-origin requests
- Logs execution metrics to `auto_fetch_logs` table
