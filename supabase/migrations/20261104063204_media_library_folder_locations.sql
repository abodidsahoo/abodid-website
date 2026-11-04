-- Organize the library without changing public R2 keys or published links.
-- NULL follows the storage folder; an empty string explicitly means library root.
alter table public.media_assets add column if not exists library_folder_path text;
create index if not exists media_assets_library_folder_idx
    on public.media_assets(storage_provider, storage_bucket, library_folder_path)
    where library_folder_path is not null;
comment on column public.media_assets.library_folder_path is
    'Optional Media Library folder override. R2 object_key and public_url remain stable.';
