begin;

create extension if not exists pgcrypto;

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  storage_provider text not null default 'cloudflare_r2'
    check (storage_provider in ('cloudflare_r2', 'supabase')),
  storage_bucket text not null,
  object_key text not null,
  folder_path text not null default '',
  public_url text not null,
  original_filename text not null,
  mime_type text not null,
  file_size bigint not null default 0 check (file_size >= 0),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  duration_seconds numeric,
  etag text,
  alt_text text not null default '',
  caption text not null default '',
  credit text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (storage_provider, storage_bucket, object_key)
);

create index if not exists media_assets_folder_idx
  on public.media_assets(storage_provider, storage_bucket, folder_path, created_at desc);
create index if not exists media_assets_created_idx
  on public.media_assets(created_at desc);
create index if not exists media_assets_mime_idx
  on public.media_assets(mime_type);

create or replace function public.media_assets_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.media_assets_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists media_assets_touch on public.media_assets;
create trigger media_assets_touch
before update on public.media_assets
for each row execute function public.media_assets_touch_updated_at();

alter table public.media_assets enable row level security;

drop policy if exists media_assets_admin_read on public.media_assets;
create policy media_assets_admin_read
on public.media_assets for select
to authenticated
using (public.media_assets_is_admin());

drop policy if exists media_assets_admin_insert on public.media_assets;
create policy media_assets_admin_insert
on public.media_assets for insert
to authenticated
with check (public.media_assets_is_admin() and created_by = auth.uid());

drop policy if exists media_assets_admin_update on public.media_assets;
create policy media_assets_admin_update
on public.media_assets for update
to authenticated
using (public.media_assets_is_admin())
with check (public.media_assets_is_admin());

drop policy if exists media_assets_admin_delete on public.media_assets;
create policy media_assets_admin_delete
on public.media_assets for delete
to authenticated
using (public.media_assets_is_admin());

grant select, insert, update, delete on public.media_assets to authenticated;
grant execute on function public.media_assets_is_admin() to authenticated;

commit;
