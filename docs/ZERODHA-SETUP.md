# 🚀 Zerodha KiteConnect Integration Guide

## Overview

All scanners (`breakout-scanner.js`, `intraday-bearish-scanner.js`, `shared-websocket-scanner.js`) now use **Zerodha KiteConnect SDK** for real-time WebSocket tick data and historical data fetching via REST API.

---

## 📊 Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    ZERODHA KITE CONNECT                         │
│                                                                 │
│  ┌──────────────────┐         ┌─────────────────────────┐     │
│  │  KiteTicker      │         │  REST API (Historical)  │     │
│  │  WebSocket       │         │  5-min OHLCV Data       │     │
│  │  (Real-time)     │         │  Daily Candles          │     │
│  └────────┬─────────┘         └────────┬────────────────┘     │
│           │                            │                       │
└───────────┼────────────────────────────┼───────────────────────┘
            │                            │
            ▼                            ▼
    ┌──────────────────────────────────────────────┐
    │         Supabase Edge Function               │
    │         (hyper-action)                       │
    │  • Fetches historical data every 5 min      │
    │  • Stores in historical_prices table        │
    └──────────────┬───────────────────────────────┘
                   │
                   ▼
    ┌──────────────────────────────────────────────┐
    │         Supabase Database                    │
    │  • zerodha_symbols (instrument tokens)      │
    │  • historical_prices (5-min OHLCV)          │
    │  • kite_tokens (access tokens)              │
    │  • breakout_signals / intraday_bearish_     │
    └──────────────┬───────────────────────────────┘
                   │
                   ▼
    ┌──────────────────────────────────────────────┐
    │         Scanner (Node.js)                    │
    │  • Receives live ticks via KiteTicker       │
    │  • Aggregates into 5-min candles            │
    │  • Merges with historical data              │
    │  • Calculates EMA, RSI, Volume              │
    │  • Generates signals                         │
    └──────────────────────────────────────────────┘
```

---

## 🔧 Setup Steps

### 1. **Get Zerodha KiteConnect Credentials**

1. Open a Zerodha trading account at [https://zerodha.com](https://zerodha.com)
2. Visit [https://kite.trade](https://kite.trade) and create a new app
3. Get your credentials:
   - **API Key**: Your app's API key
   - **API Secret**: Your app's secret
4. Generate an **Access Token** (valid for 1 day):
   - Use the login flow or token generation script
   - Store the token in `kite_tokens` table in Supabase

**Pricing:**
- ₹2,000/month for KiteConnect API
- Unlimited API calls and WebSocket connections

---

### 2. **Configure Environment Variables**

Update your `.env` file:

```env
# Zerodha Kite Connect API Credentials
KITE_API_KEY=your_api_key_here
KITE_API_SECRET=your_api_secret_here
KITE_ACCESS_TOKEN=your_access_token_here

# Supabase (existing)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Important:** Access tokens expire daily at 6:00 AM IST. You need to:
- Generate a new token every day before market open
- Store it in the `kite_tokens` table
- Update the `.env` file or fetch from database

---

### 3. **Database Setup**

Your database already has the required tables. Here's what they do:

#### **zerodha_symbols**
```sql
-- Stores NSE stock symbols with their Zerodha instrument tokens
-- Required for WebSocket subscription and historical data fetching
```

#### **historical_prices**
```sql
-- Stores 5-minute OHLCV candles
-- Populated by the Supabase Edge Function (hyper-action)
-- Used for EMA, RSI calculations
```

#### **kite_tokens**
```sql
-- Stores Zerodha access tokens
-- Tokens expire daily, new ones are added by login script
```

---

### 4. **Install Dependencies**

The KiteConnect SDK is already installed:

```bash
npm install kiteconnect
```

Dependencies:
- `kiteconnect`: Official Zerodha SDK for Node.js
- `ws`: WebSocket library (used internally by KiteTicker)
- `@supabase/supabase-js`: Supabase client

---

## 🎯 How It Works

### Real-Time Tick Data (KiteTicker WebSocket)

1. **Initialize KiteTicker**:
   ```javascript
   const { KiteTicker } = require("kiteconnect");
   
   const ticker = new KiteTicker({
     api_key: KITE_API_KEY,
     access_token: KITE_ACCESS_TOKEN,
   });
   ```

2. **Connect and Subscribe**:
   ```javascript
   ticker.connect();
   
   ticker.on("connect", () => {
     const tokens = [738561, 779521, 341249]; // instrument_tokens
     ticker.setMode(ticker.modeFull, tokens); // Full mode: LTP + OHLC + Volume
     ticker.subscribe(tokens);
   });
   ```

3. **Receive Ticks**:
   ```javascript
   ticker.on("ticks", (ticks) => {
     ticks.forEach((tick) => {
       console.log({
         instrument_token: tick.instrument_token,
         last_price: tick.last_price,
         volume: tick.volume,
         ohlc: tick.ohlc, // { open, high, low, close }
       });
     });
   });
   ```

4. **Aggregate into 5-min Candles**:
   - Each tick updates the current candle
   - When 5 minutes pass, candle is completed and a new one starts
   - Completed candles are used for EMA/RSI calculations

---

### Historical Data (Edge Function)

The **hyper-action** edge function runs every 5 minutes (via cron):

1. **Fetches access token** from `kite_tokens` table
2. **Calls Zerodha REST API** for each symbol:
   ```
   GET https://api.kite.trade/instruments/historical/{instrument_token}/5minute
   ```
3. **Stores data** in `historical_prices` table
4. **Logs execution** to `auto_fetch_logs` table

**Cron Schedule:**
- Runs every 5 minutes during market hours (9:05 AM - 6:30 PM IST)
- Only on weekdays (Monday-Friday)
- Configured in `fetch-historical-cron.sh`

---

## 📡 Scanner Architecture

### Breakout Scanner (`breakout-scanner.js`)

**Purpose:** Detects bullish breakout signals

**Criteria (6 total):**
1. Stock is part of NIFTY 50
2. Trading above Daily 20 EMA
3. Trading above 5-min 20 EMA
4. Volume surge (current > previous day)
5. Opening price ≤ Current price
6. RSI between 50 and 80

**How it works:**
```
Live Ticks → Candle Aggregator → Merge with Historical → Calculate EMA/RSI → Check Criteria → Save Signal
```

---

### Intraday Bearish Scanner (`intraday-bearish-scanner.js`)

**Purpose:** Detects bearish intraday opportunities

**Criteria (6 total):**
1. Stock is part of NIFTY 50
2. Trading **below** Daily 20 EMA
3. Trading **below** 5-min 20 EMA
4. Volume surge
5. Opening price > Current price (gap down)
6. RSI between 20 and 50

---

### Shared WebSocket Scanner (`shared-websocket-scanner.js`)

**Purpose:** Single WebSocket connection for both bullish AND bearish signals

**Advantages:**
- One WebSocket connection instead of two
- Lower resource usage
- Simultaneous detection of both patterns

---

## 🚀 Running the Scanners

### Start Breakout Scanner

```bash
cd scripts
node breakout-scanner.js
```

**Output:**
```
🚀 Initializing Zerodha KiteConnect Breakout Scanner...
✅ Loaded 50 Nifty 50 symbols from zerodha_symbols table
📥 Loading historical data...
🔌 Connecting to Zerodha KiteTicker WebSocket...
✅ KiteTicker connected successfully
📡 Subscribing to 50 instrument tokens...
✅ Scanner initialized with 50 symbols
🚀 Starting Zerodha KiteConnect scanner...
```

### Start as Background Process (PM2)

```bash
pm2 start breakout-scanner.js --name "zerodha-scanner"
pm2 logs zerodha-scanner
pm2 stop zerodha-scanner
```

---

## 🔑 Token Management

### Daily Token Refresh

Zerodha access tokens expire daily at 6:00 AM IST. You need to refresh them:

**Option 1: Manual Login**
1. Visit: `https://kite.trade/connect/login?v=3&api_key=YOUR_API_KEY`
2. Login with your Zerodha credentials
3. Copy the `request_token` from URL
4. Generate access token:
   ```javascript
   const { KiteConnect } = require("kiteconnect");
   const kc = new KiteConnect({ api_key: "your_api_key" });
   
   kc.generateSession("request_token", "api_secret")
     .then((response) => {
       console.log("Access Token:", response.access_token);
       // Store in kite_tokens table
     });
   ```

**Option 2: Automated Script** (recommended)
Create a script that:
1. Runs daily at 8:00 AM IST (before market open)
2. Generates a new access token
3. Stores it in `kite_tokens` table
4. Updates `.env` file or fetches from database

---

## 📊 Monitoring

### Check Tick Data Reception

The scanner logs tick status every 5 minutes:

```
📊 TICK DATA STATUS (10:25:00 IST):
   ✅ Receiving ticks: 48 symbols
   ❌ No ticks yet: 2 symbols
   Top 10 active: RELIANCE(1234), TCS(987), HDFCBANK(765), ...
```

### Check Signals

Query the database:

```sql
-- Recent breakout signals
SELECT * FROM breakout_signals 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY probability DESC;

-- Recent bearish signals
SELECT * FROM intraday_bearish_signals 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY probability DESC;
```

---

## 🛠️ Troubleshooting

### Issue: "No valid access token found"

**Solution:**
1. Generate a new access token (see Token Management)
2. Store it in `kite_tokens` table:
   ```sql
   INSERT INTO kite_tokens (access_token, expires_at)
   VALUES ('your_token', '2026-01-09 06:00:00+05:30');
   ```
3. Update `.env` file:
   ```env
   KITE_ACCESS_TOKEN=your_new_token
   ```

---

### Issue: "Access token has expired"

**Solution:**
Access tokens expire daily at 6 AM IST. Generate a new one before market open.

---

### Issue: "No ticks received"

**Possible causes:**
1. **Market is closed** - Ticks only flow during market hours (9:15 AM - 3:30 PM IST)
2. **Invalid instrument tokens** - Verify tokens in `zerodha_symbols` table
3. **Access token expired** - Generate a new token
4. **WebSocket disconnected** - Check console logs for errors

**Solution:**
- Check market hours
- Verify instrument tokens match Zerodha's master database
- Regenerate access token
- Check internet connection

---

### Issue: "Insufficient historical data"

**Solution:**
- Ensure the edge function is running (check `auto_fetch_logs`)
- Manually trigger the edge function:
  ```bash
  curl -X POST "https://kowxpazskkigzwdwzwyq.supabase.co/functions/v1/hyper-action" \
    -H "Authorization: Bearer your-service-role-key" \
    -H "Content-Type: application/json" \
    --data '{"trigger": "manual"}'
  ```
- Wait 15-20 minutes for sufficient candles to accumulate

---

## 🎯 Best Practices

1. **Generate tokens before market open** (8:00 AM IST)
2. **Monitor scanner logs** regularly via PM2
3. **Check database** for signal quality and frequency
4. **Keep historical data updated** via cron job
5. **Use full mode** for KiteTicker to get OHLC + Volume data
6. **Limit to 50 symbols** for trial account (upgrade for more)

---

## 📚 Resources

- **Zerodha KiteConnect Docs**: https://kite.trade/docs/connect/v3/
- **KiteTicker Node.js**: https://github.com/zerodhatech/kiteconnectjs
- **WebSocket Modes**: https://kite.trade/docs/connect/v3/websocket/
- **Historical Data API**: https://kite.trade/docs/connect/v3/historical/

---

## 🆚 Zerodha vs TrueData

| Feature | Zerodha KiteConnect | TrueData |
|---------|---------------------|----------|
| **Cost** | ₹2,000/month | ₹500-1,000/month |
| **Tick Delay** | Real-time (< 1s) | Near real-time (~1-2s) |
| **Historical Data** | REST API + WebSocket | WebSocket only |
| **Symbol Limit** | 3,000 (full account) | 50 (trial) |
| **Broker Account** | Required (Zerodha) | Not required |
| **Data Quality** | Exchange-grade | Good |
| **SDK** | Official Node.js SDK | Community SDK |
| **Support** | Official support | Community |

**Recommendation:** Use Zerodha if you have a Zerodha account. More reliable and official support.

---

## ✅ Migration Complete

All scanners now use Zerodha KiteConnect SDK:
- ✅ `breakout-scanner.js` → Uses KiteTicker WebSocket
- ✅ `intraday-bearish-scanner.js` → Uses KiteTicker WebSocket
- ✅ `shared-websocket-scanner.js` → Uses KiteTicker WebSocket
- ✅ Database queries → Use `zerodha_symbols` table
- ✅ Cron jobs → Call `hyper-action` edge function
- ✅ Token management → Store in `kite_tokens` table

**Backup files created:**
- `breakout-scanner-truedata-backup.js`
- `intraday-bearish-scanner-truedata-backup.js`
- `shared-websocket-scanner-truedata-backup.js`

---

## 🎉 You're Ready!

Your system is now fully integrated with Zerodha KiteConnect. Start the scanner and monitor live tick data!

```bash
# Start scanner
node scripts/breakout-scanner.js

# Or with PM2
pm2 start scripts/breakout-scanner.js --name "zerodha-scanner"
pm2 logs zerodha-scanner
```

Happy trading! 📈
