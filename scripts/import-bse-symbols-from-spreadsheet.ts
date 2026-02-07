/**
 * Import BSE Symbols from Spreadsheet
 * 
 * Purpose: Read symbols from an Excel spreadsheet and match them against
 * the all_bse_equity_symbols table, then store matches in bse_equity_top_1000_symbols.
 * 
 * Data Flow:
 * 1. Read symbols from Excel file (D:\Private\top_nse_1000_stocks.xlsx)
 * 2. Query all_bse_equity_symbols table for matching symbols
 * 3. Insert matched records into bse_equity_top_1000_symbols table
 * 
 * Usage:
 *   npm run import-bse-symbols-from-spreadsheet
 * 
 * Environment Variables:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import dotenv from "dotenv";

dotenv.config();

// =================================================================
// CONFIGURATION
// =================================================================

const CONFIG = {
  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL!,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,

  // Excel file path
  EXCEL_PATH: "D:\\Private\\top_nse_1000_stocks.xlsx",

  // Source and destination tables
  SOURCE_TABLE: "all_bse_equity_symbols",
  DEST_TABLE: "bse_equity_top_1000_symbols",
};

// =================================================================
// INTERFACES
// =================================================================

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
// BSE SYMBOL IMPORTER
// =================================================================

class BseSymbolImporter {
  private supabase: ReturnType<typeof createClient>;

  constructor() {
    this.supabase = createClient(
      CONFIG.SUPABASE_URL,
      CONFIG.SUPABASE_SERVICE_KEY
    );
  }

  /**
   * Read symbols from Excel file
   * Requires xlsx package - npm install xlsx
   */
  readSymbolsFromExcel(filePath: string): string[] {
    console.log(`📄 Reading symbols from Excel: ${filePath}`);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Excel file not found: ${filePath}`);
    }

    try {
      const xlsx = require("xlsx");
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      
      // Parse with headers to get column names
      const data = xlsx.utils.sheet_to_json(sheet);

      const symbols: string[] = [];
      
      for (const row of data) {
        const rowData = row as any;
        
        // Look for 'Trading Symbol' column (case-insensitive)
        const tradingSymbol = rowData['Trading Symbol'] || 
                             rowData['trading symbol'] || 
                             rowData['TRADING SYMBOL'] ||
                             rowData['TradingSymbol'];
        
        if (tradingSymbol) {
          const symbol = String(tradingSymbol).trim().toUpperCase();
          if (symbol && !symbols.includes(symbol)) {
            symbols.push(symbol);
          }
        }
      }

      console.log(`✅ Found ${symbols.length} unique symbols in Excel`);
      return symbols;
    } catch (error: any) {
      if (error.code === "MODULE_NOT_FOUND") {
        console.error("❌ xlsx package not found. Installing...");
        console.error("   Run: npm install xlsx");
      }
      throw error;
    }
  }

  /**
   * Fetch matching symbols from all_bse_equity_symbols table
   */
  async fetchMatchingSymbols(symbols: string[]): Promise<BseSymbolRow[]> {
    console.log(`\n🔍 Querying ${CONFIG.SOURCE_TABLE} for ${symbols.length} symbols...`);

    try {
      const { data, error } = await this.supabase
        .from(CONFIG.SOURCE_TABLE)
        .select("*")
        .in("symbol", symbols)
        .eq("is_active", true);

      if (error) {
        throw new Error(`Failed to fetch symbols: ${error.message}`);
      }

      console.log(`✅ Found ${data.length} matching symbols in database`);
      return data as BseSymbolRow[];
    } catch (error: any) {
      console.error(`❌ Database query error:`, error.message);
      throw error;
    }
  }

  /**
   * Insert symbols into bse_equity_top_1000_symbols table
   */
  async insertSymbols(rows: BseSymbolRow[]): Promise<number> {
    if (rows.length === 0) return 0;

    console.log(`\n💾 Inserting ${rows.length} symbols into ${CONFIG.DEST_TABLE}...`);

    try {
      const { data, error } = await this.supabase
        .from(CONFIG.DEST_TABLE)
        .upsert(rows, {
          onConflict: "symbol",
          ignoreDuplicates: false, // Update if exists
        })
        .select();

      if (error) {
        throw new Error(`Failed to insert symbols: ${error.message}`);
      }

      console.log(`✅ Successfully inserted ${data?.length || rows.length} symbols`);
      return data?.length || rows.length;
    } catch (error: any) {
      console.error(`❌ Insert error:`, error.message);
      return 0;
    }
  }

  /**
   * Main execution
   */
  async execute() {
    console.log("🚀 BSE Symbol Importer from Spreadsheet");
    console.log("=".repeat(60));
    console.log(`📁 Excel File: ${CONFIG.EXCEL_PATH}`);
    console.log(`📍 Source Table: ${CONFIG.SOURCE_TABLE}`);
    console.log(`💾 Destination Table: ${CONFIG.DEST_TABLE}`);
    console.log("=".repeat(60));

    try {
      const startTime = Date.now();

      // 1. Read symbols from Excel
      const symbols = this.readSymbolsFromExcel(CONFIG.EXCEL_PATH);

      if (symbols.length === 0) {
        console.log("❌ No symbols found in Excel file. Exiting.");
        return;
      }

      // 2. Fetch matching symbols from all_bse_equity_symbols
      const matchedSymbols = await this.fetchMatchingSymbols(symbols);

      if (matchedSymbols.length === 0) {
        console.log("❌ No matching symbols found in database. Exiting.");
        return;
      }

      // 3. Insert into bse_equity_top_1000_symbols
      const inserted = await this.insertSymbols(matchedSymbols);

      // 4. Calculate not found symbols
      const matchedSymbolNames = matchedSymbols.map((s) => s.symbol);
      const notFound = symbols.filter((s) => !matchedSymbolNames.includes(s));

      // 5. Summary
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log("\n" + "=".repeat(60));
      console.log("✅ IMPORT COMPLETE");
      console.log("=".repeat(60));
      console.log(`⏱️  Duration: ${duration} seconds`);
      console.log("");
      console.log("Results:");
      console.log(`  📊 Total Symbols in Excel: ${symbols.length}`);
      console.log(`  ✅ Matched in Database: ${matchedSymbols.length}`);
      console.log(`  💾 Inserted Successfully: ${inserted}`);
      console.log(`  ❌ Not Found: ${notFound.length}`);

      if (notFound.length > 0 && notFound.length <= 50) {
        console.log("\n❌ Symbols not found in all_bse_equity_symbols:");
        notFound.forEach((sym) => console.log(`   - ${sym}`));
      } else if (notFound.length > 50) {
        console.log(`\n❌ ${notFound.length} symbols not found (too many to display)`);
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
  const importer = new BseSymbolImporter();
  await importer.execute();
  process.exit(0);
})();
