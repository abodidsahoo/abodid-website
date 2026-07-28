begin;

create extension if not exists pgcrypto;

create or replace function public.punctum_valid_polygon(vertices jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    jsonb_typeof(vertices) = 'array'
    and jsonb_array_length(vertices) between 3 and 6
    and not exists (
      select 1
      from jsonb_array_elements(vertices) as vertex
      where jsonb_typeof(vertex) <> 'object'
        or jsonb_typeof(vertex -> 'x') <> 'number'
        or jsonb_typeof(vertex -> 'y') <> 'number'
        or (vertex ->> 'x')::numeric < 0
        or (vertex ->> 'x')::numeric > 1
        or (vertex ->> 'y')::numeric < 0
        or (vertex ->> 'y')::numeric > 1
    );
$$;

create table if not exists public.punctum_studies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'paused', 'archived')),
  consent_version text not null,
  minimum_cohort_size integer not null default 10
    check (minimum_cohort_size between 5 and 100),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.punctum_images (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.punctum_studies(id) on delete cascade,
  slug text not null,
  title text not null,
  storage_path text not null,
  public_url text not null,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  checksum text not null,
  version integer not null default 1 check (version > 0),
  soft_background text not null default '#eee7dc',
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint punctum_images_slug_matches_storage_filename check (
    slug = regexp_replace(
      regexp_replace(storage_path, '^.*/', ''),
      '[.][^.]+$',
      ''
    )
  ),
  unique (study_id, slug),
  unique (id, version)
);

comment on column public.punctum_images.slug is
  'Canonical source filename without its directory or extension.';

create table if not exists public.punctum_sessions (
  id uuid primary key default gen_random_uuid(),
  public_session_id uuid not null unique default gen_random_uuid(),
  study_id uuid not null references public.punctum_studies(id) on delete restrict,
  consent_version text not null,
  age_confirmed boolean not null check (age_confirmed),
  age_band text check (
    age_band is null
    or age_band in ('18-24', '25-34', '35-44', '45-54', '55-64', '65+', 'prefer_not')
  ),
  gender text check (
    gender is null
    or gender in ('woman', 'man', 'non_binary', 'self_described', 'prefer_not')
  ),
  country_code text check (
    country_code is null
    or country_code = 'PREFER_NOT'
    or country_code ~ '^[A-Z]{2}$'
  ),
  verification_method text not null
    check (verification_method in ('turnstile', 'local-preview')),
  verified_at timestamptz not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.punctum_responses (
  id uuid primary key default gen_random_uuid(),
  image_id uuid not null references public.punctum_images(id) on delete restrict,
  session_id uuid not null references public.punctum_sessions(id) on delete cascade,
  image_version integer not null check (image_version > 0),
  image_checksum text not null,
  polygon_vertices jsonb not null
    check (public.punctum_valid_polygon(polygon_vertices)),
  vertex_count integer not null check (vertex_count between 3 and 6),
  centroid_x double precision not null check (centroid_x between 0 and 1),
  centroid_y double precision not null check (centroid_y between 0 and 1),
  normalized_area double precision not null check (
    normalized_area > 0 and normalized_area <= 1
  ),
  drawing_type text not null check (
    drawing_type in ('tap', 'short-mark', 'line', 'closed-mark', 'scribble')
  ),
  polygon_fit_score double precision check (
    polygon_fit_score is null or polygon_fit_score between 0 and 1
  ),
  algorithm_version text not null,
  brush_radius double precision not null check (
    brush_radius > 0 and brush_radius < 0.1
  ),
  idempotency_key uuid not null unique,
  quality_flags jsonb not null default '[]'::jsonb
    check (jsonb_typeof(quality_flags) = 'array'),
  is_valid boolean not null default true,
  public_visible boolean not null default true,
  created_at timestamptz not null default now(),
  unique (session_id, image_id)
);

create table if not exists public.punctum_annotations (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null unique references public.punctum_responses(id) on delete cascade,
  text text not null check (
    char_length(btrim(text)) between 1 and 600
  ),
  moderation_status text not null default 'pending'
    check (moderation_status in ('pending', 'approved', 'rejected', 'hidden')),
  created_at timestamptz not null default now(),
  moderated_at timestamptz
);

create table if not exists public.punctum_contact_options (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.punctum_sessions(id) on delete cascade,
  encrypted_contact_value text not null,
  consent_version text not null,
  created_at timestamptz not null default now()
);

create index if not exists punctum_images_active_order_idx
  on public.punctum_images (study_id, active, display_order);
create index if not exists punctum_sessions_started_idx
  on public.punctum_sessions (study_id, started_at desc);
create index if not exists punctum_responses_image_created_idx
  on public.punctum_responses (image_id, created_at)
  where public_visible and is_valid;
create index if not exists punctum_responses_session_idx
  on public.punctum_responses (session_id);
create index if not exists punctum_annotations_moderation_idx
  on public.punctum_annotations (moderation_status, created_at);

alter table public.punctum_studies enable row level security;
alter table public.punctum_images enable row level security;
alter table public.punctum_sessions enable row level security;
alter table public.punctum_responses enable row level security;
alter table public.punctum_annotations enable row level security;
alter table public.punctum_contact_options enable row level security;

revoke all on public.punctum_studies from anon, authenticated;
revoke all on public.punctum_images from anon, authenticated;
revoke all on public.punctum_sessions from anon, authenticated;
revoke all on public.punctum_responses from anon, authenticated;
revoke all on public.punctum_annotations from anon, authenticated;
revoke all on public.punctum_contact_options from anon, authenticated;

grant all on public.punctum_studies to service_role;
grant all on public.punctum_images to service_role;
grant all on public.punctum_sessions to service_role;
grant all on public.punctum_responses to service_role;
grant all on public.punctum_annotations to service_role;
grant all on public.punctum_contact_options to service_role;

insert into public.punctum_studies (
  id, slug, title, status, consent_version, minimum_cohort_size, settings
) values (
  'b9ca68cf-76d5-45a6-b9e2-eb8b7b0c5dbe',
  'punctum',
  'Punctum',
  'published',
  'punctum-consent-v1',
  10,
  '{"algorithm_version":"polygon-fit-v1","source_folder":"originals/exhibition-photos"}'::jsonb
)
on conflict (id) do update set
  title = excluded.title,
  status = excluded.status,
  consent_version = excluded.consent_version,
  minimum_cohort_size = excluded.minimum_cohort_size,
  settings = excluded.settings,
  updated_at = now();

insert into public.punctum_images (
  id, study_id, slug, title, storage_path, public_url, width, height,
  checksum, version, soft_background, active, display_order
) values
  (
    'b52cfd49-194d-4990-8243-9ca96ef171b7',
    'b9ca68cf-76d5-45a6-b9e2-eb8b7b0c5dbe',
    'rca-outernet-digital-direction-2024-gradshow-abodid-18',
    'Exhibition photograph 01',
    'originals/exhibition-photos/rca-outernet-digital-direction-2024-gradshow-abodid-18.jpg',
    'https://photos.abodid.com/originals/exhibition-photos/rca-outernet-digital-direction-2024-gradshow-abodid-18.jpg',
    1920, 1280, '5f1b5ce734bda739f25a71b323ee05d3', 1, '#d6d3ce', true, 1
  ),
  (
    'fa7299d8-37fe-483f-b02c-aaf3537c8aa6',
    'b9ca68cf-76d5-45a6-b9e2-eb8b7b0c5dbe',
    'rca-digital-direction-2024-gradshow-abodid-146',
    'Exhibition photograph 02',
    'originals/exhibition-photos/rca-digital-direction-2024-gradshow-abodid-146.jpg',
    'https://photos.abodid.com/originals/exhibition-photos/rca-digital-direction-2024-gradshow-abodid-146.jpg',
    1920, 1280, '71558b1e9e0f55d7175b80cf2c1ac025', 1, '#e9e0d6', true, 2
  ),
  (
    'f42c5540-7748-4795-9d2e-6bb7a62175ac',
    'b9ca68cf-76d5-45a6-b9e2-eb8b7b0c5dbe',
    'rca-grad-show-truman-brewery-abodid-97',
    'Exhibition photograph 03',
    'originals/exhibition-photos/rca-grad-show-truman-brewery-abodid-97.jpg',
    'https://photos.abodid.com/originals/exhibition-photos/rca-grad-show-truman-brewery-abodid-97.jpg',
    1920, 1280, '3853dd699c864ce0f3cdfb3ce2a472c0', 1, '#dbd6cf', true, 3
  ),
  (
    'dbb67b6b-32c4-4ff0-ba00-eb7809f5e688',
    'b9ca68cf-76d5-45a6-b9e2-eb8b7b0c5dbe',
    'rca-digital-direction-2024-gradshow-abodid-346',
    'Exhibition photograph 04',
    'originals/exhibition-photos/rca-digital-direction-2024-gradshow-abodid-346.jpg',
    'https://photos.abodid.com/originals/exhibition-photos/rca-digital-direction-2024-gradshow-abodid-346.jpg',
    1920, 1280, 'a9afa1724f4329d51de2ebfb38939c35', 1, '#e8dbd0', true, 4
  ),
  (
    '813cac09-7777-4042-a432-c605252bdfd4',
    'b9ca68cf-76d5-45a6-b9e2-eb8b7b0c5dbe',
    'rca-2023-ting-photoshoot-collab-9',
    'Exhibition photograph 05',
    'originals/exhibition-photos/rca-2023-ting-photoshoot-collab-9.jpg',
    'https://photos.abodid.com/originals/exhibition-photos/rca-2023-ting-photoshoot-collab-9.jpg',
    1920, 1280, '29517ab5fa91fdf58e633bf8c544243b', 1, '#cecdc5', true, 5
  ),
  (
    'f89a3837-7534-4fd7-adae-b6b92edc8144',
    'b9ca68cf-76d5-45a6-b9e2-eb8b7b0c5dbe',
    'into-the-flux-iba-london88',
    'Exhibition photograph 06',
    'originals/exhibition-photos/into-the-flux-iba-london88.jpg',
    'https://photos.abodid.com/originals/exhibition-photos/into-the-flux-iba-london88.jpg',
    1980, 1320, '28d7f7c01fa9ba276e5e639ce71d3df9', 1, '#d2d3cf', true, 6
  )
on conflict (id) do update set
  slug = excluded.slug,
  title = excluded.title,
  storage_path = excluded.storage_path,
  public_url = excluded.public_url,
  width = excluded.width,
  height = excluded.height,
  checksum = excluded.checksum,
  version = excluded.version,
  soft_background = excluded.soft_background,
  active = excluded.active,
  display_order = excluded.display_order,
  updated_at = now();

commit;
