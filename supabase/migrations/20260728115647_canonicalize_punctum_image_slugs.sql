begin;

update public.punctum_images
set
  slug = regexp_replace(
    regexp_replace(storage_path, '^.*/', ''),
    '[.][^.]+$',
    ''
  ),
  updated_at = now()
where slug is distinct from regexp_replace(
  regexp_replace(storage_path, '^.*/', ''),
  '[.][^.]+$',
  ''
);

alter table public.punctum_images
  drop constraint if exists punctum_images_slug_matches_storage_filename;

alter table public.punctum_images
  add constraint punctum_images_slug_matches_storage_filename check (
    slug = regexp_replace(
      regexp_replace(storage_path, '^.*/', ''),
      '[.][^.]+$',
      ''
    )
  );

comment on column public.punctum_images.slug is
  'Canonical source filename without its directory or extension.';

commit;
