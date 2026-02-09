// NSE F&O NIFTY Symbols Sync Edge Function
// Fetches NEW active NIFTY contracts from Kite and stores them in nse_fo_symbols
// Run daily to keep contract list updated

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const KITE_API_KEY = Deno.env.get("KITE_API_KEY")!;
const KITE_ACCESS_TOKEN = Deno.env.get("KITE_ACCESS_TOKEN")!;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface KiteInstrument {
  instrument_token: string;
  exchange_token: string;
  tradingsymbol: string;
  name: string;
  last_price: number;
  expiry: string; // "2024-02-29"
  strike: number;
  tick_size: number;
  lot_size: number;
  instrument_type: string; // "CE", "PE", "FUT"
  segment: string; // "NFO-FUT", "NFO-OPT"
  exchange: string; // "NFO"
}

Deno.serve(async (req) => {
  try {
    console.log("🚀 Starting NSE F&O NIFTY symbols sync...");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Step 1: Fetch all instruments from Kite API
    console.log("📥 Fetching instruments from Kite API...");
    const kiteUrl = "https://api.kite.trade/instruments/NFO";

    const response = await fetch(kiteUrl, {
      headers: {
        "X-Kite-Version": "3",
        Authorization: `token ${KITE_API_KEY}:${KITE_ACCESS_TOKEN}`,
      },
    });

    if (!response.ok) {
      console.error(`❌ Kite API error: ${response.status}`);
      return new Response(
        JSON.stringify({ error: "Failed to fetch instruments from Kite API", status: response.status }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const csvText = await response.text();
    const lines = csvText.trim().split("\n");
    const headers = lines[0].split(",");

    // Parse CSV to JSON
    const instruments: KiteInstrument[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",");
      const instrument: any = {};
      headers.forEach((header, index) => {
        instrument[header.trim()] = values[index]?.trim() || "";
      });
      instruments.push(instrument as KiteInstrument);
    }

    console.log(`✅ Fetched ${instruments.length} total NFO instruments`);

    // Step 2: Filter for NIFTY underlying only (CE, PE, FUT)
    const niftyContracts = instruments.filter((inst) => {
      const tradingsymbol = inst.tradingsymbol || "";
      const underlying = tradingsymbol.split(/\d/)[0]; // Extract "NIFTY" from "NIFTY24FEB24500CE"
      
      return (
        underlying === "NIFTY" &&
        inst.exchange === "NFO" &&
        ["CE", "PE", "FUT"].includes(inst.instrument_type) &&
        inst.expiry && // Has expiry date
        new Date(inst.expiry) >= new Date() // Not expired
      );
    });

    console.log(`✅ Filtered ${niftyContracts.length} active NIFTY contracts (CE/PE/FUT)`);

    if (niftyContracts.length === 0) {
      console.log("⚠️ No NIFTY contracts found");
      return new Response(
        JSON.stringify({ message: "No NIFTY contracts found", count: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Step 3: Get existing instrument tokens from database
    const { data: existingSymbols, error: fetchError } = await supabase
      .from("nse_fo_symbols")
      .select("instrument_token")
      .eq("underlying", "NIFTY");

    if (fetchError) {
      console.error("❌ Error fetching existing symbols:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch existing symbols", details: fetchError }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const existingTokens = new Set(
      (existingSymbols || []).map((s: any) => s.instrument_token)
    );

    console.log(`✅ Found ${existingTokens.size} existing NIFTY contracts in database`);

    // Step 4: Filter for NEW contracts only
    const newContracts = niftyContracts.filter(
      (contract) => !existingTokens.has(contract.instrument_token)
    );

    console.log(`✅ Found ${newContracts.length} NEW NIFTY contracts to insert`);

    if (newContracts.length === 0) {
      console.log("✅ No new contracts to add. Database is up-to-date.");
      return new Response(
        JSON.stringify({
          message: "No new contracts found",
          total_nifty_contracts: niftyContracts.length,
          existing_contracts: existingTokens.size,
          new_contracts: 0,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Step 5: Transform and insert NEW contracts
    const recordsToInsert = newContracts.map((contract) => {
      const tradingsymbol = contract.tradingsymbol || "";
      const underlying = tradingsymbol.split(/\d/)[0]; // "NIFTY"
      
      // Determine option_type: CE/PE for options, null for futures
      let optionType: string | null = null;
      if (contract.instrument_type === "CE" || contract.instrument_type === "PE") {
        optionType = contract.instrument_type;
      }

      return {
        symbol: tradingsymbol,
        instrument_token: contract.instrument_token,
        exchange: "NFO",
        segment: contract.segment || "NFO-FUT",
        instrument_type: contract.instrument_type,
        underlying: underlying,
        expiry: contract.expiry,
        strike: contract.strike || null,
        option_type: optionType,
        lot_size: contract.lot_size || 25, // Default NIFTY lot size
        tick_size: contract.tick_size || 0.05,
        company_name: contract.name || null,
        is_active: true,
      };
    });

    // Insert in batches of 500 to avoid payload limits
    const batchSize = 500;
    let insertedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < recordsToInsert.length; i += batchSize) {
      const batch = recordsToInsert.slice(i, i + batchSize);

      const { error: insertError } = await supabase
        .from("nse_fo_symbols")
        .insert(batch);

      if (insertError) {
        console.error(`❌ Batch insert error:`, insertError.message);
        errorCount += batch.length;
      } else {
        insertedCount += batch.length;
        console.log(`✅ Inserted batch ${i / batchSize + 1}: ${batch.length} contracts`);
      }
    }

    console.log(`✅ Sync complete: ${insertedCount} inserted, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "NIFTY symbols sync completed",
        total_nifty_contracts: niftyContracts.length,
        existing_contracts: existingTokens.size,
        new_contracts_found: newContracts.length,
        inserted: insertedCount,
        errors: errorCount,
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
