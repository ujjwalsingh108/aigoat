/**
 * Zerodha Historical Data Fetcher - BSE F&O
 * 
 * Purpose: Fetch and store 3 months of 5-minute interval historical data
 * for top 1000 BSE F&O instruments into historical_prices_bse_fo table.
 * 
 * Strategy: Focus on near-month expiries + ATM strikes for options
 * 
 * Data Source: Zerodha Kite Historical API
 * Storage: ~1.25GB for 1000 instruments × 3 months × 78 candles/day
 * 
 * Usage:
 *   npm run fetch-historical-bse-fo
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
  KITE_API_KEY: process.env.KITE_API_KEY!,
  KITE_ACCESS_TOKEN: process.env.KITE_ACCESS_TOKEN!,
  SUPABASE_URL: process.env.SUPABASE_URL!,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,

  INTERVAL: "5minute" as const,
  DAYS_TO_FETCH: 90,
  TOP_INSTRUMENTS_LIMIT: 1000,

  // F&O specific filters
  FOCUS_UNDERLYINGS: ["SENSEX", "BANKEX"], // BSE indices
  NEAR_MONTH_ONLY: true, // Only fetch near-month expiries
  MAX_STRIKES_PER_EXPIRY: 10, // Limit strikes (ATM ± 5)

  BATCH_SIZE: 50,
  DELAY_BETWEEN_BATCHES: 2000,
  DELAY_BETWEEN_REQUESTS: 100,
  MAX_REQUESTS_PER_SECOND: 2,
};

// =================================================================
// INTERFACES
// =================================================================

interface FoSymbolData {
  symbol: string;
  instrument_token: string;
  exchange: string;
  segment: string;
  instrument_type: string;
  underlying: string;
  expiry: string;
  strike: number | null;
  option_type: string | null;
}

interface KiteCandle {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface HistoricalPriceFoRow {
  symbol: string;
  instrument_token: string;
  underlying: string;
  instrument_type: string;
  expiry: string;
  strike: number | null;
  option_type: string | null;
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
// ZERODHA BSE F&O HISTORICAL DATA FETCHER
// =================================================================

class ZerodhaBseFoHistoricalFetcher {
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
   * Fetch BSE F&O symbols with filters
   */
  async getBseFoSymbols(): Promise<FoSymbolData[]> {
    console.log("📊 Fetching BSE F&O instruments...");

    // Get all active F&O symbols
    let query = this.supabase
      .from("kite_bse_fo_symbols")
      .select("symbol, instrument_token, exchange, segment, instrument_type, underlying, expiry, strike, option_type")
      .eq("is_active", true);

    // Filter by underlyings if specified
    if (CONFIG.FOCUS_UNDERLYINGS.length > 0) {
      query = query.in("underlying", CONFIG.FOCUS_UNDERLYINGS);
    }

    const { data, error } = await query.order("expiry", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch BSE F&O symbols: ${error.message}`);
    }

    console.log(`✅ Loaded ${data.length} BSE F&O instruments (before filtering)`);

    // Filter for near-month expiries
    let filtered = data as FoSymbolData[];
    
    if (CONFIG.NEAR_MONTH_ONLY) {
      filtered = this.filterNearMonthExpiries(filtered);
    }

    // Limit total instruments
    filtered = filtered.slice(0, CONFIG.TOP_INSTRUMENTS_LIMIT);

    console.log(`✅ Final selection: ${filtered.length} instruments`);
    return filtered;
  }

  /**
   * Filter to keep only near-month expiries (next 2 expiries)
   */
  filterNearMonthExpiries(instruments: FoSymbolData[]): FoSymbolData[] {
    const today = new Date();
    const grouped = new Map<string, FoSymbolData[]>();

    // Group by underlying
    instruments.forEach(inst => {
      if (!grouped.has(inst.underlying)) {
        grouped.set(inst.underlying, []);
      }
      grouped.get(inst.underlying)!.push(inst);
    });

    const result: FoSymbolData[] = [];

    // For each underlying, keep next 2 expiries
    grouped.forEach((instList, underlying) => {
      // Sort by expiry
      instList.sort((a, b) => new Date(a.expiry).getTime() - new Date(b.expiry).getTime());

      // Get unique expiries
      const expiries = [...new Set(instList.map(i => i.expiry))];

      // Keep only next 2 expiries
      const nearExpiries = expiries
        .filter(exp => new Date(exp) >= today)
        .slice(0, 2);

      // Add instruments for these expiries
      instList.forEach(inst => {
        if (nearExpiries.includes(inst.expiry)) {
          result.push(inst);
        }
      });
    });

    return result;
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
    symbolData: FoSymbolData,
    candles: KiteCandle[]
  ): HistoricalPriceFoRow[] {
    return candles.map((candle) => {
      const date = new Date(candle.date);
      const dateStr = date.toISOString().split("T")[0];
      const timeStr = date.toTimeString().substring(0, 5);

      return {
        symbol: symbolData.symbol,
        instrument_token: symbolData.instrument_token,
        underlying: symbolData.underlying,
        instrument_type: symbolData.instrument_type,
        expiry: symbolData.expiry,
        strike: symbolData.strike,
        option_type: symbolData.option_type,
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

  async saveHistoricalData(rows: HistoricalPriceFoRow[]): Promise<boolean> {
    if (rows.length === 0) return true;

    try {
      const { error } = await this.supabase
        .from("historical_prices_bse_fo")
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
      .from("historical_prices_bse_fo")
      .select("*", { count: "exact", head: true })
      .eq("symbol", symbol);

    if (countError) {
      console.error(`   ⚠️ Error checking existing data for ${symbol}:`, countError.message);
      return { count: 0, latestDate: null };
    }

    const { data, error: dateError } = await this.supabase
      .from("historical_prices_bse_fo")
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
    console.log("🚀 Starting BSE F&O Historical Data Fetch");
    console.log("=" .repeat(60));
    console.log(`📅 Date Range: Last ${CONFIG.DAYS_TO_FETCH} days`);
    console.log(`📊 Interval: ${CONFIG.INTERVAL}`);
    console.log(`🎯 Target: Top ${CONFIG.TOP_INSTRUMENTS_LIMIT} instruments`);
    console.log(`📍 Underlyings: ${CONFIG.FOCUS_UNDERLYINGS.join(", ")}`);
    console.log(`💾 Destination: historical_prices_bse_fo`);
    console.log("=" .repeat(60));

    try {
      const symbols = await this.getBseFoSymbols();

      if (symbols.length === 0) {
        console.log("❌ No instruments found. Exiting.");
        return;
      }

      const { fromDate, toDate } = this.getDateRange();
      console.log(`\n📅 Fetching data from ${fromDate.toISOString().split("T")[0]} to ${toDate.toISOString().split("T")[0]}`);

      const batches = [];
      for (let i = 0; i < symbols.length; i += CONFIG.BATCH_SIZE) {
        batches.push(symbols.slice(i, i + CONFIG.BATCH_SIZE));
      }

      console.log(`\n📦 Processing ${batches.length} batches of ${CONFIG.BATCH_SIZE} instruments each`);

      let totalCandles = 0;
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`\n📦 Batch ${i + 1}/${batches.length} (${batch.length} instruments)`);

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

          const rows = this.transformCandles(symbolData, candles);
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
      console.log(`📊 Total Instruments: ${symbols.length}`);
      console.log(`✅ Successful: ${successCount}`);
      console.log(`❌ Failed: ${failCount}`);
      console.log(`📈 Total Candles Saved: ${totalCandles.toLocaleString()}`);
      console.log(`💾 Estimated Storage: ~${((totalCandles * 120) / 1024 / 1024).toFixed(2)} MB`);
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
  const fetcher = new ZerodhaBseFoHistoricalFetcher();
  await fetcher.execute();
  process.exit(0);
})();
