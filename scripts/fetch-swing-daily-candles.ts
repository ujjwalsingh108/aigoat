/**
 * Fetch Daily Candles for Swing Trading (NSE & BSE Top 1000)
 * 
 * This script fetches daily historical candles for swing positional trading (1-15 days)
 * from Zerodha Kite API and stores them in:
 * - historical_prices_nse_swing_daily (NSE top 1000 symbols)
 * - historical_prices_bse_swing_daily (BSE top 1000 symbols)
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
const DAYS_TO_FETCH = 30; // Fetch 30 days of daily data for swing trading
const BATCH_SIZE = 50; // Process symbols in batches to avoid rate limits
const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds delay between batches

interface Symbol {
  symbol: string;
  instrument_token: string;
}

interface DailyCandle {
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
 * Fetch symbols from Supabase
 */
async function fetchSymbols(exchange: "NSE" | "BSE"): Promise<Symbol[]> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Supabase credentials not found in .env file");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const tableName =
    exchange === "NSE"
      ? "nse_equity_top_1000_symbols"
      : "bse_equity_top_1000_symbols";

  console.log(`Fetching ${exchange} top 1000 symbols...`);

  const { data, error } = await supabase
    .from(tableName)
    .select("symbol, instrument_token")
    .eq("is_active", true)
    .order("symbol", { ascending: true });

  if (error) {
    throw new Error(`Error fetching ${exchange} symbols: ${error.message}`);
  }

  console.log(`✓ Fetched ${data?.length || 0} ${exchange} symbols`);
  return data || [];
}

/**
 * Fetch daily candles from Kite API
 */
async function fetchDailyCandles(
  kite: KiteConnect,
  instrumentToken: string,
  symbol: string,
  days: number
): Promise<DailyCandle[]> {
  try {
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const candles = await kite.getHistoricalData(
      instrumentToken,
      "day",
      fromDate,
      toDate
    );

    return candles.map((candle: any) => ({
      symbol,
      date: candle.date.toISOString().split("T")[0],
      timestamp: candle.date.toISOString(),
      interval_type: "day",
      open: parseFloat(candle.open),
      high: parseFloat(candle.high),
      low: parseFloat(candle.low),
      close: parseFloat(candle.close),
      volume: parseInt(candle.volume) || 0,
      open_interest: candle.oi ? parseInt(candle.oi) : null,
    }));
  } catch (error: any) {
    console.error(`✗ Error fetching candles for ${symbol}:`, error.message);
    return [];
  }
}

/**
 * Store daily candles in Supabase
 */
async function storeDailyCandles(
  candles: DailyCandle[],
  exchange: "NSE" | "BSE"
): Promise<{ success: number; failed: number }> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Supabase credentials not found");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const tableName =
    exchange === "NSE"
      ? "historical_prices_nse_swing_daily"
      : "historical_prices_bse_swing_daily";

  let success = 0;
  let failed = 0;

  // Insert in batches of 1000 to avoid payload limits
  const insertBatchSize = 1000;
  for (let i = 0; i < candles.length; i += insertBatchSize) {
    const batch = candles.slice(i, i + insertBatchSize);

    const { error } = await supabase.from(tableName).upsert(batch, {
      onConflict: "symbol,date",
      ignoreDuplicates: false,
    });

    if (error) {
      console.error(`✗ Error inserting batch:`, error.message);
      failed += batch.length;
    } else {
      success += batch.length;
    }
  }

  return { success, failed };
}

/**
 * Process symbols in batches
 */
async function processSymbolsBatch(
  kite: KiteConnect,
  symbols: Symbol[],
  exchange: "NSE" | "BSE"
): Promise<void> {
  console.log(`\nProcessing ${symbols.length} ${exchange} symbols in batches of ${BATCH_SIZE}...`);

  let totalCandles = 0;
  let totalSuccess = 0;
  let totalFailed = 0;
  let processedSymbols = 0;

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(symbols.length / BATCH_SIZE);

    console.log(`\nBatch ${batchNumber}/${totalBatches} (${batch.length} symbols)...`);

    // Fetch candles for all symbols in batch
    const candlePromises = batch.map((symbol) =>
      fetchDailyCandles(kite, symbol.instrument_token, symbol.symbol, DAYS_TO_FETCH)
    );

    const batchCandles = await Promise.all(candlePromises);
    const flatCandles = batchCandles.flat();

    if (flatCandles.length > 0) {
      // Store candles in database
      const result = await storeDailyCandles(flatCandles, exchange);
      totalSuccess += result.success;
      totalFailed += result.failed;
      totalCandles += flatCandles.length;
    }

    processedSymbols += batch.length;
    console.log(`✓ Batch ${batchNumber} complete: ${flatCandles.length} candles fetched`);
    console.log(`Progress: ${processedSymbols}/${symbols.length} symbols (${((processedSymbols / symbols.length) * 100).toFixed(1)}%)`);

    // Delay between batches to avoid rate limits
    if (i + BATCH_SIZE < symbols.length) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }

  console.log(`\n${exchange} Summary:`);
  console.log(`- Total candles fetched: ${totalCandles}`);
  console.log(`- Successfully stored: ${totalSuccess}`);
  console.log(`- Failed: ${totalFailed}`);
}

/**
 * Main function
 */
async function main() {
  try {
    if (!API_KEY || !ACCESS_TOKEN) {
      throw new Error("KITE_API_KEY and KITE_ACCESS_TOKEN must be set in .env file");
    }

    console.log("\n" + "=".repeat(70));
    console.log("FETCH DAILY CANDLES FOR SWING TRADING");
    console.log("=".repeat(70));
    console.log(`Fetching ${DAYS_TO_FETCH} days of daily candles...`);
    console.log("=".repeat(70) + "\n");

    const kite = new KiteConnect({ api_key: API_KEY });
    kite.setAccessToken(ACCESS_TOKEN);

    // Fetch NSE symbols
    console.log("\n--- NSE TOP 1000 SYMBOLS ---");
    const nseSymbols = await fetchSymbols("NSE");
    if (nseSymbols.length > 0) {
      await processSymbolsBatch(kite, nseSymbols, "NSE");
    }

    // Fetch BSE symbols
    console.log("\n--- BSE TOP 1000 SYMBOLS ---");
    const bseSymbols = await fetchSymbols("BSE");
    if (bseSymbols.length > 0) {
      await processSymbolsBatch(kite, bseSymbols, "BSE");
    }

    console.log("\n" + "=".repeat(70));
    console.log("✓ DAILY CANDLES SYNC COMPLETED");
    console.log("=".repeat(70));
    console.log("\nData stored in:");
    console.log("- historical_prices_nse_swing_daily");
    console.log("- historical_prices_bse_swing_daily\n");

    return true;
  } catch (error) {
    console.error("\n✗ Error:", error);
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

export { fetchSymbols, fetchDailyCandles, storeDailyCandles };
