-- Record the first successful Opportunity Tracker session separately from the
-- site's shared Supabase account. This is the canonical onboarding event for
-- owner notifications and the admin user directory.

begin;

create table if not exists public.opportunity_memberships (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  signup_notification_status text not null default 'pending' check (
    signup_notification_status in ('pending', 'sending', 'sent', 'failed')
  ),
  signup_notification_attempts integer not null default 0 check (
    signup_notification_attempts between 0 and 5
  ),
  signup_notification_last_attempt_at timestamptz,
  signup_notification_sent_at timestamptz,
  signup_notification_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists opportunity_memberships_first_seen_idx
  on public.opportunity_memberships (first_seen_at desc);

alter table public.opportunity_memberships enable row level security;
alter table public.opportunity_memberships force row level security;
revoke all on table public.opportunity_memberships from public, anon, authenticated;
grant select, insert, update, delete on table public.opportunity_memberships to service_role;

create or replace function public.claim_opportunity_signup_notification(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed boolean := false;
begin
  update public.opportunity_memberships
  set
    signup_notification_status = 'sending',
    signup_notification_attempts = signup_notification_attempts + 1,
    signup_notification_last_attempt_at = now(),
    signup_notification_error = null,
    updated_at = now()
  where user_id = p_user_id
    and signup_notification_sent_at is null
    and signup_notification_attempts < 5
    and (
      signup_notification_status = 'pending'
      or (
        signup_notification_status = 'failed'
        and signup_notification_last_attempt_at < now() - interval '5 minutes'
      )
      or (
        signup_notification_status = 'sending'
        and signup_notification_last_attempt_at < now() - interval '10 minutes'
      )
    )
  returning true into claimed;

  return coalesce(claimed, false);
end;
$$;

revoke all on function public.claim_opportunity_signup_notification(uuid)
  from public, anon, authenticated;
grant execute on function public.claim_opportunity_signup_notification(uuid)
  to service_role;

-- Backfill people who demonstrably used the tracker, plus Google accounts
-- created after the multi-user tracker launched. Mark these historical rows as
-- already notified so deploying this migration never sends a burst of old mail.
insert into public.opportunity_memberships (
  user_id,
  first_seen_at,
  signup_notification_status,
  signup_notification_attempts,
  signup_notification_sent_at
)
select
  auth_user.id,
  case
    when min(saved.created_at) is not null then least(auth_user.created_at, min(saved.created_at))
    else auth_user.created_at
  end,
  'sent',
  0,
  now()
from auth.users as auth_user
join public.profiles as profile on profile.id = auth_user.id
left join public.saved_opportunities as saved on saved.user_id = auth_user.id
where coalesce(auth_user.is_anonymous, false) = false
  and lower(coalesce(auth_user.email, '')) <> 'abodidsahoo@gmail.com'
  and (
    saved.id is not null
    or (
      auth_user.created_at >= timestamptz '2026-10-09 00:00:00+00'
      and lower(coalesce(auth_user.raw_app_meta_data->>'provider', '')) = 'google'
    )
  )
group by auth_user.id, auth_user.created_at
on conflict (user_id) do nothing;

commit;
