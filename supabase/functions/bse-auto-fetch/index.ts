// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Zerodha Kite credentials
const KITE_API_KEY = Deno.env.get("KITE_API_KEY")!;

// CORS headers helper
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

interface KiteAccessToken {
  access_token: string;
  created_at: string;
  expires_at: string;
}

// Get access token from Supabase
async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase
    .from("kite_tokens")
    .select("access_token, expires_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    throw new Error(
      "No valid access token found. Please run token refresh script first."
    );
  }

  // Check if token is expired (tokens expire at 6 AM next day)
  const expiresAt = new Date(data.expires_at);
  const now = new Date();

  if (now >= expiresAt) {
    throw new Error(
      "Access token has expired. Please run token refresh script."
    );
  }

  return data.access_token;
}

// Get all BSE equity symbols from bse_equity_top_1000_symbols table
async function getSymbolsFromDB(): Promise<
  Array<{ symbol: string; instrument_token: string }>
> {
  const { data, error } = await supabase
    .from("bse_equity_top_1000_symbols")
    .select("symbol, instrument_token")
    .eq("is_active", true)
    .order("symbol", { ascending: true });

  if (error) throw new Error(`DB fetch error: ${error.message}`);

  if (!data || data.length === 0) {
    throw new Error(
      "No symbols found in bse_equity_top_1000_symbols table."
    );
  }

  console.log(`✅ Loaded ${data.length} BSE equity symbols from database`);
  return data || [];
}

// Fetch historical data from Kite API
async function fetchSymbolData(
  symbol: string,
  instrumentToken: string,
  accessToken: string,
  fromDate: string,
  toDate: string
): Promise<number> {
  const url = `https://api.kite.trade/instruments/historical/${instrumentToken}/5minute`;
  const params = new URLSearchParams({
    from: fromDate,
    to: toDate,
    continuous: "0",
    oi: "0",
  });

  const response = await fetch(`${url}?${params}`, {
    headers: {
      Authorization: `token ${KITE_API_KEY}:${accessToken}`,
      "X-Kite-Version": "3",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  const result = await response.json();

  if (!result.data || result.data.candles.length === 0) {
    return 0; // No data available
  }

  const candles = result.data.candles;
  const dataToInsert = [];

  for (const candle of candles) {
    const [timestamp, open, high, low, close, volume, oi = 0] = candle;

    // Parse timestamp (format: "2024-01-05T09:15:00+0530")
    const dateTime = new Date(timestamp);

    // Convert to IST (UTC+5:30)
    const istDate = new Date(
      dateTime.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );
    const date = istDate.toISOString().split("T")[0]; // YYYY-MM-DD
    const time = istDate.toTimeString().split(" ")[0].substring(0, 5); // HH:MM in IST

    dataToInsert.push({
      symbol,
      date,
      time,
      timestamp: dateTime.toISOString(),
      interval_type: "5min",
      open: parseFloat(open),
      high: parseFloat(high),
      low: parseFloat(low),
      close: parseFloat(close),
      volume: parseInt(volume) || 0,
      open_interest: parseInt(oi) || 0,
    });
  }

  if (dataToInsert.length > 0) {
    const { error } = await supabase
      .from("historical_prices_bse_equity")
      .upsert(dataToInsert, {
        onConflict: "symbol,timestamp",
        ignoreDuplicates: false,
      });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
  }

  return dataToInsert.length;
}

// Process all symbols
async function processAllSymbols() {
  const startTime = Date.now();
  let processedSymbols = 0;
  let totalRecords = 0;
  let failedSymbols = 0;
  const errors: string[] = [];

  try {
    // Get access token
    const accessToken = await getAccessToken();

    // Get today's date range (market hours: 9:00 AM to 3:30 PM)
    const today = new Date();
    const fromDate = new Date(today);
    fromDate.setHours(9, 0, 0, 0);
    const toDate = new Date(today);
    toDate.setHours(15, 30, 0, 0);

    const fromDateStr = fromDate.toISOString().split("T")[0];
    const toDateStr = toDate.toISOString().split("T")[0];

    // Get all symbols from bse_equity_top_1000_symbols table
    let symbols = await getSymbolsFromDB();

    console.log(`📊 Processing ${symbols.length} BSE equity symbols...`);

    // Process symbols in batches to avoid overwhelming the API
    const batchSize = 5;
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);

      const batchPromises = batch.map(async (symbolData) => {
        try {
          const records = await fetchSymbolData(
            symbolData.symbol,
            symbolData.instrument_token,
            accessToken,
            fromDateStr,
            toDateStr
          );

          totalRecords += records;
          processedSymbols++;

          if (processedSymbols % 100 === 0) {
            console.log(
              `⏳ Processed ${processedSymbols}/${symbols.length} symbols`
            );
          }

          return { symbol: symbolData.symbol, records, success: true };
        } catch (error) {
          failedSymbols++;
          const errorMsg = `${symbolData.symbol}: ${
            error instanceof Error ? error.message : String(error)
          }`;
          errors.push(errorMsg);
          console.error(
            `❌ Error processing ${symbolData.symbol}:`,
            error instanceof Error ? error.message : String(error)
          );
          return { symbol: symbolData.symbol, records: 0, success: false };
        }
      });

      await Promise.all(batchPromises);

      // Rate limiting: 1 second delay between batches (Kite has rate limits)
      if (i + batchSize < symbols.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    const duration = Date.now() - startTime;

    return {
      success: true,
      processedSymbols,
      totalRecords,
      failedSymbols,
      duration,
      totalSymbols: symbols.length,
      errors: errors.slice(0, 10), // Limit error array size
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      processedSymbols,
      totalRecords,
      failedSymbols,
      duration,
      totalSymbols: 0,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

// Log execution to database
async function logExecution(result: any) {
  try {
    await supabase.from("auto_fetch_logs").insert({
      executed_at: new Date().toISOString(),
      success: result.success,
      data: {
        processedSymbols: result.processedSymbols,
        totalRecords: result.totalRecords,
        failedSymbols: result.failedSymbols,
        durationMs: result.duration,
        durationMinutes: Math.round((result.duration / 60000) * 100) / 100,
        errors: result.errors,
      },
      config: {
        batchSize: 5,
        totalSymbols: result.totalSymbols,
        interval: "5min",
        provider: "zerodha_kite",
        sourceTable: "bse_equity_top_1000_symbols",
        destinationTable: "historical_prices_bse_equity",
      },
    });
  } catch (error) {
    console.error("Failed to log execution:", error);
  }
}

// Verify authorization
function verifyAuth(req: Request): boolean {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return false;
  }

  // Extract the token from "Bearer <token>"
  const token = authHeader.replace("Bearer ", "");

  // Verify it matches the service role key
  return token === supabaseKey;
}

Deno.serve(async (req) => {
  try {
    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
      return new Response("ok", {
        status: 200,
        headers: corsHeaders,
      });
    }

    // Verify authorization for non-OPTIONS requests
    if (!verifyAuth(req)) {
      return new Response(
        JSON.stringify({
          code: 401,
          message: "Missing or invalid authorization header",
        }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // Only allow POST requests for actual processing
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    // Process all symbols
    const result = await processAllSymbols();

    // Log the execution
    await logExecution(result);

    console.log("✅ Auto-fetch completed:", {
      success: result.success,
      processed: result.processedSymbols,
      records: result.totalRecords,
      duration: `${Math.round((result.duration / 60000) * 100) / 100}min`,
    });

    return new Response(
      JSON.stringify({
        success: result.success,
        message: `Auto-fetch completed for ${result.totalSymbols} BSE equity stocks`,
        summary: {
          timestamp: new Date().toLocaleString("en-US", {
            timeZone: "Asia/Kolkata",
          }),
          processedSymbols: result.processedSymbols,
          totalSymbols: result.totalSymbols,
          totalRecords: result.totalRecords,
          failedSymbols: result.failedSymbols,
          durationMinutes: Math.round((result.duration / 60000) * 100) / 100,
        },
        errors: result.errors.length > 0 ? result.errors : undefined,
      }),
      {
        status: result.success ? 200 : 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error("Edge function error:", error);

    // Log the failure
    await logExecution({
      success: false,
      processedSymbols: 0,
      totalRecords: 0,
      failedSymbols: 0,
      duration: 0,
      totalSymbols: 0,
      errors: [error instanceof Error ? error.message : String(error)],
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: "Auto-fetch failed",
        message: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
});
