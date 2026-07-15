begin;

create table if not exists public.analytics_events (
  id uuid primary key,
  session_id uuid not null references public.analytics_sessions(id) on delete cascade,
  page_view_id uuid references public.analytics_page_views(id) on delete set null,
  event_name text not null check (
    event_name in ('menu_open', 'menu_dismiss', 'menu_link_click')
  ),
  page_path text not null,
  menu_context text not null check (menu_context in ('mobile', 'desktop')),
  target_label text,
  target_url text,
  target_type text check (
    target_type is null or target_type in ('primary', 'secondary', 'cta', 'social')
  ),
  menu_position smallint check (
    menu_position is null or menu_position between 1 and 100
  ),
  occurred_at timestamptz not null default now()
);

create index if not exists analytics_events_session_occurred_idx
  on public.analytics_events (session_id, occurred_at desc);
create index if not exists analytics_events_name_context_occurred_idx
  on public.analytics_events (event_name, menu_context, occurred_at desc);
create index if not exists analytics_events_target_occurred_idx
  on public.analytics_events (target_label, occurred_at desc)
  where event_name = 'menu_link_click';

alter table public.analytics_events enable row level security;

drop policy if exists analytics_events_admin_read on public.analytics_events;
create policy analytics_events_admin_read
  on public.analytics_events
  for select
  to authenticated
  using (public.analytics_is_admin());

revoke all on public.analytics_events from anon, authenticated;
grant select on public.analytics_events to authenticated;
grant all on public.analytics_events to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'analytics_events'
    ) then
    execute 'alter publication supabase_realtime add table public.analytics_events';
  end if;
end;
$$;

create or replace function public.analytics_record_navigation_event(
  p_event_id uuid,
  p_session_id uuid,
  p_page_view_id uuid,
  p_event_name text,
  p_page_path text,
  p_menu_context text,
  p_target_label text default null,
  p_target_url text default null,
  p_target_type text default null,
  p_position integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.analytics_events (
    id,
    session_id,
    page_view_id,
    event_name,
    page_path,
    menu_context,
    target_label,
    target_url,
    target_type,
    menu_position,
    occurred_at
  ) values (
    p_event_id,
    p_session_id,
    p_page_view_id,
    p_event_name,
    p_page_path,
    p_menu_context,
    nullif(p_target_label, ''),
    nullif(p_target_url, ''),
    nullif(p_target_type, ''),
    case when p_position between 1 and 100 then p_position else null end,
    now()
  )
  on conflict (id) do nothing;
end;
$$;

revoke all on function public.analytics_record_navigation_event(
  uuid, uuid, uuid, text, text, text, text, text, text, integer
) from public, anon, authenticated;
grant execute on function public.analytics_record_navigation_event(
  uuid, uuid, uuid, text, text, text, text, text, text, integer
) to service_role;

create or replace function public.analytics_build_navigation_report(
  p_start_at timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with filtered_events as (
    select
      events.*,
      sessions.country,
      sessions.visitor_id
    from public.analytics_events events
    join public.analytics_sessions sessions on sessions.id = events.session_id
    where events.occurred_at >= greatest(p_start_at, now() - interval '95 days')
      and events.menu_context = 'mobile'
  ),
  totals as (
    select
      count(*) filter (where event_name = 'menu_open')::integer as opens,
      count(*) filter (where event_name = 'menu_link_click')::integer as selections,
      count(*) filter (where event_name = 'menu_dismiss')::integer as dismissals,
      count(*) filter (
        where event_name = 'menu_link_click' and target_type = 'social'
      )::integer as social_clicks,
      count(*) filter (
        where event_name = 'menu_link_click' and target_type = 'cta'
      )::integer as cta_clicks
    from filtered_events
  ),
  link_rows as (
    select
      target_label,
      target_url,
      target_type,
      min(menu_position)::integer as position,
      count(*)::integer as clicks,
      count(distinct session_id)::integer as sessions,
      count(distinct visitor_id)::integer as visitors,
      round(
        (count(*) * 100.0) /
          nullif((select selections from totals), 0),
        1
      ) as share
    from filtered_events
    where event_name = 'menu_link_click'
      and target_label is not null
    group by target_label, target_url, target_type
    order by clicks desc, position, target_label
    limit 20
  ),
  country_rows as (
    select
      country,
      count(*) filter (where event_name = 'menu_open')::integer as opens,
      count(*) filter (where event_name = 'menu_link_click')::integer as selections,
      count(*) filter (where event_name = 'menu_dismiss')::integer as dismissals,
      round(
        (
          count(*) filter (where event_name = 'menu_link_click') * 100.0
        ) / nullif(
          count(*) filter (where event_name = 'menu_open'),
          0
        ),
        1
      ) as selection_rate
    from filtered_events
    group by country
    having count(*) filter (where event_name = 'menu_open') > 0
    order by opens desc, selections desc, country
    limit 12
  )
  select jsonb_build_object(
    'summary', jsonb_build_object(
      'opens', coalesce((select opens from totals), 0),
      'selections', coalesce((select selections from totals), 0),
      'dismissals', coalesce((select dismissals from totals), 0),
      'socialClicks', coalesce((select social_clicks from totals), 0),
      'ctaClicks', coalesce((select cta_clicks from totals), 0),
      'selectionRate', coalesce((
        select round((selections * 100.0) / nullif(opens, 0), 1)
        from totals
      ), 0)
    ),
    'links', coalesce((
      select jsonb_agg(jsonb_build_object(
        'label', target_label,
        'url', target_url,
        'type', target_type,
        'position', position,
        'clicks', clicks,
        'sessions', sessions,
        'visitors', visitors,
        'share', share
      ) order by clicks desc, position, target_label)
      from link_rows
    ), '[]'::jsonb),
    'countries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'country', country,
        'opens', opens,
        'selections', selections,
        'dismissals', dismissals,
        'selectionRate', selection_rate
      ) order by opens desc, selections desc, country)
      from country_rows
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.analytics_build_navigation_report(timestamptz)
  from public, anon, authenticated;
grant execute on function public.analytics_build_navigation_report(timestamptz)
  to service_role;

comment on table public.analytics_events is
  'Privacy-minimised interaction events linked to anonymous analytics sessions.';

commit;
