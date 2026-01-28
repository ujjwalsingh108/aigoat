import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    // Get BSE F&O signals (SENSEX, BANKEX)
    const { data, error } = await supabase
      .from("bse_fo_signals")
      .select("*")
      .order("last_scanned_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Error fetching BSE F&O signals:", error);
      return NextResponse.json(
        { error: "Failed to fetch BSE F&O signals" },
        { status: 500 }
      );
    }

    // Group by underlying
    const grouped = {
      SENSEX: data?.filter((s) => s.underlying === "SENSEX") || [],
      BANKEX: data?.filter((s) => s.underlying === "BANKEX") || [],
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
    console.error("BSE F&O API Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
