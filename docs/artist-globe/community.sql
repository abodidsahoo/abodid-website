-- Nominations remain private drafts in the existing artist table.
alter table public.art_globe_artists add column artist_number bigint generated always as identity unique;
grant usage, select on sequence public.art_globe_artists_artist_number_seq to service_role;
alter table public.art_globe_artists alter column latitude drop not null;
alter table public.art_globe_artists alter column longitude drop not null;
alter table public.art_globe_artists add column if not exists nomination_status text not null default 'curated' check (nomination_status in ('curated','pending','approved','declined'));
alter table public.art_globe_artists add column if not exists nomination_link text;
alter table public.art_globe_artists add constraint art_globe_published_location check (not published or (latitude is not null and longitude is not null and nomination_status in ('curated','approved')));

-- The only additional table: opt-in monthly wandering scores. No IP addresses.
create table public.art_globe_wanderers (
 month date not null,
 visitor_hash text not null check(length(visitor_hash)=64),
 display_name text not null check(length(display_name) between 2 and 40),
 active_seconds integer not null default 0 check(active_seconds >= 0),
 last_heartbeat timestamptz not null default now(),
 public_opt_in boolean not null default true,
 awarded boolean not null default false,
 primary key(month,visitor_hash)
);
alter table public.art_globe_wanderers enable row level security;
revoke all on public.art_globe_wanderers from anon,authenticated;
grant all on public.art_globe_wanderers to service_role;
create index art_globe_wanderers_ranking on public.art_globe_wanderers(month,active_seconds desc) where public_opt_in;

-- One row lock prevents concurrent tabs from inflating elapsed time.
create or replace function public.record_art_globe_wandering(p_visitor_hash text,p_name text default null,p_active boolean default false)
returns integer language plpgsql security invoker set search_path='' as $$
declare
 v_month date := date_trunc('month',timezone('UTC',now()))::date;
 v_now timestamptz := clock_timestamp();
 previous public.art_globe_wanderers%rowtype;
 elapsed integer;
 total integer;
begin
 if length(p_visitor_hash) <> 64 then raise exception 'Invalid visitor'; end if;
 if p_name is not null then
  insert into public.art_globe_wanderers(month,visitor_hash,display_name,last_heartbeat)
  values(v_month,p_visitor_hash,p_name,v_now)
  on conflict(month,visitor_hash) do update set display_name=excluded.display_name,public_opt_in=true;
 end if;
 select * into previous from public.art_globe_wanderers where month=v_month and visitor_hash=p_visitor_hash for update;
 if not found then return 0; end if;
 elapsed := floor(extract(epoch from(v_now-previous.last_heartbeat)))::integer;
 update public.art_globe_wanderers set
  active_seconds=active_seconds+case when p_active and public_opt_in and elapsed between 1 and 45 then least(elapsed,20) else 0 end,
  last_heartbeat=v_now
 where month=v_month and visitor_hash=p_visitor_hash
 returning active_seconds into total;
 return total;
end;
$$;
revoke all on function public.record_art_globe_wandering(text,text,boolean) from public,anon,authenticated;
grant execute on function public.record_art_globe_wandering(text,text,boolean) to service_role;

-- A namespaced limiter reuses the existing rate-limit storage without touching
-- the contact form’s function or deleting any records.
create or replace function public.consume_art_globe_rate_limit(p_key_hash text,p_limit integer,p_window_seconds integer)
returns boolean language plpgsql security invoker set search_path='' as $$
declare v_now timestamptz := clock_timestamp(); v_count integer;
begin
 if length(p_key_hash)<>64 or p_limit<1 or p_window_seconds<1 then raise exception 'Invalid limit'; end if;
 insert into public.contact_rate_limits as limits(key_hash,window_started_at,request_count,updated_at)
 values(p_key_hash,v_now,1,v_now)
 on conflict(key_hash) do update set
  window_started_at=case when limits.window_started_at<=v_now-make_interval(secs=>p_window_seconds) then v_now else limits.window_started_at end,
  request_count=case when limits.window_started_at<=v_now-make_interval(secs=>p_window_seconds) then 1 else limits.request_count+1 end,
  updated_at=v_now
 returning request_count into v_count;
 return v_count<=p_limit;
end;
$$;
revoke all on function public.consume_art_globe_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.consume_art_globe_rate_limit(text,integer,integer) to service_role;

-- A single named award recipient per month.
create unique index if not exists art_globe_wanderers_one_award_per_month on public.art_globe_wanderers(month) where awarded;
