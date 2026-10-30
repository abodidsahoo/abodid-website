begin;
create function public.check_opportunity_capacity(p_user_id uuid) returns boolean
language sql security definer set search_path = '' as $$
 select (select count(*) from public.saved_opportunities where user_id=p_user_id) < 100;
$$;
revoke all on function public.check_opportunity_capacity(uuid) from public,anon,authenticated;
grant execute on function public.check_opportunity_capacity(uuid) to service_role;
create function public.guard_opportunity_capacity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 1827));
 if tg_op='UPDATE' and new.user_id=old.user_id then return new; end if;
 if exists(select 1 from public.saved_opportunities where user_id=new.user_id and canonical_url=new.canonical_url) then return new; end if;
 if not public.check_opportunity_capacity(new.user_id) then
  raise exception 'Your radar has 100 saved opportunities. Delete an opportunity to make room, or contact the Support team of Abodid & Co.' using errcode='P0100';
 end if;
 return new;
end; $$;
revoke all on function public.guard_opportunity_capacity() from public,anon,authenticated;
create trigger guard_opportunity_capacity before insert or update of user_id on public.saved_opportunities
for each row execute function public.guard_opportunity_capacity();

create table public.opportunity_credit_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 message text not null check(char_length(message) between 10 and 2000),
 status text not null default 'pending' check(status in ('pending','resolved')),
 delivery_status text not null default 'sending' check(delivery_status in ('sending','sent','failed')),
 created_at timestamptz not null default now(),
 last_attempt_at timestamptz not null default now()
);
create unique index opportunity_credit_request_pending on public.opportunity_credit_requests(user_id) where status='pending';
alter table public.opportunity_credit_requests enable row level security;
alter table public.opportunity_credit_requests force row level security;
revoke all on public.opportunity_credit_requests from public,anon,authenticated;
grant all on public.opportunity_credit_requests to service_role;
create table public.opportunity_allowance_audit (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 admin_id uuid references public.profiles(id) on delete set null, previous_limit integer, new_limit integer not null,
 changed_at timestamptz not null default now()
);
create index opportunity_allowance_audit_user_idx on public.opportunity_allowance_audit(user_id);
create index opportunity_allowance_audit_admin_idx on public.opportunity_allowance_audit(admin_id);
create index opportunity_credit_requests_user_idx on public.opportunity_credit_requests(user_id);
alter table public.opportunity_allowance_audit enable row level security;
alter table public.opportunity_allowance_audit force row level security;
revoke all on public.opportunity_allowance_audit from public,anon,authenticated;
grant select,insert on public.opportunity_allowance_audit to service_role;
create function public.set_opportunity_ai_allowance(p_user_id uuid,p_admin_id uuid,p_limit integer)
returns void language plpgsql security definer set search_path = '' as $$
declare previous integer;
begin
 if p_limit not between 0 and 10000 or p_limit is null or not exists(select 1 from public.profiles where id=p_admin_id and role='admin') then raise exception 'Admin access required' using errcode='42501'; end if;
 select ai_monthly_limit into previous from public.opportunity_memberships where user_id=p_user_id for update;
 if not found then raise exception 'Tracker user not found'; end if;
 update public.opportunity_memberships set ai_monthly_limit=p_limit where user_id=p_user_id;
 insert into public.opportunity_allowance_audit(user_id,admin_id,previous_limit,new_limit) values(p_user_id,p_admin_id,previous,p_limit);
 if p_limit > coalesce(previous,5) then
 update public.opportunity_credit_requests set status='resolved' where user_id=p_user_id and status='pending';
 end if;
end; $$;
revoke all on function public.set_opportunity_ai_allowance(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.set_opportunity_ai_allowance(uuid,uuid,integer) to service_role;
create or replace function public.reserve_opportunity_ai_capture(
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
  if not public.check_opportunity_capacity(p_user_id) then
    return query select false, 'capacity'::text, 0, null::uuid;
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

commit;
