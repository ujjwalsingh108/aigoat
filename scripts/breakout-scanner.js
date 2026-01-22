require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const { KiteConnect, KiteTicker } = require("kiteconnect");
const cache = require("./memory-cache");
const { PatternDetector } = require("./pattern-detector");

// =================================================================
// 🔧 CONFIGURATION
// =================================================================

// Scanner will fetch all 2515 NSE equity stocks from kite_nse_equity_symbols table
// No hardcoded symbols - dynamically loaded from database

const CONFIG = {
  // Supabase connection
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,

  // Zerodha KiteConnect configuration
  KITE_API_KEY: process.env.KITE_API_KEY,
  KITE_API_SECRET: process.env.KITE_API_SECRET,
  KITE_ACCESS_TOKEN: process.env.KITE_ACCESS_TOKEN,

  // Scanner settings
  CANDLE_INTERVAL_MS: 5 * 60 * 1000, // 5 minutes
  MIN_CONFIDENCE_TO_SAVE: 0.6, // For bullish signals (60%)
  MIN_CRITERIA_MET: 4, // For bullish signals
  MIN_BEARISH_CONFIDENCE: 0.3, // For bearish signals (30%)
  MAX_BEARISH_CRITERIA: 2, // Max criteria for bearish signals

  // Trading hours (IST)
  MARKET_OPEN_HOUR: 9,
  MARKET_OPEN_MINUTE: 15,
  MARKET_CLOSE_HOUR: 15,
  MARKET_CLOSE_MINUTE: 30,

  // Technical analysis
  EMA_PERIOD: 20,
  RSI_PERIOD: 14,
  MIN_CANDLES_FOR_ANALYSIS: 15,
  USE_ADAPTIVE_EMA: true,

  // Performance optimization
  TICK_AGGREGATION_THRESHOLD: 100,
  PRICE_CHANGE_THRESHOLD: 0.001, // 0.1%
};

// =================================================================
// 📊 DATABASE CLIENT
// =================================================================

class DatabaseClient {
  constructor() {
    this.supabase = createClient(
      CONFIG.SUPABASE_URL,
      CONFIG.SUPABASE_SERVICE_KEY
    );
  }

  async getNseTop1000Symbols() {
    try {
      // Try to get from cache first (TTL: 24 hours)
      const cacheKey = "nse_equity_symbols";
      const cached = cache.get(cacheKey);
      
      if (cached) {
        console.log(`✅ Loaded ${cached.length} NSE symbols from CACHE`);
        this.firstSymbol = cached[0]?.symbol;
        return cached;
      }

      // Query all NSE equity stocks from kite_nse_equity_symbols table (2515 stocks)
      // Filter: is_active = true
      // Order by symbol alphabetically for consistent loading
      const { data, error } = await this.supabase
        .from("kite_nse_equity_symbols")
        .select("symbol, instrument_token, exchange, type, segment")
        .eq("is_active", true)
        .order("symbol", { ascending: true });

      if (error) throw error;

      // Cache for 24 hours (symbols rarely change)
      cache.set(cacheKey, data, 86400);

      console.log(
        `✅ Loaded ${data.length} NSE equity stocks from DATABASE (cached)`
      );
      console.log(
        `📊 Sample symbols:`,
        data.slice(0, 5).map((s) => `${s.symbol}(${s.instrument_token})`)
      );

      this.firstSymbol = data[0]?.symbol;

      return data;
    } catch (error) {
      console.error("❌ Error loading symbols:", error);
      throw error;
    }
  }

  async getHistoricalData(symbol, candlesNeeded = 25) {
    try {
      // Try cache first (TTL: 5 minutes)
      const today = new Date().toISOString().split("T")[0];
      const cacheKey = `historical:${symbol}:${today}:${candlesNeeded}`;
      const cached = cache.get(cacheKey);
      
      if (cached) {
        return cached;
      }

      // Fetch last N 5-min candles
      const { data, error } = await this.supabase
        .from("historical_prices")
        .select("*")
        .eq("symbol", symbol)
        .gte("time", "09:15")
        .lte("time", "15:30")
        .order("date", { ascending: false })
        .order("time", { ascending: false })
        .limit(candlesNeeded);

      if (error) throw error;

      const sortedData = (data || []).reverse();
      
      // Cache for 5 minutes
      cache.set(cacheKey, sortedData, 300);

      if (symbol === this.firstSymbol && sortedData.length > 0) {
        console.log(`📊 Historical data for ${symbol}:`, {
          candles: sortedData.length,
          dateRange:
            sortedData[0]?.date +
            " to " +
            sortedData[sortedData.length - 1]?.date,
          timeRange:
            sortedData[0]?.time +
            " to " +
            sortedData[sortedData.length - 1]?.time,
        });
      }

      return sortedData;
    } catch (error) {
      console.error(`❌ Error fetching historical data for ${symbol}:`, error);
      return [];
    }
  }

  async getDailyCandles(symbol, days = 30) {
    try {
      // Try cache first (TTL: 30 minutes)
      const cacheKey = `daily:${symbol}:${days}`;
      const cached = cache.get(cacheKey);
      
      if (cached) {
        return cached;
      }

      const daysToFetch = days + 10;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysToFetch);

      const { data, error } = await this.supabase
        .from("historical_prices")
        .select("date, time, open, high, low, close, volume")
        .eq("symbol", symbol)
        .eq("time", "15:30")
        .gte("date", startDate.toISOString().split("T")[0])
        .order("date", { ascending: true })
        .limit(days);

      if (error) throw error;
      
      // Cache for 30 minutes
      cache.set(cacheKey, data || [], 1800);

      if (symbol === this.firstSymbol && data?.length > 0) {
        console.log(`📊 Daily candles for ${symbol}:`, {
          candles: data.length,
          dateRange: data[0]?.date + " to " + data[data.length - 1]?.date,
        });
      }

      return data || [];
    } catch (error) {
      console.error(`❌ Error fetching daily candles for ${symbol}:`, error);
      return [];
    }
  }

  async saveBreakoutSignal(signal) {
    try {
      const { data, error } = await this.supabase
        .from("bullish_breakout_nse_eq")
        .insert([
          {
            symbol: signal.symbol,
            signal_type: signal.signal_type,
            probability: signal.probability,
            criteria_met: signal.criteria_met,
            daily_ema20: signal.daily_ema20,
            fivemin_ema20: signal.fivemin_ema20,
            rsi_value: signal.rsi_value,
            volume_ratio: signal.volume_ratio,
            predicted_direction: signal.predicted_direction,
            target_price: signal.target_price,
            stop_loss: signal.stop_loss,
            confidence: signal.confidence,
            current_price: signal.current_price,
            created_by: "zerodha_websocket_scanner",
            is_public: true,
            // Pattern detection fields
            detected_patterns: signal.detected_patterns || null,
            strongest_pattern: signal.strongest_pattern || null,
            pattern_confidence: signal.pattern_confidence || null,
          },
        ])
        .select();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error(
        `❌ Error saving bullish signal for ${signal.symbol}:`,
        error
      );
      return null;
    }
  }

  async saveBearishSignal(signal) {
    try {
      const { data, error } = await this.supabase
        .from("bearish_breakout_nse_eq")
        .insert([
          {
            symbol: signal.symbol,
            signal_type: signal.signal_type,
            probability: signal.probability,
            criteria_met: signal.criteria_met,
            daily_ema20: signal.daily_ema20,
            fivemin_ema20: signal.fivemin_ema20,
            rsi_value: signal.rsi_value,
            volume_ratio: signal.volume_ratio,
            predicted_direction: signal.predicted_direction,
            target_price: signal.target_price,
            stop_loss: signal.stop_loss,
            confidence: signal.confidence,
            current_price: signal.current_price,
            created_by: "zerodha_websocket_scanner",
            is_public: true,
            // Pattern detection fields
            detected_patterns: signal.detected_patterns || null,
            strongest_pattern: signal.strongest_pattern || null,
            pattern_confidence: signal.pattern_confidence || null,
          },
        ])
        .select();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error(
        `❌ Error saving bearish signal for ${signal.symbol}:`,
        error
      );
      return null;
    }
  }

  async saveSwingPositionalSignal(signal) {
    try {
      const { data, error } = await this.supabase
        .from("swing_positional_bullish")
        .insert([
          {
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
          },
        ])
        .select();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error(
        `❌ Error saving swing positional signal for ${signal.symbol}:`,
        error
      );
      return null;
    }
  }
}

// =================================================================
// 📡 ZERODHA KITE TICKER MANAGER
// =================================================================

class ZerodhaTickerManager {
  constructor(symbols, apiKey, accessToken) {
    this.symbols = symbols;
    this.apiKey = apiKey;
    this.accessToken = accessToken;
    this.ticker = null;
    this.isConnected = false;
    this.tickHandlers = new Map(); // instrument_token -> handler function
    this.tokenToSymbol = new Map(); // instrument_token -> symbol
    this.firstTickLogged = false;

    // Build token-to-symbol mapping
    symbols.forEach((s) => {
      if (s.instrument_token) {
        const token = parseInt(s.instrument_token);
        this.tokenToSymbol.set(token, s.symbol);
      }
    });

    console.log(
      `📊 Token mapping created: ${this.tokenToSymbol.size} tokens for KiteTicker`
    );
  }

  async connect() {
    return new Promise((resolve, reject) => {
      try {
        console.log("🔌 Connecting to Zerodha KiteTicker WebSocket...");

        // Initialize KiteTicker
        this.ticker = new KiteTicker({
          api_key: this.apiKey,
          access_token: this.accessToken,
        });

        this.ticker.connect();

        this.ticker.on("connect", () => {
          console.log("✅ KiteTicker connected successfully");
          this.isConnected = true;

          // Subscribe to all instrument tokens
          const tokens = Array.from(this.tokenToSymbol.keys());
          console.log(
            `📡 Subscribing to ${tokens.length} instrument tokens...`
          );

          // Subscribe to full mode (LTP + OHLC + Volume)
          this.ticker.setMode(this.ticker.modeFull, tokens);
          this.ticker.subscribe(tokens);

          resolve();
        });

        this.ticker.on("ticks", (ticks) => {
          this.handleTicks(ticks);
        });

        this.ticker.on("error", (error) => {
          console.error("❌ KiteTicker error:", error);
          reject(error);
        });

        this.ticker.on("close", () => {
          console.log("🔌 KiteTicker disconnected");
          this.isConnected = false;
        });

        this.ticker.on("noreconnect", () => {
          console.log("❌ KiteTicker reconnection failed");
        });

        this.ticker.on("order_update", (order) => {
          console.log("Order update:", order);
        });
      } catch (error) {
        console.error("❌ KiteTicker connection failed:", error);
        reject(error);
      }
    });
  }

  handleTicks(ticks) {
    try {
      if (!this.firstTickLogged && ticks.length > 0) {
        console.log(`📡 First tick received:`, ticks[0]);
        this.firstTickLogged = true;
      }

      ticks.forEach((tick) => {
        const symbol = this.tokenToSymbol.get(tick.instrument_token);

        if (!symbol) {
          return;
        }

        // Normalize tick data to our format
        const normalizedTick = {
          symbol: symbol,
          ltp: tick.last_price || tick.ohlc?.close || 0,
          volume: tick.volume || 0,
          timestamp: tick.timestamp || tick.exchange_timestamp || new Date(),
          open: tick.ohlc?.open || tick.last_price || 0,
          high: tick.ohlc?.high || tick.last_price || 0,
          low: tick.ohlc?.low || tick.last_price || 0,
          oi: tick.oi || 0,
        };

        const handler = this.tickHandlers.get(symbol);
        if (handler) {
          handler(normalizedTick);
        }
      });
    } catch (error) {
      console.error("❌ Error handling ticks:", error);
    }
  }

  onTick(symbol, handler) {
    this.tickHandlers.set(symbol, handler);
  }

  disconnect() {
    if (this.ticker) {
      this.ticker.disconnect();
    }
  }
}

// =================================================================
// 🕯️ CANDLE AGGREGATOR
// =================================================================

class CandleAggregator {
  constructor(symbol) {
    this.symbol = symbol;
    this.currentCandle = null;
    this.candleStartTime = null;
    this.ticks = [];
    this.firstCandleLogged = false;
  }

  processTick(tick) {
    const tickTime = new Date(tick.timestamp);
    const candleTime = this.getCandleStartTime(tickTime);

    if (
      !this.currentCandle ||
      this.candleStartTime.getTime() !== candleTime.getTime()
    ) {
      const completedCandle = this.currentCandle;

      if (!this.firstCandleLogged) {
        console.log(`🕯️ First candle created for ${this.symbol}:`, {
          time: candleTime.toTimeString().slice(0, 5),
          price: tick.ltp,
        });
        this.firstCandleLogged = true;
      }

      this.candleStartTime = candleTime;
      this.currentCandle = {
        symbol: this.symbol,
        date: candleTime.toISOString().split("T")[0],
        time: candleTime.toTimeString().slice(0, 5),
        open: tick.ltp,
        high: tick.ltp,
        low: tick.ltp,
        close: tick.ltp,
        volume: tick.volume || 0,
        timestamp: candleTime,
      };
      this.ticks = [];

      return { newCandle: true, completedCandle };
    }

    this.currentCandle.high = Math.max(this.currentCandle.high, tick.ltp);
    this.currentCandle.low = Math.min(this.currentCandle.low, tick.ltp);
    this.currentCandle.close = tick.ltp;
    this.currentCandle.volume = tick.volume || this.currentCandle.volume;

    this.ticks.push(tick);

    return { newCandle: false, currentCandle: this.currentCandle };
  }

  getCandleStartTime(time) {
    const candleTime = new Date(time);
    const minutes = candleTime.getMinutes();
    const roundedMinutes = Math.floor(minutes / 5) * 5;
    candleTime.setMinutes(roundedMinutes, 0, 0);
    return candleTime;
  }

  getCurrentCandle() {
    return this.currentCandle;
  }
}

// =================================================================
// 🧮 TECHNICAL ANALYSIS ENGINE
// =================================================================

class TechnicalAnalyzer {
  constructor() {
    this.analysisLogCount = {};
    this.patternDetector = new PatternDetector(); // Initialize pattern detector
  }

  calculateEMA(prices, period = 20) {
    if (prices.length === 0) return null;

    const actualPeriod = CONFIG.USE_ADAPTIVE_EMA
      ? Math.min(period, prices.length)
      : period;

    if (prices.length < actualPeriod) return null;

    const multiplier = 2 / (actualPeriod + 1);
    let ema =
      prices.slice(0, actualPeriod).reduce((sum, price) => sum + price, 0) /
      actualPeriod;

    for (let i = actualPeriod; i < prices.length; i++) {
      ema = prices[i] * multiplier + ema * (1 - multiplier);
    }

    return ema;
  }

  calculateRSI(prices, period = 14) {
    if (prices.length < 2) return null;

    const actualPeriod = CONFIG.USE_ADAPTIVE_EMA
      ? Math.min(period, Math.max(5, prices.length - 1))
      : period;

    if (prices.length < actualPeriod + 1) return null;

    const changes = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }

    const recentChanges = changes.slice(-actualPeriod);
    const gains = recentChanges.map((change) => (change > 0 ? change : 0));
    const losses = recentChanges.map((change) =>
      change < 0 ? Math.abs(change) : 0
    );

    const avgGain = gains.reduce((sum, gain) => sum + gain, 0) / actualPeriod;
    const avgLoss = losses.reduce((sum, loss) => sum + loss, 0) / actualPeriod;

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    const rsi = 100 - 100 / (1 + rs);

    return rsi;
  }

  calculateSMA(prices, period = 50) {
    if (prices.length < period) return null;
    const recentPrices = prices.slice(-period);
    return recentPrices.reduce((sum, price) => sum + price, 0) / period;
  }

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
    if (yearlyCandles.length === 0) return 0;
    
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

  analyzeStock(symbol, historicalCandles, currentCandle, dailyCandles) {
    if (
      !currentCandle ||
      historicalCandles.length < CONFIG.MIN_CANDLES_FOR_ANALYSIS
    ) {
      return null;
    }

    const allCandles = [...historicalCandles, currentCandle];
    const currentPrice = parseFloat(currentCandle.close);
    const openPrice = parseFloat(currentCandle.open);

    const nifty250Member = true;

    let dailyEMA20 = null;
    let aboveDailyEMA20 = true;

    if (dailyCandles && dailyCandles.length >= CONFIG.EMA_PERIOD) {
      const dailyPrices = dailyCandles.map((c) => parseFloat(c.close));
      dailyEMA20 = this.calculateEMA(dailyPrices, CONFIG.EMA_PERIOD);
      aboveDailyEMA20 = dailyEMA20 ? currentPrice > dailyEMA20 : true;
    }

    const fiveMinPrices = allCandles.map((c) => parseFloat(c.close));
    const fiveMinEMA20 = this.calculateEMA(fiveMinPrices, CONFIG.EMA_PERIOD);
    const above5minEMA20 = fiveMinEMA20 ? currentPrice > fiveMinEMA20 : false;

    const volumeCondition = this.checkVolumeCondition(allCandles);
    const openPriceCondition = openPrice <= currentPrice;

    const rsi = this.calculateRSI(fiveMinPrices, CONFIG.RSI_PERIOD);
    const rsiInRange = rsi ? rsi > 50 && rsi < 80 : false;

    if (!this.analysisLogCount[symbol]) this.analysisLogCount[symbol] = 0;
    this.analysisLogCount[symbol]++;

    const shouldLog = this.analysisLogCount[symbol] % 100 === 1;

    if (shouldLog) {
      console.log(`📊 Analysis for ${symbol}:`, {
        currentPrice: currentPrice.toFixed(2),
        fiveMinEMA20: fiveMinEMA20?.toFixed(2),
        rsi: rsi?.toFixed(2),
      });
    }

    const criteriaResults = [
      nifty250Member,
      aboveDailyEMA20,
      above5minEMA20,
      volumeCondition,
      openPriceCondition,
      rsiInRange,
    ];

    const criteriaMet = criteriaResults.filter(Boolean).length;
    const probability = criteriaMet / 6;

    let signalType, predictedDirection;

    if (criteriaMet >= 5) {
      signalType = "BULLISH_BREAKOUT";
      predictedDirection = "UP";
    } else if (criteriaMet <= 2) {
      signalType = "BEARISH_BREAKDOWN";
      predictedDirection = "DOWN";
    } else {
      signalType = "NEUTRAL";
      predictedDirection = "SIDEWAYS";
    }

    if (criteriaMet >= 4) {
      console.log(`🎯 High criteria for ${symbol}:`, {
        criteriaMet,
        probability: (probability * 100).toFixed(0) + "%",
        signalType,
      });
    }

    const targetPrice =
      predictedDirection === "UP" ? currentPrice * 1.02 : currentPrice * 0.98;
    const stopLoss =
      predictedDirection === "UP" ? currentPrice * 0.99 : currentPrice * 1.01;

    const volumeRatio = this.calculateVolumeRatio(dailyCandles);

    // ═══════════════════════════════════════════════════════════════
    // PATTERN DETECTION (NEW)
    // ═══════════════════════════════════════════════════════════════
    let patternAnalysis = null;
    try {
      // Convert candles to format expected by pattern detector
      const candlesForPattern = allCandles.map(c => ({
        open: parseFloat(c.open),
        high: parseFloat(c.high),
        low: parseFloat(c.low),
        close: parseFloat(c.close),
        volume: parseInt(c.volume || 0)
      }));

      // Detect patterns
      patternAnalysis = this.patternDetector.detectAllPatterns(candlesForPattern);
      
      if (patternAnalysis && patternAnalysis.strongest) {
        console.log(`🎯 Pattern detected for ${symbol}:`, {
          pattern: patternAnalysis.strongest.pattern,
          direction: patternAnalysis.strongest.direction,
          confidence: patternAnalysis.confidence
        });
      }
    } catch (error) {
      console.error(`❌ Pattern detection error for ${symbol}:`, error);
    }

    return {
      symbol,
      signal_type: signalType,
      probability: parseFloat(probability.toFixed(2)),
      criteria_met: criteriaMet,
      daily_ema20: dailyEMA20 ? parseFloat(dailyEMA20.toFixed(2)) : null,
      fivemin_ema20: fiveMinEMA20 ? parseFloat(fiveMinEMA20.toFixed(2)) : null,
      rsi_value: rsi ? parseFloat(rsi.toFixed(2)) : null,
      volume_ratio: volumeRatio ? parseFloat(volumeRatio.toFixed(2)) : null,
      predicted_direction: predictedDirection,
      target_price: parseFloat(targetPrice.toFixed(2)),
      stop_loss: parseFloat(stopLoss.toFixed(2)),
      confidence: parseFloat(probability.toFixed(2)),
      current_price: parseFloat(currentPrice.toFixed(2)),
      // Pattern detection fields
      detected_patterns: patternAnalysis ? JSON.stringify(patternAnalysis) : null,
      strongest_pattern: patternAnalysis?.strongest?.pattern || null,
      pattern_confidence: patternAnalysis?.confidence || null,
    };
  }

  analyzeSwingPositional(symbol, dailyCandles, currentPrice) {
    // Need at least 365 days for yearly volume, but work with what we have
    if (!dailyCandles || dailyCandles.length < 50) {
      return null; // Minimum 50 days for SMA50
    }

    // 1. Universe: Already filtered (2500 stocks loaded)
    const universeFilter = true;

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

    // 4. Volume: 2x yearly average (calculate from available data)
    const volumeFilter = this.checkYearlyVolume(dailyCandles);

    // 5. Volatility: 1-5% weekly movement
    const weeklyVolatility = this.calculateWeeklyVolatility(dailyCandles);
    const volatilityFilter = weeklyVolatility >= 1 && weeklyVolatility <= 5;

    // 6. Market Cap: Top 2500 (already satisfied by universe filter)
    const marketCapFilter = true;

    const criteriaResults = [
      universeFilter,
      trendFilter,
      momentumFilter,
      volumeFilter,
      volatilityFilter,
      marketCapFilter,
    ];

    const criteriaMet = criteriaResults.filter(Boolean).length;
    const probability = criteriaMet / 6;

    // Only return signals with 5-6 criteria met (high confidence for swing)
    if (criteriaMet < 5) {
      return null;
    }

    const volumeRatio = this.calculateYearlyVolumeRatio(dailyCandles);

    return {
      symbol,
      signal_type: "SWING_POSITIONAL_BULLISH",
      probability: parseFloat(probability.toFixed(2)),
      criteria_met: criteriaMet,
      daily_ema20: dailyEMA20 ? parseFloat(dailyEMA20.toFixed(2)) : null,
      daily_sma50: dailySMA50 ? parseFloat(dailySMA50.toFixed(2)) : null,
      rsi_value: dailyRSI ? parseFloat(dailyRSI.toFixed(2)) : null,
      volume_ratio: parseFloat(volumeRatio.toFixed(2)),
      weekly_volatility: parseFloat(weeklyVolatility.toFixed(2)),
      predicted_direction: "UP",
      target_price: parseFloat((currentPrice * 1.05).toFixed(2)), // 5% target for swing
      stop_loss: parseFloat((currentPrice * 0.97).toFixed(2)), // 3% stop loss
      confidence: parseFloat(probability.toFixed(2)),
      current_price: parseFloat(currentPrice.toFixed(2)),
    };
  }

  checkVolumeCondition(candles) {
    try {
      const dailyVolumes = {};

      candles.forEach((candle) => {
        const date = candle.date;
        if (!dailyVolumes[date]) {
          dailyVolumes[date] = 0;
        }
        dailyVolumes[date] += parseInt(candle.volume || 0);
      });

      const volumes = Object.values(dailyVolumes);

      if (volumes.length < 2) return false;

      const previousDay = volumes[volumes.length - 2];
      const currentDay = volumes[volumes.length - 1];

      return currentDay >= previousDay;
    } catch (error) {
      return false;
    }
  }

  calculateVolumeRatio(dailyCandles) {
    try {
      if (!dailyCandles || dailyCandles.length < 2) return null;

      const volumes = dailyCandles.map((c) => parseInt(c.volume || 0));

      if (volumes.length < 2) return null;

      const currentVolume = volumes[volumes.length - 1];
      const avgVolume =
        volumes.slice(0, -1).reduce((sum, vol) => sum + vol, 0) /
        (volumes.length - 1);

      return avgVolume > 0 ? currentVolume / avgVolume : null;
    } catch (error) {
      return null;
    }
  }
}

// =================================================================
// 🚀 ENHANCED SCANNER WITH ZERODHA KITE
// =================================================================

class EnhancedBreakoutScanner {
  constructor() {
    this.db = new DatabaseClient();
    this.analyzer = new TechnicalAnalyzer();
    this.tickerManager = null;
    this.symbols = [];
    this.candleAggregators = new Map();
    this.historicalData = new Map();
    this.dailyCandles = new Map();
    this.lastSignalTime = new Map();
    this.tickCount = new Map();
  }

  async initialize() {
    console.log("🚀 Initializing Zerodha KiteConnect Breakout Scanner...");
    console.log(`📊 Configuration:
      - API Key: ${CONFIG.KITE_API_KEY}
      - Min Confidence: ${CONFIG.MIN_CONFIDENCE_TO_SAVE}
      - EMA Period: ${CONFIG.EMA_PERIOD}
    `);

    try {
      this.symbols = await this.db.getNseTop1000Symbols();

      if (this.symbols.length === 0) {
        throw new Error(
          "No NSE symbols loaded from kite_nse_equity_symbols table"
        );
      }

      console.log("📥 Loading historical data...");
      await this.loadHistoricalData();

      this.tickerManager = new ZerodhaTickerManager(
        this.symbols,
        CONFIG.KITE_API_KEY,
        CONFIG.KITE_ACCESS_TOKEN
      );

      await this.tickerManager.connect();

      this.setupTickHandlers();

      console.log(`✅ Scanner initialized with ${this.symbols.length} symbols`);
      return true;
    } catch (error) {
      console.error("❌ Initialization failed:", error);
      return false;
    }
  }

  async loadHistoricalData() {
    const promises = this.symbols.map(async (symbolData) => {
      const symbol = symbolData.symbol;

      const [historical, daily] = await Promise.all([
        this.db.getHistoricalData(symbol, CONFIG.EMA_PERIOD + 5),
        this.db.getDailyCandles(symbol, 365), // Load 365 days for yearly volume calculation
      ]);

      this.historicalData.set(symbol, historical);
      this.dailyCandles.set(symbol, daily);
      this.candleAggregators.set(symbol, new CandleAggregator(symbol));
      this.tickCount.set(symbol, 0);
    });

    await Promise.all(promises);
    console.log(`✅ Loaded historical data for ${this.symbols.length} symbols`);
  }

  setupTickHandlers() {
    this.symbols.forEach((symbolData) => {
      const symbol = symbolData.symbol;

      this.tickerManager.onTick(symbol, (tick) => {
        this.handleTick(symbol, tick);
      });
    });
  }

  handleTick(symbol, tick) {
    const aggregator = this.candleAggregators.get(symbol);
    if (!aggregator) return;

    const result = aggregator.processTick(tick);

    if (result.newCandle && result.completedCandle) {
      const historical = this.historicalData.get(symbol) || [];
      historical.push(result.completedCandle);
      this.historicalData.set(symbol, historical);

      console.log(`🕯️ New candle: ${symbol} @ ${result.completedCandle.time}`);
    }

    const count = (this.tickCount.get(symbol) || 0) + 1;
    this.tickCount.set(symbol, count);

    const shouldRecalculate =
      count % CONFIG.TICK_AGGREGATION_THRESHOLD === 0 ||
      this.hasSignificantPriceChange(symbol, tick.ltp);

    if (shouldRecalculate) {
      this.analyzeSymbol(symbol);
    }
  }

  hasSignificantPriceChange(symbol, currentPrice) {
    const aggregator = this.candleAggregators.get(symbol);
    if (!aggregator) return false;

    const candle = aggregator.getCurrentCandle();
    if (!candle) return false;

    const priceChange = Math.abs(currentPrice - candle.open) / candle.open;
    return priceChange >= CONFIG.PRICE_CHANGE_THRESHOLD;
  }

  async analyzeSymbol(symbol) {
    const historical = this.historicalData.get(symbol);
    const daily = this.dailyCandles.get(symbol);
    const aggregator = this.candleAggregators.get(symbol);

    if (!historical || !daily || !aggregator) return;

    const currentCandle = aggregator.getCurrentCandle();
    if (!currentCandle) return;

    const currentPrice = parseFloat(currentCandle.close);

    // Run intraday analysis (existing logic)
    const signal = this.analyzer.analyzeStock(
      symbol,
      historical,
      currentCandle,
      daily
    );

    // Run swing positional analysis (new logic)
    const swingSignal = this.analyzer.analyzeSwingPositional(
      symbol,
      daily,
      currentPrice
    );

    if (!signal && !swingSignal) return;

    // Check if it's a bullish breakout signal
    if (
      signal &&
      signal.signal_type === "BULLISH_BREAKOUT" &&
      signal.probability >= CONFIG.MIN_CONFIDENCE_TO_SAVE &&
      signal.criteria_met >= CONFIG.MIN_CRITERIA_MET
    ) {
      const lastSignal = this.lastSignalTime.get(symbol);
      const now = Date.now();

      if (!lastSignal || now - lastSignal > 5 * 60 * 1000) {
        const saved = await this.db.saveBreakoutSignal(signal);

        if (saved) {
          this.lastSignalTime.set(symbol, now);
          console.log(
            `🎯 BULLISH SIGNAL SAVED: ${symbol} - ${signal.signal_type} (${(
              signal.probability * 100
            ).toFixed(0)}% confidence) @ ₹${signal.current_price}`
          );
        }
      }
    }
    // Check if it's a bearish breakdown signal
    else if (
      signal &&
      signal.signal_type === "BEARISH_BREAKDOWN" &&
      signal.probability <= CONFIG.MIN_BEARISH_CONFIDENCE &&
      signal.criteria_met <= CONFIG.MAX_BEARISH_CRITERIA
    ) {
      const lastSignal = this.lastSignalTime.get(symbol);
      const now = Date.now();

      if (!lastSignal || now - lastSignal > 5 * 60 * 1000) {
        const saved = await this.db.saveBearishSignal(signal);

        if (saved) {
          this.lastSignalTime.set(symbol, now);
          console.log(
            `📉 BEARISH SIGNAL SAVED: ${symbol} - ${signal.signal_type} (${(
              signal.probability * 100
            ).toFixed(0)}% confidence) @ ₹${signal.current_price}`
          );
        }
      }
    }

    // Check if it's a swing positional signal (new logic)
    if (swingSignal && swingSignal.criteria_met >= 5) {
      const lastSwingSignal = this.lastSwingSignalTime?.get(symbol);
      const now = Date.now();

      // Save swing signals less frequently (once per hour)
      if (!lastSwingSignal || now - lastSwingSignal > 60 * 60 * 1000) {
        const saved = await this.db.saveSwingPositionalSignal(swingSignal);

        if (saved) {
          if (!this.lastSwingSignalTime) {
            this.lastSwingSignalTime = new Map();
          }
          this.lastSwingSignalTime.set(symbol, now);
          console.log(
            `📅 SWING POSITIONAL SAVED: ${symbol} - ${swingSignal.signal_type} (${(
              swingSignal.probability * 100
            ).toFixed(0)}% confidence) @ ₹${swingSignal.current_price}`
          );
        }
      }
    }
  }

  isMarketOpen() {
    const now = new Date();
    const istTime = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );

    const hour = istTime.getHours();
    const minute = istTime.getMinutes();
    const day = istTime.getDay();

    if (day === 0 || day === 6) return false;

    const marketOpen =
      hour > CONFIG.MARKET_OPEN_HOUR ||
      (hour === CONFIG.MARKET_OPEN_HOUR && minute >= CONFIG.MARKET_OPEN_MINUTE);
    const marketClose =
      hour < CONFIG.MARKET_CLOSE_HOUR ||
      (hour === CONFIG.MARKET_CLOSE_HOUR &&
        minute <= CONFIG.MARKET_CLOSE_MINUTE);

    return marketOpen && marketClose;
  }

  async start() {
    console.log("🚀 Starting Zerodha KiteConnect scanner...");
    console.log(
      `📊 Monitoring ${this.symbols.length} NSE stocks via KiteTicker...`
    );

    setInterval(() => {
      const symbolsWithTicks = [];
      const symbolsWithoutTicks = [];

      this.symbols.forEach((symbolData) => {
        const count = this.tickCount.get(symbolData.symbol) || 0;
        if (count > 0) {
          symbolsWithTicks.push(`${symbolData.symbol}(${count})`);
        } else {
          symbolsWithoutTicks.push(symbolData.symbol);
        }
      });

      console.log(
        `\n📊 TICK DATA STATUS (${new Date().toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
        })}):`
      );
      console.log(`   ✅ Receiving ticks: ${symbolsWithTicks.length} symbols`);
      console.log(`   ❌ No ticks yet: ${symbolsWithoutTicks.length} symbols`);

      if (symbolsWithTicks.length > 0) {
        console.log(
          `   Top 10 active: ${symbolsWithTicks.slice(0, 10).join(", ")}`
        );
      }
    }, 5 * 60 * 1000);
  }

  async shutdown() {
    console.log("🛑 Shutting down scanner...");
    if (this.tickerManager) {
      this.tickerManager.disconnect();
    }
  }
}

// =================================================================
// 🎬 MAIN EXECUTION
// =================================================================

(async () => {
  const scanner = new EnhancedBreakoutScanner();

  try {
    const initialized = await scanner.initialize();

    if (!initialized) {
      console.error("❌ Failed to initialize scanner");
      process.exit(1);
    }

    await scanner.start();

    console.log("✅ Scanner is running with Zerodha KiteTicker!");
    console.log("   Press Ctrl+C to stop");

    process.on("SIGINT", async () => {
      console.log("\n🛑 Received SIGINT, shutting down...");
      await scanner.shutdown();
      process.exit(0);
    });
  } catch (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  }
})();
