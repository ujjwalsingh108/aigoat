/**
 * Cleanup Expired F&O Symbols
 * 
 * This script marks expired F&O contracts as inactive or deletes them
 * based on their expiry date. Run this script daily or weekly to keep
 * the database clean and relevant.
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

// Environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

interface CleanupStats {
  totalRecords: number;
  expiredRecords: number;
  activeRecords: number;
  deletedRecords: number;
  markedInactive: number;
}

/**
 * Get expired F&O symbols from database
 */
async function getExpiredSymbols(
  supabase: any,
  table: string
): Promise<any[]> {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format

  const { data, error } = await supabase
    .from(table)
    .select("*")
    .lt("expiry", today) // expiry < today
    .eq("is_active", true);

  if (error) {
    throw new Error(`Error fetching expired symbols: ${error.message}`);
  }

  return data || [];
}

/**
 * Mark expired symbols as inactive
 */
async function markExpiredAsInactive(
  supabase: any,
  table: string,
  expiredSymbols: any[]
): Promise<number> {
  if (expiredSymbols.length === 0) {
    return 0;
  }

  const instrumentTokens = expiredSymbols.map((s) => s.instrument_token);

  const { error } = await supabase
    .from(table)
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .in("instrument_token", instrumentTokens);

  if (error) {
    throw new Error(`Error marking symbols as inactive: ${error.message}`);
  }

  return expiredSymbols.length;
}

/**
 * Delete very old expired symbols (older than 90 days)
 */
async function deleteOldExpiredSymbols(
  supabase: any,
  table: string,
  daysOld: number = 90
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  const cutoffDateStr = cutoffDate.toISOString().split("T")[0];

  // First, count how many will be deleted
  const { data: toDelete, error: countError } = await supabase
    .from(table)
    .select("instrument_token")
    .lt("expiry", cutoffDateStr);

  if (countError) {
    throw new Error(`Error counting old symbols: ${countError.message}`);
  }

  const deleteCount = toDelete?.length || 0;

  if (deleteCount === 0) {
    return 0;
  }

  // Delete old expired records
  const { error: deleteError } = await supabase
    .from(table)
    .delete()
    .lt("expiry", cutoffDateStr);

  if (deleteError) {
    throw new Error(`Error deleting old symbols: ${deleteError.message}`);
  }

  return deleteCount;
}

/**
 * Get statistics for a table
 */
async function getTableStats(supabase: any, table: string): Promise<any> {
  const { data: totalData, error: totalError } = await supabase
    .from(table)
    .select("instrument_token", { count: "exact", head: true });

  const { data: activeData, error: activeError } = await supabase
    .from(table)
    .select("instrument_token", { count: "exact", head: true })
    .eq("is_active", true);

  if (totalError || activeError) {
    return { total: 0, active: 0, inactive: 0 };
  }

  const total = totalData?.length || 0;
  const active = activeData?.length || 0;

  return {
    total,
    active,
    inactive: total - active,
  };
}

/**
 * Cleanup expired symbols from NSE F&O table
 */
async function cleanupNSEFO(supabase: any): Promise<CleanupStats> {
  console.log("\nCleaning up NSE F&O symbols...");
  const table = "kite_nse_fo_symbols";

  // Get initial stats
  const initialStats = await getTableStats(supabase, table);
  console.log(`  Total records: ${initialStats.total}`);
  console.log(`  Active records: ${initialStats.active}`);
  console.log(`  Inactive records: ${initialStats.inactive}`);

  // Find expired symbols
  const expiredSymbols = await getExpiredSymbols(supabase, table);
  console.log(`  Found ${expiredSymbols.length} expired active contracts`);

  // Mark as inactive
  let markedInactive = 0;
  if (expiredSymbols.length > 0) {
    markedInactive = await markExpiredAsInactive(supabase, table, expiredSymbols);
    console.log(`  ✓ Marked ${markedInactive} contracts as inactive`);
  }

  // Delete very old records (older than 90 days)
  const deletedRecords = await deleteOldExpiredSymbols(supabase, table, 90);
  if (deletedRecords > 0) {
    console.log(`  ✓ Deleted ${deletedRecords} contracts older than 90 days`);
  }

  // Get final stats
  const finalStats = await getTableStats(supabase, table);

  return {
    totalRecords: finalStats.total,
    expiredRecords: expiredSymbols.length,
    activeRecords: finalStats.active,
    deletedRecords,
    markedInactive,
  };
}

/**
 * Cleanup expired symbols from BSE F&O table
 */
async function cleanupBSEFO(supabase: any): Promise<CleanupStats> {
  console.log("\nCleaning up BSE F&O symbols...");
  const table = "kite_bse_fo_symbols";

  try {
    // Get initial stats
    const initialStats = await getTableStats(supabase, table);
    console.log(`  Total records: ${initialStats.total}`);
    console.log(`  Active records: ${initialStats.active}`);
    console.log(`  Inactive records: ${initialStats.inactive}`);

    // Find expired symbols
    const expiredSymbols = await getExpiredSymbols(supabase, table);
    console.log(`  Found ${expiredSymbols.length} expired active contracts`);

    // Mark as inactive
    let markedInactive = 0;
    if (expiredSymbols.length > 0) {
      markedInactive = await markExpiredAsInactive(supabase, table, expiredSymbols);
      console.log(`  ✓ Marked ${markedInactive} contracts as inactive`);
    }

    // Delete very old records (older than 90 days)
    const deletedRecords = await deleteOldExpiredSymbols(supabase, table, 90);
    if (deletedRecords > 0) {
      console.log(`  ✓ Deleted ${deletedRecords} contracts older than 90 days`);
    }

    // Get final stats
    const finalStats = await getTableStats(supabase, table);

    return {
      totalRecords: finalStats.total,
      expiredRecords: expiredSymbols.length,
      activeRecords: finalStats.active,
      deletedRecords,
      markedInactive,
    };
  } catch (error: any) {
    // Table might not exist yet
    if (error.message.includes("relation") || error.message.includes("does not exist")) {
      console.log("  ⚠ BSE F&O table not found - skipping");
      return {
        totalRecords: 0,
        expiredRecords: 0,
        activeRecords: 0,
        deletedRecords: 0,
        markedInactive: 0,
      };
    }
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error("Supabase credentials not found in .env file");
    }

    console.log("\n" + "=".repeat(70));
    console.log("F&O SYMBOLS CLEANUP - EXPIRED CONTRACTS");
    console.log("=".repeat(70));

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const today = new Date().toISOString().split("T")[0];
    console.log(`Today's date: ${today}`);

    // Cleanup NSE F&O
    const nseStats = await cleanupNSEFO(supabase);

    // Cleanup BSE F&O
    const bseStats = await cleanupBSEFO(supabase);

    // Summary
    console.log("\n" + "=".repeat(70));
    console.log("CLEANUP SUMMARY");
    console.log("=".repeat(70));
    console.log("\nNSE F&O:");
    console.log(`  Active contracts: ${nseStats.activeRecords}`);
    console.log(`  Marked as inactive: ${nseStats.markedInactive}`);
    console.log(`  Deleted (>90 days old): ${nseStats.deletedRecords}`);
    console.log(`  Total remaining: ${nseStats.totalRecords}`);

    if (bseStats.totalRecords > 0) {
      console.log("\nBSE F&O:");
      console.log(`  Active contracts: ${bseStats.activeRecords}`);
      console.log(`  Marked as inactive: ${bseStats.markedInactive}`);
      console.log(`  Deleted (>90 days old): ${bseStats.deletedRecords}`);
      console.log(`  Total remaining: ${bseStats.totalRecords}`);
    }

    console.log("=".repeat(70));
    console.log("\n✓ Cleanup completed successfully");
    console.log("\nRecommendation: Run this script weekly to maintain database health\n");

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

export { cleanupNSEFO, cleanupBSEFO };
