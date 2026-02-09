import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    // Get NSE F&O signals (NIFTY, BANKNIFTY, FINNIFTY)
    const { data, error } = await supabase
      .from("nse_fo_signals")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Error fetching NSE F&O signals:", error);
      return NextResponse.json(
        { error: "Failed to fetch NSE F&O signals" },
        { status: 500 }
      );
    }

    // Group by underlying
    const grouped = {
      NIFTY: data?.filter((s) => s.underlying === "NIFTY") || [],
      BANKNIFTY: data?.filter((s) => s.underlying === "BANKNIFTY") || [],
      FINNIFTY: data?.filter((s) => s.underlying === "FINNIFTY") || [],
    };

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        all: data || [],
        grouped,
        count: data?.length || 0,
      },
    });
  } catch (error: any) {
    console.error("NSE F&O API Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
