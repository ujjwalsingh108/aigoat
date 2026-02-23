-- ============================================================================
-- Check Supabase Cron Jobs Status - ALL JOBS
-- ============================================================================
-- Copy and paste this entire script into Supabase SQL Editor and run it
-- Shows: Extension status, scheduled jobs, execution history, success rates
-- ============================================================================

-- ============================================================================
-- 1. Check if pg_cron extension is enabled
-- ============================================================================
SELECT 
  '1. EXTENSION STATUS' as "Section",
  extname as "Extension Name",
  extversion as "Version",
  CASE 
    WHEN extname IS NOT NULL THEN '✅ Enabled'
    ELSE '❌ Not Enabled'
  END as "Status"
FROM pg_extension 
WHERE extname = 'pg_cron';

-- ============================================================================
-- 2. List all scheduled cron jobs with details
-- ============================================================================
SELECT 
  '2. SCHEDULED JOBS' as "Section",
  jobid as "Job ID",
  jobname as "Job Name",
  schedule as "Schedule (Cron)",
  active as "Active",
  CASE 
    WHEN command LIKE '%nse_cleanup-expired-fo-contracts%' THEN '🗑️ Cleanup Expired Contracts'
    WHEN command LIKE '%nse_fo_historical%' THEN '📊 Fetch Historical F&O Data'
    WHEN command LIKE '%fetch_nifty_contracts%' THEN '📥 Fetch NIFTY Contracts'
    ELSE '❓ Other'
  END as "Job Type",
  CASE 
    WHEN schedule = '31 18 * * *' THEN '00:01 IST Daily'
    WHEN schedule LIKE '%/5%' THEN 'Every 5 minutes (market hours)'
    WHEN schedule = '30 2 * * *' THEN '08:00 IST Daily'
    ELSE schedule
  END as "Human Readable Schedule"
FROM cron.job
ORDER BY jobname;

-- ============================================================================
-- 3. Check specific important jobs
-- ============================================================================
SELECT 
  '3. IMPORTANT JOBS STATUS' as "Section",
  'nse_cleanup-expired-fo-contracts' as "Job Name",
  CASE 
    WHEN EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nse_cleanup-expired-fo-contracts') 
    THEN '✅ Scheduled'
    ELSE '❌ NOT FOUND'
  END as "Status",
  (SELECT schedule FROM cron.job WHERE jobname = 'nse_cleanup-expired-fo-contracts') as "Schedule",
  (SELECT active FROM cron.job WHERE jobname = 'nse_cleanup-expired-fo-contracts') as "Active"
UNION ALL
SELECT 
  '3. IMPORTANT JOBS STATUS',
  'Other cleanup jobs',
  CASE 
    WHEN EXISTS (SELECT 1 FROM cron.job WHERE jobname LIKE '%cleanup%' AND jobname != 'nse_cleanup-expired-fo-contracts') 
    THEN '⚠️ Found: ' || (SELECT string_agg(jobname, ', ') FROM cron.job WHERE jobname LIKE '%cleanup%' AND jobname != 'nse_cleanup-expired-fo-contracts')
    ELSE '✅ None'
  END,
  NULL,
  NULL;

-- ============================================================================
-- 4. Recent execution history (last 20 runs) - ALL JOBS
-- ============================================================================
SELECT 
  '4. RECENT EXECUTIONS (Last 20)' as "Section",
  j.jobname as "Job Name",
  r.runid as "Run ID",
  r.start_time as "Started At (UTC)",
  r.end_time as "Ended At (UTC)",
  ROUND(EXTRACT(EPOCH FROM (r.end_time - r.start_time))::numeric, 2) as "Duration (sec)",
  r.status as "Status",
  CASE 
    WHEN r.status = 'succeeded' THEN '✅'
    WHEN r.status = 'failed' THEN '❌'
    ELSE '⚠️'
  END as "Icon",
  LEFT(r.return_message, 100) as "Message (truncated)"
FROM cron.job_run_details r
JOIN cron.job j ON j.jobid = r.jobid
ORDER BY r.start_time DESC
LIMIT 20;

-- ============================================================================
-- 5. Cleanup job execution history (last 10 runs)
-- ============================================================================
SELECT 
  '5. CLEANUP JOB HISTORY' as "Section",
  runid as "Run ID",
  start_time as "Started At (UTC)",
  end_time as "Ended At (UTC)",
  status as "Status",
  CASE 
    WHEN status = 'succeeded' THEN '✅ Success'
    WHEN status = 'failed' THEN '❌ Failed'
    ELSE '⚠️ ' || status
  END as "Result",
  LEFT(return_message, 150) as "Message"
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'nse_cleanup-expired-fo-contracts')
ORDER BY start_time DESC
LIMIT 10;

-- ============================================================================
-- 6. Success rate statistics by job
-- ============================================================================
SELECT 
  '6. SUCCESS RATE STATISTICS' as "Section",
  j.jobname as "Job Name",
  COUNT(*) as "Total Runs",
  SUM(CASE WHEN r.status = 'succeeded' THEN 1 ELSE 0 END) as "✅ Succeeded",
  SUM(CASE WHEN r.status = 'failed' THEN 1 ELSE 0 END) as "❌ Failed",
  ROUND(
    100.0 * SUM(CASE WHEN r.status = 'succeeded' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0),
    2
  ) as "Success Rate %",
  MAX(r.start_time) as "Last Run At (UTC)",
  CASE 
    WHEN MAX(r.start_time) > NOW() - INTERVAL '2 days' THEN '✅ Recent'
    WHEN MAX(r.start_time) > NOW() - INTERVAL '7 days' THEN '⚠️ Stale'
    WHEN MAX(r.start_time) IS NULL THEN '❌ Never Run'
    ELSE '❌ Very Old'
  END as "Status"
FROM cron.job j
LEFT JOIN cron.job_run_details r ON j.jobid = r.jobid
GROUP BY j.jobname, j.jobid
ORDER BY j.jobname;

-- ============================================================================
-- 7. Check if jobs are running on schedule
-- ============================================================================
SELECT 
  '7. SCHEDULE COMPLIANCE' as "Section",
  j.jobname as "Job Name",
  j.schedule as "Expected Schedule",
  MAX(r.start_time) as "Last Execution (UTC)",
  CASE 
    WHEN j.schedule LIKE '%/5%' AND MAX(r.start_time) < NOW() - INTERVAL '10 minutes' THEN '❌ Should run every 5 min - OVERDUE'
    WHEN j.schedule LIKE '%* * *%' AND MAX(r.start_time) < NOW() - INTERVAL '2 days' THEN '❌ Daily job OVERDUE'
    WHEN MAX(r.start_time) IS NULL THEN '⚠️ NEVER RUN'
    WHEN MAX(r.start_time) > NOW() - INTERVAL '1 day' THEN '✅ Running on schedule'
    ELSE '⚠️ Check schedule'
  END as "Compliance Status",
  EXTRACT(EPOCH FROM (NOW() - MAX(r.start_time)))/3600 as "Hours Since Last Run"
FROM cron.job j
LEFT JOIN cron.job_run_details r ON j.jobid = r.jobid
GROUP BY j.jobname, j.jobid, j.schedule
ORDER BY j.jobname;

-- ============================================================================
-- 8. Summary - Quick Health Check
-- ============================================================================
SELECT 
  '8. SUMMARY - HEALTH CHECK' as "Section",
  (SELECT COUNT(*) FROM cron.job) as "Total Jobs Scheduled",
  (SELECT COUNT(*) FROM cron.job WHERE active = true) as "Active Jobs",
  (SELECT COUNT(DISTINCT jobid) FROM cron.job_run_details WHERE start_time > NOW() - INTERVAL '24 hours') as "Jobs Run in Last 24h",
  (SELECT COUNT(*) FROM cron.job_run_details WHERE status = 'failed' AND start_time > NOW() - INTERVAL '24 hours') as "Failures in Last 24h",
  CASE 
    WHEN EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nse_cleanup-expired-fo-contracts') 
    THEN '✅ YES'
    ELSE '❌ NO'
  END as "Cleanup Job Exists",
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM cron.job_run_details r
      JOIN cron.job j ON j.jobid = r.jobid
      WHERE j.jobname = 'nse_cleanup-expired-fo-contracts'
      AND r.start_time > NOW() - INTERVAL '2 days'
      AND r.status = 'succeeded'
    ) THEN '✅ YES'
    WHEN EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nse_cleanup-expired-fo-contracts')
    THEN '⚠️ SCHEDULED BUT NOT RUN'
    ELSE '❌ NO'
  END as "Cleanup Job Running";

-- ============================================================================
-- 9. Failed jobs in last 7 days (if any)
-- ============================================================================
SELECT 
  '9. RECENT FAILURES (Last 7 Days)' as "Section",
  j.jobname as "Job Name",
  r.start_time as "Failed At (UTC)",
  r.return_message as "Error Message"
FROM cron.job_run_details r
JOIN cron.job j ON j.jobid = r.jobid
WHERE r.status = 'failed'
AND r.start_time > NOW() - INTERVAL '7 days'
ORDER BY r.start_time DESC
LIMIT 20;
