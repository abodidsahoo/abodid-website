begin;

alter table public.analytics_sessions
  add column if not exists city text;

create table if not exists public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.analytics_sessions(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 254),
  message text not null check (char_length(message) between 1 and 5000),
  enquiry_path text,
  enquiry_source_name text,
  enquiry_cta text,
  enquiry_title text not null,
  submitted_at timestamptz not null default now(),
  notification_sent_at timestamptz,
  notification_error text,
  created_at timestamptz not null default now()
);

create index if not exists contact_submissions_session_submitted_idx
  on public.contact_submissions (session_id, submitted_at desc);
create index if not exists contact_submissions_submitted_idx
  on public.contact_submissions (submitted_at desc);

alter table public.contact_submissions enable row level security;
revoke all on public.contact_submissions from anon, authenticated;
grant all on public.contact_submissions to service_role;

drop policy if exists contact_submissions_admin_read on public.contact_submissions;
create policy contact_submissions_admin_read
  on public.contact_submissions
  for select
  to authenticated
  using (public.analytics_is_admin());
grant select on public.contact_submissions to authenticated;

-- Keep the previous overload available during deployment so the currently live
-- collector continues to work until the application release reaches every edge.
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
  p_city text,
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
    id, visitor_id, source, referrer_domain,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content,
    country, city, landing_page, exit_page, started_at, ended_at
  ) values (
    p_session_id,
    p_visitor_id,
    coalesce(nullif(p_source, ''), 'Direct Visit'),
    nullif(p_referrer_domain, ''),
    nullif(p_utm_source, ''),
    nullif(p_utm_medium, ''),
    nullif(p_utm_campaign, ''),
    nullif(p_utm_term, ''),
    nullif(p_utm_content, ''),
    coalesce(nullif(p_country, ''), 'Unknown'),
    nullif(p_city, ''),
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
    city = coalesce(analytics_sessions.city, excluded.city),
    exit_page = excluded.exit_page,
    ended_at = now();

  insert into public.analytics_page_views (
    id, session_id, page_path, page_title, sequence_number, viewed_at, project_id
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

revoke all on function public.analytics_record_page_open(
  uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text, integer, uuid
) from public, anon, authenticated;
grant execute on function public.analytics_record_page_open(
  uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text, integer, uuid
) to service_role;

comment on table public.contact_submissions is
  'Contact enquiries linked to one exact analytics session for notification generation.';
comment on column public.analytics_sessions.city is
  'Optional coarse city supplied by trusted hosting geolocation headers; raw IP addresses are not stored.';

commit;
