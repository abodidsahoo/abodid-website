-- Multi-user Opportunities foundation.
--
-- This migration is additive: the legacy public.opportunities table remains
-- intact as a rollback source. Existing founder rows are copied exactly once
-- into public.saved_opportunities when the founder auth identity already
-- exists. The application cuts over to saved_opportunities after migration.

begin;

alter table public.profiles
  add column if not exists is_public boolean not null default false,
  add column if not exists created_at timestamptz not null default now();

alter table public.profiles
  drop constraint if exists profiles_opportunity_username_format;

alter table public.profiles
  add constraint profiles_opportunity_username_format
  check (
    username is null
    or (
      username ~ '^[a-z0-9_]{3,24}$'
      and lower(username) <> all (array[
        'settings', 'login', 'logout', 'auth', 'api', 'admin', 'new',
        'extension', 'extensions', 'public', 'private', 'me', 'account',
        'support', 'help', 'terms', 'privacy'
      ])
    )
  ) not valid;

create table if not exists public.saved_opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 240),
  source_url text not null check (char_length(source_url) between 1 and 4096),
  canonical_url text not null check (char_length(canonical_url) between 1 and 4096),
  deadline_at timestamptz,
  status text not null default 'inbox' check (
    status in ('inbox', 'interested', 'preparing', 'submitted', 'registered', 'attending', 'done', 'dismissed')
  ),
  priority integer not null default 1 check (priority in (1, 2, 3)),
  outcome text check (
    outcome is null or outcome in ('accepted', 'rejected', 'attended', 'withdrawn', 'expired', 'unknown')
  ),
  content jsonb not null default '{}'::jsonb check (jsonb_typeof(content) = 'object'),
  notes text check (notes is null or char_length(notes) <= 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saved_opportunities_user_canonical_unique unique (user_id, canonical_url)
);

create index if not exists saved_opportunities_user_updated_idx
  on public.saved_opportunities (user_id, updated_at desc);

create index if not exists saved_opportunities_user_status_deadline_idx
  on public.saved_opportunities (user_id, status, deadline_at)
  where status not in ('done', 'dismissed');

create index if not exists saved_opportunities_user_priority_idx
  on public.saved_opportunities (user_id, priority desc, updated_at desc);

create table if not exists public.saved_opportunity_notification_log (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.saved_opportunities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  notification_type text not null,
  scheduled_for timestamptz not null,
  sent_at timestamptz not null default now(),
  status text not null default 'sent',
  unique (user_id, opportunity_id, notification_type)
);

create index if not exists saved_opportunity_notification_user_sent_idx
  on public.saved_opportunity_notification_log (user_id, sent_at desc);

alter table public.saved_opportunity_notification_log enable row level security;
alter table public.saved_opportunity_notification_log force row level security;
revoke all on table public.saved_opportunity_notification_log from public, anon, authenticated;
grant all on table public.saved_opportunity_notification_log to service_role;

create table if not exists public.opportunity_ingestion_rate_limits (
  key_hash text primary key check (char_length(key_hash) = 64),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1 check (request_count > 0),
  updated_at timestamptz not null default now()
);

alter table public.opportunity_ingestion_rate_limits enable row level security;
revoke all on table public.opportunity_ingestion_rate_limits from public, anon, authenticated;
grant all on table public.opportunity_ingestion_rate_limits to service_role;

create or replace function public.consume_opportunity_ingestion_rate_limit(
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_time timestamptz := clock_timestamp();
  current_row public.opportunity_ingestion_rate_limits%rowtype;
begin
  if char_length(p_key_hash) <> 64 or p_limit < 1 or p_window_seconds < 1 then
    raise exception 'Invalid ingestion rate-limit input';
  end if;

  insert into public.opportunity_ingestion_rate_limits as limits (
    key_hash, window_started_at, request_count, updated_at
  ) values (
    p_key_hash, current_time, 1, current_time
  )
  on conflict (key_hash) do update set
    window_started_at = case
      when limits.window_started_at <= current_time - make_interval(secs => p_window_seconds)
        then current_time else limits.window_started_at end,
    request_count = case
      when limits.window_started_at <= current_time - make_interval(secs => p_window_seconds)
        then 1 else limits.request_count + 1 end,
    updated_at = current_time
  returning * into current_row;

  delete from public.opportunity_ingestion_rate_limits
  where updated_at < current_time - interval '2 days';

  return query select
    current_row.request_count <= p_limit,
    greatest(0, ceil(extract(epoch from (
      current_row.window_started_at
      + make_interval(secs => p_window_seconds)
      - current_time
    )))::integer);
end;
$$;

revoke all on function public.consume_opportunity_ingestion_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_opportunity_ingestion_rate_limit(text, integer, integer)
  to service_role;

create or replace function public.handle_saved_opportunities_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_saved_opportunities_updated_at on public.saved_opportunities;
create trigger set_saved_opportunities_updated_at
before update on public.saved_opportunities
for each row execute function public.handle_saved_opportunities_updated_at();

alter table public.saved_opportunities enable row level security;
alter table public.saved_opportunities force row level security;

drop policy if exists "Owners can read saved opportunities" on public.saved_opportunities;
create policy "Owners can read saved opportunities"
on public.saved_opportunities
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Owners can create saved opportunities" on public.saved_opportunities;
create policy "Owners can create saved opportunities"
on public.saved_opportunities
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Owners can update saved opportunities" on public.saved_opportunities;
create policy "Owners can update saved opportunities"
on public.saved_opportunities
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Owners can delete saved opportunities" on public.saved_opportunities;
create policy "Owners can delete saved opportunities"
on public.saved_opportunities
for delete
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.saved_opportunities from anon;
grant select, insert, update, delete on table public.saved_opportunities to authenticated;

-- The profile row is private by default. Anonymous callers may read only the
-- explicitly granted public-facing columns, and only for profiles that opted in.
alter table public.profiles enable row level security;

drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
drop policy if exists "Opportunity public profiles are viewable" on public.profiles;
create policy "Opportunity public profiles are viewable"
on public.profiles
for select
to anon
using (is_public = true);

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

revoke select on table public.profiles from anon;
grant select (id, username, full_name, avatar_url, website, bio, social_links, is_public, created_at)
  on table public.profiles to anon;
grant select on table public.profiles to authenticated;

-- Authenticated visitors also need to resolve opted-in public profiles (for
-- example on the existing Resources pages), but must not gain access to role,
-- email, approval or other account columns. This deliberately narrow view is
-- owned by the migration role and exposes only rows that opted into sharing.
drop view if exists public.public_profiles;
create view public.public_profiles
with (security_barrier = true)
as
select id, username, full_name, avatar_url, website, bio, social_links, is_public, created_at
from public.profiles
where is_public = true;

revoke all on table public.public_profiles from public, anon, authenticated;
grant select on table public.public_profiles to anon, authenticated;

-- Users may only update the public Opportunity profile fields. Existing
-- server-managed role/is_approved protections remain in force.
revoke update on table public.profiles from authenticated;
grant update (username, full_name, avatar_url, is_public, updated_at)
  on table public.profiles to authenticated;

create or replace function public.backfill_founder_opportunities(p_founder_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from auth.users
    where id = p_founder_id and lower(email) = 'abodidsahoo@gmail.com'
  ) then
    raise exception 'Founder identity verification failed' using errcode = '42501';
  end if;

  insert into public.saved_opportunities (
    id, user_id, title, source_url, canonical_url, deadline_at, status,
    priority, outcome, content, notes, created_at, updated_at
  )
  select
    opportunity.id,
    p_founder_id,
    opportunity.title,
    opportunity.source_url,
    opportunity.canonical_url,
    opportunity.deadline_at,
    opportunity.status,
    opportunity.priority,
    opportunity.outcome,
    jsonb_build_object(
      'organisation', opportunity.organisation,
      'category', opportunity.category,
      'deadline_raw', opportunity.deadline_raw,
      'deadline_timezone', opportunity.deadline_timezone,
      'deadline_confidence', opportunity.deadline_confidence,
      'event_date', opportunity.event_date,
      'location', opportunity.location,
      'requirements', opportunity.requirements,
      'next_action', opportunity.next_action,
      'application_url', opportunity.application_url,
      'meeting_url', opportunity.meeting_url,
      'fee_or_funding', opportunity.fee_or_funding,
      'summary', opportunity.summary,
      'extracted_at', opportunity.extracted_at,
      'source_hash', opportunity.source_hash,
      'llm_model', opportunity.llm_model,
      'llm_extraction_count', opportunity.llm_extraction_count,
      'legacy_opportunity_id', opportunity.id
    ),
    opportunity.notes,
    opportunity.created_at,
    opportunity.updated_at
  from public.opportunities as opportunity
  on conflict (id) do nothing;

  insert into public.saved_opportunity_notification_log (
    id, opportunity_id, user_id, notification_type, scheduled_for, sent_at, status
  )
  select
    legacy_log.id,
    legacy_log.opportunity_id,
    p_founder_id,
    legacy_log.notification_type,
    legacy_log.scheduled_for,
    legacy_log.sent_at,
    legacy_log.status
  from public.notification_log as legacy_log
  where exists (
    select 1 from public.saved_opportunities saved
    where saved.id = legacy_log.opportunity_id
      and saved.user_id = p_founder_id
  )
  on conflict (user_id, opportunity_id, notification_type) do nothing;
end;
$$;

revoke all on function public.backfill_founder_opportunities(uuid)
  from public, anon, authenticated;

-- The public founder URL cannot be claimed by another account before the
-- founder's first Google login.
create or replace function public.protect_opportunity_founder_username()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if lower(coalesce(new.username, '')) = 'abodid'
     and not exists (
       select 1 from auth.users
       where id = new.id and lower(email) = 'abodidsahoo@gmail.com'
     ) then
    raise exception 'Username is reserved' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.protect_opportunity_founder_username()
  from public, anon, authenticated;

drop trigger if exists protect_opportunity_founder_username on public.profiles;
create trigger protect_opportunity_founder_username
before insert or update on public.profiles
for each row execute function public.protect_opportunity_founder_username();

do $$
begin
  if exists (
    select 1
    from public.profiles profile
    left join auth.users auth_user on auth_user.id = profile.id
    where lower(profile.username) = 'abodid'
      and lower(coalesce(auth_user.email, '')) <> 'abodidsahoo@gmail.com'
  ) then
    raise exception 'Username abodid is already owned by a different profile';
  end if;
end
$$;

-- Generate stable usernames from Google profile names, handle reserved words,
-- and resolve concurrent collisions through the table's unique constraint.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text;
  base_username text;
  candidate_username text;
  full_name_value text;
  suffix integer := 0;
  is_founder boolean := lower(coalesce(new.email, '')) = 'abodidsahoo@gmail.com';
  reserved text[] := array[
    'settings', 'login', 'logout', 'auth', 'api', 'admin', 'new',
    'extension', 'extensions', 'public', 'private', 'me', 'account',
    'support', 'help', 'terms', 'privacy'
  ];
begin
  if exists (select 1 from public.profiles where id = new.id) then
    update public.profiles
    set
      username = case when is_founder then 'abodid' else public.profiles.username end,
      full_name = coalesce(
        nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
        nullif(trim(new.raw_user_meta_data->>'name'), ''),
        public.profiles.full_name
      ),
      avatar_url = coalesce(
        nullif(trim(new.raw_user_meta_data->>'avatar_url'), ''),
        nullif(trim(new.raw_user_meta_data->>'picture'), ''),
        public.profiles.avatar_url
      ),
      role = case when is_founder then 'admin' else public.profiles.role end,
      is_public = case when is_founder then false else public.profiles.is_public end,
      updated_at = now()
    where id = new.id;
    if is_founder then
      perform public.backfill_founder_opportunities(new.id);
    end if;
    return new;
  end if;

  full_name_value := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    split_part(coalesce(new.email, ''), '@', 1),
    'Opportunity user'
  );

  requested_username := coalesce(
    nullif(trim(new.raw_user_meta_data->>'user_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'preferred_username'), ''),
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    split_part(coalesce(new.email, ''), '@', 1),
    'user'
  );

  base_username := case
    when is_founder then 'abodid'
    else lower(regexp_replace(requested_username, '[^a-zA-Z0-9_]', '', 'g'))
  end;
  base_username := left(base_username, 24);

  if char_length(base_username) < 3 or base_username = any (reserved) then
    base_username := 'user' || right(new.id::text, 6);
  end if;

  candidate_username := base_username;

  loop
    begin
      insert into public.profiles (
        id, username, full_name, avatar_url, role, is_public, created_at, updated_at
      ) values (
        new.id,
        candidate_username,
        full_name_value,
        coalesce(
          nullif(trim(new.raw_user_meta_data->>'avatar_url'), ''),
          nullif(trim(new.raw_user_meta_data->>'picture'), '')
        ),
        case when is_founder then 'admin' else 'user' end,
        false,
        now(),
        now()
      );
      exit;
    exception
      when unique_violation then
        suffix := suffix + 1;
        candidate_username := left(base_username, greatest(3, 24 - char_length(suffix::text))) || suffix::text;
        if suffix > 9999 then
          candidate_username := 'user' || replace(new.id::text, '-', '');
          candidate_username := left(candidate_username, 24);
        end if;
    end;
  end loop;

  if is_founder then
    perform public.backfill_founder_opportunities(new.id);
  end if;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Do not assume the legacy signup trigger still exists. Recreate it so every
-- Google identity is provisioned before the OAuth request returns.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Preserve founder identity and collection URL when that Google identity is
-- already present. This never grants admin to an arbitrary client-supplied ID.
do $$
declare
  founder_id uuid;
  username_owner uuid;
begin
  select id into founder_id
  from auth.users
  where lower(email) = 'abodidsahoo@gmail.com'
  order by created_at asc
  limit 1;

  if founder_id is null then
    raise notice 'Founder auth user not present; founder backfill will be required after first Google login.';
    return;
  end if;

  select id into username_owner
  from public.profiles
  where lower(username) = 'abodid'
    and id <> founder_id
  limit 1;

  if username_owner is not null then
    raise exception 'Username abodid is already owned by a different profile';
  end if;

  update public.profiles
  set username = 'abodid', role = 'admin', is_public = false, updated_at = now()
  where id = founder_id;

  perform public.backfill_founder_opportunities(founder_id);

  if (select count(*) from public.saved_opportunities where user_id = founder_id)
     < (select count(*) from public.opportunities) then
    raise exception 'Founder opportunity backfill did not preserve every legacy row';
  end if;
end
$$;

commit;
