-- Durable, user-scoped intake for background opportunity capture.
-- Existing synchronous APIs and saved_opportunities remain unchanged.

begin;

create table if not exists public.opportunity_capture_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  idempotency_key uuid not null,
  channel text not null default 'dashboard' check (
    channel in ('dashboard', 'extension', 'telegram', 'whatsapp')
  ),
  input_kind text not null default 'url' check (input_kind in ('url')),
  status text not null default 'pending' check (
    status in ('pending', 'processing', 'succeeded', 'failed')
  ),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  opportunity_id uuid references public.saved_opportunities(id) on delete set null,
  is_duplicate boolean not null default false,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index if not exists opportunity_capture_jobs_ready_idx
  on public.opportunity_capture_jobs (available_at, created_at)
  where status = 'pending';

create index if not exists opportunity_capture_jobs_user_created_idx
  on public.opportunity_capture_jobs (user_id, created_at desc);

alter table public.opportunity_capture_jobs enable row level security;
alter table public.opportunity_capture_jobs force row level security;

revoke all on table public.opportunity_capture_jobs from public, anon;
grant select, insert on table public.opportunity_capture_jobs to authenticated;
grant all on table public.opportunity_capture_jobs to service_role;

drop policy if exists "Owners can read capture jobs" on public.opportunity_capture_jobs;
create policy "Owners can read capture jobs"
on public.opportunity_capture_jobs
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Owners can create capture jobs" on public.opportunity_capture_jobs;
create policy "Owners can create capture jobs"
on public.opportunity_capture_jobs
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create or replace function public.handle_opportunity_capture_jobs_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_opportunity_capture_jobs_updated_at on public.opportunity_capture_jobs;
create trigger set_opportunity_capture_jobs_updated_at
before update on public.opportunity_capture_jobs
for each row execute function public.handle_opportunity_capture_jobs_updated_at();

-- Atomically claims ready jobs. A stale processing lease is recoverable after
-- fifteen minutes, so an interrupted serverless invocation cannot strand work.
create or replace function public.claim_opportunity_capture_jobs(
  p_limit integer default 5,
  p_job_id uuid default null
)
returns setof public.opportunity_capture_jobs
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit < 1 or p_limit > 20 then
    raise exception 'Capture job claim limit must be between 1 and 20';
  end if;

  return query
  with claimable as (
    select jobs.id
    from public.opportunity_capture_jobs as jobs
    where (p_job_id is null or jobs.id = p_job_id)
      and (
        (jobs.status = 'pending' and jobs.available_at <= now())
        or (
          jobs.status = 'processing'
          and jobs.locked_at < now() - interval '15 minutes'
        )
      )
    order by jobs.available_at asc, jobs.created_at asc
    for update skip locked
    limit p_limit
  )
  update public.opportunity_capture_jobs as jobs
  set status = 'processing',
      attempt_count = jobs.attempt_count + 1,
      locked_at = now(),
      started_at = coalesce(jobs.started_at, now()),
      error_code = null,
      error_message = null
  from claimable
  where jobs.id = claimable.id
  returning jobs.*;
end;
$$;

revoke all on function public.claim_opportunity_capture_jobs(integer, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_opportunity_capture_jobs(integer, uuid)
  to service_role;

commit;
