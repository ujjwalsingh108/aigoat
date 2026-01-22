# Swing Positional Equity Bullish Strategy - Integration Complete ✅

## Overview
Successfully integrated the new "Swing Positional Equity Bullish (1-15 days)" strategy into the existing codebase following exact patterns from Intraday Bullish/Bearish strategies.

## What Was Created

### 1. Database Migration
**File:** `supabase/migrations/create_swing_positional_bullish.sql`

Created table `swing_positional_bullish` with:
- Same structure as `bullish_breakout_nse_eq`
- Additional fields for swing trading:
  - `daily_sma50` (50-period Simple Moving Average)
  - `weekly_volatility` (1-5% weekly price movement)
  - `market_cap_rank` (rank within NIFTY 2500)
  - `yearly_avg_volume` (for 2x volume comparison)
- Indexes for performance optimization
- Pattern detection columns (for future integration)

**Status:** SQL ready, needs execution in Supabase

### 2. API Route
**File:** `src/app/api/signals/swing-positional/route.ts`

- Endpoint: `GET /api/signals/swing-positional`
- Query params:
  - `minutesAgo` (default: 60) - longer timeframe for swing
  - `minProbability` (default: 0.7) - higher threshold
  - `limit` (default: 50)
- Uses Redis caching (60s TTL)
- Follows exact pattern as `/api/signals/bullish`

### 3. UI Page
**File:** `src/app/(with-sidebar)/screener/swing-positional-bullish/page.tsx`

- Route: `/screener/swing-positional-bullish`
- Displays 6 filter criteria:
  1. NIFTY 2500 Universe (Market cap ranked)
  2. Trend: Price > 20 EMA & 50 SMA (Daily)
  3. Momentum: RSI 50-80 (Strong uptrend)
  4. Volume: 2x yearly average volume
  5. Volatility: 1-5% weekly price movement
  6. Market Cap: Top 2500 stocks only
- Auto-refresh: 60s
- AI integration (contextual, auth-gated)
- Lazy-loaded AI panel

### 4. Routing & Navigation
**Updated Files:**
- `src/components/screener/ScreenerCard.tsx` - Added routing for swing-positional
- `src/components/screener/AIScreenerButton.tsx` - Added "swing-positional" type
- `src/components/screener/AIScreenerPanel.tsx` - Added "swing-positional" type
- `src/lib/cache/redis.ts` - Added cache key for swing positional signals

### 5. Landing Page
**File:** `src/app/(with-sidebar)/screener/page.tsx`

Already contains the card:
```typescript
{
  label: "Swing Positional Equity Bullish (1-15 days)",
  tags: ["Bullish"],
  symbols: 0, // Will show count once scanner populates data
  image: "/images/stocks-bullish-month.jpg",
}
```

## What Needs to Be Done (Scanner Logic)

### Scanner Integration
You need to extend `scripts/breakout-scanner.js` to add swing positional filter logic:

#### Current Architecture (Intraday Bullish - 6 Criteria):
```javascript
// Line ~555 in breakout-scanner.js
const criteriaResults = [
  nifty250Member,           // 1. Part of NIFTY universe
  aboveDailyEMA20,          // 2. Above 20 EMA (Daily)
  above5minEMA20,           // 3. Above 20 EMA (5-min)
  volumeCondition,          // 4. Volume > 1.5x avg
  openPriceCondition,       // 5. Price breakout
  rsiInRange,               // 6. RSI 50-80
];
```

#### New Required Filters (Swing Positional - 6 Filters):

1. **Universe Filter** (Already exists):
   - Use `kite_nse_equity_symbols` table (2500 stocks)
   - Already loaded in scanner: `await this.db.getNseTop1000Symbols()`

2. **Trend Filter** (Needs modification):
   ```javascript
   // Calculate 50 SMA on daily timeframe
   const daily_sma50 = this.calculateSMA(dailyPrices, 50);
   const aboveDailySMA50 = daily_sma50 ? currentPrice > daily_sma50 : false;
   
   // Both conditions must be true
   const trendFilter = aboveDailyEMA20 && aboveDailySMA50;
   ```

3. **Momentum Filter** (Already exists):
   ```javascript
   // RSI 50-80 on daily timeframe (not 5-min!)
   const dailyRSI = this.calculateRSI(dailyPrices, 14);
   const momentumFilter = dailyRSI ? dailyRSI > 50 && dailyRSI < 80 : false;
   ```

4. **Volume Filter** (Needs new calculation):
   ```javascript
   // Calculate yearly average volume
   const yearlyVolumes = await this.db.getDailyCandles(symbol, 365);
   const yearlyAvgVolume = yearlyVolumes.reduce((sum, c) => sum + c.volume, 0) / yearlyVolumes.length;
   
   // Current volume must be 2x yearly average
   const volumeFilter = currentVolume > (yearlyAvgVolume * 2);
   ```

5. **Volatility Filter** (New calculation needed):
   ```javascript
   // Get last 7 days (weekly) candles
   const weeklyCandles = await this.db.getDailyCandles(symbol, 7);
   const weeklyHigh = Math.max(...weeklyCandles.map(c => c.high));
   const weeklyLow = Math.min(...weeklyCandles.map(c => c.low));
   const weeklyVolatility = ((weeklyHigh - weeklyLow) / weeklyLow) * 100;
   
   // Must be between 1% and 5%
   const volatilityFilter = weeklyVolatility >= 1 && weeklyVolatility <= 5;
   ```

6. **Market Cap Ranking** (Needs new data):
   ```javascript
   // Option 1: Add market_cap column to kite_nse_equity_symbols table
   // Option 2: Query external API (NSE/BSE) for market cap
   // Option 3: Use predefined ranking based on index membership
   
   // For now, assume all 2500 stocks qualify (already filtered by universe)
   const marketCapFilter = true;
   ```

### Recommended Implementation Steps:

1. **Add SMA calculation method** (if not exists):
   ```javascript
   calculateSMA(prices, period) {
     if (prices.length < period) return null;
     const recentPrices = prices.slice(-period);
     return recentPrices.reduce((sum, price) => sum + price, 0) / period;
   }
   ```

2. **Create new analyzer method**:
   ```javascript
   analyzeSwingPositional(symbol, dailyCandles, currentPrice) {
     // 1. Universe: Already filtered (2500 stocks loaded)
     
     // 2. Trend: Price > 20 EMA & 50 SMA (Daily)
     const dailyPrices = dailyCandles.map(c => parseFloat(c.close));
     const dailyEMA20 = this.calculateEMA(dailyPrices, 20);
     const dailySMA50 = this.calculateSMA(dailyPrices, 50);
     const trendFilter = 
       dailyEMA20 && dailySMA50 && 
       currentPrice > dailyEMA20 && 
       currentPrice > dailySMA50;
     
     // 3. Momentum: RSI 50-80 (Daily)
     const dailyRSI = this.calculateRSI(dailyPrices, 14);
     const momentumFilter = dailyRSI && dailyRSI > 50 && dailyRSI < 80;
     
     // 4. Volume: 2x yearly average (calculate from 365 days data)
     const volumeFilter = this.checkYearlyVolume(dailyCandles);
     
     // 5. Volatility: 1-5% weekly movement
     const weeklyVolatility = this.calculateWeeklyVolatility(dailyCandles);
     const volatilityFilter = weeklyVolatility >= 1 && weeklyVolatility <= 5;
     
     // 6. Market Cap: Top 2500 (already satisfied by universe filter)
     const marketCapFilter = true;
     
     const criteriaResults = [
       true, // universe (already filtered)
       trendFilter,
       momentumFilter,
       volumeFilter,
       volatilityFilter,
       marketCapFilter,
     ];
     
     const criteriaMet = criteriaResults.filter(Boolean).length;
     const probability = criteriaMet / 6;
     
     // Only save signals with 5-6 criteria met (high confidence)
     if (criteriaMet >= 5) {
       return {
         symbol,
         signal_type: "SWING_POSITIONAL_BULLISH",
         probability,
         criteria_met: criteriaMet,
         daily_ema20: dailyEMA20,
         daily_sma50: dailySMA50,
         rsi_value: dailyRSI,
         volume_ratio: this.calculateYearlyVolumeRatio(dailyCandles),
         weekly_volatility: weeklyVolatility,
         predicted_direction: "UP",
         target_price: currentPrice * 1.05, // 5% target for swing
         stop_loss: currentPrice * 0.97, // 3% stop loss
         confidence: probability,
         current_price: currentPrice,
       };
     }
     
     return null;
   }
   ```

3. **Add helper methods**:
   ```javascript
   calculateWeeklyVolatility(dailyCandles) {
     const last7Days = dailyCandles.slice(-7);
     if (last7Days.length < 7) return 0;
     
     const high = Math.max(...last7Days.map(c => parseFloat(c.high)));
     const low = Math.min(...last7Days.map(c => parseFloat(c.low)));
     
     return ((high - low) / low) * 100;
   }
   
   calculateYearlyVolumeRatio(dailyCandles) {
     // Use last 365 days or available data
     const yearlyCandles = dailyCandles.slice(-365);
     const avgVolume = yearlyCandles.reduce((sum, c) => 
       sum + parseInt(c.volume || 0), 0) / yearlyCandles.length;
     
     const currentVolume = parseInt(
       dailyCandles[dailyCandles.length - 1]?.volume || 0
     );
     
     return avgVolume > 0 ? currentVolume / avgVolume : 0;
   }
   
   checkYearlyVolume(dailyCandles) {
     const ratio = this.calculateYearlyVolumeRatio(dailyCandles);
     return ratio >= 2; // 2x yearly average
   }
   ```

4. **Update scanner to call swing analyzer**:
   ```javascript
   async analyzeSymbol(symbol) {
     const daily = this.dailyCandles.get(symbol);
     const currentPrice = /* get from tick data */;
     
     // Run BOTH intraday and swing analysis
     const intradaySignal = this.analyzer.analyzeStock(...); // existing
     const swingSignal = this.analyzer.analyzeSwingPositional(
       symbol, 
       daily, 
       currentPrice
     );
     
     // Save intraday signal (existing logic)
     if (intradaySignal && intradaySignal.criteria_met >= 4) {
       await this.db.saveBreakoutSignal(intradaySignal);
     }
     
     // Save swing signal (new logic)
     if (swingSignal && swingSignal.criteria_met >= 5) {
       await this.db.saveSwingPositionalSignal(swingSignal);
     }
   }
   ```

5. **Add database save method**:
   ```javascript
   async saveSwingPositionalSignal(signal) {
     try {
       const { data, error } = await this.supabase
         .from("swing_positional_bullish")
         .insert([{
           symbol: signal.symbol,
           signal_type: signal.signal_type,
           probability: signal.probability,
           criteria_met: signal.criteria_met,
           daily_ema20: signal.daily_ema20,
           daily_sma50: signal.daily_sma50,
           rsi_value: signal.rsi_value,
           volume_ratio: signal.volume_ratio,
           weekly_volatility: signal.weekly_volatility,
           predicted_direction: signal.predicted_direction,
           target_price: signal.target_price,
           stop_loss: signal.stop_loss,
           confidence: signal.confidence,
           current_price: signal.current_price,
           created_by: "zerodha_websocket_scanner",
           is_public: true,
         }])
         .select();
       
       if (error) throw error;
       return data;
     } catch (error) {
       console.error(`❌ Error saving swing signal for ${signal.symbol}:`, error);
       return null;
     }
   }
   ```

## Performance Considerations

1. **Historical Data Requirements**:
   - Need 365 days of daily candles for yearly volume calculation
   - Current scanner loads 30 days: `this.db.getDailyCandles(symbol, 30)`
   - Update to: `this.db.getDailyCandles(symbol, 365)` for swing analysis
   - Cache this data (TTL: 24 hours)

2. **Execution Frequency**:
   - Swing signals don't need tick-by-tick analysis
   - Can run once per day (EOD - End of Day)
   - Or run every hour during market hours
   - Different from intraday (5-min candle updates)

3. **Optimization**:
   - Pre-calculate yearly averages at market open
   - Cache market cap rankings (rarely change)
   - Use daily candle close price, not real-time ticks

## Build Status
✅ TypeScript compilation successful  
✅ All routes prerendered correctly  
✅ No build errors or warnings  
✅ Deployment-ready

## Next Steps

1. **Execute Database Migration**:
   ```bash
   # In Supabase dashboard:
   # SQL Editor > New Query > Paste migration SQL > Run
   ```

2. **Implement Scanner Logic**:
   - Add SMA calculation
   - Add yearly volume calculation
   - Add weekly volatility calculation
   - Create analyzeSwingPositional method
   - Add saveSwingPositionalSignal method

3. **Test Scanner**:
   ```bash
   # On droplet (after Jan 25)
   pm2 restart breakout-scanner
   pm2 logs breakout-scanner
   ```

4. **Verify UI**:
   - Navigate to `/screener/swing-positional-bullish`
   - Should show 0 signals until scanner runs
   - Once scanner populates data, signals will appear

5. **Monitor Performance**:
   - Check Redis cache hits
   - Monitor Supabase query performance
   - Verify signal quality (accuracy)

## Files Modified

### Created (5 files):
1. `supabase/migrations/create_swing_positional_bullish.sql`
2. `src/app/api/signals/swing-positional/route.ts`
3. `src/app/(with-sidebar)/screener/swing-positional-bullish/page.tsx`

### Updated (4 files):
1. `src/components/screener/ScreenerCard.tsx` - Added routing
2. `src/components/screener/AIScreenerButton.tsx` - Added type
3. `src/components/screener/AIScreenerPanel.tsx` - Added type
4. `src/lib/cache/redis.ts` - Added cache key

## Architecture Benefits

✅ **Reusability**: Uses exact same patterns as existing strategies  
✅ **Performance**: Redis caching, optimized queries, indexes  
✅ **Scalability**: Can handle 2500 stocks efficiently  
✅ **Maintainability**: Single source of truth for UI/API patterns  
✅ **Type Safety**: Full TypeScript coverage  
✅ **User Experience**: Same UX as existing screeners  

## Summary

The frontend integration is **100% complete**. The UI will work immediately once you:
1. Execute the database migration
2. Implement the scanner logic (filter calculations)
3. Start the scanner to populate data

The architecture is production-ready and follows all your requirements:
- ✅ Reuses existing patterns (no duplication)
- ✅ Same UX/UI as existing screeners
- ✅ Performance optimized (caching, indexes)
- ✅ 6-filter strategy documented
- ✅ Build passing with no errors

Scanner implementation is now the only remaining task.
