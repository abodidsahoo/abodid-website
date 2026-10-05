create table if not exists public.contact_rate_limits (
  key_hash text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1 check (request_count > 0),
  updated_at timestamptz not null default now(),
  constraint contact_rate_limits_key_hash_length check (char_length(key_hash) = 64)
);

alter table public.contact_rate_limits enable row level security;
revoke all on table public.contact_rate_limits from public, anon, authenticated;
grant all on table public.contact_rate_limits to service_role;

create or replace function public.consume_contact_rate_limit(
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
  current_row public.contact_rate_limits%rowtype;
begin
  if char_length(p_key_hash) <> 64 or p_limit < 1 or p_window_seconds < 1 then
    raise exception 'Invalid contact rate-limit input';
  end if;

  insert into public.contact_rate_limits as limits (
    key_hash,
    window_started_at,
    request_count,
    updated_at
  ) values (
    p_key_hash,
    current_time,
    1,
    current_time
  )
  on conflict (key_hash) do update set
    window_started_at = case
      when limits.window_started_at <= current_time - make_interval(secs => p_window_seconds)
        then current_time
      else limits.window_started_at
    end,
    request_count = case
      when limits.window_started_at <= current_time - make_interval(secs => p_window_seconds)
        then 1
      else limits.request_count + 1
    end,
    updated_at = current_time
  returning * into current_row;

  delete from public.contact_rate_limits
  where updated_at < current_time - interval '2 days';

  return query select
    current_row.request_count <= p_limit,
    greatest(
      0,
      ceil(extract(epoch from (
        current_row.window_started_at
        + make_interval(secs => p_window_seconds)
        - current_time
      )))::integer
    );
end;
$$;

revoke all on function public.consume_contact_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_contact_rate_limit(text, integer, integer)
  to service_role;

comment on table public.contact_rate_limits is
  'Privacy-preserving, HMAC-keyed counters for the public contact endpoint.';
