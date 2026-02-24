// BSE F&O SENSEX Index Auto-Fetch Edge Function
// Fetches active SENSEX PE/CE contracts and stores 5-minute historical data

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const KITE_API_KEY = Deno.env.get("KITE_API_KEY")!;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Kite returns candles as arrays: [timestamp, open, high, low, close, volume, oi]
type KiteHistoricalCandle = [string, number, number, number, number, number, number?];

interface BseFoSymbol {
  symbol: string;
  instrument_token: string;
  underlying: string;
  instrument_type: string;
  expiry: string;
  strike: number | null;
  option_type: string | null;
}

interface KiteToken {
  access_token: string;
  created_at: string;
  expires_at: string;
}

/**
 * Fetch the latest valid Kite access token from database
 */
async function getKiteAccessToken(supabase: any): Promise<string> {
  const { data, error } = await supabase
    .from("kite_tokens")
    .select("access_token, expires_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    throw new Error(`Failed to fetch Kite token: ${error?.message || "No token found"}`);
  }

  // Check if token is expired
  const expiresAt = new Date(data.expires_at);
  const now = new Date();
  
  if (now >= expiresAt) {
    throw new Error(`Kite token expired at ${expiresAt.toISOString()}`);
  }

  console.log(`✅ Using Kite token (valid until ${expiresAt.toISOString()})`);
  return data.access_token;
}

Deno.serve(async (req) => {
  try {
    console.log("🚀 Starting BSE F&O SENSEX auto-fetch...");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Fetch latest Kite access token from database
    const KITE_ACCESS_TOKEN = await getKiteAccessToken(supabase);

    // Step 1: Get active SENSEX PE/CE contracts from bse_fo_symbols
    const { data: symbols, error: symbolsError } = await supabase
      .from("bse_fo_symbols")
      .select("symbol, instrument_token, underlying, instrument_type, expiry, strike, option_type")
      .eq("underlying", "SENSEX")
      .in("option_type", ["PE", "CE"])
      .eq("is_active", true)
      .gte("expiry", new Date().toISOString().split('T')[0]) // Only non-expired
      .order("expiry", { ascending: true })
      .order("strike", { ascending: true }) // ATM-nearest strikes first
      .limit(100); // Fetch up to 100 most recent contracts

    if (symbolsError) {
      console.error("❌ Error fetching SENSEX symbols:", symbolsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch SENSEX symbols", details: symbolsError }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!symbols || symbols.length === 0) {
      console.log("⚠️ No active SENSEX PE/CE contracts found");
      return new Response(
        JSON.stringify({ message: "No active SENSEX contracts", count: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Found ${symbols.length} active SENSEX contracts`);

    // Step 2: Fetch 5-minute historical data for each contract
    let successCount = 0;
    let errorCount = 0;

    for (const symbolData of symbols as BseFoSymbol[]) {
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

        // Step 3: Transform and insert into historical_prices_bse_fo
        const historicalRecords = candles
          .map((candle) => {
            // Kite API returns: [timestamp, open, high, low, close, volume, oi]
            const [dateStr, open, high, low, close, volume, oi] = candle;
            const timestamp = new Date(dateStr);
            
            // Validate timestamp before proceeding
            if (isNaN(timestamp.getTime())) {
              console.warn(`⚠️ Invalid date for ${symbolData.symbol}: ${dateStr}`);
              return null;
            }

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
              open,
              high,
              low,
              close,
              volume,
              open_interest: oi || null,
            };
          })
          .filter((record) => record !== null); // Remove invalid records

        // Skip if no valid records
        if (historicalRecords.length === 0) {
          console.log(`⚠️ No valid candles for ${symbolData.symbol} after filtering`);
          continue;
        }

        // Upsert into database (ignore conflicts on symbol + timestamp)
        const { error: insertError } = await supabase
          .from("historical_prices_bse_fo")
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
        message: "SENSEX F&O auto-fetch completed",
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
