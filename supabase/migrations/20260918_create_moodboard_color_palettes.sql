-- Migration: Create moodboard_color_palettes table
-- Stores precomputed CIELAB, HSL, and Hex palette vectors for fast moodboard color filtering

create table if not exists public.moodboard_color_palettes (
    id uuid primary key default gen_random_uuid(),
    moodboard_item_id uuid not null references public.moodboard_items(id) on delete cascade unique,
    storage_path text not null,
    image_url text not null,
    dominant_hex text not null,
    dominant_lab jsonb not null default '[]'::jsonb,
    dominant_hsl jsonb not null default '[]'::jsonb,
    palette_hex text[] not null default '{}'::text[],
    palette_lab jsonb not null default '[]'::jsonb,
    palette_hsl jsonb not null default '[]'::jsonb,
    is_dark boolean not null default false,
    created_at timestamp with time zone not null default timezone('utc'::text, now()),
    updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

create index if not exists idx_moodboard_color_palettes_item_id
on public.moodboard_color_palettes (moodboard_item_id);

create index if not exists idx_moodboard_color_palettes_storage_path
on public.moodboard_color_palettes (storage_path);

create or replace function public.set_moodboard_color_palettes_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$;

drop trigger if exists trg_moodboard_color_palettes_updated_at on public.moodboard_color_palettes;
create trigger trg_moodboard_color_palettes_updated_at
before insert or update on public.moodboard_color_palettes
for each row
execute function public.set_moodboard_color_palettes_updated_at();

notify pgrst, 'reload schema';
