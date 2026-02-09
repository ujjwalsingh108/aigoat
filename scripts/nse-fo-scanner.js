require("dotenv").config();
const { DatabaseClient } = require("./utils/database-client");
const { TechnicalIndicators } = require("./utils/indicators");
const { ScannerMonitor, MarketHoursChecker } = require("./utils/monitor");
const { PatternDetector } = require("./pattern-detector");
const { AiBreakoutFilter } = require("./utils/ai-breakout-filter");
const cache = require("./memory-cache");

// =================================================================
// 🔧 CONFIGURATION
// =================================================================

const CONFIG = {
  // Database
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  MAX_DB_RETRIES: 3,
  DB_RETRY_DELAY: 2000,

  // Scanner settings
  SCAN_INTERVAL_MS: parseInt(process.env.SCAN_INTERVAL_MS) || 60000, // 60 seconds
  SYMBOLS_LIMIT: 50, // Top 50 most liquid NIFTY options (ATM ±5 strikes)
  
  // Technical analysis (5-min timeframe for F&O)
  EMA_PERIOD: 20,
  RSI_PERIOD: 14,
  MIN_CANDLES_FOR_ANALYSIS: 20,
  
  // F&O specific filters
  FOCUS_UNDERLYINGS: ["NIFTY"], // Start with NIFTY only
  
  // Signal generation (more aggressive for F&O)
  MIN_CONFIDENCE_TO_SAVE: 0.7, // Higher threshold for options
  MIN_CRITERIA_MET: 4,
  
  // Cleanup
  SIGNAL_TTL_MINUTES: 15, // F&O signals expire in 15 minutes
  CLEANUP_INTERVAL_MS: 5 * 60 * 1000, // 5 minutes
};


// =================================================================
// 📊 NSE F&O SCANNER (BATCH MODE)
// =================================================================

class NseFoScanner {
  constructor() {
    this.db = new DatabaseClient(CONFIG);
    this.monitor = new ScannerMonitor('NSE_FO');
    this.patternDetector = new PatternDetector();
    this.aiFilter = new AiBreakoutFilter();
    this.symbols = [];
    this.scanInterval = null;
    this.cleanupInterval = null;
  }

  async initialize() {
    console.log("🚀 Initializing NSE F&O Scanner (Batch Mode)...");
    console.log(`📊 Configuration:
      - Scan Interval: ${CONFIG.SCAN_INTERVAL_MS / 1000}s
      - Symbols Limit: ${CONFIG.SYMBOLS_LIMIT}
      - Min Confidence: ${CONFIG.MIN_CONFIDENCE_TO_SAVE}
    `);

    try {
      // Get active NIFTY PE/CE options near ATM
      this.symbols = await this.db.getNseFoSymbols('NIFTY', CONFIG.SYMBOLS_LIMIT);
      
      if (this.symbols.length === 0) {
        throw new Error("No NSE F&O symbols loaded");
      }

      console.log(`✅ Loaded ${this.symbols.length} NSE F&O symbols`);
      console.log(`📊 Sample: ${this.symbols.slice(0, 5).map(s => s.symbol).join(', ')}`);
      
      return true;
    } catch (error) {
      console.error("❌ Initialization failed:", error);
      return false;
    }
  }

  async scanAllSymbols() {
    const startTime = Date.now();
    let totalSignals = 0;

    console.log(`\n🔍 Starting NSE F&O scan at ${new Date().toLocaleTimeString()}...`);

    for (const symbolData of this.symbols) {
      try {
        const signal = await this.analyzeSymbol(symbolData);
        
        if (signal) {
          // AI validation for F&O signals
          const aiResult = await this.aiFilter.validateBreakout(signal.data, { 
            patterns: signal.patterns, 
            historicalCandles: signal.historical 
          });
          
          if (this.aiFilter.shouldSaveSignal(aiResult, CONFIG.MIN_CONFIDENCE_TO_SAVE)) {
            const enrichedSignal = {
              ...signal.data,
              ai_verdict: aiResult.verdict,
              ai_confidence: aiResult.confidence,
              ai_reasoning: aiResult.reasoning,
              ai_risk_factors: JSON.stringify(aiResult.risk_factors),
            };
            
            await this.db.saveNseFoSignal(enrichedSignal);
            totalSignals++;
          }
        }
      } catch (error) {
        if (error.message && !error.message.includes('rate limit')) {
          console.error(`⚠️ Error analyzing ${symbolData.symbol}:`, error.message);
        }
      }
    }

    const duration = Date.now() - startTime;
    
    this.monitor.recordScan(duration, totalSignals);
    console.log(`✅ Scan complete: ${totalSignals} signals | ${duration}ms`);
  }

  async analyzeSymbol(symbolData) {
    const symbol = symbolData.symbol;

    // Fetch 5-min historical data with cache
    const historicalCacheKey = `nse_fo_hist_${symbol}_50`;
    let historical = cache.get(historicalCacheKey);
    
    if (!historical) {
      historical = await this.db.getNseFoHistoricalData(symbol, 50);
      // Cache for 5 minutes (gets fresh data every few scans)
      cache.set(historicalCacheKey, historical, 300);
    }

    if (historical.length < CONFIG.MIN_CANDLES_FOR_ANALYSIS) {
      return null;
    }

    // Get current candle (last 5-min candle)
    const currentCandle = historical[historical.length - 1];
    const currentPrice = parseFloat(currentCandle.close);
    const prices = historical.map(c => parseFloat(c.close));

    // Calculate indicators
    const ema20 = TechnicalIndicators.calculateEMA(prices, CONFIG.EMA_PERIOD);
    const rsi = TechnicalIndicators.calculateRSI(prices, CONFIG.RSI_PERIOD);
    
    if (!ema20 || !rsi) {
      return null;
    }

    // Calculate volume metrics
    const currentVolume = currentCandle.volume || 0;
    const avgVolume = historical.reduce((sum, c) => sum + (c.volume || 0), 0) / historical.length;
    const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 0;

    // Detect chart patterns
    const patterns = this.patternDetector.detectAllPatterns(historical);

    // Check breakout criteria
    const breakoutSignal = this.checkBreakout({
      symbolData,
      currentPrice,
      currentCandle,
      ema20,
      rsi,
      volumeRatio,
      avgVolume,
      patterns,
      historical,
    });

    if (!breakoutSignal) {
      return null;
    }

    return {
      data: breakoutSignal,
      patterns,
      historical,
    };
  }

  checkBreakout({ symbolData, currentPrice, currentCandle, ema20, rsi, volumeRatio, avgVolume, patterns, historical }) {
    let criteriaMet = 0;
    const criteria = [];
    let signalType = null;

    // Determine signal type (Bullish or Bearish)
    const isBullish = currentPrice > ema20 && rsi >= 50 && rsi <= 80;
    const isBearish = currentPrice < ema20 && rsi >= 20 && rsi < 50;

    if (!isBullish && !isBearish) {
      return null;
    }

    signalType = isBullish ? 'BULLISH_BREAKOUT' : 'BEARISH_BREAKDOWN';

    // Criterion 1: Price vs EMA20
    if (isBullish && currentPrice > ema20) {
      criteriaMet++;
      criteria.push("Price above EMA20");
    } else if (isBearish && currentPrice < ema20) {
      criteriaMet++;
      criteria.push("Price below EMA20");
    }

    // Criterion 2: RSI in momentum zone
    if (isBullish && rsi >= 50 && rsi <= 80) {
      criteriaMet++;
      criteria.push("RSI in bullish zone");
    } else if (isBearish && rsi >= 20 && rsi < 50) {
      criteriaMet++;
      criteria.push("RSI in bearish zone");
    }

    // Criterion 3: Volume breakout (2x average for F&O)
    if (volumeRatio >= 2.0) {
      criteriaMet++;
      criteria.push(`Volume ${volumeRatio.toFixed(2)}x average`);
    }

    // Criterion 4: Price momentum
    const prevCandle = historical[historical.length - 2];
    const priceChange = ((currentPrice - prevCandle.close) / prevCandle.close) * 100;
    
    if (isBullish && priceChange > 0.5) {
      criteriaMet++;
      criteria.push(`+${priceChange.toFixed(2)}% momentum`);
    } else if (isBearish && priceChange < -0.5) {
      criteriaMet++;
      criteria.push(`${priceChange.toFixed(2)}% momentum`);
    }

    // Criterion 5: Pattern detection
    if (patterns.strongest) {
      const patternMatch = (isBullish && patterns.strongest.type.includes('bullish')) ||
                          (isBearish && patterns.strongest.type.includes('bearish'));
      if (patternMatch) {
        criteriaMet++;
        criteria.push(`Pattern: ${patterns.strongest.name}`);
      }
    }

    const confidence = criteriaMet / 5;

    if (criteriaMet >= CONFIG.MIN_CRITERIA_MET && confidence >= CONFIG.MIN_CONFIDENCE_TO_SAVE) {
      // Calculate targets and stop loss for options
      const swingLow = TechnicalIndicators.findRecentSwingLow(historical, 10);
      const swingHigh = TechnicalIndicators.findRecentSwingHigh(historical, 10);
      
      // For options, use tighter stops and more aggressive targets
      const stopLoss = isBullish 
        ? (swingLow ? parseFloat(swingLow.toFixed(2)) : parseFloat((currentPrice * 0.95).toFixed(2)))
        : (swingHigh ? parseFloat(swingHigh.toFixed(2)) : parseFloat((currentPrice * 1.05).toFixed(2)));
      
      const target1 = isBullish 
        ? parseFloat((currentPrice * 1.10).toFixed(2)) // 10% target
        : parseFloat((currentPrice * 0.90).toFixed(2));
      
      const target2 = isBullish 
        ? parseFloat((currentPrice * 1.20).toFixed(2)) // 20% target
        : parseFloat((currentPrice * 0.80).toFixed(2));
      
      return {
        symbol: symbolData.symbol,
        instrument_token: symbolData.instrument_token,
        underlying: symbolData.underlying,
        instrument_type: symbolData.instrument_type,
        expiry: symbolData.expiry,
        strike: symbolData.strike,
        option_type: symbolData.option_type,
        signal_type: signalType,
        entry_price: currentPrice,
        ema20_5min: parseFloat(ema20.toFixed(2)),
        rsi14_5min: parseFloat(rsi.toFixed(2)),
        volume: currentCandle.volume || 0,
        avg_volume: Math.round(avgVolume),
        candle_time: currentCandle.timestamp,
        target1,
        target2,
        stop_loss: stopLoss,
        probability: parseFloat(confidence.toFixed(2)),
        criteria_met: criteriaMet,
        is_active: true,
        created_at: new Date().toISOString(),
      };
    }

    return null;
  }

  async cleanupStaleSignals() {
    try {
      await this.db.cleanupStaleSignals('nse_fo_signals', CONFIG.SIGNAL_TTL_MINUTES);
      console.log(`🧹 Cleaned up stale F&O signals older than ${CONFIG.SIGNAL_TTL_MINUTES} minutes`);
    } catch (error) {
      console.error('❌ Cleanup failed:', error.message);
    }
  }

  async start() {
    console.log("🚀 Starting NSE F&O Scanner (Batch Mode)...");

    const initialized = await this.initialize();
    if (!initialized) {
      console.error("❌ Failed to initialize scanner. Exiting.");
      process.exit(1);
    }

    // Run immediate scan
    await this.scanAllSymbols();

    // Schedule periodic scans
    this.scanInterval = setInterval(async () => {
      // Only scan during market hours
      if (MarketHoursChecker.isMarketOpen()) {
        await this.scanAllSymbols();
      } else {
        console.log("⏸️ Market closed. Waiting for next market open...");
        const nextOpen = MarketHoursChecker.getNextMarketOpen();
        console.log(`📅 Next market open: ${nextOpen.toLocaleString()}`);
      }
    }, CONFIG.SCAN_INTERVAL_MS);

    // Schedule cleanup
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupStaleSignals();
    }, CONFIG.CLEANUP_INTERVAL_MS);

    // Log status every 10 minutes
    setInterval(() => {
      this.monitor.logStatus();
      this.monitor.logMemoryUsage();
      this.aiFilter.logStats();
    }, 10 * 60 * 1000);

    console.log(`✅ Scanner running. Scanning every ${CONFIG.SCAN_INTERVAL_MS / 1000}s...`);
  }

  stop() {
    if (this.scanInterval) clearInterval(this.scanInterval);
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    console.log("⏹️ NSE F&O Scanner stopped.");
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
