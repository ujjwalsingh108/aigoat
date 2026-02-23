/**
 * Fetch 50+ Days of Hourly Candles for BSE Swing Trading
 * 
 * This script fetches hourly (60min) historical candles for BSE top 1000 symbols
 * and stores them in historical_prices_bse_swing_hourly table.
 * 
 * Target: At least 50 trading days of hourly data per symbol
 */

import { KiteConnect } from "kiteconnect";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

// Environment variables
const API_KEY = process.env.KITE_API_KEY;
const ACCESS_TOKEN = process.env.KITE_ACCESS_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Configuration
const DAYS_TO_FETCH = 90; // Fetch 90 calendar days to ensure 50+ trading days
const BATCH_SIZE = 20; // Smaller batches for hourly data (more data per symbol)
const DELAY_BETWEEN_BATCHES = 3000; // 3 seconds delay between batches
const DELAY_BETWEEN_REQUESTS = 350; // 350ms between each API call (rate limit safety)
const MIN_REQUIRED_DAYS = 50; // Minimum trading days required
const FORCE_REFRESH = true; // Set to true to ignore existing data and refetch all

interface Symbol {
  symbol: string;
  instrument_token: string;
}

interface HourlyCandle {
  symbol: string;
  date: string;
  timestamp: string;
  interval_type: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  open_interest?: number;
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch BSE top 1000 symbols from Supabase
 */
async function fetchBseSymbols(): Promise<Symbol[]> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Supabase credentials not found in .env file");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log(`Fetching BSE top 1000 symbols...`);

  const { data, error } = await supabase
    .from("bse_equity_top_1000_symbols")
    .select("symbol, instrument_token")
    .eq("is_active", true)
    .order("symbol", { ascending: true });

  if (error) {
    throw new Error(`Error fetching BSE symbols: ${error.message}`);
  }

  console.log(`✅ Fetched ${data?.length || 0} BSE symbols`);
  return data || [];
}

/**
 * Check existing data for a symbol
 */
async function checkExistingData(symbol: string): Promise<{
  hasData: boolean;
  daysCount: number;
  latestDate: string | null;
  oldestDate: string | null;
}> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Supabase credentials not found");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const { data, error } = await supabase
    .from("historical_prices_bse_swing_hourly")
    .select("date")
    .eq("symbol", symbol)
    .order("date", { ascending: false });

  if (error) {
    return { hasData: false, daysCount: 0, latestDate: null, oldestDate: null };
  }

  if (!data || data.length === 0) {
    return { hasData: false, daysCount: 0, latestDate: null, oldestDate: null };
  }

  const uniqueDates = [...new Set(data.map(d => d.date))];
  return {
    hasData: true,
    daysCount: uniqueDates.length,
    latestDate: uniqueDates[0],
    oldestDate: uniqueDates[uniqueDates.length - 1],
  };
}

/**
 * Fetch hourly candles from Kite API
 */
async function fetchHourlyCandles(
  kite: KiteConnect,
  instrumentToken: string,
  symbol: string,
  days: number
): Promise<HourlyCandle[]> {
  try {
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const candles = await kite.getHistoricalData(
      instrumentToken,
      "60minute", // 60-minute (hourly) candles
      fromDate,
      toDate
    );

    return candles.map((candle: any) => ({
      symbol,
      date: candle.date.toISOString().split("T")[0],
      timestamp: candle.date.toISOString(),
      interval_type: "hourly", // Hourly candles for precise calculations
      open: parseFloat(candle.open),
      high: parseFloat(candle.high),
      low: parseFloat(candle.low),
      close: parseFloat(candle.close),
      volume: parseInt(candle.volume) || 0,
      open_interest: candle.oi ? parseInt(candle.oi) : null,
    }));
  } catch (error: any) {
    console.error(`❌ Error fetching candles for ${symbol}:`, error.message);
    return [];
  }
}

/**
 * Store hourly candles in Supabase (with duplicate handling)
 */
async function storeHourlyCandles(
  candles: HourlyCandle[]
): Promise<{ success: number; duplicates: number; failed: number }> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Supabase credentials not found");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  let success = 0;
  let duplicates = 0;
  let failed = 0;

  // Insert in batches of 500 to avoid payload limits
  const insertBatchSize = 500;
  for (let i = 0; i < candles.length; i += insertBatchSize) {
    const batch = candles.slice(i, i + insertBatchSize);

    const { data, error } = await supabase
      .from("historical_prices_bse_swing_hourly")
      .upsert(batch, {
        onConflict: "symbol,timestamp", // Avoid duplicates on symbol+timestamp
        ignoreDuplicates: true, // Skip existing records
      });

    if (error) {
      console.error(`❌ Error inserting batch:`, error.message);
      failed += batch.length;
    } else {
      // If data is null, records were duplicates (ignored)
      if (!data || data.length === 0) {
        duplicates += batch.length;
      } else {
        success += batch.length;
      }
    }
  }

  return { success, duplicates, failed };
}

/**
 * Process symbols in batches
 */
async function processSymbolsBatch(
  kite: KiteConnect,
  symbols: Symbol[]
): Promise<void> {
  console.log(`\n📊 Processing ${symbols.length} BSE symbols in batches of ${BATCH_SIZE}...`);
  console.log(`🎯 Target: At least ${MIN_REQUIRED_DAYS} trading days of hourly data per symbol\n`);

  let totalCandles = 0;
  let totalSuccess = 0;
  let totalDuplicates = 0;
  let totalFailed = 0;
  let processedSymbols = 0;
  let skippedSymbols = 0;

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(symbols.length / BATCH_SIZE);

    console.log(`\n📦 Batch ${batchNumber}/${totalBatches} (${batch.length} symbols)...`);

    // Process each symbol in the batch sequentially (to respect rate limits)
    for (const symbol of batch) {
      // Check existing data (skip if FORCE_REFRESH is false)
      if (!FORCE_REFRESH) {
        const existingData = await checkExistingData(symbol.symbol);
        
        if (existingData.hasData && existingData.daysCount >= MIN_REQUIRED_DAYS) {
          console.log(`  ⏭️  ${symbol.symbol}: Already has ${existingData.daysCount} days (skip)`);
          skippedSymbols++;
          processedSymbols++;
          continue;
        }

        if (existingData.hasData) {
          console.log(`  🔄 ${symbol.symbol}: Has ${existingData.daysCount} days, fetching more...`);
        } else {
          console.log(`  📥 ${symbol.symbol}: Fetching fresh data...`);
        }
      } else {
        console.log(`  📥 ${symbol.symbol}: Force refresh - fetching data...`);
      }

      // Fetch hourly candles
      const candles = await fetchHourlyCandles(
        kite,
        symbol.instrument_token,
        symbol.symbol,
        DAYS_TO_FETCH
      );

      if (candles.length > 0) {
        // Count unique trading days
        const uniqueDays = new Set(candles.map(c => c.date));
        
        // Store candles in database
        const result = await storeHourlyCandles(candles);
        totalSuccess += result.success;
        totalDuplicates += result.duplicates;
        totalFailed += result.failed;
        totalCandles += candles.length;

        const status = uniqueDays.size >= MIN_REQUIRED_DAYS ? '✅' : '⚠️';
        console.log(`  ${status} ${symbol.symbol}: ${candles.length} records (${uniqueDays.size} days) | New: ${result.success}, Duplicate: ${result.duplicates}`);
      } else {
        console.log(`  ⚠️  ${symbol.symbol}: No data returned`);
      }

      processedSymbols++;

      // Rate limit delay between symbols
      await sleep(DELAY_BETWEEN_REQUESTS);
    }

    const progress = ((processedSymbols / symbols.length) * 100).toFixed(1);
    console.log(`\n✅ Batch ${batchNumber} complete`);
    console.log(`📊 Progress: ${processedSymbols}/${symbols.length} symbols (${progress}%)`);
    console.log(`📈 Running totals: Success: ${totalSuccess}, Duplicates: ${totalDuplicates}, Failed: ${totalFailed}`);

    // Delay between batches
    if (i + BATCH_SIZE < symbols.length) {
      console.log(`⏳ Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
      await sleep(DELAY_BETWEEN_BATCHES);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("📊 BSE SWING HOURLY DATA FETCH SUMMARY");
  console.log("=".repeat(80));
  console.log(`✅ Total records fetched: ${totalCandles}`);
  console.log(`✅ Successfully stored (new): ${totalSuccess}`);
  console.log(`⏭️  Duplicates (skipped): ${totalDuplicates}`);
  console.log(`❌ Failed: ${totalFailed}`);
  console.log(`📊 Symbols processed: ${processedSymbols}`);
  console.log(`⏭️  Symbols skipped (already have 50+ days): ${skippedSymbols}`);
  console.log("=".repeat(80) + "\n");
}

/**
 * Main function
 */
async function main() {
  try {
    if (!API_KEY || !ACCESS_TOKEN) {
      throw new Error("KITE_API_KEY and KITE_ACCESS_TOKEN must be set in .env file");
    }

    console.log("\n" + "=".repeat(80));
    console.log("🚀 FETCH BSE SWING HOURLY DATA (50+ DAYS MINIMUM)");
    console.log("=".repeat(80));
    console.log(`📅 Fetching up to ${DAYS_TO_FETCH} calendar days of hourly candles...`);
    console.log(`🎯 Target: At least ${MIN_REQUIRED_DAYS} trading days per symbol`);
    console.log(`📊 Interval: 60-minute (hourly) candles`);
    console.log(`💾 Table: historical_prices_bse_swing_hourly`);
    console.log("=".repeat(80) + "\n");

    const kite = new KiteConnect({ api_key: API_KEY });
    kite.setAccessToken(ACCESS_TOKEN);

    // Fetch BSE symbols
    const bseSymbols = await fetchBseSymbols();
    if (bseSymbols.length > 0) {
      await processSymbolsBatch(kite, bseSymbols);
    } else {
      console.log("⚠️  No BSE symbols found to process");
    }

    console.log("\n" + "=".repeat(80));
    console.log("✅ BSE SWING HOURLY DATA SYNC COMPLETED");
    console.log("=".repeat(80));
    console.log("\n💡 Next steps:");
    console.log("1. Run the swing scanner: pm2 restart bse-swing-positional-scanner");
    console.log("2. Check results in: bse_swing_positional_bullish & bse_swing_positional_bearish tables\n");

    return true;
  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    console.error(error);
    return false;
  }
}

// Run the script
if (require.main === module) {
  main()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error("Fatal error:", error);
      process.exit(1);
    });
}

export { fetchBseSymbols, fetchHourlyCandles, storeHourlyCandles };
