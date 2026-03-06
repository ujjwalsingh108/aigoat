// Cleanup Breakout Signals Edge Function
// Deletes previous trading session signals from all breakout/swing/F&O signal tables
// Runs daily at 3:00 AM IST (9:30 PM UTC) via cron

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// All signal tables to clean up
const SIGNAL_TABLES = [
  "bearish_breakout_bse_eq",
  "bearish_breakout_nse_eq",
  "bse_fo_signals",
  "bse_swing_positional_bearish",
  "bse_swing_positional_bullish",
  "bullish_breakout_bse_eq",
  "bullish_breakout_nse_eq",
  "nse_fo_signals",
  "nse_swing_positional_bearish",
  "nse_swing_positional_bullish",
];

interface TableResult {
  table: string;
  deleted: number;
  error: string | null;
}

/**
 * Delete all signals created before today's midnight IST.
 * At 3 AM IST, this removes the entire previous trading session's signals.
 *
 * Cutoff = midnight of today in IST (UTC+5:30)
 * e.g. at 3:00 AM IST on 2026-03-07 → cutoff = 2026-03-06 18:30:00 UTC
 */
async function cleanupTable(
  supabase: any,
  table: string,
  cutoff: string
): Promise<TableResult> {
  // Count rows to be deleted
  const { count, error: countError } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .lt("created_at", cutoff);

  if (countError) {
    console.error(`❌ ${table}: count error — ${countError.message}`);
    return { table, deleted: 0, error: countError.message };
  }

  const toDelete = count || 0;

  if (toDelete === 0) {
    console.log(`✅ ${table}: nothing to delete`);
    return { table, deleted: 0, error: null };
  }

  // Delete previous session signals
  const { error: deleteError } = await supabase
    .from(table)
    .delete()
    .lt("created_at", cutoff);

  if (deleteError) {
    console.error(`❌ ${table}: delete error — ${deleteError.message}`);
    return { table, deleted: 0, error: deleteError.message };
  }

  console.log(`🗑️  ${table}: deleted ${toDelete} signals`);
  return { table, deleted: toDelete, error: null };
}

Deno.serve(async (_req) => {
  try {
    console.log("🚀 Starting breakout signals cleanup...");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Cutoff = midnight of today in IST (UTC+5:30)
    // All signals before this timestamp belong to a previous trading session
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const nowUtc = new Date();
    const nowIst = new Date(nowUtc.getTime() + IST_OFFSET_MS);

    // Strip time → midnight IST → convert back to UTC
    const midnightIst = new Date(
      Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate())
    );
    const cutoffUtc = new Date(midnightIst.getTime() - IST_OFFSET_MS);
    const cutoff = cutoffUtc.toISOString();

    console.log(`📅 Run time (IST): ${nowIst.toISOString().replace("T", " ").substring(0, 19)}`);
    console.log(`✂️  Deleting signals created before: ${cutoff} UTC (midnight IST)\n`);

    // Process all tables in parallel
    const results: TableResult[] = await Promise.all(
      SIGNAL_TABLES.map((table) => cleanupTable(supabase, table, cutoff))
    );

    const totalDeleted = results.reduce((sum, r) => sum + r.deleted, 0);
    const errors = results.filter((r) => r.error !== null);

    console.log("\n╔══════════════════════════════════════════════════════════╗");
    console.log("║           BREAKOUT SIGNALS CLEANUP SUMMARY               ║");
    console.log("╚══════════════════════════════════════════════════════════╝");
    results.forEach((r) => {
      const icon = r.error ? "❌" : r.deleted > 0 ? "🗑️ " : "✅";
      console.log(`  ${icon} ${r.table.padEnd(38)} deleted: ${r.deleted}`);
    });
    console.log(`\n  Total deleted: ${totalDeleted}`);
    if (errors.length > 0) {
      console.log(`  Errors: ${errors.length}`);
    }

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        run_at: nowUtc.toISOString(),
        cutoff_utc: cutoff,
        summary: {
          total_deleted: totalDeleted,
          error_count: errors.length,
        },
        results,
      }),
      {
        status: errors.length === 0 ? 200 : 207,
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
