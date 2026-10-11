-- Store the precomputed palette with each moodboard item so color filtering is
-- immediately available after an upload and never needs to analyze an image
-- during a page view or slider interaction.

alter table public.moodboard_items
add column if not exists palette jsonb;

comment on column public.moodboard_items.palette is
'Precomputed moodboard palette: dominant Hex/Lab/HSL values, four swatches, and isDark.';

notify pgrst, 'reload schema';
