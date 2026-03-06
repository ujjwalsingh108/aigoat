-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule: daily at 3:00 AM IST (9:30 PM UTC)
SELECT cron.schedule(
  'nse-cleanup-expired-fo-contracts',
  '30 21 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://kowxpazskkigzwdwzwyq.supabase.co/functions/v1/nse-cleanup-expired-fo-contracts',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body    := '{}'::jsonb
  );
  $$
);
