# Strategy-to-Table Mapping Reference

**Quick reference for all trading strategies, their database tables, and API endpoints.**

---

## 📊 NSE EQUITY (Cash Market)

### Strategy 1: NSE Bullish Breakout (Intraday)
**Status**: ✅ **PRODUCTION**  
**Scanner**: `scripts/breakout-scanner.js` → `analyzeStock()`  
**Method**: `EnhancedBreakoutScanner.saveBreakoutSignal()`

| Aspect | Details |
|--------|---------|
| **Input Table** | `kite_nse_equity_symbols` (symbols)<br>`historical_prices_nse_equity` (candles) |
| **Output Table** | `bullish_breakout_nse_eq` |
| **API Endpoint** | `GET /api/signals/bullish` |
| **Frontend Route** | `/screener/intraday-bullish` |
| **Card Label** | "NSE Bullish Breakout" |
| **Timeframe** | 5-minute (intraday) |
| **Min Confidence** | 60% (criteria_met ≥ 5) |
| **Pattern Detection** | ✅ Enabled |

**Key Columns**:
```sql
symbol, signal_type, probability, criteria_met, daily_ema20, 
fivemin_ema20, rsi_value, volume_ratio, current_price, target_price, 
stop_loss, detected_patterns, strongest_pattern, pattern_confidence
```

---

### Strategy 2: NSE Bearish Breakdown (Intraday)
**Status**: ✅ **PRODUCTION**  
**Scanner**: `scripts/breakout-scanner.js` → `analyzeStock()`  
**Method**: `EnhancedBreakoutScanner.saveBearishSignal()`

| Aspect | Details |
|--------|---------|
| **Input Table** | `kite_nse_equity_symbols` (symbols)<br>`historical_prices_nse_equity` (candles) |
| **Output Table** | `bearish_breakout_nse_eq` |
| **API Endpoint** | `GET /api/signals/bearish` |
| **Frontend Route** | `/screener/intraday-bearish` |
| **Card Label** | "NSE Bearish Breakdown" |
| **Timeframe** | 5-minute (intraday) |
| **Min Confidence** | 30% (criteria_met ≤ 2) |
| **Pattern Detection** | ✅ Enabled |

**Key Columns**: Same as bullish

---

### Strategy 3: Swing Positional Bullish (NSE, 1-15 days)
**Status**: ✅ **PRODUCTION**  
**Scanner**: `scripts/breakout-scanner.js` → `analyzeSwingPositional()`  
**Method**: `EnhancedBreakoutScanner.saveSwingPositionalSignal()`

| Aspect | Details |
|--------|---------|
| **Input Table** | `kite_nse_equity_symbols` (top 1000)<br>`historical_prices_nse_equity` (daily candles) |
| **Output Table** | `swing_positional_bullish` |
| **API Endpoint** | `GET /api/signals/swing-positional` |
| **Frontend Route** | `/screener/swing-positional-bullish` |
| **Card Label** | "Swing Positional Equity Bullish (1-15 days)" |
| **Timeframe** | Daily |
| **Min Confidence** | 70% (criteria_met ≥ 5) |
| **Pattern Detection** | ⚠️ Not yet integrated |

**Key Columns**:
```sql
symbol, signal_type, probability, criteria_met, daily_ema20, daily_sma50, 
rsi_value, volume_ratio, weekly_volatility, current_price, target_price, 
stop_loss, detected_patterns, strongest_pattern, pattern_confidence
```

---

### Strategy 4: Swing Positional Bearish (NSE, 1-15 days)
**Status**: ✅ **PRODUCTION**  
**Scanner**: `scripts/breakout-scanner.js` → `analyzeSwingPositionalBearish()`  
**Method**: `EnhancedBreakoutScanner.saveSwingPositionalBearishSignal()`

| Aspect | Details |
|--------|---------|
| **Input Table** | `kite_nse_equity_symbols` (top 1000)<br>`historical_prices_nse_equity` (daily candles) |
| **Output Table** | `swing_positional_bearish` |
| **API Endpoint** | `GET /api/signals/swing-positional-bearish` |
| **Frontend Route** | `/screener/swing-positional-bearish` |
| **Card Label** | "Swing Positional Equity Bearish (1-15 days)" |
| **Timeframe** | Daily |
| **Min Confidence** | 70% (criteria_met ≥ 5) |
| **Pattern Detection** | ⚠️ Not yet integrated |

**Key Columns**: Same as swing bullish

---

## 📊 BSE EQUITY (Cash Market)

### Strategy 5: BSE Bullish Breakout (Intraday)
**Status**: ❌ **NOT IMPLEMENTED**  
**Scanner**: ❌ Needs creation  
**Method**: ❌ `DatabaseClient.saveBseBullishSignal()`

| Aspect | Details |
|--------|---------|
| **Input Table** | `kite_bse_equity_symbols` (symbols)<br>`historical_prices_bse_equity` (candles) |
| **Output Table** | `bullish_breakout_bse_eq` |
| **API Endpoint** | ❌ `GET /api/signals/bse-bullish` |
| **Frontend Route** | `/screener/bse-bullish` |
| **Card Label** | "BSE Bullish Breakout" |
| **Timeframe** | 5-minute (intraday) |
| **Min Confidence** | 60% (criteria_met ≥ 5) |
| **Pattern Detection** | ❌ Needs implementation |

**Implementation Notes**:
- Clone NSE equity breakout logic EXACTLY
- Use BSE symbol table and historical data
- Same criteria, same scoring, same pattern detection

**Key Columns**:
```sql
symbol, instrument_token, entry_price, ema20_5min, rsi14_5min, volume, 
avg_volume, candle_time, target1, target2, stop_loss, probability, 
criteria_met, is_active
```

---

### Strategy 6: BSE Bearish Breakdown (Intraday)
**Status**: ❌ **NOT IMPLEMENTED**  
**Scanner**: ❌ Needs creation  
**Method**: ❌ `DatabaseClient.saveBseBearishSignal()`

| Aspect | Details |
|--------|---------|
| **Input Table** | `kite_bse_equity_symbols` (symbols)<br>`historical_prices_bse_equity` (candles) |
| **Output Table** | `bearish_breakout_bse_eq` |
| **API Endpoint** | ❌ `GET /api/signals/bse-bearish` |
| **Frontend Route** | `/screener/bse-bearish` |
| **Card Label** | "BSE Bearish Breakdown" |
| **Timeframe** | 5-minute (intraday) |
| **Min Confidence** | 30% (criteria_met ≤ 2) |
| **Pattern Detection** | ❌ Needs implementation |

**Key Columns**: Same as BSE bullish

---

## 📊 INDICES (NIFTY / BANKNIFTY)

### Strategy 7: Intraday Index (NIFTY / BANKNIFTY)
**Status**: ✅ **PRODUCTION**  
**Scanner**: `scripts/breakout-scanner.js` → `analyzeIntradayIndex()`  
**Method**: `EnhancedBreakoutScanner.saveIntradayIndexSignal()`

| Aspect | Details |
|--------|---------|
| **Input Table** | `historical_prices_nse_equity` (for NIFTY/BANKNIFTY)<br>or `historical_prices_nse_fo` (index futures) |
| **Output Table** | `intraday_index_signals` |
| **API Endpoint** | `GET /api/signals/intraday-index` |
| **Frontend Route** | `/screener/intraday-index` |
| **Card Label** | "Intraday Index (NIFTY / BANKNIFTY)" |
| **Timeframe** | 5-minute (intraday) |
| **Symbols** | NIFTY, BANKNIFTY |
| **Pattern Detection** | ⚠️ Not yet integrated |

**Key Columns**:
```sql
symbol, signal_type, entry_price, ema20_5min, swing_reference_price, 
distance_from_swing, target1, target2, stop_loss, candle_time, 
signal_direction, is_active
```

**Logic**:
- **BUY**: Price > EMA20 AND distance from swing low ≤ 150 points
- **SELL**: Price < EMA20 AND distance from swing high ≤ 150 points

---

### Strategy 8: Swing Positional Index (NIFTY / BANKNIFTY)
**Status**: ✅ **PRODUCTION**  
**Scanner**: `scripts/breakout-scanner.js` → `analyzeSwingPositionalIndex()`  
**Method**: `EnhancedBreakoutScanner.saveSwingPositionalIndexSignal()`

| Aspect | Details |
|--------|---------|
| **Input Table** | `historical_prices_nse_equity` (1H, 4H, Daily aggregations) |
| **Output Table** | `swing_positional_index_signals` |
| **API Endpoint** | `GET /api/signals/swing-index` |
| **Frontend Route** | `/screener/swing-index` |
| **Card Label** | "Swing Positional Index (NIFTY / BANKNIFTY)" |
| **Timeframe** | Multi-timeframe (1H, 4H, Daily) |
| **Symbols** | NIFTY, BANKNIFTY |
| **Pattern Detection** | ⚠️ Not yet integrated |

**Key Columns**:
```sql
symbol, signal_type, signal_direction, entry_price, ema20_1h, ema20_4h, 
ema20_1d, rsi9_daily, rsi14_daily, is_above_ema_1h, is_above_ema_4h, 
is_above_ema_1d, signal_start_date, signal_age_days, is_active
```

**Logic**:
- **LONG**: Price above ALL EMAs + RSI 50-80
- **SHORT**: Price below ALL EMAs + RSI 20-50

---

## 📊 NSE F&O (Futures & Options)

### Strategy 9: NSE F&O Breakout
**Status**: ❌ **NOT IMPLEMENTED**  
**Scanner**: ❌ Needs creation  
**Method**: ❌ `DatabaseClient.saveNseFoSignal()`

| Aspect | Details |
|--------|---------|
| **Input Table** | `kite_nse_fo_symbols` (instruments)<br>`historical_prices_nse_fo` (candles) |
| **Output Table** | `nse_fo_signals` |
| **API Endpoint** | ❌ `GET /api/signals/nse-fo` |
| **Frontend Route** | `/screener/nifty-fo` |
| **Card Label** | "NIFTY F&O" |
| **Timeframe** | 5-minute (intraday) |
| **Instruments** | Futures + Options (filtered) |
| **Pattern Detection** | ❌ Needs implementation |

**Key Columns**:
```sql
symbol, instrument_token, underlying, instrument_type, expiry, strike, 
option_type, signal_type, entry_price, ema20_5min, rsi14_5min, volume, 
avg_volume, candle_time, target1, target2, stop_loss, probability, 
criteria_met, is_active
```

**Implementation Notes**:
- Filter near-month expiries only
- For options: ATM ± 5 strikes
- Include Open Interest analysis
- Separate signals by instrument_type (FUT/CE/PE)

---

### Strategy 10: BANKNIFTY F&O Breakout
**Status**: ❌ **NOT IMPLEMENTED**  
**Scanner**: ❌ Needs creation  
**Method**: ❌ `DatabaseClient.saveBankniftyFoSignal()`

| Aspect | Details |
|--------|---------|
| **Input Table** | `kite_nse_fo_symbols` (underlying='BANKNIFTY')<br>`historical_prices_nse_fo` (candles) |
| **Output Table** | `banknifty_fo_signals` |
| **API Endpoint** | ❌ `GET /api/signals/banknifty-fo` |
| **Frontend Route** | `/screener/banknifty-fo` |
| **Card Label** | "BANKNIFTY F&O" |
| **Timeframe** | 5-minute (intraday) |
| **Instruments** | BANKNIFTY Futures + Options |
| **Pattern Detection** | ❌ Needs implementation |

**Key Columns**: Same as NSE F&O

**Implementation Notes**:
- Dedicated table for BANKNIFTY (high volume)
- Link with BANKNIFTY index signals for confidence boost
- Prioritize ATM options

---

## 📊 BSE F&O (Futures & Options)

### Strategy 11: BSE F&O Breakout
**Status**: ❌ **NOT IMPLEMENTED**  
**Scanner**: ❌ Needs creation  
**Method**: ❌ `DatabaseClient.saveBseFoSignal()`

| Aspect | Details |
|--------|---------|
| **Input Table** | `kite_bse_fo_symbols` (instruments)<br>`historical_prices_bse_fo` (candles) |
| **Output Table** | `bse_fo_signals` |
| **API Endpoint** | ❌ `GET /api/signals/bse-fo` |
| **Frontend Route** | `/screener/bse-fo` |
| **Card Label** | "BSE F&O" |
| **Timeframe** | 5-minute (intraday) |
| **Instruments** | SENSEX/BANKEX Futures + Options |
| **Pattern Detection** | ❌ Needs implementation |

**Key Columns**: Same as NSE F&O (with BSE-specific underlyings)

---

## 🗺️ COMPLETE MAPPING TABLE

| # | Strategy | Status | Input Tables | Output Table | API Route | Frontend Route |
|---|----------|--------|--------------|--------------|-----------|----------------|
| 1 | NSE Bullish | ✅ Live | `kite_nse_equity_symbols`<br>`historical_prices_nse_equity` | `bullish_breakout_nse_eq` | `/api/signals/bullish` | `/screener/intraday-bullish` |
| 2 | NSE Bearish | ✅ Live | `kite_nse_equity_symbols`<br>`historical_prices_nse_equity` | `bearish_breakout_nse_eq` | `/api/signals/bearish` | `/screener/intraday-bearish` |
| 3 | Swing Bull | ✅ Live | `kite_nse_equity_symbols`<br>`historical_prices_nse_equity` | `swing_positional_bullish` | `/api/signals/swing-positional` | `/screener/swing-positional-bullish` |
| 4 | Swing Bear | ✅ Live | `kite_nse_equity_symbols`<br>`historical_prices_nse_equity` | `swing_positional_bearish` | `/api/signals/swing-positional-bearish` | `/screener/swing-positional-bearish` |
| 5 | BSE Bullish | ❌ Missing | `kite_bse_equity_symbols`<br>`historical_prices_bse_equity` | `bullish_breakout_bse_eq` | ❌ Missing | `/screener/bse-bullish` |
| 6 | BSE Bearish | ❌ Missing | `kite_bse_equity_symbols`<br>`historical_prices_bse_equity` | `bearish_breakout_bse_eq` | ❌ Missing | `/screener/bse-bearish` |
| 7 | Index Intraday | ✅ Live | `historical_prices_nse_equity` | `intraday_index_signals` | `/api/signals/intraday-index` | `/screener/intraday-index` |
| 8 | Index Swing | ✅ Live | `historical_prices_nse_equity` | `swing_positional_index_signals` | `/api/signals/swing-index` | `/screener/swing-index` |
| 9 | NSE F&O | ❌ Missing | `kite_nse_fo_symbols`<br>`historical_prices_nse_fo` | `nse_fo_signals` | ❌ Missing | `/screener/nifty-fo` |
| 10 | BANKNIFTY F&O | ❌ Missing | `kite_nse_fo_symbols`<br>`historical_prices_nse_fo` | `banknifty_fo_signals` | ❌ Missing | `/screener/banknifty-fo` |
| 11 | BSE F&O | ❌ Missing | `kite_bse_fo_symbols`<br>`historical_prices_bse_fo` | `bse_fo_signals` | ❌ Missing | `/screener/bse-fo` |

---

## 📐 TECHNICAL INDICATOR REFERENCE

### Used by ALL Strategies

| Indicator | Function | Period | Usage |
|-----------|----------|--------|-------|
| **EMA (Exponential Moving Average)** | `calculateEMA(prices, period)` | 20 | Trend direction |
| **SMA (Simple Moving Average)** | `calculateSMA(prices, period)` | 50 | Long-term trend (swing only) |
| **RSI (Relative Strength Index)** | `calculateRSI(prices, period)` | 14 | Momentum |
| **Volume Ratio** | `calculateVolumeRatio(dailyCandles)` | - | Volume spike detection |
| **Weekly Volatility** | `calculateWeeklyVolatility(dailyCandles)` | 7 days | Swing filter |
| **Yearly Volume Ratio** | `calculateYearlyVolumeRatio(dailyCandles)` | 365 days | Swing filter |

### Pattern Detection

| Module | Function | Returns |
|--------|----------|---------|
| **PatternDetector** | `detectAllPatterns(candles)` | `{patterns: [], strongest: {}, confidence: number}` |

**Patterns Supported**:
- Candlestick: Doji, Hammer, Shooting Star, Engulfing, Harami
- Triangle: Ascending, Descending, Symmetric
- Reversal: Head & Shoulders, Double Top/Bottom
- Continuation: Flags, Pennants
- Consolidation: Range-bound

---

## 🔄 DATA FLOW

```
1. Symbol Load
   ↓
   kite_{exchange}_{segment}_symbols
   ↓
   Filter active symbols (limit 1000)

2. Historical Data Fetch
   ↓
   historical_prices_{exchange}_{segment}
   ↓
   Cache (5 min TTL)

3. Technical Analysis
   ↓
   calculateEMA/SMA/RSI/Volume
   ↓
   Pattern Detection (optional)
   ↓
   Criteria Scoring (1-6 points)

4. Signal Generation
   ↓
   IF criteria_met >= threshold
   ↓
   Save to {strategy}_signals table

5. API Exposure
   ↓
   GET /api/signals/{strategy}
   ↓
   Redis Cache (60s TTL)
   ↓
   Frontend Card Display
```

---

## 🛠️ IMPLEMENTATION CHECKLIST

### For Each New Strategy

- [ ] **Scanner Logic**
  - [ ] Create/update scanner file
  - [ ] Implement analyze{Strategy}() method
  - [ ] Add pattern detection
  - [ ] Add save{Strategy}Signal() method
  - [ ] Test with sample data

- [ ] **Database**
  - [ ] Verify output table exists
  - [ ] Check all columns present
  - [ ] Add RLS policies
  - [ ] Create indexes

- [ ] **API**
  - [ ] Create `/api/signals/{strategy}/route.ts`
  - [ ] Add caching logic
  - [ ] Test with Postman/curl
  - [ ] Add error handling

- [ ] **Frontend**
  - [ ] Update card in `screener/page.tsx`
  - [ ] Add route mapping in `ScreenerCard.tsx`
  - [ ] Create detail page (if needed)
  - [ ] Test navigation

- [ ] **Documentation**
  - [ ] Update this mapping doc
  - [ ] Add strategy to README
  - [ ] Document criteria
  - [ ] Add code comments

---

## 📚 RELATED DOCUMENTATION

- [Complete System Analysis](./COMPLETE-SYSTEM-ANALYSIS.md)
- [Historical Prices Schema](./HISTORICAL-PRICES-SCHEMA.md)
- [Pattern Detection System](./PATTERN-DETECTION-SYSTEM.md)
- [Deployment Checklist](./DEPLOYMENT-CHECKLIST.md)

---

_Last Updated: January 28, 2026_
