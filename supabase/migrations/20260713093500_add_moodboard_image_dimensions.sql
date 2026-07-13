alter table public.moodboard_items
    add column image_width integer,
    add column image_height integer,
    add column aspect_ratio double precision generated always as (
        case
            when image_width > 0 and image_height > 0
                then image_width::double precision / image_height::double precision
            else null
        end
    ) stored;

alter table public.moodboard_items
    add constraint moodboard_items_image_width_positive
        check (image_width is null or image_width > 0),
    add constraint moodboard_items_image_height_positive
        check (image_height is null or image_height > 0);

comment on column public.moodboard_items.image_width is
    'Intrinsic source image width in pixels, used to reserve layout space before lazy loading.';
comment on column public.moodboard_items.image_height is
    'Intrinsic source image height in pixels, used to reserve layout space before lazy loading.';
comment on column public.moodboard_items.aspect_ratio is
    'Generated intrinsic width-to-height ratio used by the moodboard layout.';

notify pgrst, 'reload schema';
