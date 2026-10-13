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
  v_now timestamptz := clock_timestamp();
  current_row public.opportunity_ingestion_rate_limits%rowtype;
begin
  if char_length(p_key_hash) <> 64 or p_limit < 1 or p_window_seconds < 1 then
    raise exception 'Invalid ingestion rate-limit input';
  end if;

  insert into public.opportunity_ingestion_rate_limits as limits (
    key_hash, window_started_at, request_count, updated_at
  ) values (
    p_key_hash, v_now, 1, v_now
  )
  on conflict (key_hash) do update set
    window_started_at = case
      when limits.window_started_at <= v_now - make_interval(secs => p_window_seconds)
        then v_now else limits.window_started_at end,
    request_count = case
      when limits.window_started_at <= v_now - make_interval(secs => p_window_seconds)
        then 1 else limits.request_count + 1 end,
    updated_at = v_now
  returning * into current_row;

  delete from public.opportunity_ingestion_rate_limits
  where updated_at < v_now - interval '2 days';

  return query select
    current_row.request_count <= p_limit,
    case
      when current_row.request_count <= p_limit then 0
      else greatest(0, ceil(extract(epoch from (
        current_row.window_started_at
        + make_interval(secs => p_window_seconds)
        - v_now
      )))::integer)
    end;
end;
$$;

revoke all on function public.consume_opportunity_ingestion_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_opportunity_ingestion_rate_limit(text, integer, integer)
  to service_role;
