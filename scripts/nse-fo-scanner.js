require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const { PatternDetector } = require("./pattern-detector");
const { AiBreakoutFilter } = require("./utils/ai-breakout-filter");

// =================================================================
// 🔧 CONFIGURATION
// =================================================================

const CONFIG = {
  // Supabase connection
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,

  // Scanner settings
  CANDLE_INTERVAL_MS: 5 * 60 * 1000, // 5 minutes
  
  // Trading hours (IST)
  MARKET_OPEN_HOUR: 9,
  MARKET_OPEN_MINUTE: 15,
  MARKET_CLOSE_HOUR: 15,
  MARKET_CLOSE_MINUTE: 30,

  // Technical analysis
  EMA_PERIOD: 20,
  MIN_CANDLES_FOR_ANALYSIS: 20,

  // F&O specific filters
  FOCUS_UNDERLYINGS: ["NIFTY", "BANKNIFTY", "FINNIFTY"],
  MIN_OI_THRESHOLD: 100000, // Minimum Open Interest
  MAX_STRIKES_FROM_ATM: 2, // ATM ± 2 strikes
  NEAR_MONTH_EXPIRY_ONLY: true,
  
  // IV filters (percentile-based)
  MAX_IV_PERCENTILE_FOR_BUY: 30, // Buy options when IV < 30th percentile
  
  // Signal generation
  DISTANCE_FROM_SWING_LIMIT: 150, // Max 150 points from swing
  TARGET1_POINTS: 50,
  TARGET2_POINTS: 75,
  
  // Performance
  SCAN_INTERVAL_MS: 60000, // Scan every 60 seconds
};

// =================================================================
// 📊 DATABASE CLIENT
// =================================================================

class FoDatabaseClient {
  constructor() {
    this.supabase = createClient(
      CONFIG.SUPABASE_URL,
      CONFIG.SUPABASE_SERVICE_KEY
    );
  }

  async getNseFoInstruments() {
    try {
      console.log("📊 Fetching NSE F&O instruments...");

      // Get futures + options for NIFTY, BANKNIFTY, FINNIFTY
      const { data, error } = await this.supabase
        .from("kite_nse_fo_symbols")
        .select("symbol, instrument_token, underlying, instrument_type, expiry, strike, option_type")
        .eq("is_active", true)
        .in("underlying", CONFIG.FOCUS_UNDERLYINGS)
        .order("expiry", { ascending: true });

      if (error) throw error;

      console.log(`✅ Loaded ${data.length} NSE F&O instruments`);
      
      // Filter for near-month expiries
      const filtered = this.filterNearMonthExpiries(data);
      console.log(`✅ After expiry filter: ${filtered.length} instruments`);
      
      return filtered;
    } catch (error) {
      console.error("❌ Error fetching NSE F&O instruments:", error);
      return [];
    }
  }

  filterNearMonthExpiries(instruments) {
    const today = new Date();
    const grouped = {};

    // Group by underlying
    instruments.forEach(inst => {
      if (!grouped[inst.underlying]) {
        grouped[inst.underlying] = [];
      }
      grouped[inst.underlying].push(inst);
    });

    const result = [];

    // For each underlying, keep only next 2 expiries
    Object.entries(grouped).forEach(([underlying, instList]) => {
      const expiries = [...new Set(instList.map(i => i.expiry))];
      const nearExpiries = expiries
        .filter(exp => new Date(exp) >= today)
        .slice(0, 2); // Current week + next week

      instList.forEach(inst => {
        if (nearExpiries.includes(inst.expiry)) {
          result.push(inst);
        }
      });
    });

    return result;
  }

  async getHistoricalData(symbol, limit = 50) {
    try {
      const { data, error } = await this.supabase
        .from("historical_prices_nse_fo")
        .select("date, time, timestamp, open, high, low, close, volume")
        .eq("symbol", symbol)
        .order("timestamp", { ascending: false })
        .limit(limit);

      if (error) throw error;
      
      return data ? data.reverse() : [];
    } catch (error) {
      console.error(`❌ Error fetching historical data for ${symbol}:`, error.message);
      return [];
    }
  }

  async saveNseFoSignal(signal) {
    try {
      const { error } = await this.supabase
        .from("nse_fo_signals")
        .upsert(
          {
            symbol: signal.symbol,
            underlying: signal.underlying,
            instrument_type: signal.instrument_type,
            strike: signal.strike,
            option_type: signal.option_type,
            signal_type: signal.signal_type,
            signal_direction: signal.signal_direction,
            entry_price: signal.entry_price,
            target1: signal.target1,
            target2: signal.target2,
            stop_loss: signal.stop_loss,
            ema20_5min: signal.ema20_5min,
            swing_reference_price: signal.swing_reference_price,
            distance_from_swing: signal.distance_from_swing,
            open_interest: signal.open_interest,
            oi_change: signal.oi_change,
            implied_volatility: signal.implied_volatility,
            confidence_score: signal.confidence_score,
            created_by: "nse_fo_scanner",
            last_scanned_at: new Date().toISOString(),
          },
          {
            onConflict: "symbol",
            ignoreDuplicates: false,
          }
        );

      if (error) {
        console.error(`❌ Error saving NSE F&O signal for ${signal.symbol}:`, error.message);
        return false;
      }

      return true;
    } catch (error) {
      console.error(`❌ Error saving NSE F&O signal:`, error.message);
      return false;
    }
  }
}

// =================================================================
// 📈 TECHNICAL ANALYSIS
// =================================================================

class TechnicalAnalyzer {
  calculateEMA(prices, period) {
    if (!prices || prices.length < period) return null;

    const multiplier = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;

    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }

    return ema;
  }

  findRecentSwingLow(candles, lookback = 10) {
    if (!candles || candles.length < lookback) return null;
    
    const recentCandles = candles.slice(-lookback);
    const lows = recentCandles.map(c => parseFloat(c.low));
    return Math.min(...lows);
  }

  findRecentSwingHigh(candles, lookback = 10) {
    if (!candles || candles.length < lookback) return null;
    
    const recentCandles = candles.slice(-lookback);
    const highs = recentCandles.map(c => parseFloat(c.high));
    return Math.max(...highs);
  }

  detectPatterns(candles) {
    try {
      if (!candles || candles.length < 10) return null;
      
      // Convert to format expected by PatternDetector
      const formattedCandles = candles.map(c => ({
        open: parseFloat(c.open),
        high: parseFloat(c.high),
        low: parseFloat(c.low),
        close: parseFloat(c.close),
        volume: parseInt(c.volume || 0)
      }));
      
      return this.patternDetector.detectAllPatterns(formattedCandles);
    } catch (error) {
      return null;
    }
  }

  analyzeIntradayIndex(underlying, historicalCandles, currentPrice) {
    if (!currentPrice || !historicalCandles || historicalCandles.length < CONFIG.EMA_PERIOD) {
      return null;
    }

    const prices = historicalCandles.map(c => parseFloat(c.close));
    prices.push(currentPrice);

    const ema20 = this.calculateEMA(prices, CONFIG.EMA_PERIOD);
    if (!ema20) return null;

    const swingLow = this.findRecentSwingLow(historicalCandles, 10);
    const swingHigh = this.findRecentSwingHigh(historicalCandles, 10);

    let signal = null;

    // Detect chart patterns
    const patterns = this.detectPatterns(historicalCandles);
    const hasConfirmingPattern = patterns && patterns.strongest && 
      ((currentPrice > ema20 && patterns.strongest.type.includes('bullish')) ||
       (currentPrice < ema20 && patterns.strongest.type.includes('bearish')));

    // LONG SIGNAL: Price > EMA20 AND within 150 points of swing low
    if (currentPrice > ema20 && swingLow) {
      const distanceFromSwingLow = currentPrice - swingLow;
      
      if (distanceFromSwingLow <= CONFIG.DISTANCE_FROM_SWING_LIMIT) {
        signal = {
          underlying,
          signal_type: 'FO_LONG',
          signal_direction: 'LONG',
          index_price: currentPrice,
          ema20_5min: parseFloat(ema20.toFixed(2)),
          swing_reference_price: parseFloat(swingLow.toFixed(2)),
          distance_from_swing: parseFloat(distanceFromSwingLow.toFixed(2)),
          target1_index: parseFloat((currentPrice + CONFIG.TARGET1_POINTS).toFixed(2)),
          target2_index: parseFloat((currentPrice + CONFIG.TARGET2_POINTS).toFixed(2)),
          stop_loss_index: parseFloat(swingLow.toFixed(2)),
          pattern: patterns?.strongest?.name || null,
          pattern_confidence: patterns?.strongest?.confidence || null,
          has_confirming_pattern: hasConfirmingPattern,
        };
      }
    }
    // SHORT SIGNAL: Price < EMA20 AND within 150 points of swing high
    else if (currentPrice < ema20 && swingHigh) {
      const distanceFromSwingHigh = swingHigh - currentPrice;
      
      if (distanceFromSwingHigh <= CONFIG.DISTANCE_FROM_SWING_LIMIT) {
        signal = {
          underlying,
          signal_type: 'FO_SHORT',
          signal_direction: 'SHORT',
          index_price: currentPrice,
          ema20_5min: parseFloat(ema20.toFixed(2)),
          swing_reference_price: parseFloat(swingHigh.toFixed(2)),
          distance_from_swing: parseFloat(distanceFromSwingHigh.toFixed(2)),
          target1_index: parseFloat((currentPrice - CONFIG.TARGET1_POINTS).toFixed(2)),
          target2_index: parseFloat((currentPrice - CONFIG.TARGET2_POINTS).toFixed(2)),
          stop_loss_index: parseFloat(swingHigh.toFixed(2)),
          pattern: patterns?.strongest?.name || null,
          pattern_confidence: patterns?.strongest?.confidence || null,
          has_confirming_pattern: hasConfirmingPattern,
        };
      }
    }

    return signal;
  }
}

// =================================================================
// 🎯 F&O SCANNER
// =================================================================

class NseFoScanner {
  constructor() {
    this.db = new FoDatabaseClient();
    this.analyzer = new TechnicalAnalyzer();
    this.patternDetector = new PatternDetector();
    this.aiFilter = new AiBreakoutFilter();
    this.kite = null;
    this.instruments = [];
    this.underlyingPrices = new Map(); // Track NIFTY, BANKNIFTY, FINNIFTY prices
    this.scanInterval = null;
  }

  async initialize() {
    console.log("🚀 Initializing NSE F&O Scanner...");
    console.log(`📊 Configuration:
      - Underlyings: ${CONFIG.FOCUS_UNDERLYINGS.join(", ")}
      - Min OI: ${CONFIG.MIN_OI_THRESHOLD.toLocaleString()}
      - Strike Range: ATM ± ${CONFIG.MAX_STRIKES_FROM_ATM}
      - Scan Interval: ${CONFIG.SCAN_INTERVAL_MS / 1000}s
    `);

    try {
      this.instruments = await this.db.getNseFoInstruments();

      if (this.instruments.length === 0) {
        throw new Error("No NSE F&O instruments loaded");
      }

      console.log(`✅ Scanner initialized with ${this.instruments.length} F&O instruments`);
      return true;
    } catch (error) {
      console.error("❌ Initialization failed:", error);
      return false;
    }
  }

  async getUnderlyingPrice(underlying) {
    try {
      // Get latest candle from historical data
      const historical = await this.db.getHistoricalData(underlying, 1);
      
      if (historical.length === 0) return null;
      
      return parseFloat(historical[0].close);
    } catch (error) {
      console.error(`❌ Error fetching ${underlying} price:`, error.message);
      return null;
    }
  }

  findATMStrike(price, strikeInterval = 50) {
    // Round to nearest strike
    return Math.round(price / strikeInterval) * strikeInterval;
  }

  async selectBestOption(underlying, signalDirection, indexPrice) {
    // Find ATM strike
    const atmStrike = this.findATMStrike(indexPrice, underlying === 'BANKNIFTY' ? 100 : 50);
    
    // Determine option type
    const optionType = signalDirection === 'LONG' ? 'CE' : 'PE';
    
    // Get strikes within range (ATM ± MAX_STRIKES_FROM_ATM)
    const strikeInterval = underlying === 'BANKNIFTY' ? 100 : 50;
    const minStrike = atmStrike - (CONFIG.MAX_STRIKES_FROM_ATM * strikeInterval);
    const maxStrike = atmStrike + (CONFIG.MAX_STRIKES_FROM_ATM * strikeInterval);

    // Filter instruments
    const candidates = this.instruments.filter(inst => 
      inst.underlying === underlying &&
      inst.instrument_type === 'OPT' &&
      inst.option_type === optionType &&
      inst.strike >= minStrike &&
      inst.strike <= maxStrike
    );

    if (candidates.length === 0) return null;

    // Get latest data for all candidates from historical database
    try {
      // Select strike with highest OI that meets threshold
      let bestOption = null;
      let highestOI = 0;

      for (const candidate of candidates) {
        // Get latest historical data for this option
        const optionHistory = await this.db.getHistoricalData(candidate.symbol, 1);
        
        if (optionHistory.length === 0) continue;

        const latestCandle = optionHistory[0];
        const oi = parseInt(latestCandle.oi || 0);
        const volume = parseInt(latestCandle.volume || 0);

        if (oi >= CONFIG.MIN_OI_THRESHOLD && oi > highestOI) {
          highestOI = oi;
          bestOption = {
            ...candidate,
            entry_price: parseFloat(latestCandle.close),
            open_interest: oi,
            oi_change: volume, // Use volume as proxy for OI change
            implied_volatility: 0, // Set to 0 or calculate if IV data available
            bid: parseFloat(latestCandle.close) * 0.995, // Approximate bid
            ask: parseFloat(latestCandle.close) * 1.005, // Approximate ask
          };
        }
      }

      return bestOption;
    } catch (error) {
      console.error(`❌ Error fetching option quotes for ${underlying}:`, error.message);
      return null;
    }
  }

  async scanForSignals() {
    console.log(`\n🔍 Scanning NSE F&O at ${new Date().toLocaleTimeString()}...`);

    const signals = [];

    for (const underlying of CONFIG.FOCUS_UNDERLYINGS) {
      try {
        // Get current index price
        const indexPrice = await this.getUnderlyingPrice(underlying);
        if (!indexPrice) {
          console.log(`⚠️ Could not fetch ${underlying} price`);
          continue;
        }

        console.log(`📊 ${underlying}: ${indexPrice.toFixed(2)}`);

        // Get historical data for the underlying futures
        const futuresSymbol = `${underlying}26FEBFUT`; // Adjust month dynamically in production
        const historicalData = await this.db.getHistoricalData(futuresSymbol, 50);

        if (historicalData.length < CONFIG.MIN_CANDLES_FOR_ANALYSIS) {
          console.log(`⚠️ Insufficient historical data for ${underlying}`);
          continue;
        }

        // Analyze index for signal
        const indexSignal = this.analyzer.analyzeIntradayIndex(
          underlying,
          historicalData,
          indexPrice
        );

        if (!indexSignal) {
          console.log(`   No signal for ${underlying}`);
          continue;
        }

        console.log(`   ✅ ${indexSignal.signal_direction} signal for ${underlying}`);

        // Find best option contract
        const bestOption = await this.selectBestOption(
          underlying,
          indexSignal.signal_direction,
          indexPrice
        );

        if (!bestOption) {
          console.log(`   ⚠️ No suitable option found for ${underlying}`);
          continue;
        }

        // Calculate option targets (premium-based)
        const entryPremium = bestOption.entry_price;
        const target1Premium = entryPremium * 1.20; // +20%
        const target2Premium = entryPremium * 1.30; // +30%
        const stopLossPremium = entryPremium * 0.85; // -15%

        const signal = {
          symbol: bestOption.symbol,
          underlying: bestOption.underlying,
          instrument_type: bestOption.instrument_type,
          strike: bestOption.strike,
          option_type: bestOption.option_type,
          signal_type: indexSignal.signal_type,
          signal_direction: indexSignal.signal_direction,
          entry_price: parseFloat(entryPremium.toFixed(2)),
          target1: parseFloat(target1Premium.toFixed(2)),
          target2: parseFloat(target2Premium.toFixed(2)),
          stop_loss: parseFloat(stopLossPremium.toFixed(2)),
          ema20_5min: indexSignal.ema20_5min,
          swing_reference_price: indexSignal.swing_reference_price,
          distance_from_swing: indexSignal.distance_from_swing,
          open_interest: bestOption.open_interest,
          oi_change: bestOption.oi_change,
          implied_volatility: parseFloat(bestOption.implied_volatility.toFixed(2)),
          confidence_score: 0.75, // Base confidence for F&O signals
          pattern: indexSignal.pattern,
          pattern_confidence: indexSignal.pattern_confidence,
          has_confirming_pattern: indexSignal.has_confirming_pattern,
        };

        // AI validation
        const aiResult = await this.aiFilter.validateBreakout(signal, { 
          patterns: indexSignal.pattern ? { strongest: { name: indexSignal.pattern, confidence: indexSignal.pattern_confidence } } : null,
          historicalCandles: historicalData 
        });
        
        if (this.aiFilter.shouldSaveSignal(aiResult, 0.7)) { // Higher threshold for F&O (70%)
          // Merge AI result
          const enrichedSignal = {
            ...signal,
            ai_verdict: aiResult.verdict,
            ai_confidence: aiResult.confidence,
            ai_reasoning: aiResult.reasoning,
            ai_risk_factors: JSON.stringify(aiResult.risk_factors),
            ai_validated: aiResult.ai_validated,
          };

          signals.push(enrichedSignal);
          
          console.log(`   💾 Signal: ${signal.symbol} @ ₹${signal.entry_price} (AI: ${aiResult.verdict}) (OI: ${signal.open_interest.toLocaleString()})`);

          // Save to database
          await this.db.saveNseFoSignal(enrichedSignal);
        } else {
          console.log(`   ❌ Rejected by AI: ${signal.symbol} (${aiResult.verdict})`);
        }

      } catch (error) {
        console.error(`❌ Error scanning ${underlying}:`, error.message);
      }
    }

    console.log(`\n✅ Scan complete. Generated ${signals.length} signals.`);
    return signals;
  }

  async start() {
    console.log("🚀 Starting NSE F&O Scanner...");

    const initialized = await this.initialize();
    if (!initialized) {
      console.error("❌ Failed to initialize scanner. Exiting.");
      process.exit(1);
    }

    // Run initial scan
    await this.scanForSignals();

    // Schedule periodic scans
    this.scanInterval = setInterval(async () => {
      await this.scanForSignals();
    }, CONFIG.SCAN_INTERVAL_MS);

    console.log(`✅ Scanner running. Scanning every ${CONFIG.SCAN_INTERVAL_MS / 1000}s...`);
  }

  stop() {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      console.log("⏹️ NSE F&O Scanner stopped.");
    }
  }
}

// =================================================================
// 🎬 MAIN EXECUTION
// =================================================================

const scanner = new NseFoScanner();

scanner.start().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n⏹️ Shutting down NSE F&O Scanner...");
  scanner.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n⏹️ Shutting down NSE F&O Scanner...");
  scanner.stop();
  process.exit(0);
});
