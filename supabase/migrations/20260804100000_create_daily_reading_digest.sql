begin;

create extension if not exists pgcrypto;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create or replace function public.reading_digest_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.reading_digest_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.reading_digest_settings (
  id boolean primary key default true check (id),
  recipient_name text not null default 'Abodid',
  recipient_email text not null default 'abodidsahoo@gmail.com',
  sender_name text not null default 'Abodid reads',
  sender_email text not null default 'hello@abodid.com',
  reply_to_email text,
  timezone text not null default 'Asia/Kolkata' check (timezone = 'Asia/Kolkata'),
  delivery_hour smallint not null default 8 check (delivery_hour = 8),
  frequency text not null default 'daily'
    check (frequency in ('daily', 'weekdays', 'weekly', 'paused')),
  weekly_delivery_day smallint not null default 1
    check (weekly_delivery_day between 0 and 6),
  recent_lookback_days integer not null default 45
    check (recent_lookback_days between 7 and 365),
  openai_model text not null default 'gpt-4o-mini',
  enabled boolean not null default true,
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.reading_digest_settings (id, recipient_email)
values (true, 'abodidsahoo@gmail.com')
on conflict (id) do update set recipient_email = excluded.recipient_email;

create table public.reading_digest_topics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  weight numeric(4, 2) not null default 1 check (weight between 0.1 and 5),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name)
);

insert into public.reading_digest_topics (name, weight) values
  ('Immersive media', 1.2),
  ('Participatory art', 1.2),
  ('Photography', 1.1),
  ('Ethnography', 1.1),
  ('AI and culture', 1.2),
  ('Cultural heritage', 1.1),
  ('Museums', 1.0),
  ('Exhibition design', 1.1),
  ('Spatial storytelling', 1.2),
  ('Practice-based research', 1.2),
  ('Digital humanities', 1.0),
  ('Creative technology', 1.1)
on conflict (name) do nothing;

create table public.reading_digest_sources (
  id uuid primary key default gen_random_uuid(),
  domain text not null,
  name text not null default '',
  disposition text not null check (disposition in ('trusted', 'blocked')),
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (domain)
);

insert into public.reading_digest_sources (domain, name, disposition, notes) values
  ('tate.org.uk', 'Tate', 'trusted', 'Museum research, conservation and artist material'),
  ('vam.ac.uk', 'V&A', 'trusted', 'Museum, design and conservation research'),
  ('moma.org', 'MoMA', 'trusted', 'Museum publications and artist research'),
  ('si.edu', 'Smithsonian Institution', 'trusted', 'Museum and cultural heritage research'),
  ('getty.edu', 'Getty', 'trusted', 'Conservation, art history and cultural heritage'),
  ('metmuseum.org', 'The Metropolitan Museum of Art', 'trusted', 'Museum scholarship and collection research'),
  ('acm.org', 'Association for Computing Machinery', 'trusted', 'Peer-reviewed creative technology research'),
  ('mitpress.mit.edu', 'MIT Press', 'trusted', 'Research books and journals'),
  ('e-flux.com', 'e-flux', 'trusted', 'Recognised art and cultural publication'),
  ('rhizome.org', 'Rhizome', 'trusted', 'Digital art and network culture'),
  ('producthunt.com', 'Product Hunt', 'blocked', 'Promotional product listings'),
  ('pinterest.com', 'Pinterest', 'blocked', 'Aggregator without reliable publication metadata'),
  ('linkedin.com', 'LinkedIn', 'blocked', 'Promotional and social posts'),
  ('newsbreak.com', 'NewsBreak', 'blocked', 'Aggregated news'),
  ('msn.com', 'MSN', 'blocked', 'Aggregated news'),
  ('yahoo.com', 'Yahoo', 'blocked', 'Aggregated news')
on conflict (domain) do nothing;

create table public.reading_digest_runs (
  id uuid primary key default gen_random_uuid(),
  run_key text not null unique,
  trigger_source text not null default 'cron'
    check (trigger_source in ('cron', 'dashboard', 'manual')),
  status text not null default 'running'
    check (status in ('running', 'skipped', 'failed', 'completed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  discovered_count integer not null default 0,
  verified_count integer not null default 0,
  selected_count integer not null default 0,
  openai_response_ids text[] not null default '{}',
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create index reading_digest_runs_started_idx
  on public.reading_digest_runs(started_at desc);

create table public.reading_digest_readings (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  canonical_url text not null unique,
  title text not null,
  normalized_title text not null,
  source_name text not null,
  source_domain text not null,
  publication_date date not null,
  estimated_reading_minutes integer not null
    check (estimated_reading_minutes between 1 and 180),
  why_it_matters text not null,
  topic_names text[] not null default '{}',
  relevance_score numeric(6, 2) not null default 0,
  credibility_score numeric(6, 2) not null default 0,
  rank_score numeric(7, 2) not null default 0,
  is_foundational boolean not null default false,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'broken', 'blocked', 'duplicate', 'unverifiable')),
  http_status integer,
  content_type text,
  status text not null default 'discovered'
    check (status in ('discovered', 'selected', 'sent', 'rejected')),
  rejection_reason text,
  first_discovered_at timestamptz not null default now(),
  last_discovered_at timestamptz not null default now(),
  selected_at timestamptz,
  sent_at timestamptz,
  discovery_run_id uuid references public.reading_digest_runs(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (array_length(regexp_split_to_array(trim(why_it_matters), '[[:space:]]+'), 1) <= 20)
);

create index reading_digest_readings_discovered_idx
  on public.reading_digest_readings(first_discovered_at desc);
create index reading_digest_readings_status_idx
  on public.reading_digest_readings(status, rank_score desc);
create index reading_digest_readings_domain_idx
  on public.reading_digest_readings(source_domain);

create table public.reading_digest_deliveries (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null unique references public.reading_digest_runs(id) on delete restrict,
  delivery_date date not null,
  recipient_email text not null,
  subject text not null,
  status text not null default 'preparing'
    check (status in ('preparing', 'sending', 'sent', 'failed')),
  resend_email_id text,
  idempotency_key text not null unique,
  html text not null default '',
  error_message text,
  attempted_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index reading_digest_deliveries_created_idx
  on public.reading_digest_deliveries(created_at desc);

create table public.reading_digest_delivery_items (
  delivery_id uuid not null references public.reading_digest_deliveries(id) on delete cascade,
  reading_id uuid not null unique references public.reading_digest_readings(id) on delete restrict,
  position smallint not null check (position between 1 and 5),
  is_read_first boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (delivery_id, position),
  unique (delivery_id, reading_id)
);

create unique index reading_digest_one_read_first_idx
  on public.reading_digest_delivery_items(delivery_id)
  where is_read_first;

create table public.reading_digest_saves (
  id uuid primary key default gen_random_uuid(),
  reading_id uuid not null references public.reading_digest_readings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (reading_id, user_id)
);

create table public.reading_digest_feedback (
  id uuid primary key default gen_random_uuid(),
  reading_id uuid not null references public.reading_digest_readings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  signal text not null
    check (signal in ('helpful', 'not_for_me', 'read', 'dismissed')),
  note text not null default '',
  created_at timestamptz not null default now()
);

create index reading_digest_feedback_reading_idx
  on public.reading_digest_feedback(reading_id, created_at desc);

create or replace function public.reading_digest_finalize_delivery(
  p_delivery_id uuid,
  p_resend_email_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_count integer;
  v_read_first_count integer;
  v_run_id uuid;
begin
  select count(*), count(*) filter (where is_read_first)
  into v_item_count, v_read_first_count
  from public.reading_digest_delivery_items
  where delivery_id = p_delivery_id;

  if v_item_count <> 5 or v_read_first_count <> 1 then
    raise exception 'A sent digest requires exactly five items and one read-first item';
  end if;

  update public.reading_digest_deliveries
  set status = 'sent',
      resend_email_id = p_resend_email_id,
      sent_at = now(),
      error_message = null
  where id = p_delivery_id
  returning run_id into v_run_id;

  if v_run_id is null then
    raise exception 'Delivery not found';
  end if;

  update public.reading_digest_readings r
  set status = 'sent', sent_at = now(), updated_at = now()
  from public.reading_digest_delivery_items i
  where i.delivery_id = p_delivery_id and i.reading_id = r.id;

  update public.reading_digest_runs
  set status = 'completed', finished_at = now(), selected_count = 5
  where id = v_run_id;

  update public.reading_digest_settings
  set last_sent_at = now(), updated_at = now()
  where id = true;
end;
$$;

create trigger reading_digest_settings_touch
before update on public.reading_digest_settings
for each row execute function public.reading_digest_touch_updated_at();

create trigger reading_digest_topics_touch
before update on public.reading_digest_topics
for each row execute function public.reading_digest_touch_updated_at();

create trigger reading_digest_sources_touch
before update on public.reading_digest_sources
for each row execute function public.reading_digest_touch_updated_at();

create trigger reading_digest_readings_touch
before update on public.reading_digest_readings
for each row execute function public.reading_digest_touch_updated_at();

alter table public.reading_digest_settings enable row level security;
alter table public.reading_digest_topics enable row level security;
alter table public.reading_digest_sources enable row level security;
alter table public.reading_digest_runs enable row level security;
alter table public.reading_digest_readings enable row level security;
alter table public.reading_digest_deliveries enable row level security;
alter table public.reading_digest_delivery_items enable row level security;
alter table public.reading_digest_saves enable row level security;
alter table public.reading_digest_feedback enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'reading_digest_settings',
    'reading_digest_topics',
    'reading_digest_sources',
    'reading_digest_runs',
    'reading_digest_readings',
    'reading_digest_deliveries',
    'reading_digest_delivery_items',
    'reading_digest_saves',
    'reading_digest_feedback'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_admin_all', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.reading_digest_is_admin()) with check (public.reading_digest_is_admin())',
      table_name || '_admin_all',
      table_name
    );
  end loop;
end;
$$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.reading_digest_settings,
  public.reading_digest_topics,
  public.reading_digest_sources,
  public.reading_digest_runs,
  public.reading_digest_readings,
  public.reading_digest_deliveries,
  public.reading_digest_delivery_items,
  public.reading_digest_saves,
  public.reading_digest_feedback
to authenticated;
grant select, insert, update, delete on
  public.reading_digest_settings,
  public.reading_digest_topics,
  public.reading_digest_sources,
  public.reading_digest_runs,
  public.reading_digest_readings,
  public.reading_digest_deliveries,
  public.reading_digest_delivery_items,
  public.reading_digest_saves,
  public.reading_digest_feedback
to service_role;
grant execute on function public.reading_digest_is_admin() to authenticated;
revoke all on function public.reading_digest_finalize_delivery(uuid, text) from public, anon, authenticated;
grant execute on function public.reading_digest_finalize_delivery(uuid, text) to service_role;

-- Supabase Cron evaluates schedules in UTC. 02:30 UTC is 08:00 Asia/Kolkata.
-- The three Vault secrets are created during deployment; the job can be installed
-- now and will begin succeeding once those secrets and Edge Function secrets exist.
select cron.unschedule(jobid)
from cron.job
where jobname = 'daily-reading-digest-0800-ist';

select cron.schedule(
  'daily-reading-digest-0800-ist',
  '30 2 * * *',
  $cron$
    select net.http_post(
      url := (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'reading_digest_project_url'
        limit 1
      ) || '/functions/v1/daily-reading-digest',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'reading_digest_publishable_key'
          limit 1
        ),
        'x-cron-secret', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'reading_digest_cron_secret'
          limit 1
        )
      ),
      body := jsonb_build_object('trigger', 'cron', 'scheduled_at', now()),
      timeout_milliseconds := 300000
    ) as request_id;
  $cron$
);

commit;
