// NSE F&O NIFTY Index Auto-Fetch Edge Function
// Fetches active NIFTY PE/CE contracts and stores 5-minute historical data

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const KITE_API_KEY = Deno.env.get("KITE_API_KEY")!;
const KITE_ACCESS_TOKEN = Deno.env.get("KITE_ACCESS_TOKEN")!;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface KiteHistoricalCandle {
  date: string; // "2024-01-15T09:15:00+0530"
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  oi?: number; // Open Interest for F&O
}

interface NseFoSymbol {
  symbol: string;
  instrument_token: string;
  underlying: string;
  instrument_type: string;
  expiry: string;
  strike: number | null;
  option_type: string | null;
}

Deno.serve(async (req) => {
  try {
    console.log("🚀 Starting NSE F&O NIFTY auto-fetch...");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Step 1: Get active NIFTY PE/CE contracts from nse_fo_symbols
    const { data: symbols, error: symbolsError } = await supabase
      .from("nse_fo_symbols")
      .select("symbol, instrument_token, underlying, instrument_type, expiry, strike, option_type")
      .eq("underlying", "NIFTY")
      .in("option_type", ["PE", "CE"])
      .eq("is_active", true)
      .gte("expiry", new Date().toISOString().split('T')[0]) // Only non-expired
      .order("expiry", { ascending: true })
      .limit(100); // Fetch up to 100 most recent contracts

    if (symbolsError) {
      console.error("❌ Error fetching NIFTY symbols:", symbolsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch NIFTY symbols", details: symbolsError }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!symbols || symbols.length === 0) {
      console.log("⚠️ No active NIFTY PE/CE contracts found");
      return new Response(
        JSON.stringify({ message: "No active NIFTY contracts", count: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Found ${symbols.length} active NIFTY contracts`);

    // Step 2: Fetch 5-minute historical data for each contract
    let successCount = 0;
    let errorCount = 0;

    for (const symbolData of symbols as NseFoSymbol[]) {
      try {
        // Calculate date range (last 50 candles = ~4 hours of 5-min data)
        const toDate = new Date();
        const fromDate = new Date(toDate.getTime() - 4 * 60 * 60 * 1000); // 4 hours ago

        const kiteUrl = `https://api.kite.trade/instruments/historical/${symbolData.instrument_token}/5minute?from=${fromDate.toISOString().split('T')[0]}&to=${toDate.toISOString().split('T')[0]}`;

        const response = await fetch(kiteUrl, {
          headers: {
            "X-Kite-Version": "3",
            Authorization: `token ${KITE_API_KEY}:${KITE_ACCESS_TOKEN}`,
          },
        });

        if (!response.ok) {
          console.error(`❌ Kite API error for ${symbolData.symbol}: ${response.status}`);
          errorCount++;
          continue;
        }

        const kiteData = await response.json();
        const candles: KiteHistoricalCandle[] = kiteData?.data?.candles || [];

        if (candles.length === 0) {
          console.log(`⚠️ No candles for ${symbolData.symbol}`);
          continue;
        }

        // Step 3: Transform and insert into historical_prices_nse_fo
        const historicalRecords = candles.map((candle) => {
          const timestamp = new Date(candle.date);
          const dateOnly = timestamp.toISOString().split('T')[0];
          const timeOnly = timestamp.toTimeString().slice(0, 5); // HH:MM

          return {
            symbol: symbolData.symbol,
            instrument_token: symbolData.instrument_token,
            underlying: symbolData.underlying,
            instrument_type: symbolData.instrument_type,
            expiry: symbolData.expiry,
            strike: symbolData.strike,
            option_type: symbolData.option_type,
            date: dateOnly,
            timestamp: timestamp.toISOString(),
            interval_type: "5min",
            time: timeOnly,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume,
            open_interest: candle.oi || null,
          };
        });

        // Upsert into database (ignore conflicts on symbol + timestamp)
        const { error: insertError } = await supabase
          .from("historical_prices_nse_fo")
          .upsert(historicalRecords, {
            onConflict: "symbol,timestamp",
            ignoreDuplicates: true,
          });

        if (insertError) {
          console.error(`❌ Insert error for ${symbolData.symbol}:`, insertError.message);
          errorCount++;
        } else {
          console.log(`✅ Inserted ${historicalRecords.length} candles for ${symbolData.symbol}`);
          successCount++;
        }

        // Rate limiting: wait 60ms between requests (max 1000 req/min from Kite)
        await new Promise((resolve) => setTimeout(resolve, 60));
      } catch (error) {
        console.error(`❌ Error processing ${symbolData.symbol}:`, error);
        errorCount++;
      }
    }

    console.log(`✅ Auto-fetch complete: ${successCount} success, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "NIFTY F&O auto-fetch completed",
        total_symbols: symbols.length,
        success_count: successCount,
        error_count: errorCount,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Fatal error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
