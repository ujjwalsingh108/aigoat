/**
 * BSE Symbol Fetcher from Spreadsheet
 * 
 * Purpose: Read symbols from a spreadsheet file and fetch BSE-specific
 * instrument tokens from Zerodha Kite API, then store in Supabase.
 * 
 * Features:
 * - Reads symbols from CSV/Excel file
 * - Fetches BSE instrument tokens from Kite API
 * - Stores in bse_equity_top_1000_symbols table
 * - Handles duplicates and updates
 * 
 * Supported File Formats:
 * - CSV (.csv)
 * - Excel (.xlsx, .xls)
 * 
 * Usage:
 *   npm run fetch-bse-symbols-from-spreadsheet
 * 
 * Environment Variables:
 *   - KITE_API_KEY
 *   - KITE_ACCESS_TOKEN
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - SPREADSHEET_PATH (optional, defaults to ./symbols.csv)
 */

import { KiteConnect } from "kiteconnect";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
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

  // Spreadsheet path (can be overridden via env variable)
  SPREADSHEET_PATH: process.env.SPREADSHEET_PATH || "./symbols.csv",

  // Target exchange
  EXCHANGE: "BSE",
};

// =================================================================
// INTERFACES
// =================================================================

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

interface BseSymbolRow {
  symbol: string;
  instrument_token: string;
  exchange: string;
  type: string;
  segment: string;
  company_name: string;
  isin?: string;
  lot_size: number;
  tick_size: number;
  is_active: boolean;
}

// =================================================================
// BSE SYMBOL FETCHER
// =================================================================

class BseSymbolFetcher {
  private kite: KiteConnect;
  private supabase: ReturnType<typeof createClient>;
  private allInstruments: KiteInstrument[] = [];

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
   * Read symbols from CSV file
   */
  readSymbolsFromCSV(filePath: string): string[] {
    console.log(`📄 Reading symbols from CSV: ${filePath}`);

    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n").filter((line) => line.trim());

    // Skip header if present
    const symbols: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Skip header row (case-insensitive check)
      if (i === 0 && /^(symbol|name|stock)/i.test(line)) {
        continue;
      }

      // Get first column (symbol)
      const columns = line.split(",");
      const symbol = columns[0].trim().toUpperCase();

      if (symbol && !symbols.includes(symbol)) {
        symbols.push(symbol);
      }
    }

    console.log(`✅ Found ${symbols.length} unique symbols in CSV`);
    return symbols;
  }

  /**
   * Read symbols from Excel file
   * Note: Requires xlsx package - npm install xlsx
   */
  readSymbolsFromExcel(filePath: string): string[] {
    console.log(`📄 Reading symbols from Excel: ${filePath}`);

    try {
      // Try to import xlsx package
      const xlsx = require("xlsx");
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

      const symbols: string[] = [];
      for (let i = 0; i < data.length; i++) {
        const row = data[i] as any[];
        if (!row || row.length === 0) continue;

        // Skip header row
        if (i === 0 && typeof row[0] === "string" && /^(symbol|name|stock)/i.test(row[0])) {
          continue;
        }

        const symbol = String(row[0]).trim().toUpperCase();
        if (symbol && !symbols.includes(symbol)) {
          symbols.push(symbol);
        }
      }

      console.log(`✅ Found ${symbols.length} unique symbols in Excel`);
      return symbols;
    } catch (error: any) {
      console.error("❌ Failed to read Excel file. Make sure xlsx package is installed:");
      console.error("   npm install xlsx");
      throw error;
    }
  }

  /**
   * Read symbols from spreadsheet (auto-detect format)
   */
  readSymbolsFromFile(filePath: string): string[] {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === ".csv") {
      return this.readSymbolsFromCSV(filePath);
    } else if (ext === ".xlsx" || ext === ".xls") {
      return this.readSymbolsFromExcel(filePath);
    } else {
      throw new Error(`Unsupported file format: ${ext}. Use .csv, .xlsx, or .xls`);
    }
  }

  /**
   * Fetch all instruments from Kite API
   */
  async fetchAllInstruments(): Promise<void> {
    console.log("📊 Fetching all instruments from Kite API...");

    try {
      const instruments = await this.kite.getInstruments(CONFIG.EXCHANGE);
      this.allInstruments = instruments as KiteInstrument[];
      console.log(`✅ Loaded ${this.allInstruments.length} ${CONFIG.EXCHANGE} instruments`);
    } catch (error: any) {
      throw new Error(`Failed to fetch instruments: ${error.message}`);
    }
  }

  /**
   * Find BSE instrument by symbol
   */
  findBseInstrument(symbol: string): KiteInstrument | null {
    // Try exact match first
    let instrument = this.allInstruments.find(
      (inst) =>
        inst.tradingsymbol === symbol &&
        inst.exchange === CONFIG.EXCHANGE &&
        inst.instrument_type === "EQ"
    );

    if (instrument) return instrument;

    // Try case-insensitive match (with null checks)
    instrument = this.allInstruments.find(
      (inst) =>
        inst.tradingsymbol &&
        inst.tradingsymbol.toUpperCase() === symbol.toUpperCase() &&
        inst.exchange === CONFIG.EXCHANGE &&
        inst.instrument_type === "EQ"
    );

    return instrument || null;
  }

  /**
   * Transform Kite instrument to database row
   */
  transformToDbRow(instrument: KiteInstrument): BseSymbolRow {
    return {
      symbol: instrument.tradingsymbol,
      instrument_token: instrument.instrument_token.toString(),
      exchange: CONFIG.EXCHANGE,
      type: "EQ",
      segment: CONFIG.EXCHANGE,
      company_name: instrument.name || instrument.tradingsymbol,
      lot_size: instrument.lot_size || 1,
      tick_size: instrument.tick_size || 0.05,
      is_active: true,
    };
  }

  /**
   * Save symbols to Supabase
   */
  async saveSymbols(rows: BseSymbolRow[]): Promise<number> {
    if (rows.length === 0) return 0;

    console.log(`💾 Saving ${rows.length} BSE symbols to Supabase...`);

    try {
      const { data, error } = await this.supabase
        .from("bse_equity_top_1000_symbols")
        .upsert(rows, {
          onConflict: "symbol",
          ignoreDuplicates: false, // Update existing records
        })
        .select();

      if (error) {
        throw new Error(`Failed to save symbols: ${error.message}`);
      }

      console.log(`✅ Saved ${data?.length || rows.length} symbols`);
      return data?.length || rows.length;
    } catch (error: any) {
      console.error(`❌ Database error:`, error.message);
      return 0;
    }
  }

  /**
   * Main execution
   */
  async execute() {
    console.log("🚀 BSE Symbol Fetcher from Spreadsheet");
    console.log("=".repeat(60));
    console.log(`📁 Spreadsheet: ${CONFIG.SPREADSHEET_PATH}`);
    console.log(`📍 Exchange: ${CONFIG.EXCHANGE}`);
    console.log(`💾 Table: bse_equity_top_1000_symbols`);
    console.log("=".repeat(60));

    try {
      // 1. Check if spreadsheet exists
      if (!fs.existsSync(CONFIG.SPREADSHEET_PATH)) {
        throw new Error(`Spreadsheet file not found: ${CONFIG.SPREADSHEET_PATH}`);
      }

      // 2. Read symbols from spreadsheet
      const symbols = this.readSymbolsFromFile(CONFIG.SPREADSHEET_PATH);

      if (symbols.length === 0) {
        console.log("❌ No symbols found in spreadsheet. Exiting.");
        return;
      }

      // 3. Fetch all BSE instruments from Kite
      await this.fetchAllInstruments();

      // 4. Match symbols and prepare data
      console.log("\n📊 Matching symbols with BSE instruments...");
      const matched: BseSymbolRow[] = [];
      const notFound: string[] = [];

      for (const symbol of symbols) {
        const instrument = this.findBseInstrument(symbol);

        if (instrument) {
          matched.push(this.transformToDbRow(instrument));
          console.log(`   ✅ ${symbol} → ${instrument.instrument_token}`);
        } else {
          notFound.push(symbol);
          console.log(`   ❌ ${symbol} → Not found`);
        }
      }

      // 5. Save to database
      console.log("\n" + "=".repeat(60));
      const saved = await this.saveSymbols(matched);

      // 6. Summary
      console.log("\n" + "=".repeat(60));
      console.log("✅ IMPORT COMPLETE");
      console.log("=".repeat(60));
      console.log(`📊 Total Symbols in File: ${symbols.length}`);
      console.log(`✅ Matched: ${matched.length}`);
      console.log(`❌ Not Found: ${notFound.length}`);
      console.log(`💾 Saved to Database: ${saved}`);

      if (notFound.length > 0) {
        console.log("\n❌ Symbols not found on BSE:");
        notFound.forEach((sym) => console.log(`   - ${sym}`));
      }

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
  const fetcher = new BseSymbolFetcher();
  await fetcher.execute();
  process.exit(0);
})();
