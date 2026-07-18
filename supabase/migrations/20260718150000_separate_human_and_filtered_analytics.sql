begin;

create or replace function public.analytics_build_report(
  p_start_at timestamptz,
  p_traffic_class text
)
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
      and (
        (p_traffic_class = 'human' and total_engaged_seconds >= 2)
        or (p_traffic_class = 'filtered' and total_engaged_seconds < 2)
      )
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

revoke all on function public.analytics_build_report(timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.analytics_build_report(timestamptz, text)
  to service_role;

create or replace function public.analytics_build_navigation_report(
  p_start_at timestamptz,
  p_traffic_class text
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
      and (
        (p_traffic_class = 'human' and sessions.total_engaged_seconds >= 2)
        or (p_traffic_class = 'filtered' and sessions.total_engaged_seconds < 2)
      )
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

revoke all on function public.analytics_build_navigation_report(timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.analytics_build_navigation_report(timestamptz, text)
  to service_role;

comment on function public.analytics_build_report(timestamptz, text) is
  'Builds analytics for either human sessions (2+ engaged seconds) or separately retained filtered traffic.';

commit;
