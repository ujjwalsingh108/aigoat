/**
 * Check F&O Cleanup Status
 * 
 * This script checks:
 * 1. If expired contracts exist in nse_fo_symbols
 * 2. If cleanup is running (check logs)
 * 3. If edge function nse_fo_fetch_nifty_contracts is being called
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface StatusReport {
  totalContracts: number;
  activeContracts: number;
  inactiveContracts: number;
  expiredActiveContracts: number;
  expiredInactiveContracts: number;
  oldestExpiry: string | null;
  newestExpiry: string | null;
  needsCleanup: boolean;
}

async function checkNseFoSymbolsStatus(): Promise<StatusReport> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const today = new Date().toISOString().split('T')[0];

  console.log("📊 Checking NSE F&O Symbols Status...\n");

  // Total contracts
  const { count: totalCount } = await supabase
    .from('nse_fo_symbols')
    .select('*', { count: 'exact', head: true });

  // Active contracts
  const { count: activeCount } = await supabase
    .from('nse_fo_symbols')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);

  // Inactive contracts
  const { count: inactiveCount } = await supabase
    .from('nse_fo_symbols')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', false);

  // Expired ACTIVE contracts (should be 0 if cleanup is working)
  const { data: expiredActive, count: expiredActiveCount } = await supabase
    .from('nse_fo_symbols')
    .select('symbol, expiry', { count: 'exact' })
    .eq('is_active', true)
    .lt('expiry', today)
    .order('expiry', { ascending: false })
    .limit(5);

  // Expired INACTIVE contracts
  const { count: expiredInactiveCount } = await supabase
    .from('nse_fo_symbols')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', false)
    .lt('expiry', today);

  // Get date ranges
  const { data: oldestData } = await supabase
    .from('nse_fo_symbols')
    .select('expiry')
    .order('expiry', { ascending: true })
    .limit(1)
    .single();

  const { data: newestData } = await supabase
    .from('nse_fo_symbols')
    .select('expiry')
    .order('expiry', { ascending: false })
    .limit(1)
    .single();

  const report: StatusReport = {
    totalContracts: totalCount || 0,
    activeContracts: activeCount || 0,
    inactiveContracts: inactiveCount || 0,
    expiredActiveContracts: expiredActiveCount || 0,
    expiredInactiveContracts: expiredInactiveCount || 0,
    oldestExpiry: oldestData?.expiry || null,
    newestExpiry: newestData?.expiry || null,
    needsCleanup: (expiredActiveCount || 0) > 0
  };

  // Print report
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║           NSE F&O SYMBOLS STATUS REPORT                 ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  console.log(`📈 Total Contracts: ${report.totalContracts}`);
  console.log(`✅ Active Contracts: ${report.activeContracts}`);
  console.log(`❌ Inactive Contracts: ${report.inactiveContracts}\n`);

  console.log(`⏰ Expiry Range:`);
  console.log(`   Oldest: ${report.oldestExpiry}`);
  console.log(`   Newest: ${report.newestExpiry}\n`);

  console.log(`🗑️  Expired Contracts:`);
  console.log(`   ⚠️  Expired (ACTIVE): ${report.expiredActiveContracts} ← SHOULD BE 0!`);
  console.log(`   ✓  Expired (Inactive): ${report.expiredInactiveContracts}\n`);

  if (report.expiredActiveContracts > 0) {
    console.log("⚠️  WARNING: Found expired active contracts!");
    console.log("   These should be marked inactive by cleanup script.\n");
    console.log("   Sample expired active contracts:");
    expiredActive?.forEach((contract: any) => {
      console.log(`   - ${contract.symbol} (expired: ${contract.expiry})`);
    });
    console.log();
  }

  if (report.needsCleanup) {
    console.log("❌ CLEANUP NEEDED: Expired active contracts found!");
    console.log("   Run: npx tsx scripts/cleanup-expired-fo-symbols.ts\n");
  } else {
    console.log("✅ CLEANUP STATUS: OK - No expired active contracts\n");
  }

  return report;
}

async function checkEdgeFunctionLogs() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║         EDGE FUNCTION EXECUTION CHECK                   ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  console.log("📝 To check if edge functions are being called:\n");
  
  console.log("1. Check fetch contracts edge function:");
  console.log("   npx supabase functions logs nse_fo_fetch_nifty_contracts\n");
  
  console.log("2. Check cleanup (if edge function exists):");
  console.log("   npx supabase functions logs cleanup-expired-fo\n");

  console.log("3. Manually test fetch contracts:");
  console.log(`   curl -X POST "${SUPABASE_URL}/functions/v1/nse_fo_fetch_nifty_contracts" \\`);
  console.log(`     -H "Authorization: Bearer ${SUPABASE_KEY}"\n`);

  console.log("4. Check droplet cron jobs:");
  console.log("   ssh root@143.244.129.143 'crontab -l | grep -i nifty'\n");
}

async function checkCronConfiguration() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║         RECOMMENDED CRON CONFIGURATION                  ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  console.log("📅 Suggested cron jobs for droplet:\n");

  console.log("# Fetch new NIFTY contracts daily at 8 AM (before market)");
  console.log("0 8 * * 1-5 /root/aigoat/cron-scripts/invoke-fetch-nifty-contracts.sh\n");

  console.log("# Cleanup expired contracts daily at 7 AM");
  console.log("0 7 * * * cd /root/aigoat && npx tsx scripts/cleanup-expired-fo-symbols.ts >> /root/logs/fo-cleanup.log 2>&1\n");

  console.log("📝 Create cron script: /root/aigoat/cron-scripts/invoke-fetch-nifty-contracts.sh");
  console.log("#!/bin/bash");
  console.log(`curl -X POST "${SUPABASE_URL}/functions/v1/nse_fo_fetch_nifty_contracts" \\`);
  console.log(`  -H "Authorization: Bearer ${SUPABASE_KEY}" \\`);
  console.log(`  >> /root/logs/fetch-nifty-contracts.log 2>&1\n`);
}

async function main() {
  try {
    console.clear();
    console.log("\n");
    
    // Check database status
    const report = await checkNseFoSymbolsStatus();
    
    // Check edge function setup
    await checkEdgeFunctionLogs();
    
    // Show recommended configuration
    await checkCronConfiguration();

    console.log("╔══════════════════════════════════════════════════════════╗");
    console.log("║                    SUMMARY                               ║");
    console.log("╚══════════════════════════════════════════════════════════╝\n");

    if (report.needsCleanup) {
      console.log("⚠️  ACTION REQUIRED:");
      console.log(`   1. Run cleanup script to fix ${report.expiredActiveContracts} expired contracts`);
      console.log("   2. Setup daily cron job for automatic cleanup");
      console.log("   3. Setup cron job to call fetch contracts edge function\n");
    } else {
      console.log("✅ Database is clean");
      console.log("   Verify cron jobs are configured on droplet\n");
    }

  } catch (error: any) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

// Run
if (require.main === module) {
  main();
}

export { checkNseFoSymbolsStatus, checkEdgeFunctionLogs, checkCronConfiguration };
