-- Global design-system settings persisted from Admin > Design

create table if not exists public.site_design_settings (
    id uuid primary key default gen_random_uuid(),
    settings_key text not null unique default 'global',
    settings jsonb not null default '{}'::jsonb,
    created_at timestamp with time zone not null default timezone('utc'::text, now()),
    updated_at timestamp with time zone not null default timezone('utc'::text, now()),
    updated_by uuid references auth.users(id)
);

create or replace function public.set_site_design_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$;

drop trigger if exists trg_site_design_settings_updated_at on public.site_design_settings;
create trigger trg_site_design_settings_updated_at
before update on public.site_design_settings
for each row
execute function public.set_site_design_settings_updated_at();

alter table public.site_design_settings enable row level security;

drop policy if exists "Public can read design settings" on public.site_design_settings;
create policy "Public can read design settings"
on public.site_design_settings
for select
using (true);

drop policy if exists "Admins can insert design settings" on public.site_design_settings;
create policy "Admins can insert design settings"
on public.site_design_settings
for insert
with check (
    exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and role = 'admin'
    )
);

drop policy if exists "Admins can update design settings" on public.site_design_settings;
create policy "Admins can update design settings"
on public.site_design_settings
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

insert into public.site_design_settings (settings_key, settings)
values ('global', '{}'::jsonb)
on conflict (settings_key) do nothing;
