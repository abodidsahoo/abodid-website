-- Preserve the separately extracted application fee when a public
-- opportunity is copied into another user's private radar.

begin;

create or replace function public.copy_public_opportunity(p_source_opportunity_id uuid)
returns table (opportunity_id uuid, import_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  destination_user_id uuid := (select auth.uid());
  source_row public.saved_opportunities%rowtype;
  existing_id uuid;
  inserted_id uuid;
begin
  if destination_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select saved.* into source_row
  from public.saved_opportunities as saved
  join public.profiles as profile on profile.id = saved.user_id
  where saved.id = p_source_opportunity_id
    and profile.is_public = true
    and saved.status <> 'dismissed'
  limit 1;

  if not found then
    return query select null::uuid, 'unavailable'::text;
    return;
  end if;

  if source_row.user_id = destination_user_id then
    return query select source_row.id, 'owned'::text;
    return;
  end if;

  select saved.id into existing_id
  from public.saved_opportunities as saved
  where saved.user_id = destination_user_id
    and (
      saved.canonical_url = source_row.canonical_url
      or saved.copied_from_opportunity_id = source_row.id
    )
  order by saved.created_at asc
  limit 1;

  if existing_id is not null then
    return query select existing_id, 'already_saved'::text;
    return;
  end if;

  insert into public.saved_opportunities (
    user_id,
    title,
    source_url,
    canonical_url,
    deadline_at,
    status,
    priority,
    outcome,
    content,
    notes,
    copied_from_opportunity_id,
    copied_at,
    source_snapshot_updated_at
  ) values (
    destination_user_id,
    source_row.title,
    source_row.source_url,
    source_row.canonical_url,
    source_row.deadline_at,
    'inbox',
    1,
    null,
    jsonb_strip_nulls(jsonb_build_object(
      'organisation', source_row.content->'organisation',
      'category', source_row.content->'category',
      'deadline_raw', source_row.content->'deadline_raw',
      'deadline_timezone', source_row.content->'deadline_timezone',
      'deadline_confidence', source_row.content->'deadline_confidence',
      'event_date', source_row.content->'event_date',
      'location', source_row.content->'location',
      'requirements', source_row.content->'requirements',
      'application_url', source_row.content->'application_url',
      'fee_or_funding', source_row.content->'fee_or_funding',
      'application_fee', source_row.content->'application_fee',
      'summary', source_row.content->'summary',
      'extracted_at', source_row.content->'extracted_at'
    )),
    null,
    source_row.id,
    now(),
    source_row.updated_at
  )
  on conflict (user_id, canonical_url) do nothing
  returning id into inserted_id;

  if inserted_id is not null then
    return query select inserted_id, 'added'::text;
    return;
  end if;

  select saved.id into existing_id
  from public.saved_opportunities as saved
  where saved.user_id = destination_user_id
    and saved.canonical_url = source_row.canonical_url
  limit 1;

  return query select existing_id, 'already_saved'::text;
end;
$$;

revoke all on function public.copy_public_opportunity(uuid) from public, anon;
grant execute on function public.copy_public_opportunity(uuid) to authenticated;

commit;
