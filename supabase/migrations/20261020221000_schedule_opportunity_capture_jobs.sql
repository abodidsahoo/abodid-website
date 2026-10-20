-- Activate recovery and cleanup only after the API is deployed and the same
-- cron secret exists in Vercel and Supabase Vault.

begin;

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if not exists (
    select 1
    from vault.decrypted_secrets
    where name = 'opportunities_cron_secret'
      and nullif(trim(decrypted_secret), '') is not null
  ) then
    raise exception 'Supabase Vault secret opportunities_cron_secret must be configured before scheduler activation';
  end if;
end;
$$;

do $$
begin
  perform cron.unschedule('opportunity-capture-jobs-every-minute')
  where exists (
    select 1 from cron.job where jobname = 'opportunity-capture-jobs-every-minute'
  );
end;
$$;

do $$
begin
  perform cron.unschedule('opportunity-capture-payload-cleanup')
  where exists (
    select 1 from cron.job where jobname = 'opportunity-capture-payload-cleanup'
  );
end;
$$;

-- Recovery sweep. Immediate work is started by Vercel waitUntil; this cron is
-- the durable fallback for interrupted invocations and delayed retries.
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
      body := '{"source":"supabase-cron"}'::jsonb,
      timeout_milliseconds := 55000
    );
  $cron$
);

-- Failed jobs retain their captured page snapshot briefly so a retry does not
-- depend on the original tab. The raw text is removed after 24 hours; the URL
-- and status metadata remain available as capture history.
select cron.schedule(
  'opportunity-capture-payload-cleanup',
  '17 * * * *',
  $cron$
    update public.opportunity_capture_jobs
    set payload = payload - 'page_text'
    where status in ('succeeded', 'failed')
      and completed_at < now() - interval '24 hours'
      and payload ? 'page_text';
  $cron$
);

commit;
