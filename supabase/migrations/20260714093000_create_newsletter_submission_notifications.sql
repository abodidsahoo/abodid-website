begin;

create table if not exists public.newsletter_submissions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.analytics_sessions(id) on delete set null,
  email text not null check (char_length(email) between 3 and 254),
  name text,
  source text not null,
  subscriber_status text not null check (subscriber_status in ('new', 'existing')),
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists newsletter_submissions_session_submitted_idx
  on public.newsletter_submissions (session_id, submitted_at desc)
  where session_id is not null;
create index if not exists newsletter_submissions_submitted_idx
  on public.newsletter_submissions (submitted_at desc);

alter table public.newsletter_submissions enable row level security;
revoke all on public.newsletter_submissions from anon, authenticated;
grant all on public.newsletter_submissions to service_role;

drop policy if exists newsletter_submissions_admin_read on public.newsletter_submissions;
create policy newsletter_submissions_admin_read
  on public.newsletter_submissions
  for select
  to authenticated
  using (public.analytics_is_admin());
grant select on public.newsletter_submissions to authenticated;

comment on table public.newsletter_submissions is
  'Newsletter form actions linked to at most one exact analytics session for concise owner notifications.';

commit;
