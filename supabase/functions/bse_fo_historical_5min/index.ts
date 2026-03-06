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
    // NOTE: is_active is intentionally excluded — on expiry day contracts get
    // marked inactive while still tradeable. The gte(expiry, today) filter is
    // the authoritative boundary.
    const today = new Date().toISOString().split('T')[0];
    let { data: symbols, error: symbolsError } = await supabase
      .from("bse_fo_symbols")
      .select("symbol, instrument_token, underlying, instrument_type, expiry, strike, option_type")
      .eq("underlying", "SENSEX")
      .in("option_type", ["PE", "CE"])
      .gte("expiry", today) // Only non-expired (>= today handles expiry-day contracts)
      .order("expiry", { ascending: true })
      .order("strike", { ascending: true })
      .limit(100);

    // Expiry-day fallback: primary query only returns 0 if the cleanup job deleted
    // today's contracts AND next week's haven't been ingested yet (rare ~30 min window
    // on Thursday morning). In that case, look back 7 days to find the most recently
    // expired contracts — still bounded so we never pull months-old data.
    if (!symbolsError && (!symbols || symbols.length === 0)) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      console.warn(`⚠️ No contracts with expiry >= ${today}, trying 7-day lookback (expiry >= ${sevenDaysAgo})...`);
      ({ data: symbols, error: symbolsError } = await supabase
        .from("bse_fo_symbols")
        .select("symbol, instrument_token, underlying, instrument_type, expiry, strike, option_type")
        .eq("underlying", "SENSEX")
        .in("option_type", ["PE", "CE"])
        .gte("expiry", sevenDaysAgo)   // bounded — never returns contracts older than 7 days
        .order("expiry", { ascending: false })
        .limit(100));
    }

    if (symbolsError) {
      console.error("❌ Error fetching BSE F&O symbols:", symbolsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch BSE F&O symbols", details: symbolsError }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!symbols || symbols.length === 0) {
      console.log("⚠️ No active BSE F&O PE/CE contracts found");
      return new Response(
        JSON.stringify({ message: "No active BSE F&O contracts", count: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Found ${symbols.length} active SENSEX contracts`);

    // Step 2: Fetch 5-min candles for all contracts from Kite API,
    // accumulate all records, then do a SINGLE batched upsert (avoids per-symbol DB calls).
    let kiteErrorCount = 0;
    const allRecords: object[] = [];
    const todayStr = new Date().toISOString().split('T')[0]; // fetch full intraday day

    for (const symbolData of symbols as BseFoSymbol[]) {
      try {
        const kiteUrl = `https://api.kite.trade/instruments/historical/${symbolData.instrument_token}/5minute?from=${todayStr}&to=${todayStr}`;

        const response = await fetch(kiteUrl, {
          headers: {
            "X-Kite-Version": "3",
            Authorization: `token ${KITE_API_KEY}:${KITE_ACCESS_TOKEN}`,
          },
        });

        if (!response.ok) {
          console.error(`❌ Kite API error for ${symbolData.symbol}: ${response.status}`);
          kiteErrorCount++;
          continue;
        }

        const kiteData = await response.json();
        const candles: KiteHistoricalCandle[] = kiteData?.data?.candles || [];

        if (candles.length === 0) {
          console.log(`⚠️ No candles for ${symbolData.symbol}`);
          continue;
        }

        // Transform candles → DB records
        for (const candle of candles) {
          const [dateStr, open, high, low, close, volume, oi] = candle;
          const timestamp = new Date(dateStr);
          if (isNaN(timestamp.getTime())) continue; // skip invalid timestamps

          allRecords.push({
            symbol: symbolData.symbol,
            instrument_token: symbolData.instrument_token,
            underlying: symbolData.underlying,
            instrument_type: symbolData.instrument_type,
            expiry: symbolData.expiry,
            strike: symbolData.strike,
            option_type: symbolData.option_type,
            date: timestamp.toISOString().split('T')[0],
            timestamp: timestamp.toISOString(),
            interval_type: "5min",
            time: timestamp.toTimeString().slice(0, 5),
            open,
            high,
            low,
            close,
            volume,
            open_interest: oi ?? null,
          });
        }

        // Rate limiting: 60ms between Kite requests (max ~1000 req/min)
        await new Promise((resolve) => setTimeout(resolve, 60));
      } catch (err) {
        console.error(`❌ Error fetching ${symbolData.symbol}:`, err);
        kiteErrorCount++;
      }
    }

    // Step 3: Single batched upsert — avoids N individual DB round-trips.
    // NOTE: historical_prices_bse_fo needs a unique index on (symbol, timestamp)
    // for ON CONFLICT to work. If not present, duplicates will be inserted.
    // Run: CREATE UNIQUE INDEX IF NOT EXISTS idx_bse_fo_symbol_timestamp
    //       ON historical_prices_bse_fo (symbol, timestamp);
    let successCount = 0;
    let dbErrorCount = 0;
    const CHUNK_SIZE = 500;

    for (let i = 0; i < allRecords.length; i += CHUNK_SIZE) {
      const chunk = allRecords.slice(i, i + CHUNK_SIZE);
      const { error: insertError } = await supabase
        .from("historical_prices_bse_fo")
        .upsert(chunk, { onConflict: "symbol,timestamp", ignoreDuplicates: true });

      if (insertError) {
        console.error(`❌ Batch insert error (chunk ${i / CHUNK_SIZE + 1}):`, insertError.message);
        dbErrorCount++;
      } else {
        successCount += chunk.length;
      }
    }

    console.log(`✅ Auto-fetch complete: ${successCount} candles saved | Kite errors: ${kiteErrorCount} | DB errors: ${dbErrorCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "BSE F&O auto-fetch completed (SENSEX)",
        total_symbols: symbols.length,
        total_candles_saved: successCount,
        kite_errors: kiteErrorCount,
        db_errors: dbErrorCount,
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
