-- Local release migration: apply before deploying the corresponding API.
begin;

-- Client intake lockdown is activated after the matching API is deployed.

-- Service-managed entitlement override; null uses the server's configured trial.
alter table public.opportunity_memberships
  add column if not exists ai_monthly_limit integer
    check (ai_monthly_limit between 0 and 10000);

create table public.opportunity_ai_usage (
  user_id uuid not null references public.profiles(id) on delete cascade,
  month_start date not null,
  captures integer not null default 0 check (captures >= 0),
  primary key (user_id, month_start)
);
create table public.opportunity_ai_leases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null
);
create index opportunity_ai_leases_expiry_idx on public.opportunity_ai_leases(expires_at);
alter table public.opportunity_ai_usage enable row level security;
alter table public.opportunity_ai_usage force row level security;
alter table public.opportunity_ai_leases enable row level security;
alter table public.opportunity_ai_leases force row level security;
revoke all on public.opportunity_ai_usage, public.opportunity_ai_leases from public, anon, authenticated;
grant all on public.opportunity_ai_usage, public.opportunity_ai_leases to service_role;

create function public.reserve_opportunity_ai_capture(
  p_user_id uuid, p_monthly_limit integer default 5, p_global_concurrency integer default 4
) returns table(allowed boolean, reason text, retry_after_seconds integer, lease_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz := clock_timestamp();
  v_month date := date_trunc('month', v_now at time zone 'UTC')::date;
  v_limit integer;
  v_used integer;
  v_lease uuid;
begin
  if p_user_id is null or p_monthly_limit is null or p_monthly_limit not between 0 and 10000
    or p_global_concurrency is null or p_global_concurrency not between 1 and 20 then
    raise exception 'Invalid AI allowance configuration';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_user_id
    and coalesce(u.is_anonymous, false) = false) then
    return query select false, 'authentication'::text, 0, null::uuid;
    return;
  end if;
  -- One short transaction serializes admissions across serverless instances.
  perform pg_advisory_xact_lock(1869640259, 1);
  delete from public.opportunity_ai_leases where expires_at <= v_now;
  select coalesce(m.ai_monthly_limit, p_monthly_limit) into v_limit
    from public.opportunity_memberships m where m.user_id = p_user_id;
  v_limit := coalesce(v_limit, p_monthly_limit);
  if p_monthly_limit = 0 then v_limit := 0; end if;
  insert into public.opportunity_ai_usage(user_id, month_start) values(p_user_id, v_month)
    on conflict do nothing;
  select u.captures into v_used from public.opportunity_ai_usage u
    where u.user_id = p_user_id and u.month_start = v_month;
  if v_used >= v_limit then
    return query select false, 'monthly'::text,
      greatest(1, ceil(extract(epoch from (
        ((v_month + interval '1 month') at time zone 'UTC') - v_now)))::integer), null::uuid;
    return;
  end if;
  if exists(select 1 from public.opportunity_ai_leases l where l.user_id = p_user_id)
    or (select count(*) from public.opportunity_ai_leases) >= p_global_concurrency then
    return query select false, 'busy'::text, 30, null::uuid;
    return;
  end if;
  update public.opportunity_ai_usage set captures = captures + 1
    where user_id = p_user_id and month_start = v_month;
  -- Longer than two bounded provider attempts; also recovers after a crashed API.
  insert into public.opportunity_ai_leases(user_id, expires_at)
    values(p_user_id, v_now + interval '180 seconds') returning id into v_lease;
  return query select true, 'allowed'::text, 0, v_lease;
end;
$$;
create function public.release_opportunity_ai_capture(p_lease_id uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.opportunity_ai_leases where id = p_lease_id;
$$;
revoke all on function public.reserve_opportunity_ai_capture(uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.release_opportunity_ai_capture(uuid) from public, anon, authenticated;
grant execute on function public.reserve_opportunity_ai_capture(uuid, integer, integer) to service_role;
grant execute on function public.release_opportunity_ai_capture(uuid) to service_role;
commit;
