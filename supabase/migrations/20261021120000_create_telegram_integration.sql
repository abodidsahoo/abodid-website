-- Telegram is a thin transport over the existing Opportunity capture queue.
-- Connections and message delivery state stay server-only; captured source
-- material continues to use opportunity_capture_jobs and its cleanup policy.

begin;

create table if not exists public.messaging_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'telegram' check (provider in ('telegram')),
  provider_user_id text,
  provider_chat_id text,
  provider_username text,
  status text not null default 'pending' check (
    status in ('pending', 'active', 'disconnected')
  ),
  link_token_hash text check (
    link_token_hash is null or link_token_hash ~ '^[0-9a-f]{64}$'
  ),
  link_token_expires_at timestamptz,
  link_token_used_at timestamptz,
  settings jsonb not null default '{"reminders_enabled":true}'::jsonb
    check (jsonb_typeof(settings) = 'object'),
  linked_at timestamptz,
  disconnected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create unique index if not exists messaging_connections_provider_user_unique
  on public.messaging_connections (provider, provider_user_id)
  where provider_user_id is not null;

create unique index if not exists messaging_connections_provider_chat_unique
  on public.messaging_connections (provider, provider_chat_id)
  where provider_chat_id is not null;

create unique index if not exists messaging_connections_link_token_unique
  on public.messaging_connections (link_token_hash)
  where link_token_hash is not null;

create index if not exists messaging_connections_user_status_idx
  on public.messaging_connections (user_id, status);

create table if not exists public.messaging_events (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid references public.messaging_connections(id) on delete set null,
  user_id uuid references public.profiles(id) on delete cascade,
  provider text not null default 'telegram' check (provider in ('telegram')),
  direction text not null check (direction in ('inbound', 'outbound')),
  event_type text not null,
  status text not null default 'received' check (
    status in ('received', 'queued', 'processing', 'sent', 'processed', 'failed', 'ignored')
  ),
  provider_update_id text,
  provider_chat_id text,
  provider_message_id text,
  dedupe_key text,
  capture_job_id uuid,
  opportunity_id uuid references public.saved_opportunities(id) on delete set null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  error_code text,
  error_message text,
  attempted_at timestamptz,
  sent_at timestamptz,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists messaging_events_provider_update_unique
  on public.messaging_events (provider, provider_update_id)
  where direction = 'inbound' and provider_update_id is not null;

create unique index if not exists messaging_events_provider_dedupe_unique
  on public.messaging_events (provider, dedupe_key)
  where dedupe_key is not null;

create index if not exists messaging_events_connection_created_idx
  on public.messaging_events (connection_id, created_at desc);

create index if not exists messaging_events_pending_outbound_idx
  on public.messaging_events (created_at)
  where direction = 'outbound' and status in ('queued', 'failed');

alter table public.opportunity_capture_jobs
  add column if not exists messaging_event_id uuid
    references public.messaging_events(id) on delete set null;

create unique index if not exists opportunity_capture_jobs_messaging_event_unique
  on public.opportunity_capture_jobs (messaging_event_id)
  where messaging_event_id is not null;

alter table public.messaging_events
  drop constraint if exists messaging_events_capture_job_id_fkey;

alter table public.messaging_events
  add constraint messaging_events_capture_job_id_fkey
  foreign key (capture_job_id) references public.opportunity_capture_jobs(id) on delete set null;

create or replace function public.handle_messaging_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_messaging_connections_updated_at on public.messaging_connections;
create trigger set_messaging_connections_updated_at
before update on public.messaging_connections
for each row execute function public.handle_messaging_updated_at();

drop trigger if exists set_messaging_events_updated_at on public.messaging_events;
create trigger set_messaging_events_updated_at
before update on public.messaging_events
for each row execute function public.handle_messaging_updated_at();

alter table public.messaging_connections enable row level security;
alter table public.messaging_connections force row level security;
alter table public.messaging_events enable row level security;
alter table public.messaging_events force row level security;

revoke all on table public.messaging_connections from public, anon, authenticated;
revoke all on table public.messaging_events from public, anon, authenticated;
grant all on table public.messaging_connections to service_role;
grant all on table public.messaging_events to service_role;

commit;
