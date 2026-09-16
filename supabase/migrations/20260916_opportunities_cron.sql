-- Enable extensions for cron scheduling and asynchronous HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unschedules existing jobs if already defined to avoid duplicate tasks
DO $$
BEGIN
  PERFORM cron.unschedule('opportunity-reminders-check')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'opportunity-reminders-check');

  PERFORM cron.unschedule('opportunity-daily-digest')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'opportunity-daily-digest');
END $$;

-- 1. Run reminder checks twice daily (08:00 and 18:00 UTC)
-- Replace YOUR_CRON_SECRET with your CRON_SECRET environment variable value
SELECT cron.schedule(
  'opportunity-reminders-check',
  '0 8,18 * * *',
  $$
  SELECT net.http_post(
    url := 'https://abodid.com/api/opportunities/cron/reminders',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_CRON_SECRET"}'::jsonb
  );
  $$
);

-- 2. Run daily digest briefing every night at 21:00 UTC (9 PM UTC)
SELECT cron.schedule(
  'opportunity-daily-digest',
  '0 21 * * *',
  $$
  SELECT net.http_post(
    url := 'https://abodid.com/api/opportunities/cron/digest',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_CRON_SECRET"}'::jsonb
  );
  $$
);
