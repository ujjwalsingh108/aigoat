# Intraday Index Strategy Integration Summary

## Strategy Overview

**Name**: Intraday Index Strategy (NIFTY / BANKNIFTY)
**Timeframe**: 5-minute candles
**Universe**: NIFTY, BANKNIFTY
**Direction**: Both Long (Buy) and Short (Sell)

## Signal Criteria

### Buy Signal (INDEX_BUY / LONG)
1. Current Price > 20 EMA (5-minute)
2. Current Price within 150 points of recent swing low (last 10 candles)
3. Target 1: Entry + 50 points
4. Target 2: Entry + 75 points
5. Stop Loss: Swing low reference price

### Sell Signal (INDEX_SELL / SHORT)
1. Current Price < 20 EMA (5-minute)
2. Current Price within 150 points of recent swing high (last 10 candles)
3. Target 1: Entry - 50 points
4. Target 2: Entry - 75 points
5. Stop Loss: Swing high reference price

## Implementation Details

### 1. Database Migration
**File**: `supabase/migrations/create_intraday_index_signals.sql`

**Table**: `intraday_index_signals`

**Columns**:
- `id` (bigint, primary key)
- `symbol` (text) - NIFTY or BANKNIFTY
- `signal_type` (text) - INDEX_BUY or INDEX_SELL
- `signal_direction` (text) - LONG or SHORT
- `entry_price` (numeric)
- `ema20_5min` (numeric) - 20 EMA value on 5-minute chart
- `swing_reference_price` (numeric) - Swing low for buy, swing high for sell
- `distance_from_swing` (numeric) - Distance in points from swing reference
- `target1` (numeric) - Fixed +/- 50 points
- `target2` (numeric) - Fixed +/- 75 points
- `stop_loss` (numeric) - Swing reference price
- `candle_time` (timestamptz) - 5-minute candle timestamp
- `is_active` (boolean) - Signal status
- `created_at` (timestamptz) - Signal generation time

**Indexes**:
- `idx_intraday_index_signals_symbol_time` (symbol, candle_time DESC)
- `idx_intraday_index_signals_active` (is_active)
- `idx_intraday_index_signals_created` (created_at DESC)

**RLS**: Public read access, admin write access

### 2. Scanner Logic
**File**: `scripts/breakout-scanner.js` (47.5KB)

**New Methods**:

#### `findRecentSwingLow(candles, lookback = 10)`
- Finds minimum low price in last N candles
- Used for buy signal validation
- Returns lowest price found

#### `findRecentSwingHigh(candles, lookback = 10)`
- Finds maximum high price in last N candles
- Used for sell signal validation
- Returns highest price found

#### `analyzeIntradayIndex(symbol, historicalCandles, currentCandle)`
- Core index analysis logic
- Calculates 20 EMA on 5-minute data (requires 20+ candles)
- Checks buy/sell conditions with swing constraints
- Returns signal object or null

**Logic Flow**:
```javascript
// 1. Calculate 20 EMA
const prices = candles.map(c => c.close);
const ema20 = calculateEMA(prices, 20);

// 2. Get swing references
const swingLow = findRecentSwingLow(candles, 10);
const swingHigh = findRecentSwingHigh(candles, 10);

// 3. Check BUY conditions
if (currentPrice > ema20 && (currentPrice - swingLow) <= 150) {
  return {
    signal_type: 'INDEX_BUY',
    signal_direction: 'LONG',
    entry_price: currentPrice,
    ema20_5min: ema20,
    swing_reference_price: swingLow,
    distance_from_swing: currentPrice - swingLow,
    target1: currentPrice + 50,
    target2: currentPrice + 75,
    stop_loss: swingLow,
    candle_time: currentCandle.timestamp
  };
}

// 4. Check SELL conditions
if (currentPrice < ema20 && (swingHigh - currentPrice) <= 150) {
  return {
    signal_type: 'INDEX_SELL',
    signal_direction: 'SHORT',
    entry_price: currentPrice,
    ema20_5min: ema20,
    swing_reference_price: swingHigh,
    distance_from_swing: swingHigh - currentPrice,
    target1: currentPrice - 50,
    target2: currentPrice - 75,
    stop_loss: swingHigh,
    candle_time: currentCandle.timestamp
  };
}
```

#### `saveIntradayIndexSignal(signal)`
- Inserts signal into `intraday_index_signals` table
- Marks previous signals as inactive
- Returns boolean success status

**Integration in analyzeSymbol()**:
```javascript
// Only analyze NIFTY/BANKNIFTY
let indexSignal = null;
if (symbol === 'NIFTY' || symbol === 'BANKNIFTY') {
  indexSignal = this.analyzer.analyzeIntradayIndex(symbol, historical, currentCandle);
}

// Save with 5-minute deduplication
if (indexSignal) {
  const lastIndexSignal = this.lastIndexSignalTime?.get(symbol);
  const now = Date.now();
  if (!lastIndexSignal || now - lastIndexSignal > 5 * 60 * 1000) {
    const saved = await this.db.saveIntradayIndexSignal(indexSignal);
    if (saved) {
      this.lastIndexSignalTime.set(symbol, now);
      console.log(`📊 INDEX SIGNAL SAVED: ${symbol} - ${indexSignal.signal_type}`);
    }
  }
}
```

### 3. API Route
**File**: `src/app/api/signals/intraday-index/route.ts`

**Endpoint**: `GET /api/signals/intraday-index`

**Query Parameters**:
- `minutesAgo` (default: 15) - Get signals from last N minutes
- `limit` (default: 50) - Max results

**Caching**:
- Redis cache with 60-second TTL
- Cache key: `signals:intraday-index:15min`
- Uses `getOrSetCached` from redis.ts

**Response**:
```json
{
  "success": true,
  "count": 2,
  "signals": [
    {
      "id": 123,
      "symbol": "NIFTY",
      "signal_type": "INDEX_BUY",
      "signal_direction": "LONG",
      "entry_price": 24500.50,
      "ema20_5min": 24450.25,
      "swing_reference_price": 24380.00,
      "distance_from_swing": 120.50,
      "target1": 24550.50,
      "target2": 24575.50,
      "stop_loss": 24380.00,
      "candle_time": "2025-01-22T10:15:00Z",
      "is_active": true,
      "created_at": "2025-01-22T10:15:05Z"
    }
  ],
  "cached": true
}
```

### 4. UI Page
**File**: `src/app/(with-sidebar)/screener/intraday-index/page.tsx`

**Features**:
- Real-time signal display with 60-second auto-refresh
- Buy/Sell signal differentiation (green/red badges)
- Displays entry, targets, stop-loss, swing reference
- Shows distance from swing in points
- AI integration (auth-gated)
- Responsive grid layout (1-column mobile, 2-column desktop)

**Strategy Criteria Card**:
- Split view: Buy criteria (left), Sell criteria (right)
- Color-coded: Green for buy, red for sell
- Explains EMA condition, swing constraint, targets

**Signal Cards**:
- Entry price, 20 EMA (5m), swing reference, distance
- Target 1 (+/-50pts), Target 2 (+/-75pts), stop-loss
- Candle time and signal generation timestamp
- Color-coded borders based on signal type

### 5. Cache Integration
**File**: `src/lib/cache/redis.ts`

**Updates**:
- Added `INTRADAY_INDEX_SIGNALS: 'signals:intraday-index'` to CACHE_KEYS
- Extended `buildSignalKey()` type union to include `'intraday-index'`
- Uses same 60-second TTL as other signals

### 6. Type Extensions
**Files Updated**:
- `src/components/screener/AIScreenerButton.tsx`
  - Extended `screenerType` union: `"bullish" | "bearish" | "swing-positional" | "swing-positional-bearish" | "intraday-index"`
  - Extended `signals` type: `BreakoutSignal[] | IntradayBearishSignal[] | any[]`

- `src/components/screener/AIScreenerPanel.tsx`
  - Extended `screenerType` union: `"bullish" | "bearish" | "swing-positional" | "swing-positional-bearish" | "intraday-index"`
  - Extended `signals` type: `BreakoutSignal[] | IntradayBearishSignal[] | any[]`

### 7. Routing Updates
**File**: `src/components/screener/ScreenerCard.tsx`

**Added Routing**:
```typescript
else if (label === "Intraday Index (NIFTY / BANKNIFTY)") {
  router.push(`/screener/intraday-index`);
}
```

**File**: `src/app/(with-sidebar)/screener/page.tsx`

**Added Indices Section**:
```typescript
{
  title: "Indices",
  items: [
    {
      label: "Intraday Index (NIFTY / BANKNIFTY)",
      tags: ["Buy/Sell"],
      symbols: 0,
      image: "/images/stocks-bullish-tomorrow.jpg",
    },
  ],
}
```

## Architecture Compliance

✅ **Reused Existing Infrastructure**:
- `calculateEMA()` - Used for 20 EMA calculation
- `CandleAggregator` - 5-minute candle construction
- WebSocket tick handling - Real-time data flow
- Signal deduplication pattern - Map with timestamp tracking
- Database save pattern - Supabase insert with error handling

✅ **No Code Duplication**:
- All indicator utilities reused (EMA)
- Candle aggregation reused (5-minute timeframe)
- API route pattern mirrored (query params, caching)
- UI page pattern mirrored (auto-refresh, AI integration)

✅ **Minimal New Logic**:
- `findRecentSwingLow()` - 10-line method
- `findRecentSwingHigh()` - 10-line method
- 150-point distance constraint validation
- Fixed point targets instead of percentage

## Key Differences from Equity Strategies

| Aspect | Equity Strategies | Index Strategy |
|--------|------------------|----------------|
| Universe | 2500 NSE stocks | NIFTY, BANKNIFTY only |
| Filters | 6 filters (trend, momentum, volume, volatility, breakout, market cap) | 2 filters (EMA, swing constraint) |
| Targets | Percentage-based (3%, 5%, 8%) | Fixed points (+/-50, +/-75) |
| Stop-Loss | Percentage-based (3%) | Swing reference price |
| Direction | Separate strategies (bullish/bearish) | Both in one (buy/sell) |
| Timeframe | 5-minute (intraday), Daily (swing) | 5-minute only |
| Signal Logic | Stateless (re-evaluated each candle) | Stateless (re-evaluated each candle) |

## Deployment Checklist

- [x] Create database migration (create_intraday_index_signals.sql)
- [x] Add swing high/low detection methods to scanner
- [x] Implement analyzeIntradayIndex() method
- [x] Implement saveIntradayIndexSignal() method
- [x] Update analyzeSymbol() to call index analysis
- [x] Create API route (/api/signals/intraday-index)
- [x] Create UI page (/screener/intraday-index)
- [x] Update cache keys (redis.ts)
- [x] Update types (AIScreenerButton, AIScreenerPanel)
- [x] Update routing (ScreenerCard)
- [x] Update screener landing page
- [x] Verify build (npm run build)
- [x] Verify scanner syntax (node -c)
- [ ] Execute database migration (Supabase dashboard)
- [ ] Deploy scanner to droplet (scp)
- [ ] Restart scanner on Jan 25 (pm2 restart)

## Files Modified

1. `supabase/migrations/create_intraday_index_signals.sql` (NEW)
2. `scripts/breakout-scanner.js` (42KB → 47.5KB)
3. `src/app/api/signals/intraday-index/route.ts` (NEW)
4. `src/app/(with-sidebar)/screener/intraday-index/page.tsx` (NEW)
5. `src/lib/cache/redis.ts` (extended CACHE_KEYS, buildSignalKey)
6. `src/components/screener/AIScreenerButton.tsx` (extended screenerType)
7. `src/components/screener/AIScreenerPanel.tsx` (extended screenerType)
8. `src/components/screener/ScreenerCard.tsx` (added routing)
9. `src/app/(with-sidebar)/screener/page.tsx` (added Indices section)

## Build Status

✅ **Next.js Build**: Passed (TypeScript compilation successful)
✅ **Scanner Syntax**: Valid (node -c passed)
✅ **Routes Generated**: 
- `/api/signals/intraday-index` (API route)
- `/screener/intraday-index` (UI page)

## Testing Plan

1. **Scanner Testing** (After Jan 25 restart):
   - Monitor logs for NIFTY/BANKNIFTY analysis
   - Verify EMA calculation (20-period on 5m)
   - Check swing detection (last 10 candles)
   - Validate 150-point constraint
   - Confirm signal saving (5-minute deduplication)

2. **API Testing**:
   ```bash
   curl http://localhost:3000/api/signals/intraday-index?minutesAgo=15
   ```
   - Verify Redis caching (60s TTL)
   - Check signal format
   - Validate is_active filtering

3. **UI Testing**:
   - Navigate to `/screener/intraday-index`
   - Verify buy/sell signal display
   - Check auto-refresh (60s interval)
   - Test AI panel (auth-gated)
   - Validate responsive layout

## Performance Metrics

- **Scanner**: +5.5KB (42KB → 47.5KB, +13% increase)
- **API Cache**: 60-second TTL (same as other signals)
- **Database Indexes**: 3 indexes for optimal query performance
- **UI Refresh**: 60-second interval (auto-refresh)
- **Build Time**: ~3.4s compilation (no regression)

## Notes

- Scanner will NOT run index analysis until database migration is executed
- Index signals limited to 2 instruments (NIFTY, BANKNIFTY)
- Fixed targets (+/-50, +/-75) different from equity percentage-based
- Swing detection uses rolling 10-candle window (can be tuned)
- 150-point constraint ensures signals near support/resistance
- One active signal per direction per index (LONG/SHORT)

---

**Integration Date**: January 22, 2025
**Status**: Complete (pending deployment)
**Total Strategies**: 6 (Intraday Bullish/Bearish, Swing Bullish/Bearish, Index Buy/Sell)
