import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/client";
import {
  getOrSetCached,
  buildSignalKey,
  CACHE_TTL,
} from "@/lib/cache/redis";

// Force this route to be dynamic
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/signals/swing-index
 * 
 * Query params:
 * - days: number (default: 7) - Get active signals from last N days
 * - limit: number (default: 50) - Max results
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get("days") || "7");
    const limit = parseInt(searchParams.get("limit") || "50");

    // Build cache key
    const cacheKey = buildSignalKey("swing-index", days);

    // Get or fetch with cache
    const signals = await getOrSetCached(
      cacheKey,
      async () => {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("swing_positional_index_signals")
          .select("*")
          .eq("is_active", true)
          .gte(
            "created_at",
            new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
          )
          .order("created_at", { ascending: false })
          .limit(limit);

        if (error) throw error;
        return data || [];
      },
      { ttl: CACHE_TTL.SIGNALS } // 60 seconds cache
    );

    return NextResponse.json({
      success: true,
      count: signals.length,
      signals,
      cached: signals.length > 0,
    });
  } catch (error) {
    console.error("Error fetching swing index signals:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch swing index signals",
      },
      { status: 500 }
    );
  }
}
