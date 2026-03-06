// BSE F&O SENSEX Symbols Sync Edge Function
// Fetches NEW active SENSEX contracts from Kite and stores them in bse_fo_symbols
// Also marks expired contracts as is_active = false
// Run daily (e.g. 8:00 AM IST) to keep contract list updated

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const KITE_API_KEY = Deno.env.get("KITE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface KiteInstrument {
  instrument_token: string;
  exchange_token: string;
  tradingsymbol: string;
  name: string;
  last_price: number;
  expiry: string; // "2026-02-26"
  strike: number;
  tick_size: number;
  lot_size: number;
  instrument_type: string; // "CE", "PE", "FUT"
  segment: string;         // "BFO-FUT", "BFO-OPT"
  exchange: string;        // "BFO"
}

async function getKiteAccessToken(supabase: any): Promise<string> {
  const { data, error } = await supabase
    .from("kite_tokens")
    .select("access_token, expires_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    throw new Error(`Failed to fetch Kite access token: ${error?.message || "No token found"}`);
  }

  const expiresAt = new Date(data.expires_at);
  if (new Date() >= expiresAt) {
    throw new Error(`Kite access token expired at ${expiresAt.toISOString()}`);
  }

  console.log(`✅ Using Kite access token (expires: ${expiresAt.toISOString()})`);
  return data.access_token;
}

Deno.serve(async (req) => {
  try {
    console.log("🚀 Starting BSE F&O SENSEX symbols sync...");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const KITE_ACCESS_TOKEN = await getKiteAccessToken(supabase);

    // Step 1: Fetch all BFO instruments from Kite API (returns CSV)
    console.log("📥 Fetching BFO instruments from Kite API...");
    const response = await fetch("https://api.kite.trade/instruments/BFO", {
      headers: {
        "X-Kite-Version": "3",
        Authorization: `token ${KITE_API_KEY}:${KITE_ACCESS_TOKEN}`,
      },
    });

    if (!response.ok) {
      console.error(`❌ Kite API error: ${response.status}`);
      return new Response(
        JSON.stringify({ error: "Failed to fetch BFO instruments from Kite", status: response.status }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Parse CSV response
    const csvText = await response.text();
    const lines = csvText.trim().split("\n");
    const headers = lines[0].split(",");

    const instruments: KiteInstrument[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",");
      const instrument: any = {};
      headers.forEach((header, index) => {
        instrument[header.trim()] = values[index]?.trim() || "";
      });
      instruments.push(instrument as KiteInstrument);
    }

    console.log(`✅ Fetched ${instruments.length} total BFO instruments`);

    // Step 2: Filter for SENSEX CE/PE/FUT contracts that have not expired
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sensexContracts = instruments.filter((inst) => {
      const tradingsymbol = inst.tradingsymbol || "";
      // SENSEX tradingsymbols: "SENSEX26FEB80000CE", "SENSEX26FEBFUT"
      // Split on first digit to extract underlying prefix
      const underlying = tradingsymbol.split(/\d/)[0];

      return (
        underlying === "SENSEX" &&
        inst.exchange === "BFO" &&
        ["CE", "PE", "FUT"].includes(inst.instrument_type) &&
        inst.expiry &&
        new Date(inst.expiry) >= today
      );
    });

    console.log(`✅ Filtered ${sensexContracts.length} active SENSEX contracts (CE/PE/FUT)`);

    if (sensexContracts.length === 0) {
      console.warn("⚠️ No SENSEX contracts found in BFO instruments");
      return new Response(
        JSON.stringify({ message: "No SENSEX contracts found", count: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Step 3: Get existing instrument tokens from bse_fo_symbols
    const { data: existingSymbols, error: fetchError } = await supabase
      .from("bse_fo_symbols")
      .select("instrument_token, expiry, is_active")
      .eq("underlying", "SENSEX");

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
    console.log(`✅ Found ${existingTokens.size} existing SENSEX contracts in database`);

    // Step 4: Mark expired contracts as is_active = false
    // Any row in DB whose expiry < today AND is still marked active
    const expiredTokens = (existingSymbols || [])
      .filter((s: any) => s.is_active && new Date(s.expiry) < today)
      .map((s: any) => s.instrument_token);

    if (expiredTokens.length > 0) {
      const { error: deactivateError } = await supabase
        .from("bse_fo_symbols")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .in("instrument_token", expiredTokens);

      if (deactivateError) {
        console.error("❌ Error deactivating expired contracts:", deactivateError.message);
      } else {
        console.log(`✅ Marked ${expiredTokens.length} expired SENSEX contracts as inactive`);
      }
    }

    // Step 5: Filter for NEW contracts not yet in DB
    const newContracts = sensexContracts.filter(
      (contract) => !existingTokens.has(contract.instrument_token)
    );

    console.log(`✅ Found ${newContracts.length} NEW SENSEX contracts to insert`);

    if (newContracts.length === 0) {
      console.log("✅ No new contracts to add. Database is up-to-date.");
      return new Response(
        JSON.stringify({
          success: true,
          message: "No new contracts. Database is up-to-date.",
          total_sensex_contracts: sensexContracts.length,
          existing_contracts: existingTokens.size,
          new_contracts: 0,
          deactivated_contracts: expiredTokens.length,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Step 6: Transform and insert NEW contracts in batches
    const recordsToInsert = newContracts.map((contract) => {
      const tradingsymbol = contract.tradingsymbol || "";
      const underlying = tradingsymbol.split(/\d/)[0]; // "SENSEX"
      const optionType =
        contract.instrument_type === "CE" || contract.instrument_type === "PE"
          ? contract.instrument_type
          : null;

      return {
        symbol: tradingsymbol,
        instrument_token: contract.instrument_token,
        exchange: "BFO",
        segment: contract.segment || (optionType ? "BFO-OPT" : "BFO-FUT"),
        instrument_type: contract.instrument_type,
        underlying,
        expiry: contract.expiry,
        strike: contract.strike ? Number(contract.strike) : null,
        option_type: optionType,
        lot_size: contract.lot_size ? parseInt(contract.lot_size as any, 10) : 10, // SENSEX default lot: 10
        tick_size: contract.tick_size ? Number(contract.tick_size) : 0.05,
        company_name: contract.name || null,
        is_active: true,
      };
    });

    const BATCH_SIZE = 500;
    let insertedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < recordsToInsert.length; i += BATCH_SIZE) {
      const batch = recordsToInsert.slice(i, i + BATCH_SIZE);
      const { error: insertError } = await supabase
        .from("bse_fo_symbols")
        .insert(batch);

      if (insertError) {
        console.error(`❌ Batch insert error (batch ${i / BATCH_SIZE + 1}):`, insertError.message);
        errorCount += batch.length;
      } else {
        insertedCount += batch.length;
        console.log(`✅ Inserted batch ${i / BATCH_SIZE + 1}: ${batch.length} contracts`);
      }
    }

    console.log(`✅ Sync complete: ${insertedCount} inserted, ${errorCount} errors, ${expiredTokens.length} deactivated`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "SENSEX symbols sync completed",
        total_sensex_contracts: sensexContracts.length,
        existing_contracts: existingTokens.size,
        new_contracts_found: newContracts.length,
        inserted: insertedCount,
        deactivated: expiredTokens.length,
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
