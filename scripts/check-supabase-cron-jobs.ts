/**
 * Check Supabase Cron Jobs Status
 * 
 * This script queries the pg_cron tables to see what cron jobs are scheduled
 * and their execution history.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kowxpazskkigzwdwzwyq.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in environment');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkCronJobs() {
  console.log('🔍 Checking Supabase Cron Jobs...\n');

  try {
    // Check if pg_cron extension is enabled
    console.log('📦 Checking pg_cron extension...');
    const { data: extensions, error: extError } = await supabase
      .rpc('check_pg_cron_extension');

    if (extError) {
      console.log('⚠️  Cannot query extensions directly. Checking jobs instead...\n');
    }

    // Get all scheduled cron jobs
    console.log('📅 Scheduled Cron Jobs:\n');
    const { data: jobs, error: jobsError } = await supabase
      .from('cron.job')
      .select('*');

    if (jobsError) {
      console.error('❌ Error fetching cron jobs:', jobsError.message);
      console.log('\n💡 Note: You may need to run these queries in Supabase SQL Editor:');
      console.log('   SELECT * FROM cron.job;');
      console.log('   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;\n');
      return;
    }

    if (!jobs || jobs.length === 0) {
      console.log('⚠️  No cron jobs found. The cleanup job may not be scheduled yet.\n');
      console.log('📝 To schedule the cleanup job, run the SQL from:');
      console.log('   supabase/functions/cleanup-expired-fo-contracts/cron.sql\n');
      return;
    }

    console.log(`Found ${jobs.length} cron job(s):\n`);
    jobs.forEach((job: any, index: number) => {
      console.log(`${index + 1}. Job Name: ${job.jobname || job.name}`);
      console.log(`   Job ID: ${job.jobid || job.id}`);
      console.log(`   Schedule: ${job.schedule}`);
      console.log(`   Command: ${job.command?.substring(0, 100)}...`);
      console.log(`   Active: ${job.active ?? 'N/A'}`);
      console.log('');
    });

    // Check for our specific cleanup job
    const cleanupJob = jobs.find((j: any) => 
      (j.jobname || j.name) === 'nse_cleanup-expired-fo-contracts'
    );

    if (cleanupJob) {
      console.log('✅ Found nse_cleanup-expired-fo-contracts job!\n');
      
      // Get execution history
      console.log('📊 Recent Execution History:\n');
      const { data: history, error: histError } = await supabase
        .from('cron.job_run_details')
        .select('*')
        .eq('jobid', cleanupJob.jobid || cleanupJob.id)
        .order('start_time', { ascending: false })
        .limit(10);

      if (histError) {
        console.log('⚠️  Cannot fetch execution history:', histError.message);
      } else if (!history || history.length === 0) {
        console.log('ℹ️  No execution history yet. Job may not have run.\n');
      } else {
        history.forEach((run: any, index: number) => {
          const startTime = new Date(run.start_time);
          const endTime = run.end_time ? new Date(run.end_time) : null;
          const duration = endTime ? (endTime.getTime() - startTime.getTime()) / 1000 : 'N/A';
          
          console.log(`${index + 1}. Run ID: ${run.runid}`);
          console.log(`   Started: ${startTime.toLocaleString()}`);
          console.log(`   Status: ${run.status}`);
          console.log(`   Duration: ${duration}s`);
          if (run.return_message) {
            console.log(`   Message: ${run.return_message}`);
          }
          console.log('');
        });
      }
    } else {
      console.log('⚠️  nse_cleanup-expired-fo-contracts job NOT found!\n');
      console.log('📝 To schedule it, run the SQL from:');
      console.log('   supabase/functions/cleanup-expired-fo-contracts/cron.sql\n');
    }

  } catch (error: any) {
    console.error('❌ Unexpected error:', error.message);
    console.log('\n💡 Alternative: Check cron jobs manually in Supabase SQL Editor:');
    console.log('\n-- See all jobs:');
    console.log('SELECT * FROM cron.job;\n');
    console.log('-- See execution history:');
    console.log('SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;\n');
  }
}

async function checkViaSQLQuery() {
  console.log('🔍 Trying alternative method via RPC...\n');
  
  try {
    // Try to execute raw SQL via RPC if available
    const { data, error } = await supabase.rpc('exec_sql', {
      query: 'SELECT jobname, schedule, active, command FROM cron.job'
    });

    if (error) {
      console.log('⚠️  RPC method not available\n');
      return false;
    }

    console.log('✅ Cron jobs:', data);
    return true;
  } catch (error) {
    return false;
  }
}

// Main execution
async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║          Supabase Cron Jobs Status Checker              ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const attempted = await checkViaSQLQuery();
  
  if (!attempted) {
    await checkCronJobs();
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('\n💡 Manual Check Options:\n');
  console.log('1. Supabase Dashboard: Database → cron.job table');
  console.log('2. SQL Editor: SELECT * FROM cron.job;');
  console.log('3. Edge Functions: Check logs for nse_cleanup-expired-fo-contracts\n');
}

main().catch(console.error);
