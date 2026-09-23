begin;

-- Editorial presentation lives on the existing digest readings, not in a second CMS.
alter table public.reading_digest_readings
  add column if not exists published boolean not null default true,
  add column if not exists thumbnail_url text,
  add column if not exists editorial_note text,
  add column if not exists editorial_order smallint,
  add column if not exists is_editors_pick boolean not null default false,
  add column if not exists editors_pick_until date;

create unique index if not exists reading_digest_one_editors_pick_idx
  on public.reading_digest_readings (is_editors_pick)
  where is_editors_pick;

create index if not exists reading_digest_public_eligible_idx
  on public.reading_digest_readings (published, verification_status, status)
  where published = true and verification_status = 'verified';

-- Views expose a deliberate field allowlist; recipient emails, run metadata, and
-- rejected/unpublished readings never become public through this surface.
create or replace view public.reading_digest_public_items
with (security_barrier = true) as
select
  r.id,
  d.delivery_date,
  coalesce(r.editorial_order, i.position)::integer as display_order,
  i.is_read_first,
  r.title,
  r.url,
  r.source_name,
  r.publication_date,
  r.topic_names,
  r.why_it_matters,
  r.editorial_note,
  r.thumbnail_url,
  r.is_editors_pick,
  r.editors_pick_until
from public.reading_digest_delivery_items i
join (
  -- A retry must not make a public day larger than the digest's five items.
  select distinct on (delivery_date) id, delivery_date
  from public.reading_digest_deliveries
  where status = 'sent'
  order by delivery_date, sent_at desc nulls last, created_at desc
) d on d.id = i.delivery_id
join public.reading_digest_readings r on r.id = i.reading_id
where r.status in ('selected', 'sent')
  and r.verification_status = 'verified'
  and r.published = true;

revoke all on public.reading_digest_public_items from public;
grant select on public.reading_digest_public_items to anon, authenticated, service_role;

create or replace function public.reading_digest_public_days(
  p_before_date date,
  p_topic text default null,
  p_limit integer default 7
)
returns table (delivery_date date)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct i.delivery_date
  from public.reading_digest_public_items i
  where (p_before_date is null or i.delivery_date < p_before_date)
    and (p_topic is null or p_topic = any(i.topic_names))
  order by i.delivery_date desc
  limit least(greatest(coalesce(p_limit, 7), 1), 20);
$$;

revoke all on function public.reading_digest_public_days(date, text, integer) from public;
grant execute on function public.reading_digest_public_days(date, text, integer)
  to anon, authenticated, service_role;

create or replace function public.reading_digest_public_topics()
returns table (name text, item_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select topic.name, count(*) as item_count
  from public.reading_digest_public_items i
  cross join lateral unnest(i.topic_names) as topic(name)
  where trim(topic.name) <> ''
  group by topic.name
  order by item_count desc, topic.name;
$$;

revoke all on function public.reading_digest_public_topics() from public;
grant execute on function public.reading_digest_public_topics()
  to anon, authenticated, service_role;

-- Called only by the server after checking the caller's current admin role.
create or replace function public.reading_digest_set_editors_pick(p_reading_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.reading_digest_public_items where id = p_reading_id
  ) then
    raise exception 'Choose a published, verified reading from a sent digest';
  end if;

  update public.reading_digest_readings
  set is_editors_pick = false, editors_pick_until = null
  where is_editors_pick = true;

  update public.reading_digest_readings
  set is_editors_pick = true,
      editors_pick_until = (now() at time zone 'Asia/Kolkata')::date + 6
  where id = p_reading_id;
end;
$$;

revoke all on function public.reading_digest_set_editors_pick(uuid)
  from public, anon, authenticated;
grant execute on function public.reading_digest_set_editors_pick(uuid) to service_role;

create or replace function public.reading_digest_reorder_day(
  p_delivery_date date,
  p_reading_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  expected_ids uuid[];
begin
  select array_agg(i.reading_id order by i.position)
  into expected_ids
  from public.reading_digest_delivery_items i
  where i.delivery_id = (
    select d.id
    from public.reading_digest_deliveries d
    where d.delivery_date = p_delivery_date and d.status = 'sent'
    order by d.sent_at desc nulls last, d.created_at desc
    limit 1
  );

  if expected_ids is null
    or cardinality(expected_ids) <> cardinality(p_reading_ids)
    or (select count(distinct ids.id) from unnest(p_reading_ids) as ids(id)) <> cardinality(p_reading_ids)
    or not (expected_ids @> p_reading_ids)
  then
    raise exception 'Reading order must contain exactly the delivered readings for this date';
  end if;

  update public.reading_digest_readings r
  set editorial_order = ordered.position
  from unnest(p_reading_ids) with ordinality as ordered(id, position)
  where r.id = ordered.id;
end;
$$;

revoke all on function public.reading_digest_reorder_day(date, uuid[])
  from public, anon, authenticated;
grant execute on function public.reading_digest_reorder_day(date, uuid[]) to service_role;

commit;
