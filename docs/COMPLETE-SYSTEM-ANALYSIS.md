# Complete System Architecture Analysis & Production Roadmap

**Date**: January 28, 2026  
**Analyst**: Senior Quant Engineer + Full-Stack Architect  
**Scope**: finance_ai Trading Signal System

---

## 📋 EXECUTIVE SUMMARY

### System Purpose
Real-time trading signal generation and delivery platform covering multiple market segments:
- **NSE Equity** (Cash market)
- **BSE Equity** (Cash market)
- **NSE F&O** (Futures & Options)
- **BSE F&O** (Futures & Options)
- **Indices** (NIFTY, BANKNIFTY - Intraday & Swing)

### Current State
✅ **PRODUCTION-READY**:
- NSE Equity Bullish/Bearish Breakout (Intraday)
- Swing Positional Bullish/Bearish (NSE Equity)
- Intraday Index (NIFTY/BANKNIFTY)
- Swing Positional Index (NIFTY/BANKNIFTY)

⚠️ **PARTIALLY IMPLEMENTED**:
- Pattern detection (integrated but not fully utilized across all strategies)
- Historical price tables (migration created but not fully integrated)

❌ **NOT IMPLEMENTED**:
- BSE Equity Breakout scanners (bullish/bearish)
- NSE F&O scanners
- BSE F&O scanners
- BankNifty constituent filtering
- AI validation hooks (structure exists but not connected)

---

## 🏗️ ARCHITECTURE OVERVIEW

### 1. **Database Layer**

#### **Signal Tables** (Output)
| Table Name | Purpose | Status | Records Expected |
|-----------|---------|--------|------------------|
| `bullish_breakout_nse_eq` | NSE equity bullish signals | ✅ Active | ~50-200/day |
| `bearish_breakout_nse_eq` | NSE equity bearish signals | ✅ Active | ~50-200/day |
| `swing_positional_bullish` | Swing bullish (NSE EQ) | ✅ Active | ~20-50/day |
| `swing_positional_bearish` | Swing bearish (NSE EQ) | ✅ Active | ~20-50/day |
| `intraday_index_signals` | Index intraday (NIFTY/BANKNIFTY) | ✅ Active | ~10-30/day |
| `swing_positional_index_signals` | Index swing (NIFTY/BANKNIFTY) | ✅ Active | ~2-5/day |
| `bullish_breakout_bse_eq` | BSE equity bullish | ❌ Placeholder | 0 |
| `bearish_breakout_bse_eq` | BSE equity bearish | ❌ Placeholder | 0 |
| `nse_fo_signals` | NSE F&O signals | ❌ Placeholder | 0 |
| `bse_fo_signals` | BSE F&O signals | ❌ Placeholder | 0 |
| `banknifty_fo_signals` | BANKNIFTY F&O signals | ❌ Placeholder | 0 |

#### **Symbol Tables** (Reference Data)
| Table Name | Purpose | Status | Record Count |
|-----------|---------|--------|--------------|
| `kite_nse_equity_symbols` | NSE stocks metadata | ✅ Active | ~2000+ |
| `kite_bse_equity_symbols` | BSE stocks metadata | ✅ Active | ~1000+ |
| `kite_nse_fo_symbols` | NSE F&O instruments | ✅ Active | ~5000+ |
| `kite_bse_fo_symbols` | BSE F&O instruments | ✅ Active | ~2000+ |

#### **Historical Price Tables** (Input Data)
| Table Name | Purpose | Status | Records Expected |
|-----------|---------|--------|------------------|
| `historical_prices_nse_equity` | 5-min NSE EQ candles | ⚠️ Migration ready | ~5M (3 months) |
| `historical_prices_bse_equity` | 5-min BSE EQ candles | ⚠️ Migration ready | ~5M (3 months) |
| `historical_prices_nse_fo` | 5-min NSE F&O candles | ⚠️ Migration ready | ~5M (3 months) |
| `historical_prices_bse_fo` | 5-min BSE F&O candles | ⚠️ Migration ready | ~5M (3 months) |

**Note**: Migration files created but tables not yet populated with data.

---

### 2. **Scanner Layer** (Backend)

#### **Main Scanner**: `scripts/breakout-scanner.js` (1819 lines)

**Architecture**:
```
EnhancedBreakoutScanner
├── DatabaseClient (Supabase integration)
│   ├── getNseTop1000Symbols()
│   ├── getHistoricalData()
│   ├── getDailyCandles()
│   ├── getHourlyCandles()
│   ├── getFourHourCandles()
│   └── Save methods (per strategy)
├── ZerodhaTickerManager (Real-time tick data)
│   ├── WebSocket connection to Kite
│   ├── Tick aggregation (5-min candles)
│   └── Symbol subscription (1000 stocks)
└── TechnicalAnalyzer (Indicators & Strategies)
    ├── calculateEMA(period)
    ├── calculateSMA(period)
    ├── calculateRSI(period)
    ├── calculateWeeklyVolatility()
    ├── analyzeStock() [Intraday Breakout]
    ├── analyzeSwingPositional() [Swing Bullish]
    ├── analyzeSwingPositionalBearish() [Swing Bearish]
    ├── analyzeIntradayIndex() [Index Intraday]
    └── analyzeSwingPositionalIndex() [Index Swing]
```

**Strengths**:
- ✅ Mature, battle-tested codebase
- ✅ Real-time WebSocket integration
- ✅ Efficient caching (memory + Redis)
- ✅ Pattern detection integrated
- ✅ All technical indicators implemented
- ✅ Proper error handling & logging

**Limitations**:
- ❌ Monolithic (1819 lines in one file)
- ❌ Only handles NSE equity + indices
- ❌ No BSE or F&O support
- ❌ Hard to extend for new strategies

---

### 3. **Pattern Detection Layer**

#### **Module**: `scripts/pattern-detector.js` (825 lines)

**Capabilities**:
| Pattern Type | Patterns Detected | Status |
|-------------|-------------------|--------|
| **Candlestick** | Doji, Hammer, Shooting Star, Engulfing, Harami, Hanging Man | ✅ Implemented |
| **Triangle** | Ascending, Descending, Symmetric | ✅ Implemented |
| **Reversal** | Head & Shoulders, Double Top/Bottom | ✅ Implemented |
| **Continuation** | Flags, Pennants | ✅ Implemented |
| **Consolidation** | Range-bound detection | ✅ Implemented |

**Output Structure**:
```javascript
{
  patterns: [...],
  strongest: {
    pattern: "BULLISH_ENGULFING",
    direction: "bullish",
    confidence: 85,
    type: "candlestick"
  },
  confidence: 82
}
```

**Integration Status**:
- ✅ Called in `analyzeStock()` for NSE equity
- ✅ Stored in `detected_patterns`, `strongest_pattern`, `pattern_confidence` columns
- ⚠️ Not yet integrated with swing/index strategies
- ⚠️ Not used for BSE/F&O (doesn't exist yet)

---

### 4. **API Layer** (Frontend Integration)

#### **Signal API Routes** (`src/app/api/signals/`)

| Route | Table | Status | Cache TTL |
|-------|-------|--------|-----------|
| `/api/signals/bullish` | `bullish_breakout_nse_eq` | ✅ Active | 60s |
| `/api/signals/bearish` | `bearish_breakout_nse_eq` | ✅ Active | 60s |
| `/api/signals/swing-positional` | `swing_positional_bullish` | ✅ Active | 60s |
| `/api/signals/swing-positional-bearish` | `swing_positional_bearish` | ✅ Active | 60s |
| `/api/signals/intraday-index` | `intraday_index_signals` | ✅ Active | 60s |
| `/api/signals/swing-index` | `swing_positional_index_signals` | ✅ Active | 60s |
| `/api/signals/bse-bullish` | N/A | ❌ Missing | - |
| `/api/signals/bse-bearish` | N/A | ❌ Missing | - |
| `/api/signals/nse-fo` | N/A | ❌ Missing | - |
| `/api/signals/bse-fo` | N/A | ❌ Missing | - |
| `/api/signals/banknifty-fo` | N/A | ❌ Missing | - |

**Common Pattern**:
```typescript
GET /api/signals/{strategy}?minutesAgo=15&minProbability=0.6&limit=50
→ Returns: { success, count, signals, cached }
```

---

### 5. **Frontend Layer** (UI Cards)

#### **Main Dashboard**: `src/app/(with-sidebar)/screener/page.tsx`

**Card System**:
```tsx
<ScreenerCard
  label="NSE Bullish Breakout"
  symbols={bullishCount}
  tags={["Bullish"]}
  image="/images/bullish.jpg"
/>
```

**Current Card Mapping**:

| Card Label | Route | Data Source | Status |
|-----------|-------|-------------|--------|
| NSE Bullish Breakout | `/screener/intraday-bullish` | `bullish_breakout_nse_eq` | ✅ Live |
| NSE Bearish Breakdown | `/screener/intraday-bearish` | `bearish_breakout_nse_eq` | ✅ Live |
| Swing Positional Bullish (1-15 days) | `/screener/swing-positional-bullish` | `swing_positional_bullish` | ✅ Live |
| Swing Positional Bearish (1-15 days) | `/screener/swing-positional-bearish` | `swing_positional_bearish` | ✅ Live |
| Intraday Index (NIFTY/BANKNIFTY) | `/screener/intraday-index` | `intraday_index_signals` | ✅ Live |
| Swing Positional Index (NIFTY/BANKNIFTY) | `/screener/swing-index` | `swing_positional_index_signals` | ✅ Live |
| BSE Bullish Breakout | `/screener/bse-bullish` | ❌ No data | ⚠️ Placeholder |
| BSE Bearish Breakdown | `/screener/bse-bearish` | ❌ No data | ⚠️ Placeholder |
| NIFTY F&O | `/screener/nifty-fo` | ❌ No data | ⚠️ Placeholder |
| BANKNIFTY F&O | `/screener/banknifty-fo` | ❌ No data | ⚠️ Placeholder |
| BSE F&O | `/screener/bse-fo` | ❌ No data | ⚠️ Placeholder |

---

## 📊 STRATEGY REFERENCE (COMPLETE)

### **STRATEGY 1: NSE Equity Bullish Breakout** ✅

**Criteria** (6 total, need ≥5 for signal):
1. ✅ Stock in NIFTY 250/500 universe
2. ✅ Price > Daily 20 EMA
3. ✅ Price > 5-min 20 EMA
4. ✅ Volume > 1.5× average
5. ✅ Open ≤ Close (bullish candle)
6. ✅ RSI(14) between 50-80

**Output**: `bullish_breakout_nse_eq`  
**Confidence**: 60%+ required  
**Pattern Detection**: ✅ Enabled

---

### **STRATEGY 2: NSE Equity Bearish Breakdown** ✅

**Criteria** (6 total, need ≤2 for signal):
1. Stock in NIFTY 250/500 universe (inverted)
2. Price BELOW Daily 20 EMA
3. Price BELOW 5-min 20 EMA
4. Volume condition (inverted)
5. Open > Close (bearish candle)
6. RSI outside 50-80

**Output**: `bearish_breakout_nse_eq`  
**Confidence**: 30%+ required (inverse logic)  
**Pattern Detection**: ✅ Enabled

---

### **STRATEGY 3: Swing Positional Bullish (NSE)** ✅

**Criteria** (6 total, need ≥5 for signal):
1. ✅ Top 1000 stocks by market cap
2. ✅ Price > Daily 20 EMA
3. ✅ Price > Daily 50 SMA
4. ✅ RSI(14) between 50-80
5. ✅ Volume ≥ 2× yearly average
6. ✅ Weekly volatility 1-5%

**Timeframe**: 1-15 days  
**Output**: `swing_positional_bullish`  
**Confidence**: 70%+ required  
**Pattern Detection**: ⚠️ Not yet integrated

---

### **STRATEGY 4: Swing Positional Bearish (NSE)** ✅

**Criteria** (6 total, need ≥5 for signal):
1. ✅ Top 1000 stocks by market cap
2. ✅ Price BELOW Daily 20 EMA
3. ✅ Price BELOW Daily 50 SMA
4. ✅ RSI(14) between 20-50
5. ✅ Volume ≥ 2× yearly average
6. ✅ Weekly volatility 1-5%

**Timeframe**: 1-15 days  
**Output**: `swing_positional_bearish`  
**Confidence**: 70%+ required  
**Pattern Detection**: ⚠️ Not yet integrated

---

### **STRATEGY 5: BSE Equity Breakout (Bullish/Bearish)** ❌

**Status**: NOT IMPLEMENTED  
**Requirements**:
- Clone NSE equity logic EXACTLY
- Change data sources:
  - Symbols: `kite_bse_equity_symbols`
  - Historical: `historical_prices_bse_equity`
  - Output: `bullish_breakout_bse_eq` / `bearish_breakout_bse_eq`
- Pattern detection: MUST INCLUDE
- Same criteria scoring as NSE

---

### **STRATEGY 6: Intraday Index (NIFTY/BANKNIFTY)** ✅

**BUY Criteria**:
- Price > 5-min 20 EMA
- Distance from swing low ≤ 150 points
- Target1: +50 points
- Target2: +75 points
- Stop Loss: Swing low

**SELL Criteria**:
- Price < 5-min 20 EMA
- Distance from swing high ≤ 150 points
- Target1: -50 points
- Target2: -75 points
- Stop Loss: Swing high

**Output**: `intraday_index_signals`  
**Pattern Detection**: ⚠️ Not yet integrated

---

### **STRATEGY 7: Swing Positional Index (NIFTY/BANKNIFTY)** ✅

**LONG Criteria**:
- Price > 20 EMA on 1H, 4H, Daily
- RSI(9) & RSI(14) between 50-80

**SHORT Criteria**:
- Price < 20 EMA on 1H, 4H, Daily
- RSI(9) & RSI(14) between 20-50

**Output**: `swing_positional_index_signals`  
**Pattern Detection**: ⚠️ Not yet integrated

---

### **STRATEGY 8: NSE F&O Breakout** ❌

**Status**: NOT IMPLEMENTED  
**Requirements**:
- Similar logic to equity breakout
- Additional fields: `underlying`, `instrument_type`, `expiry`, `strike`, `option_type`
- Data source: `historical_prices_nse_fo`
- Output: `nse_fo_signals`
- Filter: Focus on near-month expiries only

---

### **STRATEGY 9: BANKNIFTY F&O Specific** ❌

**Status**: NOT IMPLEMENTED  
**Requirements**:
- Filter BANKNIFTY options/futures specifically
- Output: `banknifty_fo_signals`
- Link with BankNifty index signals for confidence boost

---

### **STRATEGY 10: BSE F&O Breakout** ❌

**Status**: NOT IMPLEMENTED  
**Requirements**:
- Similar to NSE F&O
- Data source: `historical_prices_bse_fo`
- Output: `bse_fo_signals`

---

## 🔍 GAP ANALYSIS

### Critical Gaps

| Gap # | Issue | Impact | Priority |
|-------|-------|--------|----------|
| 1 | **BSE Equity Scanners Missing** | 2 cards show "0 symbols" | 🔴 HIGH |
| 2 | **All F&O Scanners Missing** | 3 cards show "0 symbols" | 🔴 HIGH |
| 3 | **Historical Price Tables Empty** | Scanners use old `historical_prices` table | 🔴 HIGH |
| 4 | **Pattern Detection Incomplete** | Only NSE EQ intraday has patterns | 🟡 MEDIUM |
| 5 | **Monolithic Scanner** | Hard to extend for new strategies | 🟡 MEDIUM |
| 6 | **No BankNifty Constituent Filter** | Missing optimization opportunity | 🟢 LOW |
| 7 | **AI Validation Hooks Unused** | Columns exist but not populated | 🟢 LOW |

---

## 🎯 PRODUCTION ROADMAP

### Phase 1: Data Infrastructure (Week 1) 🔴

**Objective**: Populate historical price tables with 3 months of data

**Tasks**:
1. ✅ Run migration: `20260128_rename_historical_prices_table.sql`
2. ✅ Run migrations for BSE/F&O tables
3. ❌ Create data ingestion script for NSE equity (5-min candles)
4. ❌ Create data ingestion script for BSE equity
5. ❌ Create data ingestion script for NSE F&O
6. ❌ Create data ingestion script for BSE F&O
7. ❌ Backfill 3 months of data
8. ❌ Update scanner to use new table names

**Blockers**:
- Data source for historical prices (Zerodha Historical API? TrueData?)
- Storage cost validation (~4GB per quarter)

---

### Phase 2: Shared Utilities Module (Week 1-2) 🟡

**Objective**: Extract reusable logic from monolithic scanner

**Create**: `scripts/utils/`
```
utils/
├── indicators.js         # EMA, SMA, RSI, etc.
├── pattern-detector.js   # (move existing)
├── database-client.js    # Supabase operations
├── ticker-manager.js     # Zerodha WebSocket
├── strategy-base.js      # Base class for strategies
└── config.js             # Shared config
```

**Benefits**:
- ✅ Code reusability across scanners
- ✅ Easier testing
- ✅ Faster development of new strategies

---

### Phase 3: BSE Equity Scanners (Week 2) 🔴

**Objective**: Clone NSE equity logic for BSE

**Create**: `scripts/bse-equity-scanner.js`

**Tasks**:
1. ❌ Clone `analyzeStock()` → `analyzeBseStock()`
2. ❌ Update data sources:
   - `kite_bse_equity_symbols`
   - `historical_prices_bse_equity`
3. ❌ Implement save methods:
   - `saveBseBullishSignal()`
   - `saveBseBearishSignal()`
4. ❌ Add pattern detection
5. ❌ Create API routes:
   - `/api/signals/bse-bullish`
   - `/api/signals/bse-bearish`
6. ❌ Update frontend cards

**Estimated Signals**: 20-50 bullish, 20-50 bearish per day

---

### Phase 4: F&O Scanners (Week 3-4) 🔴

**Objective**: Implement F&O breakout strategies

**Create**:
- `scripts/nse-fo-scanner.js`
- `scripts/bse-fo-scanner.js`
- `scripts/banknifty-fo-scanner.js`

**Tasks**:
1. ❌ Design F&O-specific criteria:
   - Open Interest analysis
   - IV (Implied Volatility) integration
   - Near-month expiry filter
   - Strike selection logic
2. ❌ Implement scanners
3. ❌ Create API routes
4. ❌ Update frontend cards

**Challenges**:
- F&O data has more dimensions (strike, expiry, option type)
- Need to filter noise (focus on ATM ± 5 strikes)
- Open Interest data source?

---

### Phase 5: Pattern Detection Integration (Week 4) 🟡

**Objective**: Add pattern detection to ALL strategies

**Tasks**:
1. ❌ Integrate patterns into swing positional strategies
2. ❌ Integrate patterns into index strategies
3. ❌ Integrate patterns into BSE equity
4. ❌ Integrate patterns into F&O
5. ❌ Update all save methods to store pattern data
6. ❌ Frontend: Display patterns in signal cards

---

### Phase 6: BankNifty Constituent Optimization (Week 5) 🟢

**Objective**: Boost confidence for BankNifty stocks

**Tasks**:
1. ❌ Create `banknifty_constituents` table
2. ❌ Add confidence boost logic in scanners
3. ❌ Filter BankNifty F&O to top constituents only

---

### Phase 7: Production Hardening (Week 5-6) 🔴

**Objective**: Make system production-safe

**Tasks**:
1. ❌ Add comprehensive error handling
2. ❌ Implement logging to `auto_fetch_logs`
3. ❌ Create health check endpoints
4. ❌ Add monitoring & alerting
5. ❌ Document all scanners
6. ❌ Load testing
7. ❌ Security audit

---

## 🚀 IMPLEMENTATION PRIORITIES

### Immediate (This Week)
1. 🔴 **Historical price table migrations** (BLOCKING)
2. 🔴 **Data ingestion for NSE/BSE equity** (BLOCKING)
3. 🔴 **BSE equity scanners** (HIGH IMPACT)

### Short-term (Next 2 Weeks)
4. 🟡 **Shared utilities module** (QUALITY)
5. 🔴 **NSE F&O scanner** (HIGH IMPACT)
6. 🔴 **API routes for BSE/F&O** (FRONTEND INTEGRATION)

### Medium-term (Next Month)
7. 🟡 **Pattern detection integration** (VALUE ADD)
8. 🔴 **BANKNIFTY F&O scanner** (HIGH IMPACT)
9. 🔴 **BSE F&O scanner** (COMPLETENESS)

### Long-term (Next Quarter)
10. 🟢 **AI validation integration** (FUTURE)
11. 🟢 **BankNifty optimization** (OPTIMIZATION)
12. 🟢 **Advanced pattern signals** (ENHANCEMENT)

---

## ❓ CRITICAL QUESTIONS FOR USER

### Data Infrastructure
1. **Historical Data Source**: Where should we fetch 3 months of 5-min candles from?
   - Zerodha Historical API?
   - TrueData?
   - Pre-existing CSV files?

2. **Storage Budget**: Are we OK with ~4GB database growth per quarter?

3. **Data Backfill**: Should we backfill immediately or gradually over time?

### F&O Strategy
4. **F&O Criteria**: Should F&O use same breakout logic as equity, or different?
   - Include Open Interest analysis?
   - Include IV (Implied Volatility)?

5. **Strike Selection**: For options, how do we filter strikes?
   - ATM only?
   - ATM ± 5 strikes?

6. **Expiry Filter**: Should we focus only on near-month expiries?

### Scanner Architecture
7. **Scanner Deployment**: Should all scanners run in one process or separate?
   - Monolithic (current): One scanner handles all
   - Microservices: Separate scanner per segment

8. **Real-time vs Batch**: 
   - Real-time (WebSocket) for all segments?
   - Or batch processing for swing/positional?

---

## 📁 DELIVERABLES

Once approved, I will deliver:

### Code Artifacts
1. ✅ Historical price migrations (DONE)
2. ❌ Shared utilities module (`scripts/utils/`)
3. ❌ BSE equity scanner (`scripts/bse-equity-scanner.js`)
4. ❌ NSE F&O scanner (`scripts/nse-fo-scanner.js`)
5. ❌ BSE F&O scanner (`scripts/bse-fo-scanner.js`)
6. ❌ BANKNIFTY F&O scanner (`scripts/banknifty-fo-scanner.js`)
7. ❌ API routes (6 new routes)
8. ❌ Frontend card integrations

### Documentation
1. ✅ Complete system analysis (THIS DOC)
2. ❌ Scanner development guide
3. ❌ API integration guide
4. ❌ Deployment runbook
5. ❌ Troubleshooting guide

### Testing
1. ❌ Unit tests for indicators
2. ❌ Integration tests for scanners
3. ❌ Load testing scripts
4. ❌ E2E frontend tests

---

## 🎓 RECOMMENDATIONS

### Architecture
1. **Extract Utilities First**: Before adding more scanners, refactor shared code
2. **Standardize Strategy Interface**: Create base class for all strategies
3. **Config-Driven**: Make thresholds and criteria configurable per strategy

### Data
1. **Prioritize NSE/BSE Equity**: F&O can wait until equity is stable
2. **Start with 1 month**: Backfill 3 months gradually
3. **Cache Aggressively**: Use Redis for all historical data queries

### Frontend
1. **Loading States**: Add skeleton loaders for all cards
2. **Error Boundaries**: Gracefully handle API failures
3. **Real-time Updates**: Consider WebSocket for signal counts

### Production
1. **Canary Deployment**: Test BSE scanner on small subset first
2. **Feature Flags**: Allow enabling/disabling strategies dynamically
3. **Observability**: Add metrics, logs, traces from day 1

---

## 📞 NEXT STEPS

**Awaiting User Input**:
1. Answer critical questions above
2. Approve roadmap priorities
3. Confirm data source for historical prices

**Once Approved**:
1. Begin Phase 1 (Data Infrastructure)
2. Parallel work on Phase 2 (Shared Utilities)
3. Sequential implementation of scanners (BSE → NSE F&O → BSE F&O)

**Timeline**: 4-6 weeks to production-ready for all segments

---

**Ready to proceed? Please provide:**
1. Answers to critical questions
2. Priority adjustments (if any)
3. Green light to begin implementation

---

_Document Version: 1.0_  
_Last Updated: January 28, 2026_
