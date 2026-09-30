-- Prevent browser clients from assigning themselves curation or admin access.
--
-- RLS determines which profile row a user may update, but it does not limit
-- which columns in that row may be changed. Keep the existing trigger as a
-- second line of defence and remove UPDATE privileges for server-managed
-- columns at the PostgreSQL grant layer.

begin;

alter table public.profiles enable row level security;

drop policy if exists "Users can update own profile." on public.profiles;
create policy "Users can update own profile."
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create or replace function public.curation_protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT'
     and (select auth.role()) <> 'service_role'
     and coalesce(new.role, 'user') <> 'user' then
    raise exception 'New profiles cannot assign privileged roles'
      using errcode = '42501';
  elsif tg_op = 'UPDATE'
     and new.role is distinct from old.role
     and (select auth.role()) <> 'service_role' then
    raise exception 'Only the server-side admin service may change roles'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.curation_protect_profile_privileges() from public;
revoke all on function public.curation_protect_profile_privileges() from anon;
revoke all on function public.curation_protect_profile_privileges() from authenticated;

drop trigger if exists curation_protect_profile_privileges on public.profiles;
create trigger curation_protect_profile_privileges
before insert or update on public.profiles
for each row execute function public.curation_protect_profile_privileges();

-- Supabase commonly grants UPDATE at table level. A table-level grant also
-- implies UPDATE on `role`, so remove it before restoring only user-editable
-- columns. The service_role is deliberately untouched and continues to power
-- the authenticated server-side admin role-management endpoint.
revoke update on table public.profiles from anon;
revoke update on table public.profiles from authenticated;

do $$
declare
  editable_columns text;
begin
  select string_agg(format('%I', column_name), ', ' order by ordinal_position)
  into editable_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'profiles'
    and column_name = any (array[
      'id',
      'username',
      'full_name',
      'avatar_url',
      'website',
      'bio',
      'social_links',
      'email',
      'updated_at'
    ]);

  if editable_columns is not null then
    execute format(
      'grant update (%s) on table public.profiles to authenticated',
      editable_columns
    );
  end if;
end;
$$;

-- Fail the migration rather than silently leaving either privileged field
-- browser-editable. `is_approved` is optional in older schema revisions.
do $$
begin
  if has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE') then
    raise exception 'authenticated must not have UPDATE privilege on profiles.role';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'is_approved'
  ) then
    if has_column_privilege('authenticated', 'public.profiles', 'is_approved', 'UPDATE') then
      raise exception 'authenticated must not have UPDATE privilege on profiles.is_approved';
    end if;
  end if;
end;
$$;

commit;
