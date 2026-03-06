import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getOrSetCached, CACHE_KEYS, CACHE_TTL } from "@/lib/cache/redis";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const minutesAgo = parseInt(searchParams.get("minutesAgo") || "15");
    const minProbability = parseFloat(searchParams.get("minProbability") || "0.6");
    const limit = parseInt(searchParams.get("limit") || "50");

    const cacheKey = `${CACHE_KEYS.BSE_FO_SIGNALS}:${minutesAgo}min:${minProbability}`;

    const data = await getOrSetCached(
      cacheKey,
      async () => {
        const supabase = await createClient();

        const { data, error } = await supabase
          .from("bse_fo_signals")
          .select("*")
          .eq("is_active", true)
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
      { ttl: CACHE_TTL.SIGNALS } // 60 seconds
    );

    // Group by underlying
    const grouped = {
      SENSEX: data.filter((s: any) => s.underlying === "SENSEX"),
      BANKEX: data.filter((s: any) => s.underlying === "BANKEX"),
    };

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        all: data,
        grouped,
        count: data.length,
      },
    });
  } catch (error: any) {
    console.error("BSE F&O API Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
