-- Migration: 20260916130000_create_lab_experiments_analytics.sql
-- Description: Creates analytics tracking tables for Media Lab and interactive experiments.

begin;

-- 1. Table for registering Media Lab experiments catalog
create table if not exists public.analytics_lab_experiments (
  id text primary key,
  title text not null,
  path text not null,
  discipline text not null,
  description text,
  status text not null default 'live',
  color text not null default '#2444ca',
  created_at timestamptz not null default now()
);

-- Seed current live lab experiments
insert into public.analytics_lab_experiments (id, title, path, discipline, description, color)
values
  ('punctum', 'Punctum', '/lab/punctum', 'Visual Perception & AI', 'Interactive experiment discovering emotional focal points and personal punctum in imagery.', '#ff7eb5'),
  ('glyph_loom', 'Glyph Loom', '/lab/glyph-loom', 'Generative Typography & Code Art', 'Algorithmic letterform generator weaving kinetic code into typography.', '#ffe44f'),
  ('image_flick', 'Image Flick', '/lab/image-flick', 'Computer Vision & Gesture Control', 'Touchless hand gesture photo navigation powered by real-time TensorFlow models.', '#caff48'),
  ('sequence_room', 'Sequence Room', '/lab/sequence-room', 'Interactive Sequence Curation', 'Spatial visual sequencing canvas and collaborative shareable curation boards.', '#818cf8'),
  ('second_brain', 'Obsidian Vault Graph', '/obsidian-vault', 'PKM Knowledge Graph & Semantic RAG', 'Public interactive Obsidian graph connected to GitHub sync and semantic embeddings.', '#5b8def'),
  ('xr_showcase', 'XR & Spatial Showcase', '/xr-showcase', 'Spatial Computing & WebGL Prototyping', 'Spatial UI prototypes, WebGL shaders, and interactive visionOS explorations.', '#36a37c'),
  ('lab_hub', 'Media Lab Hub', '/lab', 'Experimental Playground', 'Crossover playground inspired by MIT Media Lab & Google Creative Lab.', '#2444ca')
on conflict (id) do update set
  title = excluded.title,
  path = excluded.path,
  discipline = excluded.discipline,
  description = excluded.description,
  color = excluded.color;

-- 2. Table for tracking individual interactive events inside experiments (e.g. gesture detections, canvas generations, punctum clicks)
create table if not exists public.analytics_lab_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.analytics_sessions(id) on delete cascade,
  experiment_id text not null references public.analytics_lab_experiments(id) on delete cascade,
  event_type text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_lab_events_experiment_idx
  on public.analytics_lab_events (experiment_id, created_at desc);

create index if not exists analytics_lab_events_session_idx
  on public.analytics_lab_events (session_id, created_at desc);

alter table public.analytics_lab_experiments enable row level security;
alter table public.analytics_lab_events enable row level security;

-- Policies
drop policy if exists analytics_lab_experiments_read on public.analytics_lab_experiments;
create policy analytics_lab_experiments_read
  on public.analytics_lab_experiments
  for select
  to anon, authenticated
  using (true);

drop policy if exists analytics_lab_events_admin_read on public.analytics_lab_events;
create policy analytics_lab_events_admin_read
  on public.analytics_lab_events
  for select
  to authenticated
  using (public.analytics_is_admin());

grant select on public.analytics_lab_experiments to anon, authenticated;
grant select on public.analytics_lab_events to authenticated;
grant all on public.analytics_lab_experiments to service_role;
grant all on public.analytics_lab_events to service_role;

commit;
