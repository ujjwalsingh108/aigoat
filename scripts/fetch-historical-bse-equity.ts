/**
 * Zerodha Historical Data Fetcher - BSE Equity
 * 
 * Purpose: Fetch and store 3 months of 5-minute interval historical data
 * for top 1000 BSE equity stocks into historical_prices_bse_equity table.
 * 
 * Data Source: Zerodha Kite Historical API
 * Storage: ~1.25GB for 1000 stocks × 3 months × 78 candles/day
 * 
 * Usage:
 *   npm run fetch-historical-bse-equity
 * 
 * Environment Variables Required:
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
  DAYS_TO_FETCH: 90, // 3 months
  TOP_STOCKS_LIMIT: 1000,

  // Batch settings
  BATCH_SIZE: 50,
  DELAY_BETWEEN_BATCHES: 2000,
  DELAY_BETWEEN_REQUESTS: 100,
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
// ZERODHA BSE HISTORICAL DATA FETCHER
// =================================================================

class ZerodhaBseHistoricalFetcher {
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

  async getBseEquitySymbols(): Promise<SymbolData[]> {
    console.log("📊 Fetching top 1000 BSE equity symbols...");

    const { data, error } = await this.supabase
      .from("kite_bse_equity_symbols")
      .select("symbol, instrument_token, exchange, type, segment")
      .eq("is_active", true)
      .order("symbol", { ascending: true })
      .limit(CONFIG.TOP_STOCKS_LIMIT);

    if (error) {
      throw new Error(`Failed to fetch symbols: ${error.message}`);
    }

    console.log(`✅ Loaded ${data.length} BSE equity symbols`);
    return data as SymbolData[];
  }

  async fetchHistoricalData(
    instrumentToken: string,
    symbol: string,
    fromDate: Date,
    toDate: Date
  ): Promise<KiteCandle[]> {
    try {
      await this.rateLimitDelay();

      console.log(`   Fetching ${symbol} (${instrumentToken})...`);

      const response = await this.kite.getHistoricalData(
        instrumentToken,
        CONFIG.INTERVAL,
        fromDate,
        toDate
      );

      console.log(`   ✅ ${symbol}: ${response.length} candles`);
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

  delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  transformCandles(
    symbol: string,
    candles: KiteCandle[]
  ): HistoricalPriceRow[] {
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
        console.error("   ❌ Database insert failed:", error.message);
        return false;
      }

      return true;
    } catch (error: any) {
      console.error("   ❌ Database error:", error.message);
      return false;
    }
  }

  getDateRange(): { fromDate: Date; toDate: Date } {
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - CONFIG.DAYS_TO_FETCH);

    return { fromDate, toDate };
  }

  async checkExistingData(symbol: string): Promise<{ count: number; latestDate: string | null }> {
    const { count, error: countError } = await this.supabase
      .from("historical_prices_bse_equity")
      .select("*", { count: "exact", head: true })
      .eq("symbol", symbol);

    if (countError) {
      console.error(`   ⚠️ Error checking existing data for ${symbol}:`, countError.message);
      return { count: 0, latestDate: null };
    }

    const { data, error: dateError } = await this.supabase
      .from("historical_prices_bse_equity")
      .select("date")
      .eq("symbol", symbol)
      .order("date", { ascending: false })
      .limit(1);

    if (dateError || !data || data.length === 0) {
      return { count: count || 0, latestDate: null };
    }

    return { count: count || 0, latestDate: data[0].date };
  }

  async execute() {
    console.log("🚀 Starting BSE Equity Historical Data Fetch");
    console.log("=" .repeat(60));
    console.log(`📅 Date Range: Last ${CONFIG.DAYS_TO_FETCH} days`);
    console.log(`📊 Interval: ${CONFIG.INTERVAL}`);
    console.log(`🎯 Target: Top ${CONFIG.TOP_STOCKS_LIMIT} stocks`);
    console.log(`💾 Destination: historical_prices_bse_equity`);
    console.log("=" .repeat(60));

    try {
      const symbols = await this.getBseEquitySymbols();

      if (symbols.length === 0) {
        console.log("❌ No symbols found. Exiting.");
        return;
      }

      const { fromDate, toDate } = this.getDateRange();
      console.log(`\n📅 Fetching data from ${fromDate.toISOString().split("T")[0]} to ${toDate.toISOString().split("T")[0]}`);

      const batches = [];
      for (let i = 0; i < symbols.length; i += CONFIG.BATCH_SIZE) {
        batches.push(symbols.slice(i, i + CONFIG.BATCH_SIZE));
      }

      console.log(`\n📦 Processing ${batches.length} batches of ${CONFIG.BATCH_SIZE} symbols each`);

      let totalCandles = 0;
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`\n📦 Batch ${i + 1}/${batches.length} (${batch.length} symbols)`);

        for (const symbolData of batch) {
          const { symbol, instrument_token } = symbolData;

          const existing = await this.checkExistingData(symbol);
          if (existing.count > 0) {
            console.log(`   ⏭️  ${symbol}: ${existing.count} candles already exist (latest: ${existing.latestDate})`);
            successCount++;
            continue;
          }

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
            console.log(`   💾 ${symbol}: ${rows.length} candles saved`);
          } else {
            failCount++;
          }
        }

        if (i < batches.length - 1) {
          console.log(`   ⏳ Waiting ${CONFIG.DELAY_BETWEEN_BATCHES}ms before next batch...`);
          await this.delay(CONFIG.DELAY_BETWEEN_BATCHES);
        }
      }

      console.log("\n" + "=".repeat(60));
      console.log("✅ FETCH COMPLETE");
      console.log("=".repeat(60));
      console.log(`📊 Total Symbols: ${symbols.length}`);
      console.log(`✅ Successful: ${successCount}`);
      console.log(`❌ Failed: ${failCount}`);
      console.log(`📈 Total Candles Saved: ${totalCandles.toLocaleString()}`);
      console.log(`💾 Estimated Storage: ~${((totalCandles * 100) / 1024 / 1024).toFixed(2)} MB`);
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
  const fetcher = new ZerodhaBseHistoricalFetcher();
  await fetcher.execute();
  process.exit(0);
})();
