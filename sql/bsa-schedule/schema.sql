-- BSA schedule schema for Supabase/Postgres
-- All conference display times are Manchester time (Europe/London, GMT/BST).
-- Insert timestamps directly with Europe/London timezone literals.

create extension if not exists pgcrypto;

create table if not exists public.themes (
  code text primary key,
  name text not null
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table if not exists public.conference_days (
  day date primary key,
  label text not null
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  day date not null references public.conference_days(day) on update cascade on delete restrict,
  start_at timestamptz not null,
  end_at timestamptz not null,
  session_block text,
  kind text not null default 'session',
  theme_code text references public.themes(code) on update cascade on delete set null,
  track int,
  room_id uuid references public.rooms(id) on update cascade on delete set null,
  title_raw text not null,
  title_display text not null,
  sort_order int,
  constraint events_kind_check check (kind in ('session', 'special', 'break')),
  constraint events_time_check check (start_at < end_at),
  constraint events_track_check check (track is null or track >= 0)
);

create index if not exists idx_events_day on public.events(day);
create index if not exists idx_events_theme_code on public.events(theme_code);
create index if not exists idx_events_start_at on public.events(start_at);
create index if not exists idx_events_room_id on public.events(room_id);
create index if not exists idx_events_day_start_end on public.events(day, start_at, end_at);

-- Optional uniqueness guard for repeated imports per slot.
create unique index if not exists idx_events_unique_slot
  on public.events(day, start_at, end_at, room_id, title_display);

-- RLS: explicitly enable on all public tables.
do $$
declare
  table_name text;
begin
  for table_name in
    select tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security;', table_name);
  end loop;
end
$$;

-- Extra hardening for schedule tables.
alter table public.themes force row level security;
alter table public.rooms force row level security;
alter table public.conference_days force row level security;
alter table public.events force row level security;

-- Public read-only policies for schedule data.
drop policy if exists "public read themes" on public.themes;
create policy "public read themes"
  on public.themes
  for select
  to anon, authenticated
  using (true);

drop policy if exists "public read rooms" on public.rooms;
create policy "public read rooms"
  on public.rooms
  for select
  to anon, authenticated
  using (true);

drop policy if exists "public read conference_days" on public.conference_days;
create policy "public read conference_days"
  on public.conference_days
  for select
  to anon, authenticated
  using (true);

drop policy if exists "public read schedule" on public.events;
create policy "public read schedule"
  on public.events
  for select
  to anon, authenticated
  using (true);

-- Explicit grants/revokes for browser-facing roles.
grant usage on schema public to anon;
grant usage on schema public to authenticated;
grant select on public.themes to anon;
grant select on public.themes to authenticated;
grant select on public.rooms to anon;
grant select on public.rooms to authenticated;
grant select on public.conference_days to anon;
grant select on public.conference_days to authenticated;
grant select on public.events to anon;
grant select on public.events to authenticated;

revoke insert, update, delete on public.themes from anon;
revoke insert, update, delete on public.themes from authenticated;
revoke insert, update, delete on public.rooms from anon;
revoke insert, update, delete on public.rooms from authenticated;
revoke insert, update, delete on public.conference_days from anon;
revoke insert, update, delete on public.conference_days from authenticated;
revoke insert, update, delete on public.events from anon;
revoke insert, update, delete on public.events from authenticated;
