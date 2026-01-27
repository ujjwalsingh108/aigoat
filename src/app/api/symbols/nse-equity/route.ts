import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "1000");

    const supabase = await createClient();

    // Fetch top N NSE equity symbols
    const { data, error } = await supabase
      .from("kite_nse_equity_symbols")
      .select("symbol, instrument_token, company_name")
      .eq("is_active", true)
      .order("symbol", { ascending: true })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      symbols: data || [],
      count: data?.length || 0,
    });
  } catch (error: any) {
    console.error("Error fetching NSE equity symbols:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
