-- A display name must survive asynchronous R2 metadata processing. Renaming a
-- library item never changes its public URL or the underlying object key.
alter table public.media_assets add column if not exists library_filename text
    check (library_filename is null or char_length(library_filename) between 1 and 255);
