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
  
  // Scanner settings (runs once daily after market close)
  SCAN_TIME_HOUR: 16, // 4 PM IST (after market close at 3:30 PM)
  SCAN_TIME_MINUTE: 15, // 15 minutes after NSE scan
  SYMBOLS_LIMIT: 1000, // Top 1000 by market cap
  
  // Technical analysis (DAILY timeframe)
  EMA_PERIOD: 20,
  SMA_PERIOD: 50,
  RSI_PERIOD: 14,
  MIN_CANDLES_FOR_ANALYSIS: 50, // Need at least 50 days for SMA50
  
  // Signal generation criteria
  // BULLISH
  BULLISH_RSI_MIN: 50,
  BULLISH_RSI_MAX: 80,
  
  // BEARISH
  BEARISH_RSI_MIN: 20,
  BEARISH_RSI_MAX: 50,
  
  // COMMON
  MIN_VOLUME_RATIO: 2.0, // 2x yearly average
  MIN_WEEKLY_VOLATILITY: 1.0, // 1%
  MAX_WEEKLY_VOLATILITY: 5.0, // 5%
  
  // Cleanup
  SIGNAL_TTL_DAYS: 15, // Swing signals valid for 15 days
};

// =================================================================
// 📊 BSE SWING POSITIONAL SCANNER (DAILY BATCH)
// =================================================================

class BseSwingPositionalScanner {
  constructor() {
    this.db = new DatabaseClient(CONFIG);
    this.monitor = new ScannerMonitor('BSE_SWING_POSITIONAL');
    this.patternDetector = new PatternDetector();
    this.aiFilter = new AiBreakoutFilter();
    this.symbols = [];
    this.dailyScanTimer = null;
  }

  async initialize() {
    console.log("🚀 Initializing BSE Swing Positional Scanner (Daily Batch)...");
    console.log(`📊 Configuration:
      - Scan Time: ${CONFIG.SCAN_TIME_HOUR}:${CONFIG.SCAN_TIME_MINUTE.toString().padStart(2, '0')} IST daily
      - Symbols Limit: ${CONFIG.SYMBOLS_LIMIT}
      - Volume Requirement: ${CONFIG.MIN_VOLUME_RATIO}x yearly average
      - Weekly Volatility: ${CONFIG.MIN_WEEKLY_VOLATILITY}% - ${CONFIG.MAX_WEEKLY_VOLATILITY}%
    `);

    try {
      // Get top 1000 BSE stocks by market cap
      this.symbols = await this.db.getEquitySymbols('BSE', CONFIG.SYMBOLS_LIMIT);
      
      if (this.symbols.length === 0) {
        throw new Error("No BSE symbols loaded");
      }

      console.log(`✅ Loaded ${this.symbols.length} BSE equity symbols`);
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

    console.log(`\n🔍 Starting BSE Swing Positional scan at ${new Date().toLocaleTimeString()}...`);

    for (const symbolData of this.symbols) {
      try {
        const result = await this.analyzeSymbol(symbolData);
        
        if (result.bullish) {
          // AI validation for bullish swing signals
          const aiResult = await this.aiFilter.validateBreakout(result.bullish, { 
            patterns: result.patterns, 
            historicalCandles: result.dailyCandles 
          });
          
          if (this.aiFilter.shouldSaveSignal(aiResult, 0.7)) { // 70% confidence for swing
            const enrichedSignal = {
              ...result.bullish,
              ai_verdict: aiResult.verdict,
              ai_confidence: aiResult.confidence,
              ai_reasoning: aiResult.reasoning,
              ai_risk_factors: JSON.stringify(aiResult.risk_factors),
              ai_validated: aiResult.ai_validated,
            };
            
            await this.db.saveBullishSignal(enrichedSignal, 'bse_swing_positional_bullish');
            bullishSignals++;
          }
        }
        
        if (result.bearish) {
          // AI validation for bearish swing signals
          const aiResult = await this.aiFilter.validateBreakout(result.bearish, { 
            patterns: result.patterns, 
            historicalCandles: result.dailyCandles 
          });
          
          if (this.aiFilter.shouldSaveSignal(aiResult, 0.7)) {
            const enrichedSignal = {
              ...result.bearish,
              ai_verdict: aiResult.verdict,
              ai_confidence: aiResult.confidence,
              ai_reasoning: aiResult.reasoning,
              ai_risk_factors: JSON.stringify(aiResult.risk_factors),
              ai_validated: aiResult.ai_validated,
            };
            
            await this.db.saveBearishSignal(enrichedSignal, 'bse_swing_positional_bearish');
            bearishSignals++;
          }
        }
      } catch (error) {
        if (error.message && !error.message.includes('rate limit')) {
          console.error(`⚠️ Error analyzing ${symbolData.symbol}:`, error.message);
        }
      }
    }

    const duration = Date.now() - startTime;
    const totalSignals = bullishSignals + bearishSignals;
    
    this.monitor.recordScan(duration, totalSignals);
    console.log(`✅ Swing scan complete: ${bullishSignals} bullish, ${bearishSignals} bearish | ${duration}ms`);
    
    // Log AI stats
    this.aiFilter.logStats();
  }

  async analyzeSymbol(symbolData) {
    const symbol = symbolData.symbol;

    // Fetch daily candles with cache (365 days for volume + 50 for SMA)
    const cacheKey = `bse_swing_daily_${symbol}_365`;
    let dailyCandles = cache.get(cacheKey);
    
    if (!dailyCandles) {
      dailyCandles = await this.db.getDailyCandles(symbol, 'historical_prices_bse_swing_hourly', 365);
      // Cache for 23 hours (refreshes before next daily scan)
      cache.set(cacheKey, dailyCandles, 82800);
    }

    if (dailyCandles.length < CONFIG.MIN_CANDLES_FOR_ANALYSIS) {
      return { bullish: null, bearish: null, patterns: null, dailyCandles };
    }

    const currentCandle = dailyCandles[dailyCandles.length - 1];
    const currentPrice = parseFloat(currentCandle.close);

    // Calculate technical indicators on DAILY timeframe
    const dailyPrices = dailyCandles.map(c => parseFloat(c.close));
    const ema20 = TechnicalIndicators.calculateEMA(dailyPrices, CONFIG.EMA_PERIOD);
    const sma50 = TechnicalIndicators.calculateSMA(dailyPrices, CONFIG.SMA_PERIOD);
    const rsi = TechnicalIndicators.calculateRSI(dailyPrices, CONFIG.RSI_PERIOD);

    if (!ema20 || !sma50 || !rsi) {
      return { bullish: null, bearish: null, patterns: null, dailyCandles };
    }

    // Calculate volume ratio (current vs yearly average)
    const volumeRatio = TechnicalIndicators.calculateYearlyVolumeRatio(dailyCandles);
    const volumeOk = volumeRatio >= CONFIG.MIN_VOLUME_RATIO;

    // Calculate weekly volatility
    const weeklyVolatility = TechnicalIndicators.calculateWeeklyVolatility(dailyCandles);
    const volatilityOk = weeklyVolatility >= CONFIG.MIN_WEEKLY_VOLATILITY && 
                         weeklyVolatility <= CONFIG.MAX_WEEKLY_VOLATILITY;

    // Detect chart patterns on daily timeframe
    const patterns = this.patternDetector.detectAllPatterns(dailyCandles);

    // Check BULLISH criteria
    const bullishSignal = this.checkBullishSwing({
      symbol,
      currentPrice,
      ema20,
      sma50,
      rsi,
      volumeRatio,
      volumeOk,
      weeklyVolatility,
      volatilityOk,
      patterns,
      dailyCandles,
    });

    // Check BEARISH criteria
    const bearishSignal = this.checkBearishSwing({
      symbol,
      currentPrice,
      ema20,
      sma50,
      rsi,
      volumeRatio,
      volumeOk,
      weeklyVolatility,
      volatilityOk,
      patterns,
      dailyCandles,
    });

    return { bullish: bullishSignal, bearish: bearishSignal, patterns, dailyCandles };
  }

  checkBullishSwing({ symbol, currentPrice, ema20, sma50, rsi, volumeRatio, volumeOk, weeklyVolatility, volatilityOk, patterns, dailyCandles }) {
    const criteria = [];
    let criteriaMet = 0;

    // Criterion 1: Price > 20 EMA (Daily)
    if (currentPrice > ema20) {
      criteriaMet++;
      criteria.push("Above 20 EMA");
    }

    // Criterion 2: RSI 50-80
    if (rsi >= CONFIG.BULLISH_RSI_MIN && rsi <= CONFIG.BULLISH_RSI_MAX) {
      criteriaMet++;
      criteria.push(`RSI ${rsi.toFixed(1)} in momentum zone`);
    }

    // Criterion 3: Price > 50 SMA (Daily)
    if (currentPrice > sma50) {
      criteriaMet++;
      criteria.push("Above 50 SMA");
    }

    // Criterion 4: Volume >= 2x yearly average
    if (volumeOk) {
      criteriaMet++;
      criteria.push(`Volume ${volumeRatio.toFixed(2)}x average`);
    }

    // Criterion 5: Weekly volatility 1-5%
    if (volatilityOk) {
      criteriaMet++;
      criteria.push(`Volatility ${weeklyVolatility.toFixed(2)}%`);
    }

    // Criterion 6: Bullish pattern (bonus)
    if (patterns && patterns.strongest && patterns.strongest.type.includes('bullish')) {
      criteriaMet++;
      criteria.push(`Pattern: ${patterns.strongest.name}`);
    }

    // Must meet ALL 5 mandatory criteria (6 with pattern is bonus)
    const mandatoryCriteria = 5;
    const confidence = criteriaMet / 6;

    if (criteriaMet >= mandatoryCriteria && confidence >= 0.7) {
      const swingLow = TechnicalIndicators.findRecentSwingLow(dailyCandles, 10);
      
      return {
        symbol,
        signal_type: 'SWING_POSITIONAL_BULLISH',
        entry_price: currentPrice,
        ema20_daily: parseFloat(ema20.toFixed(2)),
        sma50_daily: parseFloat(sma50.toFixed(2)),
        rsi_daily: parseFloat(rsi.toFixed(2)),
        volume_ratio: parseFloat(volumeRatio.toFixed(2)),
        weekly_volatility: parseFloat(weeklyVolatility.toFixed(2)),
        criteria_met: criteria.join(", "),
        probability: parseFloat(confidence.toFixed(2)),
        pattern: patterns?.strongest?.name || null,
        pattern_confidence: patterns?.strongest?.confidence || null,
        stop_loss: swingLow ? parseFloat(swingLow.toFixed(2)) : parseFloat((currentPrice * 0.97).toFixed(2)), // 3% SL
        target_price: parseFloat((currentPrice * 1.05).toFixed(2)), // 5% target
        predicted_direction: 'UP',
        created_at: new Date().toISOString(),
      };
    }

    return null;
  }

  checkBearishSwing({ symbol, currentPrice, ema20, sma50, rsi, volumeRatio, volumeOk, weeklyVolatility, volatilityOk, patterns, dailyCandles }) {
    const criteria = [];
    let criteriaMet = 0;

    // Criterion 1: Price < 20 EMA (Daily)
    if (currentPrice < ema20) {
      criteriaMet++;
      criteria.push("Below 20 EMA");
    }

    // Criterion 2: RSI 20-50
    if (rsi >= CONFIG.BEARISH_RSI_MIN && rsi < CONFIG.BEARISH_RSI_MAX) {
      criteriaMet++;
      criteria.push(`RSI ${rsi.toFixed(1)} in weakness zone`);
    }

    // Criterion 3: Price < 50 SMA (Daily)
    if (currentPrice < sma50) {
      criteriaMet++;
      criteria.push("Below 50 SMA");
    }

    // Criterion 4: Volume >= 2x yearly average
    if (volumeOk) {
      criteriaMet++;
      criteria.push(`Volume ${volumeRatio.toFixed(2)}x average`);
    }

    // Criterion 5: Weekly volatility 1-5%
    if (volatilityOk) {
      criteriaMet++;
      criteria.push(`Volatility ${weeklyVolatility.toFixed(2)}%`);
    }

    // Criterion 6: Bearish pattern (bonus)
    if (patterns && patterns.strongest && patterns.strongest.type.includes('bearish')) {
      criteriaMet++;
      criteria.push(`Pattern: ${patterns.strongest.name}`);
    }

    // Must meet ALL 5 mandatory criteria
    const mandatoryCriteria = 5;
    const confidence = criteriaMet / 6;

    if (criteriaMet >= mandatoryCriteria && confidence >= 0.7) {
      const swingHigh = TechnicalIndicators.findRecentSwingHigh(dailyCandles, 10);
      
      return {
        symbol,
        signal_type: 'SWING_POSITIONAL_BEARISH',
        entry_price: currentPrice,
        ema20_daily: parseFloat(ema20.toFixed(2)),
        sma50_daily: parseFloat(sma50.toFixed(2)),
        rsi_daily: parseFloat(rsi.toFixed(2)),
        volume_ratio: parseFloat(volumeRatio.toFixed(2)),
        weekly_volatility: parseFloat(weeklyVolatility.toFixed(2)),
        criteria_met: criteria.join(", "),
        probability: parseFloat(confidence.toFixed(2)),
        pattern: patterns?.strongest?.name || null,
        pattern_confidence: patterns?.strongest?.confidence || null,
        stop_loss: swingHigh ? parseFloat(swingHigh.toFixed(2)) : parseFloat((currentPrice * 1.03).toFixed(2)), // 3% SL
        target_price: parseFloat((currentPrice * 0.95).toFixed(2)), // 5% target
        predicted_direction: 'DOWN',
        created_at: new Date().toISOString(),
      };
    }

    return null;
  }

  async cleanupStaleSignals() {
    try {
      const ttlMs = CONFIG.SIGNAL_TTL_DAYS * 24 * 60 * 60 * 1000;
      const ttlMinutes = CONFIG.SIGNAL_TTL_DAYS * 24 * 60;
      
      await this.db.cleanupStaleSignals('bse_swing_positional_bullish', ttlMinutes);
      await this.db.cleanupStaleSignals('bse_swing_positional_bearish', ttlMinutes);
      console.log(`🧹 Cleaned up BSE swing signals older than ${CONFIG.SIGNAL_TTL_DAYS} days`);
    } catch (error) {
      console.error('❌ Cleanup failed:', error.message);
    }
  }

  getNextScanTime() {
    const now = new Date();
    const nextScan = new Date(now);
    
    // Set to configured scan time (e.g., 4:15 PM)
    nextScan.setHours(CONFIG.SCAN_TIME_HOUR, CONFIG.SCAN_TIME_MINUTE, 0, 0);
    
    // If past today's scan time, schedule for tomorrow
    if (now >= nextScan) {
      nextScan.setDate(nextScan.getDate() + 1);
    }
    
    // Skip weekends
    const day = nextScan.getDay();
    if (day === 6) { // Saturday -> Monday
      nextScan.setDate(nextScan.getDate() + 2);
    } else if (day === 0) { // Sunday -> Monday
      nextScan.setDate(nextScan.getDate() + 1);
    }
    
    return nextScan;
  }

  scheduleDailyScan() {
    const nextScan = this.getNextScanTime();
    const delay = nextScan.getTime() - Date.now();
    
    console.log(`⏰ Next BSE swing scan scheduled for: ${nextScan.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    
    this.dailyScanTimer = setTimeout(async () => {
      await this.scanAllSymbols();
      await this.cleanupStaleSignals();
      
      // Schedule next day's scan
      this.scheduleDailyScan();
    }, delay);
  }

  async start() {
    console.log("🚀 Starting BSE Swing Positional Scanner (Daily Batch Mode)...");

    const initialized = await this.initialize();
    if (!initialized) {
      console.error("❌ Failed to initialize scanner. Exiting.");
      process.exit(1);
    }

    // Check if we should run immediate scan (if market already closed today)
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const currentTime = hour * 60 + minute;
    const scanTime = CONFIG.SCAN_TIME_HOUR * 60 + CONFIG.SCAN_TIME_MINUTE;
    
    if (currentTime >= scanTime && now.getDay() >= 1 && now.getDay() <= 5) {
      console.log("📅 Market closed. Running immediate scan...");
      await this.scanAllSymbols();
      await this.cleanupStaleSignals();
    }

    // Schedule daily scans
    this.scheduleDailyScan();

    // Log status every hour
    setInterval(() => {
      this.monitor.logStatus();
      this.monitor.logMemoryUsage();
    }, 60 * 60 * 1000);

    console.log(`✅ Scanner running. Will scan daily at ${CONFIG.SCAN_TIME_HOUR}:${CONFIG.SCAN_TIME_MINUTE.toString().padStart(2, '0')} IST`);
  }

  stop() {
    if (this.dailyScanTimer) clearTimeout(this.dailyScanTimer);
    console.log("⏹️ BSE Swing Positional Scanner stopped.");
  }
}

// =================================================================
// 🎬 MAIN EXECUTION
// =================================================================

const scanner = new BseSwingPositionalScanner();

scanner.start().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n⏹️ Shutting down BSE Swing Positional Scanner...");
  scanner.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n⏹️ Shutting down BSE Swing Positional Scanner...");
  scanner.stop();
  process.exit(0);
});
