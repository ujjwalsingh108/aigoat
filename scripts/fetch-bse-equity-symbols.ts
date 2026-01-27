/**
 * Fetch BSE Equity Symbols from Zerodha Kite
 * 
 * This script fetches all BSE equity instruments from Kite Connect API
 * and stores them in the kite_bse_equity_symbols table in Supabase.
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

interface BSEEquitySymbol {
  symbol: string;
  instrument_token: string;
  exchange: string;
  type: string;
  segment: string;
  company_name: string;
  isin: string | null;
  lot_size: number;
  tick_size: number;
  is_active: boolean;
}

/**
 * Fetch instruments from Kite Connect API
 */
async function fetchKiteInstruments(): Promise<any[]> {
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
 * Filter BSE equity symbols from all instruments
 */
function filterBSEEquitySymbols(instruments: any[]): BSEEquitySymbol[] {
  console.log("Filtering BSE equity symbols...");

  const bseEquities = instruments
    .filter((instrument) => {
      // Filter for BSE exchange and equity type
      return (
        instrument.exchange === "BSE" &&
        instrument.instrument_type === "EQ" &&
        instrument.segment === "BSE"
      );
    })
    .map((instrument) => ({
      symbol: instrument.tradingsymbol,
      instrument_token: instrument.instrument_token.toString(),
      exchange: "BSE",
      type: "EQ",
      segment: "BSE",
      company_name: instrument.name || instrument.tradingsymbol,
      isin: null, // Kite API doesn't provide ISIN directly
      lot_size: instrument.lot_size || 1,
      tick_size: instrument.tick_size || 0.05,
      is_active: true,
    }));

  console.log(`✓ Filtered ${bseEquities.length} BSE equity symbols`);
  return bseEquities;
}

/**
 * Store BSE equity symbols in Supabase
 */
async function storeBSESymbolsInSupabase(symbols: BSEEquitySymbol[]): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Supabase credentials not found in .env file");
  }

  console.log("\nStoring symbols in Supabase...");

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  try {
    // Delete existing records to refresh data
    console.log("Clearing existing BSE equity symbols...");
    const { error: deleteError } = await supabase
      .from("kite_bse_equity_symbols")
      .delete()
      .neq("symbol", ""); // Delete all records

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
        .from("kite_bse_equity_symbols")
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
    console.log("BSE EQUITY SYMBOLS FETCH & STORE");
    console.log("=".repeat(70) + "\n");

    // Step 1: Fetch all instruments from Kite
    const instruments = await fetchKiteInstruments();

    // Step 2: Filter BSE equity symbols
    const bseEquities = filterBSEEquitySymbols(instruments);

    if (bseEquities.length === 0) {
      console.log("⚠ No BSE equity symbols found");
      return false;
    }

    // Step 3: Store in Supabase
    await storeBSESymbolsInSupabase(bseEquities);

    console.log("\n" + "=".repeat(70));
    console.log("✓ BSE EQUITY SYMBOLS SYNC COMPLETED");
    console.log("=".repeat(70));
    console.log(`\n${bseEquities.length} BSE equity symbols are now available in your database`);
    console.log("You can query them from the 'kite_bse_equity_symbols' table\n");

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

export { fetchKiteInstruments, filterBSEEquitySymbols, storeBSESymbolsInSupabase };
