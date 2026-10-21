-- Durable, multi-user reminders for both opportunities and personal tasks.
-- Every saved item receives the default 1 day, 2 hour, and 30 minute
-- reminders when those times are still in the future. Direct "remind me"
-- captures also receive a reminder at the target time.

begin;

create table if not exists public.opportunity_reminders (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.saved_opportunities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null default 'telegram' check (channel in ('telegram')),
  target_kind text not null check (target_kind in ('deadline', 'event')),
  target_at timestamptz not null,
  offset_minutes integer not null check (offset_minutes between 0 and 525600),
  scheduled_for timestamptz not null,
  status text not null default 'pending' check (
    status in ('pending', 'processing', 'sent', 'cancelled', 'failed')
  ),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 10),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  messaging_event_id uuid references public.messaging_events(id) on delete set null,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (opportunity_id, channel, target_kind, offset_minutes)
);

create index if not exists opportunity_reminders_due_idx
  on public.opportunity_reminders (available_at, scheduled_for)
  where status in ('pending', 'failed');

create index if not exists opportunity_reminders_user_idx
  on public.opportunity_reminders (user_id, scheduled_for desc);

alter table public.opportunity_reminders enable row level security;
alter table public.opportunity_reminders force row level security;
revoke all on table public.opportunity_reminders from public, anon, authenticated;
grant all on table public.opportunity_reminders to service_role;

create or replace function public.sync_saved_opportunity_reminders()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_timestamp timestamptz;
  target_type text;
  selected_offsets integer[] := array[1440, 120, 30];
  reminder_offset integer;
  scheduled_timestamp timestamptz;
begin
  if new.deadline_at is not null then
    target_timestamp := new.deadline_at;
    target_type := 'deadline';
  elsif nullif(new.content->>'event_date', '') is not null then
    begin
      target_timestamp := (new.content->>'event_date')::timestamptz;
      target_type := 'event';
    exception when others then
      target_timestamp := null;
      target_type := null;
    end;
  end if;

  if jsonb_typeof(new.content->'reminder_offsets_minutes') = 'array' then
    select coalesce(array_agg(value::integer order by value::integer desc), array[]::integer[])
      into selected_offsets
    from jsonb_array_elements_text(new.content->'reminder_offsets_minutes')
    where value ~ '^\d+$'
      and value::integer between 0 and 525600;
  end if;

  if coalesce((new.content->>'reminder_at_target')::boolean, false)
     and not (0 = any(selected_offsets)) then
    selected_offsets := array_append(selected_offsets, 0);
  end if;

  if new.status <> 'reviewing'
     or coalesce((new.content->>'reminders_disabled')::boolean, false)
     or target_timestamp is null
     or target_timestamp <= now() then
    update public.opportunity_reminders
    set status = 'cancelled', locked_at = null, updated_at = now()
    where opportunity_id = new.id
      and status in ('pending', 'processing', 'failed');
    return new;
  end if;

  update public.opportunity_reminders
  set status = 'cancelled', locked_at = null, updated_at = now()
  where opportunity_id = new.id
    and status in ('pending', 'processing', 'failed')
    and (
      target_kind <> target_type
      or not (offset_minutes = any(selected_offsets))
    );

  foreach reminder_offset in array selected_offsets loop
    scheduled_timestamp := target_timestamp - make_interval(mins => reminder_offset);
    if scheduled_timestamp > now() then
      insert into public.opportunity_reminders (
        opportunity_id, user_id, channel, target_kind, target_at,
        offset_minutes, scheduled_for, status, available_at
      ) values (
        new.id, new.user_id, 'telegram', target_type, target_timestamp,
        reminder_offset, scheduled_timestamp, 'pending', scheduled_timestamp
      )
      on conflict (opportunity_id, channel, target_kind, offset_minutes)
      do update set
        user_id = excluded.user_id,
        target_at = excluded.target_at,
        scheduled_for = excluded.scheduled_for,
        available_at = excluded.scheduled_for,
        status = case
          when public.opportunity_reminders.target_at is distinct from excluded.target_at
            then 'pending'
          when public.opportunity_reminders.status = 'cancelled'
            then 'pending'
          else public.opportunity_reminders.status
        end,
        attempt_count = case
          when public.opportunity_reminders.target_at is distinct from excluded.target_at then 0
          else public.opportunity_reminders.attempt_count
        end,
        locked_at = null,
        sent_at = case
          when public.opportunity_reminders.target_at is distinct from excluded.target_at then null
          else public.opportunity_reminders.sent_at
        end,
        messaging_event_id = case
          when public.opportunity_reminders.target_at is distinct from excluded.target_at then null
          else public.opportunity_reminders.messaging_event_id
        end,
        error_code = null,
        error_message = null,
        updated_at = now();
    end if;
  end loop;

  return new;
end;
$$;

revoke all on function public.sync_saved_opportunity_reminders()
  from public, anon, authenticated;

drop trigger if exists sync_saved_opportunity_reminders on public.saved_opportunities;
create trigger sync_saved_opportunity_reminders
after insert or update of deadline_at, status, content on public.saved_opportunities
for each row execute function public.sync_saved_opportunity_reminders();

create or replace function public.claim_opportunity_reminders(p_limit integer default 25)
returns setof public.opportunity_reminders
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit < 1 or p_limit > 100 then
    raise exception 'Reminder claim limit must be between 1 and 100';
  end if;

  return query
  with claimable as (
    select reminders.id
    from public.opportunity_reminders as reminders
    where (
      reminders.status in ('pending', 'failed')
      and reminders.available_at <= now()
      and reminders.scheduled_for <= now()
    ) or (
      reminders.status = 'processing'
      and reminders.locked_at < now() - interval '10 minutes'
    )
    order by reminders.scheduled_for asc, reminders.created_at asc
    for update skip locked
    limit p_limit
  )
  update public.opportunity_reminders as reminders
  set status = 'processing',
      attempt_count = reminders.attempt_count + 1,
      locked_at = now(),
      error_code = null,
      error_message = null,
      updated_at = now()
  from claimable
  where reminders.id = claimable.id
  returning reminders.*;
end;
$$;

revoke all on function public.claim_opportunity_reminders(integer)
  from public, anon, authenticated;
grant execute on function public.claim_opportunity_reminders(integer)
  to service_role;

-- Populate future defaults for existing private cards.
update public.saved_opportunities
set content = content
where status = 'reviewing'
  and (
    deadline_at > now()
    or nullif(content->>'event_date', '') is not null
  );

do $$
begin
  perform cron.unschedule('opportunity-reminders-check')
  where exists (select 1 from cron.job where jobname = 'opportunity-reminders-check');
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
      body := '{"source":"supabase-cron"}'::jsonb,
      timeout_milliseconds := 55000
    );
  $cron$
);

commit;
