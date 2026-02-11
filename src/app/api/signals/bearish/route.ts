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
 * GET /api/signals/bearish
 * 
 * Query params:
 * - minutesAgo: number (default: 15) - Get signals from last N minutes
 * - minProbability: number (default: 0.6) - Minimum confidence threshold
 * - limit: number (default: 50) - Max results
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const minutesAgo = parseInt(searchParams.get("minutesAgo") || "15");
    const minProbability = parseFloat(searchParams.get("minProbability") || "0.6");
    const limit = parseInt(searchParams.get("limit") || "50");

    // Build cache key
    const cacheKey = buildSignalKey("bearish", minutesAgo);

    // Get or fetch with cache
    const signals = await getOrSetCached(
      cacheKey,
      async () => {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("bearish_breakout_nse_eq")
          .select("*")
          .gte(
            "created_at",
            new Date(Date.now() - minutesAgo * 60 * 1000).toISOString()
          )
          .gte("probability", minProbability)
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
    console.error("Error fetching bearish signals:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch bearish signals",
      },
      { status: 500 }
    );
  }
}
