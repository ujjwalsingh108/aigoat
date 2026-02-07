/**
 * 20-Day Historical Data Fetcher for BSE Equity
 * 
 * Purpose: Fetch and store 20 days of 5-minute interval historical data
 * for BSE stocks from bse_equity_top_1000_symbols table.
 * 
 * Data Flow:
 * - Source: bse_equity_top_1000_symbols table (BSE-specific instrument tokens)
 * - Destination: historical_prices_bse_equity
 * 
 * Features:
 * - 20-day rolling window (auto-cleanup of old data)
 * - Uses BSE exchange data
 * - Rate limiting and retry logic
 * - Batch processing
 * 
 * Usage:
 *   npm run fetch-20day-historical-bse
 * 
 * Environment Variables:
 *   - KITE_API_KEY
 *   - KITE_ACCESS_TOKEN
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

import { KiteConnect } from "kiteconnect";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

// =================================================================
// CONFIGURATION
// =================================================================

const CONFIG = {
  // Zerodha KiteConnect
  KITE_API_KEY: process.env.KITE_API_KEY!,
  KITE_ACCESS_TOKEN: process.env.KITE_ACCESS_TOKEN!,

  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL!,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,

  // Data fetching settings
  INTERVAL: "5minute" as const,
  DAYS_TO_FETCH: 20, // 20 days rolling window

  // Batch settings
  BATCH_SIZE: 50,
  DELAY_BETWEEN_BATCHES: 2000,
  DELAY_BETWEEN_REQUESTS: 500,
  MAX_REQUESTS_PER_SECOND: 2,
};

// =================================================================
// INTERFACES
// =================================================================

interface SymbolData {
  symbol: string;
  instrument_token: string;
  exchange: string;
  type: string;
  segment: string;
}

interface KiteCandle {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface HistoricalPriceRow {
  symbol: string;
  date: string;
  timestamp: string;
  interval_type: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  time: string;
}

// =================================================================
// BSE HISTORICAL DATA FETCHER
// =================================================================

class BseHistoricalDataFetcher {
  private kite: KiteConnect;
  private supabase: ReturnType<typeof createClient>;
  private requestCount = 0;
  private requestWindow = Date.now();

  constructor() {
    this.kite = new KiteConnect({
      api_key: CONFIG.KITE_API_KEY,
    });
    this.kite.setAccessToken(CONFIG.KITE_ACCESS_TOKEN);

    this.supabase = createClient(
      CONFIG.SUPABASE_URL,
      CONFIG.SUPABASE_SERVICE_KEY
    );
  }

  /**
   * Fetch all symbols from BSE equity top 1000 table
   * Note: Uses BSE-specific instrument tokens
   */
  async getAllSymbols(): Promise<SymbolData[]> {
    console.log("📊 Fetching symbols from bse_equity_top_1000_symbols...");

    const { data, error } = await this.supabase
      .from("bse_equity_top_1000_symbols")
      .select("symbol, instrument_token, exchange, type, segment")
      .eq("is_active", true)
      .order("symbol", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch symbols: ${error.message}`);
    }

    console.log(`✅ Loaded ${data.length} BSE symbols with BSE instrument tokens`);

    return data as SymbolData[];
  }

  /**
   * Fetch historical data from Zerodha Kite API
   */
  async fetchHistoricalData(
    instrumentToken: string,
    symbol: string,
    fromDate: Date,
    toDate: Date
  ): Promise<KiteCandle[]> {
    try {
      await this.rateLimitDelay();

      const response = await this.kite.getHistoricalData(
        instrumentToken,
        CONFIG.INTERVAL,
        fromDate,
        toDate
      );

      return response as KiteCandle[];
    } catch (error: any) {
      console.error(`   ❌ ${symbol} failed:`, error.message);

      if (error.message?.includes("rate limit") || error.message?.includes("429")) {
        console.log("   ⏳ Rate limit hit, waiting 10 seconds...");
        await this.delay(10000);
      }

      return [];
    }
  }

  /**
   * Rate limiting helper
   */
  async rateLimitDelay() {
    const now = Date.now();
    const elapsed = now - this.requestWindow;

    if (elapsed >= 1000) {
      this.requestCount = 0;
      this.requestWindow = now;
    }

    if (this.requestCount >= CONFIG.MAX_REQUESTS_PER_SECOND) {
      const waitTime = 1000 - elapsed;
      if (waitTime > 0) {
        await this.delay(waitTime);
      }
      this.requestCount = 0;
      this.requestWindow = Date.now();
    }

    this.requestCount++;
    await this.delay(CONFIG.DELAY_BETWEEN_REQUESTS);
  }

  /**
   * Simple delay helper
   */
  delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Transform Kite candles to database format
   */
  transformCandles(symbol: string, candles: KiteCandle[]): HistoricalPriceRow[] {
    return candles.map((candle) => {
      const date = new Date(candle.date);
      const dateStr = date.toISOString().split("T")[0];
      const timeStr = date.toTimeString().substring(0, 5);

      return {
        symbol,
        date: dateStr,
        timestamp: date.toISOString(),
        interval_type: "5min",
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        time: timeStr,
      };
    });
  }

  /**
   * Save historical data to BSE table
   */
  async saveHistoricalData(rows: HistoricalPriceRow[]): Promise<boolean> {
    if (rows.length === 0) return true;

    try {
      const { error } = await this.supabase
        .from("historical_prices_bse_equity")
        .upsert(rows, {
          onConflict: "symbol,timestamp",
          ignoreDuplicates: true,
        });

      if (error) {
        console.error(`   ❌ BSE insert failed:`, error.message);
        return false;
      }

      return true;
    } catch (error: any) {
      console.error(`   ❌ BSE database error:`, error.message);
      return false;
    }
  }

  /**
   * Get date range (last 20 days)
   */
  getDateRange(): { fromDate: Date; toDate: Date } {
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - CONFIG.DAYS_TO_FETCH);

    return { fromDate, toDate };
  }

  /**
   * Cleanup old data (older than 20 days)
   */
  async cleanupOldData(): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - CONFIG.DAYS_TO_FETCH);
      const cutoffDateStr = cutoffDate.toISOString();

      console.log(
        `🧹 Cleaning up BSE data older than ${cutoffDate.toISOString().split("T")[0]}...`
      );

      const { data, error } = await this.supabase
        .from("historical_prices_bse_equity")
        .delete()
        .lt("timestamp", cutoffDateStr)
        .select();

      if (error) {
        console.error(`❌ BSE cleanup failed:`, error.message);
        return 0;
      }

      const deletedCount = data?.length || 0;
      console.log(`✅ BSE: Deleted ${deletedCount.toLocaleString()} old records`);
      return deletedCount;
    } catch (error: any) {
      console.error(`❌ BSE cleanup error:`, error.message);
      return 0;
    }
  }

  /**
   * Process symbols and store in BSE historical table
   */
  async processSymbols(
    symbols: SymbolData[]
  ): Promise<{ success: number; failed: number; totalCandles: number }> {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`📊 Processing BSE Equity (${symbols.length} symbols)`);
    console.log("=".repeat(60));

    // Cleanup old data first
    await this.cleanupOldData();

    const { fromDate, toDate } = this.getDateRange();
    console.log(
      `📅 Fetching from ${fromDate.toISOString().split("T")[0]} to ${toDate.toISOString().split("T")[0]}`
    );

    // Create batches
    const batches = [];
    for (let i = 0; i < symbols.length; i += CONFIG.BATCH_SIZE) {
      batches.push(symbols.slice(i, i + CONFIG.BATCH_SIZE));
    }

    console.log(`📦 Processing ${batches.length} batches of ${CONFIG.BATCH_SIZE} symbols each\n`);

    let successCount = 0;
    let failCount = 0;
    let totalCandles = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`📦 Batch ${i + 1}/${batches.length} (${batch.length} symbols)`);

      for (const symbolData of batch) {
        const { symbol, instrument_token } = symbolData;

        console.log(`   Fetching ${symbol}...`);

        const candles = await this.fetchHistoricalData(
          instrument_token,
          symbol,
          fromDate,
          toDate
        );

        if (candles.length === 0) {
          failCount++;
          continue;
        }

        const rows = this.transformCandles(symbol, candles);
        const saved = await this.saveHistoricalData(rows);

        if (saved) {
          totalCandles += rows.length;
          successCount++;
          console.log(`   ✅ ${symbol}: ${rows.length} candles saved`);
        } else {
          failCount++;
        }
      }

      // Delay between batches
      if (i < batches.length - 1) {
        console.log(`   ⏳ Waiting ${CONFIG.DELAY_BETWEEN_BATCHES}ms...\n`);
        await this.delay(CONFIG.DELAY_BETWEEN_BATCHES);
      }
    }

    return { success: successCount, failed: failCount, totalCandles };
  }

  /**
   * Main execution
   */
  async execute() {
    console.log("🚀 20-Day BSE Historical Data Fetcher");
    console.log("=".repeat(60));
    console.log(`📅 Window: ${CONFIG.DAYS_TO_FETCH} days`);
    console.log(`📊 Interval: ${CONFIG.INTERVAL}`);
    console.log(`📍 Source: nse_bse_equity_top_1000_symbols`);
    console.log(`💾 Destination: historical_prices_bse_equity`);
    console.log("=".repeat(60));

    try {
      // 1. Get all symbols
      const symbols = await this.getAllSymbols();

      if (symbols.length === 0) {
        console.log("❌ No symbols found. Exiting.");
        return;
      }

      const startTime = Date.now();

      // 2. Process and store in BSE historical table
      const results = await this.processSymbols(symbols);

      // 3. Summary
      const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);

      console.log("\n" + "=".repeat(60));
      console.log("✅ FETCH COMPLETE");
      console.log("=".repeat(60));
      console.log(`⏱️  Duration: ${duration} minutes`);
      console.log("");
      console.log("BSE Historical Data Results:");
      console.log(`  📊 Total Symbols: ${symbols.length}`);
      console.log(`  ✅ Successful: ${results.success}`);
      console.log(`  ❌ Failed: ${results.failed}`);
      console.log(`  📈 Candles Saved: ${results.totalCandles.toLocaleString()}`);
      console.log(
        `  💾 Estimated Storage: ~${((results.totalCandles * 100) / 1024 / 1024).toFixed(2)} MB`
      );
      console.log("=".repeat(60));
    } catch (error: any) {
      console.error("\n❌ FATAL ERROR:", error.message);
      console.error(error.stack);
      process.exit(1);
    }
  }
}

// =================================================================
// MAIN EXECUTION
// =================================================================

(async () => {
  const fetcher = new BseHistoricalDataFetcher();
  await fetcher.execute();
  process.exit(0);
})();
