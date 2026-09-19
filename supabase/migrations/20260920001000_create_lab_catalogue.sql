begin;

create extension if not exists pgcrypto;

create table public.lab_catalogue_entries (
  id uuid primary key default gen_random_uuid(),
  entry_key text not null unique,
  title text not null default '',
  description text not null default '',
  discipline text not null default '',
  status_label text not null default 'Live',
  year_label text not null default '',
  destination_path text not null,
  destination_label text not null default 'Open experiment',
  thumbnail_url text not null default '',
  video_url text,
  thumbnail_alt text not null default '',
  surface text not null default 'cream'
    check (surface in ('pink', 'blue', 'yellow', 'cream', 'lime')),
  card_variant text not null default 'media'
    check (card_variant in ('media', 'vault-tags')),
  preview_heading text,
  preview_cta text,
  sort_order integer not null default 0,
  visible boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lab_catalogue_destination_is_internal
    check (destination_path ~ '^/[A-Za-z0-9][A-Za-z0-9/_-]*$')
);

create index lab_catalogue_visible_order_idx
  on public.lab_catalogue_entries(visible, sort_order);

create or replace function public.lab_catalogue_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.lab_catalogue_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger lab_catalogue_touch
before update on public.lab_catalogue_entries
for each row execute function public.lab_catalogue_touch_updated_at();

alter table public.lab_catalogue_entries enable row level security;

create policy "Lab catalogue public read"
  on public.lab_catalogue_entries
  for select
  using (visible = true or public.lab_catalogue_is_admin());

create policy "Lab catalogue admin insert"
  on public.lab_catalogue_entries
  for insert
  with check (public.lab_catalogue_is_admin());

create policy "Lab catalogue admin update"
  on public.lab_catalogue_entries
  for update
  using (public.lab_catalogue_is_admin())
  with check (public.lab_catalogue_is_admin());

create policy "Lab catalogue admin delete"
  on public.lab_catalogue_entries
  for delete
  using (public.lab_catalogue_is_admin());

create or replace function public.lab_catalogue_reorder(p_entry_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expected_count integer;
begin
  if not public.lab_catalogue_is_admin() then
    raise exception 'LAB_CATALOGUE_ADMIN_REQUIRED';
  end if;

  select count(*) into v_expected_count
  from public.lab_catalogue_entries;

  if coalesce(array_length(p_entry_ids, 1), 0) <> v_expected_count
    or (
      select count(distinct ordered_id.id)
      from unnest(p_entry_ids) as ordered_id(id)
    ) <> v_expected_count
    or exists (
      select 1
      from unnest(p_entry_ids) as ordered_id(id)
      where not exists (
        select 1
        from public.lab_catalogue_entries
        where lab_catalogue_entries.id = ordered_id.id
      )
    ) then
    raise exception 'LAB_CATALOGUE_COMPLETE_ORDER_REQUIRED';
  end if;

  update public.lab_catalogue_entries as entry
  set sort_order = ordered.position::integer
  from unnest(p_entry_ids) with ordinality as ordered(id, position)
  where entry.id = ordered.id;
end;
$$;

grant select on public.lab_catalogue_entries to anon, authenticated;
grant insert, update, delete on public.lab_catalogue_entries to authenticated;
grant execute on function public.lab_catalogue_reorder(uuid[]) to authenticated;

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
  sort_order
)
values
  (
    'punctum',
    'Punctum',
    'A participatory study of the detail in a photograph that catches, moves, or stays with each viewer.',
    'Visual attention · Participatory AI',
    'Live',
    '2026',
    '/lab/punctum',
    'Open experiment',
    'https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/misc/video-clips/punctum_thumbnail_video.mp4',
    'https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/misc/video-clips/punctum_thumbnail_video.mp4',
    'Interactive walkthrough animation of the Punctum visual-attention experiment',
    'pink',
    'media',
    null,
    null,
    1
  ),
  (
    'image-flick',
    'Image Flick',
    'A physics-led photo stack controlled by cursor movement, hand gestures, and an optional voice trigger.',
    'Gesture interface · Photography',
    'Prototype',
    '2026',
    '/lab/image-flick',
    'Open experiment',
    'https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/misc/gif/gesture-control-abodid-thumbnail-gif.gif',
    null,
    'A hand gesture controlling a stack of digital photographs',
    'yellow',
    'media',
    null,
    null,
    2
  ),
  (
    'glyph-loom',
    'Glyph Loom',
    'A generative typography instrument that reconstructs live letterforms from modular bars, dots, crosses, and woven structures.',
    'Generative typography · Creative coding',
    'Live',
    '2026',
    '/lab/glyph-loom',
    'Open experiment',
    '/images/research/glyph-loom-cover.png',
    null,
    'Generative typography outlines in the Glyph Loom instrument',
    'lime',
    'media',
    null,
    null,
    3
  ),
  (
    'sequence-room',
    'Sequence Room',
    'An immersive table for scattering, rearranging, and discovering new relationships between photographs.',
    'Photo archive · Spatial interaction',
    'Prototype',
    '2026',
    '/lab/sequence-room',
    'Open experiment',
    'https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/misc/video-clips/sequence-room-comp.mp4',
    'https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/misc/video-clips/sequence-room-comp.mp4',
    'Interactive Sequence Room photo workspace preview',
    'cream',
    'media',
    null,
    null,
    4
  ),
  (
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
    5
  ),
  (
    'obsidian-tags-interactive-explorer',
    'Obsidian Tags Interactive Explorer',
    'A living, cursor-led window into my Obsidian knowledge system, where movement reveals the ideas and connections shaping my work.',
    'Knowledge systems · Creative technology',
    'Live system',
    '2026',
    '/lab/obsidian-tags-interactive-explorer',
    'Open experiment',
    'https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/misc/video-clips/Obsidian_Timelapse.mp4',
    'https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/misc/video-clips/Obsidian_Timelapse.mp4',
    'Obsidian Vault notes and knowledge system preview',
    'blue',
    'vault-tags',
    'A glimpse into my second brain.',
    'Open the interactive explorer ↗',
    6
  );

notify pgrst, 'reload schema';

commit;
