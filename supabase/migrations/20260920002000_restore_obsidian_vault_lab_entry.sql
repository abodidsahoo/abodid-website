begin;

alter table public.lab_catalogue_entries
  drop constraint if exists lab_catalogue_destination_is_experiment;

alter table public.lab_catalogue_entries
  drop constraint if exists lab_catalogue_destination_is_internal;

alter table public.lab_catalogue_entries
  add constraint lab_catalogue_destination_is_internal
  check (destination_path ~ '^/[A-Za-z0-9][A-Za-z0-9/_-]*$');

update public.lab_catalogue_entries
set sort_order = 6
where entry_key = 'obsidian-tags-interactive-explorer'
  and sort_order = 5;

insert into public.lab_catalogue_entries (
  entry_key,
  title,
  description,
  discipline,
  status_label,
  year_label,
  destination_path,
  destination_label,
  thumbnail_url,
  video_url,
  thumbnail_alt,
  surface,
  card_variant,
  preview_heading,
  preview_cta,
  sort_order,
  visible
)
values (
  'obsidian-vault',
  'Obsidian Vault',
  'A public, interactive interface for my local Obsidian vault, synced through GitHub with tag filtering, SEO-friendly shareable notes, and an AI-powered RAG pipeline for semantic search across my knowledge base.',
  'Knowledge systems · Creative technology',
  'Live system',
  '2026',
  '/obsidian-vault',
  'Open experiment',
  'https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/misc/video-clips/obsidian-vault-notes-thumbnail-video.mp4',
  'https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/misc/video-clips/obsidian-vault-notes-thumbnail-video.mp4',
  'Obsidian Vault notes and knowledge system preview',
  'yellow',
  'media',
  null,
  null,
  5,
  true
)
on conflict (entry_key) do update
set
  title = excluded.title,
  description = excluded.description,
  discipline = excluded.discipline,
  status_label = excluded.status_label,
  year_label = excluded.year_label,
  destination_path = excluded.destination_path,
  destination_label = excluded.destination_label,
  thumbnail_url = excluded.thumbnail_url,
  video_url = excluded.video_url,
  thumbnail_alt = excluded.thumbnail_alt,
  surface = excluded.surface,
  card_variant = excluded.card_variant,
  sort_order = excluded.sort_order,
  visible = true;

notify pgrst, 'reload schema';

commit;
