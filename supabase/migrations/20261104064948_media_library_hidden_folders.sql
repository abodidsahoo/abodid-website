-- Folder moves keep the original R2 objects alive for existing public links.
-- Suppress completed source folder trees in the library only.
create table if not exists public.media_library_hidden_folders (
    storage_bucket text not null,
    folder_path text not null check (folder_path <> ''),
    hidden_at timestamptz not null default now(),
    hidden_by uuid references auth.users(id) on delete set null,
    primary key (storage_bucket, folder_path)
);
alter table public.media_library_hidden_folders enable row level security;
create policy media_library_hidden_folders_admin_all
    on public.media_library_hidden_folders for all to authenticated
    using (public.media_assets_is_admin()) with check (public.media_assets_is_admin());
grant select, insert, update, delete on public.media_library_hidden_folders to authenticated;
grant all on public.media_library_hidden_folders to service_role;
