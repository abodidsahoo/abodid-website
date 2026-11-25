-- A live snapshot is independent of the draft presets and the original tokens.
alter table public.design_system_settings
  add column published_theme jsonb,
  add constraint valid_published_design_theme check (
    published_theme is null or coalesce(
      jsonb_typeof(published_theme) = 'object'
      and (published_theme ->> 'id') ~ '^[0-9a-f-]{36}$'
      and char_length(btrim(published_theme ->> 'name')) between 1 and 80
      and (published_theme ->> 'background') ~* '^#[0-9a-f]{6}$'
      and (published_theme ->> 'foreground') ~* '^#[0-9a-f]{6}$',
      false
    )
  );

create table public.design_system_themes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  background text not null check (background ~* '^#[0-9a-f]{6}$'),
  foreground text not null check (foreground ~* '^#[0-9a-f]{6}$')
);

alter table public.design_system_themes enable row level security;
revoke all on public.design_system_themes from public, anon, authenticated;
grant select, insert, update on public.design_system_themes to authenticated;

create policy "Admins manage design theme presets"
  on public.design_system_themes for all to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid()) and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid()) and profiles.role = 'admin'
    )
  );

insert into public.design_system_themes (name, background, foreground)
values ('Crimson & Cream', '#a6192e', '#fff8e8');

notify pgrst, 'reload schema';
