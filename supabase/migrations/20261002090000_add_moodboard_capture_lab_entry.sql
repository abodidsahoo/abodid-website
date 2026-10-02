begin;

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
  'moodboard-capture-pipeline',
  'Right-click to Moodboard',
  'A cross-device capture pipeline that turns an image in Chrome or Finder into a responsive, live visual reference without opening an upload dashboard.',
  'Creative tooling · Media infrastructure',
  'Live system',
  '2026',
  '/lab/moodboard-capture-pipeline',
  'Read the case study',
  '/images/lab/moodboard-capture-pipeline.svg',
  null,
  'Diagram showing images moving from Chrome and Finder through a secure cloud pipeline into a live moodboard',
  'pink',
  'media',
  null,
  null,
  8,
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
  preview_heading = excluded.preview_heading,
  preview_cta = excluded.preview_cta,
  sort_order = excluded.sort_order,
  visible = excluded.visible;

notify pgrst, 'reload schema';

commit;
