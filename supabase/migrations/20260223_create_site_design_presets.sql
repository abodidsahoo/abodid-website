-- Named style states for Admin > Design presets

create table if not exists public.site_design_presets (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    settings jsonb not null default '{}'::jsonb,
    created_by uuid references auth.users(id),
    updated_by uuid references auth.users(id),
    created_at timestamp with time zone not null default timezone('utc'::text, now()),
    updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

create index if not exists idx_site_design_presets_updated_at
    on public.site_design_presets (updated_at desc);

create or replace function public.set_site_design_presets_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$;

drop trigger if exists trg_site_design_presets_updated_at on public.site_design_presets;
create trigger trg_site_design_presets_updated_at
before update on public.site_design_presets
for each row
execute function public.set_site_design_presets_updated_at();

alter table public.site_design_presets enable row level security;

drop policy if exists "Admins can read design presets" on public.site_design_presets;
create policy "Admins can read design presets"
on public.site_design_presets
for select
using (
    exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and role = 'admin'
    )
);

drop policy if exists "Admins can insert design presets" on public.site_design_presets;
create policy "Admins can insert design presets"
on public.site_design_presets
for insert
with check (
    exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and role = 'admin'
    )
);

drop policy if exists "Admins can update design presets" on public.site_design_presets;
create policy "Admins can update design presets"
on public.site_design_presets
for update
using (
    exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and role = 'admin'
    )
)
with check (
    exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and role = 'admin'
    )
);

drop policy if exists "Admins can delete design presets" on public.site_design_presets;
create policy "Admins can delete design presets"
on public.site_design_presets
for delete
using (
    exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and role = 'admin'
    )
);
