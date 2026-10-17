-- Private, append-only audit trail for the Family Land Register.
create table if not exists public.family_land_revisions (
  id uuid primary key default gen_random_uuid(),
  change_type text not null check (change_type in ('correct', 'add', 'archive')),
  business_key text not null,
  patch jsonb not null default '{}'::jsonb,
  before_snapshot jsonb,
  reason text not null check (char_length(reason) >= 8),
  source_reference text not null check (char_length(source_reference) >= 4),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists family_land_revisions_business_key_created_at_idx
  on public.family_land_revisions (business_key, created_at);

alter table public.family_land_revisions enable row level security;
alter table public.family_land_revisions force row level security;

revoke all on table public.family_land_revisions from anon;
revoke update, delete, truncate, references, trigger on table public.family_land_revisions from authenticated;
grant select, insert on table public.family_land_revisions to authenticated;

drop policy if exists "land_admins_read_revisions" on public.family_land_revisions;
create policy "land_admins_read_revisions"
  on public.family_land_revisions
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

drop policy if exists "land_admins_append_revisions" on public.family_land_revisions;
create policy "land_admins_append_revisions"
  on public.family_land_revisions
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

comment on table public.family_land_revisions is
  'Append-only, admin-reviewed changes layered over immutable encrypted family land source records.';

