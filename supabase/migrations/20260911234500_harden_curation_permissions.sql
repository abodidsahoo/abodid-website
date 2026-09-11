-- Security boundary for curation.abodid.com.
-- The domain move does not duplicate data: the existing hub_* tables remain
-- authoritative. This migration tightens who may assign roles, publish, and
-- write moderation metadata.

begin;

create or replace function public.curation_is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role in ('curator', 'admin')
  );
$$;

revoke all on function public.curation_is_staff() from public;
grant execute on function public.curation_is_staff() to authenticated;

create or replace function public.curation_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function public.curation_is_admin() from public;
grant execute on function public.curation_is_admin() to authenticated;

-- Users may edit their profile, but may never promote themselves by changing
-- the role field. Trusted service-role admin endpoints remain able to do so.
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

drop trigger if exists curation_protect_profile_privileges on public.profiles;
create trigger curation_protect_profile_privileges
before insert or update on public.profiles
for each row execute function public.curation_protect_profile_privileges();

-- A signed-in user must own a submission. Only staff may insert a resource in
-- a state other than pending.
drop policy if exists "Authenticated users can submit resources." on public.hub_resources;
drop policy if exists "Authenticated users can submit resources" on public.hub_resources;
drop policy if exists "Curation users can submit owned resources" on public.hub_resources;

create policy "Curation users can submit owned resources"
on public.hub_resources
for insert
to authenticated
with check (
  submitted_by = (select auth.uid())
  and (
    status = 'pending'
    or public.curation_is_staff()
  )
);

-- Even when a client crafts its own payload, regular contributors cannot set
-- review state or staff-only notes.
create or replace function public.curation_guard_moderation_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.curation_is_staff() then
    if tg_op = 'INSERT' then
      new.status := 'pending';
      new.reviewed_at := null;
      new.reviewed_by := null;
      new.admin_notes := null;
      new.rejection_reason := null;
    else
      new.status := old.status;
      new.reviewed_at := old.reviewed_at;
      new.reviewed_by := old.reviewed_by;
      new.admin_notes := old.admin_notes;
      new.rejection_reason := old.rejection_reason;
    end if;
  elsif (select auth.role()) <> 'service_role'
        and not public.curation_is_admin()
        and new.status = 'deleted' then
    raise exception 'Only administrators may move resources to trash'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists curation_guard_moderation_fields on public.hub_resources;
create trigger curation_guard_moderation_fields
before insert or update on public.hub_resources
for each row execute function public.curation_guard_moderation_fields();

commit;
