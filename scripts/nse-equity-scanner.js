require("dotenv").config();
const { DatabaseClient } = require("./utils/database-client");
const { TechnicalIndicators } = require("./utils/indicators");
const { ScannerMonitor, MarketHoursChecker } = require("./utils/monitor");
const { PatternDetector } = require("./pattern-detector");

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
  SYMBOLS_LIMIT: 1000,
  
  // Technical analysis
  EMA_PERIOD: 20,
  RSI_PERIOD: 14,
  MIN_CANDLES_FOR_ANALYSIS: 20,
  
  // Signal generation
  MIN_CONFIDENCE_TO_SAVE: 0.6, // Bullish
  MIN_CRITERIA_MET: 4,
  MIN_BEARISH_CONFIDENCE: 0.3, // Bearish
  MAX_BEARISH_CRITERIA: 2,
  
  // Cleanup
  SIGNAL_TTL_MINUTES: 15,
  CLEANUP_INTERVAL_MS: 5 * 60 * 1000, // 5 minutes
};

// =================================================================
// 📊 NSE Equity SCANNER (BATCH MODE)
// =================================================================

class NseEquityScanner {
  constructor() {
    this.db = new DatabaseClient(CONFIG);
    this.monitor = new ScannerMonitor('NSE_EQUITY');
    this.patternDetector = new PatternDetector();
    this.symbols = [];
    this.scanInterval = null;
    this.cleanupInterval = null;
  }

  async initialize() {
    console.log("🚀 Initializing NSE Equity Scanner (Batch Mode)...");
    console.log(`📊 Configuration:
      - Scan Interval: ${CONFIG.SCAN_INTERVAL_MS / 1000}s
      - Symbols Limit: ${CONFIG.SYMBOLS_LIMIT}
      - Min Confidence: ${CONFIG.MIN_CONFIDENCE_TO_SAVE}
    `);

    try {
      this.symbols = await this.db.getEquitySymbols('NSE', CONFIG.SYMBOLS_LIMIT);
      
      if (this.symbols.length === 0) {
        throw new Error("No BSE symbols loaded");
      }

      console.log(`✅ Loaded ${this.symbols.length} NSE Equity symbols`);
      console.log(`📊 Sample: ${this.symbols.slice(0, 5).map(s => s.symbol).join(', ')}`);
      
      return true;
    } catch (error) {
      console.error("❌ Initialization failed:", error);
      return false;
    }
  }

  async scanAllSymbols() {
    const startTime = Date.now();
    let bullishSignals = 0;
    let bearishSignals = 0;

    console.log(`\n🔍 Starting NSE Equity scan at ${new Date().toLocaleTimeString()}...`);

    for (const symbolData of this.symbols) {
      try {
        const { signal, type } = await this.analyzeSymbol(symbolData);
        
        if (signal && type === 'bullish') {
          await this.db.saveBullishSignal(signal, 'breakout_signals');
          bullishSignals++;
        } else if (signal && type === 'bearish') {
          await this.db.saveBearishSignal(signal, 'intraday_bearish_signals');
          bearishSignals++;
        }
      } catch (error) {
        // Skip individual symbol errors, continue scanning
        if (error.message && !error.message.includes('rate limit')) {
          console.error(`⚠️ Error analyzing ${symbolData.symbol}:`, error.message);
        }
      }
    }

    const duration = Date.now() - startTime;
    const totalSignals = bullishSignals + bearishSignals;
    
    this.monitor.recordScan(duration, totalSignals);
    console.log(`✅ Scan complete: ${bullishSignals} bullish, ${bearishSignals} bearish | ${duration}ms`);
  }

  async analyzeSymbol(symbolData) {
    const symbol = symbolData.symbol;

    // Fetch historical and daily data
    const [historical, daily] = await Promise.all([
      this.db.getHistoricalData(symbol, 'historical_prices_nse_equity', 50),
      this.db.getDailyCandles(symbol, 'historical_prices_nse_equity', 365),
    ]);

    if (historical.length < CONFIG.MIN_CANDLES_FOR_ANALYSIS || daily.length === 0) {
      return { signal: null, type: null };
    }

    // Get current candle (last 5-min candle)
    const currentCandle = historical[historical.length - 1];
    const currentPrice = parseFloat(currentCandle.close);
    const prices = historical.map(c => parseFloat(c.close));

    // Calculate indicators
    const ema20 = TechnicalIndicators.calculateEMA(prices, CONFIG.EMA_PERIOD);
    const rsi = TechnicalIndicators.calculateRSI(prices, CONFIG.RSI_PERIOD);
    const volatility = TechnicalIndicators.calculateWeeklyVolatility(daily);
    const volumeOk = TechnicalIndicators.checkYearlyVolume(daily);

    if (!ema20 || !rsi) {
      return { signal: null, type: null };
    }

    // Detect chart patterns
    const patterns = this.patternDetector.detectAllPatterns(historical);

    // Check bullish breakout
    const bullishSignal = this.checkBullishBreakout({
      symbol,
      currentPrice,
      ema20,
      rsi,
      volatility,
      volumeOk,
      patterns,
      historical,
    });

    if (bullishSignal) {
      return { signal: bullishSignal, type: 'bullish' };
    }

    // Check bearish breakdown
    const bearishSignal = this.checkBearishBreakdown({
      symbol,
      currentPrice,
      ema20,
      rsi,
      volatility,
      patterns,
      historical,
    });

    if (bearishSignal) {
      return { signal: bearishSignal, type: 'bearish' };
    }

    return { signal: null, type: null };
  }

  checkBullishBreakout({ symbol, currentPrice, ema20, rsi, volatility, volumeOk, patterns, historical }) {
    let criteriaMet = 0;
    const criteria = [];

    // Criterion 1: Price > EMA20
    if (currentPrice > ema20) {
      criteriaMet++;
      criteria.push("Price above EMA20");
    }

    // Criterion 2: RSI 50-70 (momentum)
    if (rsi >= 50 && rsi <= 70) {
      criteriaMet++;
      criteria.push("RSI in momentum zone");
    }

    // Criterion 3: Volatility < 15%
    if (volatility < 15) {
      criteriaMet++;
      criteria.push("Low volatility");
    }

    // Criterion 4: Volume breakout
    if (volumeOk) {
      criteriaMet++;
      criteria.push("Volume breakout");
    }

    // Criterion 5: Bullish pattern detected
    if (patterns.strongest && patterns.strongest.type.includes('bullish')) {
      criteriaMet++;
      criteria.push(`Pattern: ${patterns.strongest.name}`);
    }

    const confidence = criteriaMet / 5;

    if (criteriaMet >= CONFIG.MIN_CRITERIA_MET && confidence >= CONFIG.MIN_CONFIDENCE_TO_SAVE) {
      const swingLow = TechnicalIndicators.findRecentSwingLow(historical, 10);
      
      return {
        symbol,
        signal_type: 'BULLISH_BREAKOUT',
        entry_price: currentPrice,
        ema20_5min: parseFloat(ema20.toFixed(2)),
        rsi: parseFloat(rsi.toFixed(2)),
        volatility: parseFloat(volatility.toFixed(2)),
        criteria_met: criteria.join(", "),
        probability: parseFloat(confidence.toFixed(2)),
        pattern: patterns.strongest?.name || null,
        pattern_confidence: patterns.strongest?.confidence || null,
        stop_loss: swingLow ? parseFloat(swingLow.toFixed(2)) : null,
        target_price: parseFloat((currentPrice * 1.05).toFixed(2)), // 5% target
        created_at: new Date().toISOString(),
      };
    }

    return null;
  }

  checkBearishBreakdown({ symbol, currentPrice, ema20, rsi, volatility, patterns, historical }) {
    let criteriaMet = 0;
    const criteria = [];

    // Criterion 1: Price < EMA20
    if (currentPrice < ema20) {
      criteriaMet++;
      criteria.push("Price below EMA20");
    }

    // Criterion 2: RSI < 50 (weakness)
    if (rsi < 50) {
      criteriaMet++;
      criteria.push("RSI showing weakness");
    }

    // Criterion 3: Bearish pattern
    if (patterns.strongest && patterns.strongest.type.includes('bearish')) {
      criteriaMet++;
      criteria.push(`Pattern: ${patterns.strongest.name}`);
    }

    const confidence = criteriaMet / 3;

    if (criteriaMet <= CONFIG.MAX_BEARISH_CRITERIA && confidence >= CONFIG.MIN_BEARISH_CONFIDENCE) {
      const swingHigh = TechnicalIndicators.findRecentSwingHigh(historical, 10);
      
      return {
        symbol,
        signal_type: 'BEARISH_BREAKDOWN',
        entry_price: currentPrice,
        ema20_5min: parseFloat(ema20.toFixed(2)),
        rsi: parseFloat(rsi.toFixed(2)),
        volatility: parseFloat(volatility.toFixed(2)),
        criteria_met: criteria.join(", "),
        probability: parseFloat(confidence.toFixed(2)),
        pattern: patterns.strongest?.name || null,
        pattern_confidence: patterns.strongest?.confidence || null,
        stop_loss: swingHigh ? parseFloat(swingHigh.toFixed(2)) : null,
        target_price: parseFloat((currentPrice * 0.95).toFixed(2)), // 5% target
        created_at: new Date().toISOString(),
      };
    }

    return null;
  }

  async cleanupStaleSignals() {
    try {
      await this.db.cleanupStaleSignals('breakout_signals', CONFIG.SIGNAL_TTL_MINUTES);
      await this.db.cleanupStaleSignals('intraday_bearish_signals', CONFIG.SIGNAL_TTL_MINUTES);
      console.log(`🧹 Cleaned up stale signals older than ${CONFIG.SIGNAL_TTL_MINUTES} minutes`);
    } catch (error) {
      console.error('❌ Cleanup failed:', error.message);
    }
  }

  async start() {
    console.log("🚀 Starting NSE Equity Scanner (Batch Mode)...");

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
    }, 10 * 60 * 1000);

    console.log(`✅ Scanner running. Scanning every ${CONFIG.SCAN_INTERVAL_MS / 1000}s...`);
  }

  stop() {
    if (this.scanInterval) clearInterval(this.scanInterval);
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    console.log("⏹️ NSE Equity Scanner stopped.");
  }
}

// =================================================================
// 🎬 MAIN EXECUTION
// =================================================================

const scanner = new NseEquityScanner();

scanner.start().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n⏹️ Shutting down NSE Equity Scanner...");
  scanner.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n⏹️ Shutting down NSE Equity Scanner...");
  scanner.stop();
  process.exit(0);
});
