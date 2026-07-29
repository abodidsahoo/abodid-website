begin;

create table if not exists public.punctum_generations (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null unique,
  access_token_hash text not null,
  source_response_id uuid not null
    references public.punctum_responses(id) on delete cascade,
  parent_generation_id uuid
    references public.punctum_generations(id) on delete restrict,
  source_image_id uuid
    references public.punctum_images(id) on delete restrict,
  source_image_url text not null,
  generated_image_url text,
  generated_image_path text,
  source_polygon_normalized jsonb not null
    check (public.punctum_valid_polygon(source_polygon_normalized)),
  source_polygon_pixels jsonb not null default '[]'::jsonb
    check (jsonb_typeof(source_polygon_pixels) = 'array'),
  crop_x integer,
  crop_y integer,
  crop_width integer,
  crop_height integer,
  source_width integer not null check (source_width > 0),
  source_height integer not null check (source_height > 0),
  padding jsonb not null default '{}'::jsonb,
  palette jsonb not null default '[]'::jsonb
    check (jsonb_typeof(palette) = 'array'),
  visual_analysis jsonb not null default '{}'::jsonb,
  viewer_explanation text not null default '',
  source_prompt text not null default '',
  generation_prompt text not null default '',
  model text not null default '',
  provider text not null default '',
  seed bigint not null check (seed > 0),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  error_message text,
  masked_fragment_path text,
  context_crop_path text,
  mask_path text,
  post_generation_answer text check (
    post_generation_answer is null
    or post_generation_answer in ('still', 'moved', 'disappeared', 'unsure')
  ),
  post_generation_polygon jsonb check (
    post_generation_polygon is null
    or public.punctum_valid_polygon(post_generation_polygon)
  ),
  post_generation_explanation text check (
    post_generation_explanation is null
    or char_length(post_generation_explanation) <= 600
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint punctum_generation_crop_is_complete check (
    (crop_x is null and crop_y is null and crop_width is null and crop_height is null)
    or (
      crop_x >= 0 and crop_y >= 0 and crop_width > 0 and crop_height > 0
    )
  ),
  constraint punctum_generation_parent_is_not_self check (
    parent_generation_id is null or parent_generation_id <> id
  )
);

create index if not exists punctum_generations_response_created_idx
  on public.punctum_generations (source_response_id, created_at);
create index if not exists punctum_generations_parent_idx
  on public.punctum_generations (parent_generation_id);
create index if not exists punctum_generations_completed_idx
  on public.punctum_generations (source_response_id, completed_at)
  where status = 'completed';

alter table public.punctum_generations enable row level security;
revoke all on public.punctum_generations from anon, authenticated;
grant all on public.punctum_generations to service_role;

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
) values
  (
    'punctum-world-artifacts',
    'punctum-world-artifacts',
    false,
    52428800,
    array['image/png']
  ),
  (
    'punctum-generated-worlds',
    'punctum-generated-worlds',
    true,
    52428800,
    array['image/png']
  )
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;
