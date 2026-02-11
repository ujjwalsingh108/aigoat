// Edge Function: cleanup-intraday-signals
// Purpose: Clean up previous day's intraday signals after trading hours
// Schedule: Daily at 4:00 PM IST (10:30 AM UTC)
// Tables: bullish_breakout_nse_eq, bearish_breakout_nse_eq, bullish_breakout_bse_eq, bearish_breakout_bse_eq

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CleanupResult {
  table: string;
  deleted_count: number;
  cutoff_time: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("🧹 Starting cleanup of intraday signals...");

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate cutoff time (start of current trading day at 9:15 AM IST)
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
    const istNow = new Date(now.getTime() + istOffset);
    
    // Get today's date in IST
    const istDate = new Date(istNow.toISOString().split('T')[0]);
    
    // Set cutoff to today 9:15 AM IST (start of trading)
    const cutoffIST = new Date(istDate);
    cutoffIST.setHours(9, 15, 0, 0);
    
    // Convert back to UTC for database query
    const cutoffUTC = new Date(cutoffIST.getTime() - istOffset);
    const cutoffTimeStr = cutoffUTC.toISOString();

    console.log(`🕐 Cutoff time (UTC): ${cutoffTimeStr}`);
    console.log(`🕐 Cutoff time (IST): ${cutoffIST.toISOString()}`);
    console.log(`📅 Deleting signals older than ${cutoffTimeStr}`);

    const tables = [
      "bullish_breakout_nse_eq",
      "bearish_breakout_nse_eq",
      "bullish_breakout_bse_eq",
      "bearish_breakout_bse_eq",
    ];

    const results: CleanupResult[] = [];
    let totalDeleted = 0;

    // Clean up each table
    for (const table of tables) {
      try {
        console.log(`🧹 Cleaning ${table}...`);

        // Delete records older than cutoff time
        const { data, error, count } = await supabase
          .from(table)
          .delete({ count: "exact" })
          .lt("created_at", cutoffTimeStr);

        if (error) {
          console.error(`❌ Error cleaning ${table}:`, error);
          results.push({
            table,
            deleted_count: 0,
            cutoff_time: cutoffTimeStr,
          });
          continue;
        }

        const deletedCount = count || 0;
        totalDeleted += deletedCount;

        console.log(`✅ Deleted ${deletedCount} records from ${table}`);

        results.push({
          table,
          deleted_count: deletedCount,
          cutoff_time: cutoffTimeStr,
        });
      } catch (tableError) {
        console.error(`❌ Exception cleaning ${table}:`, tableError);
        results.push({
          table,
          deleted_count: 0,
          cutoff_time: cutoffTimeStr,
        });
      }
    }

    const summary = {
      success: true,
      message: `Cleanup completed: ${totalDeleted} total records deleted`,
      timestamp: new Date().toISOString(),
      cutoff_time_utc: cutoffTimeStr,
      cutoff_time_ist: cutoffIST.toISOString(),
      results,
      total_deleted: totalDeleted,
    };

    console.log("✅ Cleanup completed:", summary);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("❌ Fatal error during cleanup:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
