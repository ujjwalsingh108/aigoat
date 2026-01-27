/**
 * Fetch NSE F&O (Futures & Options) Symbols from Zerodha Kite
 * 
 * This script fetches all NSE F&O instruments from Kite Connect API
 * and stores them in the kite_nse_fo_symbols table in Supabase.
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

interface KiteInstrument {
  instrument_token: number;
  exchange_token: number;
  tradingsymbol: string;
  name: string;
  last_price: number;
  expiry: string;
  strike: number;
  tick_size: number;
  lot_size: number;
  instrument_type: string;
  segment: string;
  exchange: string;
}

interface NSEFOSymbol {
  symbol: string;
  instrument_token: string;
  exchange: string;
  segment: string;
  instrument_type: string;
  underlying: string;
  expiry: string;
  strike: number | null;
  option_type: string | null;
  lot_size: number;
  tick_size: number;
  company_name: string;
  is_active: boolean;
}

/**
 * Fetch instruments from Kite Connect API
 */
async function fetchKiteInstruments(): Promise<KiteInstrument[]> {
  if (!API_KEY || !ACCESS_TOKEN) {
    throw new Error("KITE_API_KEY and KITE_ACCESS_TOKEN must be set in .env file");
  }

  console.log("Fetching instruments from Kite Connect...");

  const kite = new KiteConnect({
    api_key: API_KEY,
  });

  kite.setAccessToken(ACCESS_TOKEN);

  try {
    const instruments = await kite.getInstruments();
    console.log(`✓ Fetched ${instruments.length} total instruments`);
    return instruments;
  } catch (error) {
    console.error("✗ Error fetching instruments:", error);
    throw error;
  }
}

/**
 * Extract underlying symbol from trading symbol
 * Examples: NIFTY24JAN24000CE -> NIFTY, RELIANCE24FEB3000CE -> RELIANCE
 */
function extractUnderlying(tradingSymbol: string, instrumentType: string): string {
  if (instrumentType === "FUT") {
    // For futures: NIFTY24JANFUT -> NIFTY, RELIANCE24FEBFUT -> RELIANCE
    return tradingSymbol.replace(/\d{2}[A-Z]{3}FUT$/i, "");
  } else {
    // For options: NIFTY24JAN24000CE -> NIFTY, RELIANCE24FEB3000CE -> RELIANCE
    return tradingSymbol.replace(/\d{2}[A-Z]{3}\d+[CP]E$/i, "");
  }
}

/**
 * Filter NSE F&O symbols from all instruments
 */
function filterNSEFOSymbols(instruments: KiteInstrument[]): NSEFOSymbol[] {
  console.log("Filtering NSE F&O symbols...");

  const nseForD = instruments
    .filter((instrument) => {
      // Filter for NFO exchange (NSE F&O segment)
      return (
        instrument.exchange === "NFO" &&
        (instrument.instrument_type === "FUT" ||
          instrument.instrument_type === "CE" ||
          instrument.instrument_type === "PE")
      );
    })
    .map((instrument) => {
      const underlying = extractUnderlying(
        instrument.tradingsymbol,
        instrument.instrument_type
      );

      // Determine segment based on instrument type
      const segment =
        instrument.instrument_type === "FUT" ? "NFO-FUT" : "NFO-OPT";

      // Option type (CE or PE for options, null for futures)
      const optionType =
        instrument.instrument_type === "CE" ||
        instrument.instrument_type === "PE"
          ? instrument.instrument_type
          : null;

      return {
        symbol: instrument.tradingsymbol,
        instrument_token: instrument.instrument_token.toString(),
        exchange: "NFO",
        segment: segment,
        instrument_type: instrument.instrument_type,
        underlying: underlying,
        expiry: instrument.expiry || "", // Format: YYYY-MM-DD
        strike: instrument.strike || null,
        option_type: optionType,
        lot_size: instrument.lot_size || 1,
        tick_size: instrument.tick_size || 0.05,
        company_name: instrument.name || underlying,
        is_active: true,
      };
    })
    .filter((symbol) => symbol.expiry !== ""); // Only include instruments with expiry dates

  console.log(`✓ Filtered ${nseForD.length} NSE F&O symbols`);

  // Show breakdown
  const futures = nseForD.filter((s) => s.instrument_type === "FUT").length;
  const callOptions = nseForD.filter((s) => s.instrument_type === "CE").length;
  const putOptions = nseForD.filter((s) => s.instrument_type === "PE").length;

  console.log(`  - Futures: ${futures}`);
  console.log(`  - Call Options (CE): ${callOptions}`);
  console.log(`  - Put Options (PE): ${putOptions}`);

  return nseForD;
}

/**
 * Store NSE F&O symbols in Supabase
 */
async function storeNSEFOSymbolsInSupabase(symbols: NSEFOSymbol[]): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Supabase credentials not found in .env file");
  }

  console.log("\nStoring symbols in Supabase...");

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  try {
    // Delete existing records to refresh data
    console.log("Clearing existing NSE F&O symbols...");
    const { error: deleteError } = await supabase
      .from("kite_nse_fo_symbols")
      .delete()
      .neq("instrument_token", ""); // Delete all records

    if (deleteError) {
      console.warn("Warning during delete:", deleteError.message);
    }

    // Insert in batches of 500 to avoid payload size limits
    const batchSize = 500;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(symbols.length / batchSize);

      console.log(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} symbols)...`);

      const { data, error } = await supabase
        .from("kite_nse_fo_symbols")
        .insert(batch)
        .select();

      if (error) {
        console.error(`✗ Error in batch ${batchNumber}:`, error.message);
        errorCount += batch.length;
      } else {
        successCount += batch.length;
        console.log(`✓ Batch ${batchNumber} inserted successfully`);
      }
    }

    console.log("\n" + "=".repeat(70));
    console.log("STORAGE SUMMARY");
    console.log("=".repeat(70));
    console.log(`Total symbols: ${symbols.length}`);
    console.log(`Successfully stored: ${successCount}`);
    console.log(`Failed: ${errorCount}`);
    console.log("=".repeat(70));
  } catch (error) {
    console.error("✗ Error storing in Supabase:", error);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    console.log("\n" + "=".repeat(70));
    console.log("NSE F&O SYMBOLS FETCH & STORE");
    console.log("=".repeat(70) + "\n");

    // Step 1: Fetch all instruments from Kite
    const instruments = await fetchKiteInstruments();

    // Step 2: Filter NSE F&O symbols
    const nseForD = filterNSEFOSymbols(instruments);

    if (nseForD.length === 0) {
      console.log("⚠ No NSE F&O symbols found");
      return false;
    }

    // Step 3: Store in Supabase
    await storeNSEFOSymbolsInSupabase(nseForD);

    console.log("\n" + "=".repeat(70));
    console.log("✓ NSE F&O SYMBOLS SYNC COMPLETED");
    console.log("=".repeat(70));
    console.log(`\n${nseForD.length} NSE F&O symbols are now available in your database`);
    console.log("You can query them from the 'kite_nse_fo_symbols' table");
    console.log("\nNote: Run 'npm run cleanup-expired-fo' periodically to remove expired contracts\n");

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

export { fetchKiteInstruments, filterNSEFOSymbols, storeNSEFOSymbolsInSupabase };
