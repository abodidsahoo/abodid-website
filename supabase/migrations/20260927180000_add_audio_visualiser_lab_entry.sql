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
  'audio-visualiser',
  'Audio Visualiser',
  'A live sound-to-image instrument that turns local tracks or Chrome-tab audio into responsive waveforms and magnetic fields you can tune in real time.',
  'Sound visualisation · Creative coding',
  'Live experiment',
  '2026',
  '/lab/audio-visualiser',
  'Launch instrument',
  'https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/misc/video-clips/audio-spectrum-compressed.mp4',
  'https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/misc/video-clips/audio-spectrum-compressed.mp4',
  'Audio Visualiser showing a glowing magnetic waveform responding to sound beside live tuning controls',
  'blue',
  'media',
  null,
  null,
  7,
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
