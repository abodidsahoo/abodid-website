begin;

create table if not exists public.analytics_sessions (
  id uuid primary key,
  visitor_id uuid not null,
  source text not null default 'Direct / Unknown',
  referrer_domain text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  country text not null default 'Unknown',
  landing_page text not null,
  exit_page text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  total_engaged_seconds integer not null default 0 check (total_engaged_seconds >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.analytics_page_views (
  id uuid primary key,
  session_id uuid not null references public.analytics_sessions(id) on delete cascade,
  page_path text not null,
  page_title text,
  sequence_number integer not null check (sequence_number > 0),
  viewed_at timestamptz not null default now(),
  engaged_seconds integer not null default 0 check (engaged_seconds >= 0),
  project_id uuid references public.portfolio_projects(id) on delete set null
);

create index if not exists analytics_sessions_started_at_idx
  on public.analytics_sessions (started_at desc);
create index if not exists analytics_sessions_visitor_idx
  on public.analytics_sessions (visitor_id, started_at desc);
create index if not exists analytics_sessions_source_idx
  on public.analytics_sessions (source, started_at desc);
create index if not exists analytics_sessions_country_idx
  on public.analytics_sessions (country, started_at desc);
create index if not exists analytics_page_views_session_sequence_idx
  on public.analytics_page_views (session_id, sequence_number, viewed_at);
create index if not exists analytics_page_views_path_idx
  on public.analytics_page_views (page_path, viewed_at desc);
create index if not exists analytics_page_views_viewed_at_idx
  on public.analytics_page_views (viewed_at desc);
create index if not exists analytics_page_views_project_idx
  on public.analytics_page_views (project_id, viewed_at desc)
  where project_id is not null;

alter table public.analytics_sessions enable row level security;
alter table public.analytics_page_views enable row level security;

create or replace function public.analytics_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.analytics_is_admin() from public;
grant execute on function public.analytics_is_admin() to authenticated, service_role;

drop policy if exists analytics_sessions_admin_read on public.analytics_sessions;
create policy analytics_sessions_admin_read
  on public.analytics_sessions
  for select
  to authenticated
  using (public.analytics_is_admin());

drop policy if exists analytics_page_views_admin_read on public.analytics_page_views;
create policy analytics_page_views_admin_read
  on public.analytics_page_views
  for select
  to authenticated
  using (public.analytics_is_admin());

revoke all on public.analytics_sessions from anon, authenticated;
revoke all on public.analytics_page_views from anon, authenticated;
grant select on public.analytics_sessions to authenticated;
grant select on public.analytics_page_views to authenticated;
grant all on public.analytics_sessions to service_role;
grant all on public.analytics_page_views to service_role;

-- Realtime still honours the SELECT policies above, so only authenticated
-- administrators can receive changes from these tables in the dashboard.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'analytics_sessions'
    ) then
      execute 'alter publication supabase_realtime add table public.analytics_sessions';
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'analytics_page_views'
    ) then
      execute 'alter publication supabase_realtime add table public.analytics_page_views';
    end if;
  end if;
end;
$$;

create or replace function public.analytics_record_page_open(
  p_session_id uuid,
  p_visitor_id uuid,
  p_page_view_id uuid,
  p_source text,
  p_referrer_domain text,
  p_utm_source text,
  p_utm_medium text,
  p_utm_campaign text,
  p_utm_term text,
  p_utm_content text,
  p_country text,
  p_landing_page text,
  p_page_path text,
  p_page_title text,
  p_sequence_number integer,
  p_project_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.analytics_sessions (
    id,
    visitor_id,
    source,
    referrer_domain,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_term,
    utm_content,
    country,
    landing_page,
    exit_page,
    started_at,
    ended_at
  ) values (
    p_session_id,
    p_visitor_id,
    coalesce(nullif(p_source, ''), 'Direct / Unknown'),
    nullif(p_referrer_domain, ''),
    nullif(p_utm_source, ''),
    nullif(p_utm_medium, ''),
    nullif(p_utm_campaign, ''),
    nullif(p_utm_term, ''),
    nullif(p_utm_content, ''),
    coalesce(nullif(p_country, ''), 'Unknown'),
    p_landing_page,
    p_page_path,
    now(),
    now()
  )
  on conflict (id) do update set
    country = case
      when analytics_sessions.country = 'Unknown' and excluded.country <> 'Unknown'
        then excluded.country
      else analytics_sessions.country
    end,
    exit_page = excluded.exit_page,
    ended_at = now();

  insert into public.analytics_page_views (
    id,
    session_id,
    page_path,
    page_title,
    sequence_number,
    viewed_at,
    project_id
  ) values (
    p_page_view_id,
    p_session_id,
    p_page_path,
    nullif(p_page_title, ''),
    greatest(1, p_sequence_number),
    now(),
    p_project_id
  )
  on conflict (id) do nothing;
end;
$$;

revoke all on function public.analytics_record_page_open(uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, integer, uuid) from public, anon, authenticated;
grant execute on function public.analytics_record_page_open(uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, integer, uuid) to service_role;

create or replace function public.analytics_record_engagement(
  p_session_id uuid,
  p_page_view_id uuid,
  p_engaged_seconds integer,
  p_exit_page text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.analytics_page_views
  set engaged_seconds = greatest(engaged_seconds, least(greatest(p_engaged_seconds, 0), 86400))
  where id = p_page_view_id and session_id = p_session_id;

  update public.analytics_sessions
  set
    exit_page = p_exit_page,
    ended_at = now(),
    total_engaged_seconds = coalesce((
      select sum(engaged_seconds)::integer
      from public.analytics_page_views
      where session_id = p_session_id
    ), 0)
  where id = p_session_id;
end;
$$;

revoke all on function public.analytics_record_engagement(uuid, uuid, integer, text) from public, anon, authenticated;
grant execute on function public.analytics_record_engagement(uuid, uuid, integer, text) to service_role;

create or replace function public.analytics_build_report(p_start_at timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with filtered_sessions as (
    select *
    from public.analytics_sessions
    where started_at >= greatest(p_start_at, now() - interval '95 days')
  ),
  filtered_views as (
    select pv.*, fs.visitor_id
    from public.analytics_page_views pv
    join filtered_sessions fs on fs.id = pv.session_id
  ),
  timeline_settings as (
    select
      p_start_at >= now() - interval '2 days' as hourly,
      case
        when p_start_at >= now() - interval '2 days' then interval '1 hour'
        else interval '1 day'
      end as bucket_size
  ),
  timeline_buckets as (
    select series.bucket, settings.bucket_size
    from timeline_settings settings
    cross join lateral generate_series(
      case
        when settings.hourly then date_trunc('hour', p_start_at)
        else date_trunc('day', p_start_at)
      end,
      case
        when settings.hourly then date_trunc('hour', now())
        else date_trunc('day', now())
      end,
      settings.bucket_size
    ) as series(bucket)
  ),
  timeline_rows as (
    select
      buckets.bucket,
      count(distinct sessions.id)::integer as sessions,
      count(distinct sessions.visitor_id)::integer as visitors,
      count(distinct views.id)::integer as page_views
    from timeline_buckets buckets
    left join filtered_sessions sessions
      on sessions.started_at >= buckets.bucket
      and sessions.started_at < buckets.bucket + buckets.bucket_size
    left join filtered_views views
      on views.viewed_at >= buckets.bucket
      and views.viewed_at < buckets.bucket + buckets.bucket_size
    group by buckets.bucket
    order by buckets.bucket
  ),
  source_rows as (
    select
      source,
      count(*)::integer as sessions,
      round((count(*) * 100.0) / nullif((select count(*) from filtered_sessions), 0), 1) as share
    from filtered_sessions
    group by source
    order by sessions desc, source
    limit 12
  ),
  country_rows as (
    select
      country,
      count(*)::integer as sessions,
      round((count(*) * 100.0) / nullif((select count(*) from filtered_sessions), 0), 1) as share
    from filtered_sessions
    group by country
    order by sessions desc, country
    limit 12
  ),
  page_rows as (
    select
      fv.page_path,
      (array_agg(fv.page_title order by fv.viewed_at desc))[1] as page_title,
      count(*)::integer as views,
      count(distinct fv.visitor_id)::integer as visitors,
      round(avg(fv.engaged_seconds))::integer as average_engaged_seconds,
      sum(fv.engaged_seconds)::integer as total_engaged_seconds
    from filtered_views fv
    group by fv.page_path
    order by total_engaged_seconds desc, views desc, fv.page_path
    limit 20
  ),
  recent_sessions as (
    select *
    from filtered_sessions
    order by coalesce(ended_at, started_at) desc
    limit 20
  ),
  recent_journeys as (
    select
      rs.id,
      rs.source,
      rs.country,
      rs.landing_page,
      rs.exit_page,
      rs.started_at,
      rs.ended_at,
      rs.total_engaged_seconds,
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'path', pv.page_path,
            'title', pv.page_title,
            'sequenceNumber', pv.sequence_number,
            'viewedAt', pv.viewed_at,
            'engagedSeconds', pv.engaged_seconds
          )
          order by pv.sequence_number, pv.viewed_at
        )
        from public.analytics_page_views pv
        where pv.session_id = rs.id
      ), '[]'::jsonb) as pages
    from recent_sessions rs
  ),
  session_sequences as (
    select
      fs.id,
      fs.total_engaged_seconds,
      string_agg(fv.page_path, ' > ' order by fv.sequence_number, fv.viewed_at) as sequence
    from filtered_sessions fs
    join filtered_views fv on fv.session_id = fs.id
    group by fs.id, fs.total_engaged_seconds
  ),
  sequence_rows as (
    select
      sequence,
      count(*)::integer as count,
      round(avg(total_engaged_seconds))::integer as average_engaged_seconds
    from session_sequences
    where sequence is not null
    group by sequence
    order by count desc, average_engaged_seconds desc, sequence
    limit 10
  )
  select jsonb_build_object(
    'summary', jsonb_build_object(
      'visitors', (select count(distinct visitor_id)::integer from filtered_sessions),
      'sessions', (select count(*)::integer from filtered_sessions),
      'pageViews', (select count(*)::integer from filtered_views),
      'averageEngagedSeconds', coalesce((select round(avg(total_engaged_seconds))::integer from filtered_sessions), 0)
    ),
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object('source', source, 'sessions', sessions, 'share', share) order by sessions desc, source)
      from source_rows
    ), '[]'::jsonb),
    'countries', coalesce((
      select jsonb_agg(jsonb_build_object('country', country, 'sessions', sessions, 'share', share) order by sessions desc, country)
      from country_rows
    ), '[]'::jsonb),
    'timeline', coalesce((
      select jsonb_agg(jsonb_build_object(
        'bucket', bucket,
        'sessions', sessions,
        'visitors', visitors,
        'pageViews', page_views
      ) order by bucket)
      from timeline_rows
    ), '[]'::jsonb),
    'pages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'pagePath', page_path,
        'pageTitle', page_title,
        'views', views,
        'visitors', visitors,
        'averageEngagedSeconds', average_engaged_seconds,
        'totalEngagedSeconds', total_engaged_seconds
      ) order by total_engaged_seconds desc, views desc, page_path)
      from page_rows
    ), '[]'::jsonb),
    'journeys', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'source', source,
        'country', country,
        'landingPage', landing_page,
        'exitPage', exit_page,
        'startedAt', started_at,
        'endedAt', ended_at,
        'totalEngagedSeconds', total_engaged_seconds,
        'pages', pages
      ) order by coalesce(ended_at, started_at) desc)
      from recent_journeys
    ), '[]'::jsonb),
    'commonJourneys', coalesce((
      select jsonb_agg(jsonb_build_object(
        'sequence', sequence,
        'count', count,
        'averageEngagedSeconds', average_engaged_seconds
      ) order by count desc, average_engaged_seconds desc, sequence)
      from sequence_rows
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.analytics_build_report(timestamptz) from public, anon, authenticated;
grant execute on function public.analytics_build_report(timestamptz) to service_role;

comment on table public.analytics_sessions is
  'Anonymous, privacy-minimised website sessions. Raw IP addresses are never stored.';
comment on table public.analytics_page_views is
  'Ordered page visits with active, visible engagement time.';

commit;
