// Cleanup Expired F&O Contracts Edge Function
// Marks expired contracts as inactive and deletes very old ones
// Run daily via cron to keep the database clean

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface CleanupResult {
  table: string;
  totalContracts: number;
  expiredActive: number;
  markedInactive: number;
  deletedOld: number;
}

/**
 * Mark expired contracts as inactive
 */
async function markExpiredAsInactive(
  supabase: any,
  table: string,
  today: string
): Promise<{ found: number; updated: number }> {
  // Find expired active contracts
  const { data: expiredContracts, error: findError } = await supabase
    .from(table)
    .select("instrument_token, symbol, expiry")
    .eq("is_active", true)
    .lt("expiry", today);

  if (findError) {
    console.error(`❌ Error finding expired contracts in ${table}:`, findError.message);
    return { found: 0, updated: 0 };
  }

  const found = expiredContracts?.length || 0;
  if (found === 0) {
    console.log(`✅ ${table}: No expired active contracts found`);
    return { found: 0, updated: 0 };
  }

  console.log(`📋 ${table}: Found ${found} expired active contracts`);

  // Mark as inactive
  const { error: updateError } = await supabase
    .from(table)
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("is_active", true)
    .lt("expiry", today);

  if (updateError) {
    console.error(`❌ Error marking contracts inactive in ${table}:`, updateError.message);
    return { found, updated: 0 };
  }

  console.log(`✅ ${table}: Marked ${found} contracts as inactive`);
  return { found, updated: found };
}

/**
 * Delete very old expired contracts (older than 90 days)
 */
async function deleteOldExpiredContracts(
  supabase: any,
  table: string,
  daysOld: number = 90
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  const cutoffDateStr = cutoffDate.toISOString().split("T")[0];

  console.log(`🗑️  ${table}: Deleting contracts expired before ${cutoffDateStr}...`);

  // Count contracts to delete
  const { data: toDelete, error: countError } = await supabase
    .from(table)
    .select("instrument_token", { count: "exact" })
    .lt("expiry", cutoffDateStr);

  if (countError) {
    console.error(`❌ Error counting old contracts in ${table}:`, countError.message);
    return 0;
  }

  const deleteCount = toDelete?.length || 0;
  if (deleteCount === 0) {
    console.log(`✅ ${table}: No contracts older than ${daysOld} days to delete`);
    return 0;
  }

  // Delete old contracts
  const { error: deleteError } = await supabase
    .from(table)
    .delete()
    .lt("expiry", cutoffDateStr);

  if (deleteError) {
    console.error(`❌ Error deleting old contracts in ${table}:`, deleteError.message);
    return 0;
  }

  console.log(`✅ ${table}: Deleted ${deleteCount} contracts older than ${daysOld} days`);
  return deleteCount;
}

/**
 * Get table statistics
 */
async function getTableStats(supabase: any, table: string): Promise<any> {
  const { count: totalCount } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });

  const { count: activeCount } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  return {
    total: totalCount || 0,
    active: activeCount || 0,
    inactive: (totalCount || 0) - (activeCount || 0),
  };
}

/**
 * Cleanup contracts for a specific table
 */
async function cleanupTable(
  supabase: any,
  table: string,
  today: string,
  deleteOlderThanDays: number
): Promise<CleanupResult> {
  console.log(`\n🔍 Processing ${table}...`);

  // Get initial stats
  const initialStats = await getTableStats(supabase, table);
  console.log(`📊 ${table}: Total=${initialStats.total}, Active=${initialStats.active}, Inactive=${initialStats.inactive}`);

  // Mark expired as inactive
  const { found, updated } = await markExpiredAsInactive(supabase, table, today);

  // Delete very old contracts
  const deleted = await deleteOldExpiredContracts(supabase, table, deleteOlderThanDays);

  // Get final stats
  const finalStats = await getTableStats(supabase, table);

  return {
    table,
    totalContracts: finalStats.total,
    expiredActive: found,
    markedInactive: updated,
    deletedOld: deleted,
  };
}

Deno.serve(async (req) => {
  try {
    console.log("🚀 Starting F&O contracts cleanup...");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    console.log(`📅 Today: ${today}`);
    console.log("🎯 Strategy: Mark expired contracts as inactive, delete contracts expired >90 days ago\n");

    const results: CleanupResult[] = [];

    // Cleanup NSE F&O symbols
    try {
      const nseResult = await cleanupTable(supabase, "nse_fo_symbols", today, 90);
      results.push(nseResult);
    } catch (error: any) {
      console.error("❌ Error cleaning NSE F&O:", error.message);
      results.push({
        table: "nse_fo_symbols",
        totalContracts: 0,
        expiredActive: 0,
        markedInactive: 0,
        deletedOld: 0,
      });
    }

    // Cleanup BSE F&O symbols (if table exists)
    try {
      const bseResult = await cleanupTable(supabase, "bse_fo_symbols", today, 90);
      results.push(bseResult);
    } catch (error: any) {
      console.log(`⚠️  BSE F&O table not found or error: ${error.message}`);
      results.push({
        table: "bse_fo_symbols",
        totalContracts: 0,
        expiredActive: 0,
        markedInactive: 0,
        deletedOld: 0,
      });
    }

    // Calculate totals
    const totalExpiredFound = results.reduce((sum, r) => sum + r.expiredActive, 0);
    const totalMarkedInactive = results.reduce((sum, r) => sum + r.markedInactive, 0);
    const totalDeleted = results.reduce((sum, r) => sum + r.deletedOld, 0);

    console.log("\n╔══════════════════════════════════════════════════════════╗");
    console.log("║                 CLEANUP SUMMARY                          ║");
    console.log("╚══════════════════════════════════════════════════════════╝");
    console.log(`✅ Expired contracts found: ${totalExpiredFound}`);
    console.log(`✅ Marked as inactive: ${totalMarkedInactive}`);
    console.log(`✅ Old contracts deleted: ${totalDeleted}\n`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "F&O contracts cleanup completed",
        date: today,
        summary: {
          expired_found: totalExpiredFound,
          marked_inactive: totalMarkedInactive,
          deleted_old: totalDeleted,
        },
        results,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("❌ Fatal error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal server error",
        details: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
