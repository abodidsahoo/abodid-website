-- Keep minute-level recovery checks inside Postgres, but do not wake the
-- Vercel function unless there is work it can claim. This preserves prompt
-- recovery for interrupted captures and due reminders without paying for two
-- idle serverless invocations every minute.

begin;

do $$
begin
  perform cron.unschedule('opportunity-capture-jobs-every-minute')
  where exists (
    select 1 from cron.job where jobname = 'opportunity-capture-jobs-every-minute'
  );
end;
$$;

select cron.schedule(
  'opportunity-capture-jobs-every-minute',
  '* * * * *',
  $cron$
    select net.http_post(
      url := 'https://abodid.com/api/opportunities/cron/capture-jobs',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'opportunities_cron_secret'
          limit 1
        )
      ),
      body := '{"source":"supabase-cron","reason":"ready-work"}'::jsonb,
      timeout_milliseconds := 55000
    )
    where exists (
      select 1
      from public.opportunity_capture_jobs as jobs
      where (jobs.status = 'pending' and jobs.available_at <= now())
         or (
           jobs.status = 'processing'
           and jobs.locked_at < now() - interval '15 minutes'
         )
         or (
           jobs.source_cleanup_at is not null
           and jobs.source_cleaned_at is null
           and jobs.source_cleanup_at <= now()
         )
    )
    or exists (
      select 1
      from public.messaging_events as events
      where events.provider = 'telegram'
        and events.direction = 'outbound'
        and (
          (
            events.status = 'processing'
            and events.updated_at < now() - interval '15 minutes'
          )
          or (
            events.status in ('queued', 'failed')
            and (
              events.created_at < now() - interval '24 hours'
              or events.attempted_at is null
              or events.attempted_at < now() - interval '5 minutes'
            )
          )
        )
    );
  $cron$
);

do $$
begin
  perform cron.unschedule('opportunity-reminders-check')
  where exists (
    select 1 from cron.job where jobname = 'opportunity-reminders-check'
  );
end;
$$;

select cron.schedule(
  'opportunity-reminders-check',
  '* * * * *',
  $cron$
    select net.http_post(
      url := 'https://abodid.com/api/opportunities/cron/reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'opportunities_cron_secret'
          limit 1
        )
      ),
      body := '{"source":"supabase-cron","reason":"due-reminder"}'::jsonb,
      timeout_milliseconds := 55000
    )
    where exists (
      select 1
      from public.opportunity_reminders as reminders
      where (
        reminders.status in ('pending', 'failed')
        and reminders.available_at <= now()
        and reminders.scheduled_for <= now()
      )
      or (
        reminders.status = 'processing'
        and reminders.locked_at < now() - interval '10 minutes'
      )
    );
  $cron$
);

commit;
