import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const underlying = searchParams.get("underlying"); // SENSEX, etc.
    const limit = parseInt(searchParams.get("limit") || "1000");
    const instrumentType = searchParams.get("type"); // FUT, CE, PE

    const supabase = await createClient();

    let query = supabase
      .from("kite_bse_fo_symbols")
      .select("symbol, instrument_token, underlying, expiry, instrument_type, strike, option_type")
      .eq("is_active", true);

    if (underlying) {
      query = query.eq("underlying", underlying);
    }

    if (instrumentType) {
      query = query.eq("instrument_type", instrumentType);
    }

    const { data, error } = await query
      .order("expiry", { ascending: true })
      .order("strike", { ascending: true })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      symbols: data || [],
      count: data?.length || 0,
    });
  } catch (error: any) {
    console.error("Error fetching BSE F&O symbols:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
