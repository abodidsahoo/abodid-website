-- ─────────────────────────────────────────────────────────────────
-- Migration: create_home_storytelling_cards
-- Creates a Supabase-managed table for the landing page storytelling
-- project cards. Seeded with all 10 current hardcoded cards so the
-- landing page render is identical from day one.
-- ─────────────────────────────────────────────────────────────────

create table if not exists public.home_storytelling_cards (
  id          uuid        primary key default gen_random_uuid(),
  card_id     text        unique not null,
  title       text        not null default '',
  category    text        not null default '',
  summary     text        not null default '',
  role        text        not null default '',
  outcome     text        not null default '',
  href        text        not null default '',
  alt         text        not null default '',
  image_url   text,
  video_url   text,
  accent      text        not null default 'lime'
                check (accent in ('lime','pink','yellow','cyan','orange','purple')),
  themes      text[]      not null default '{}',
  sort_order  integer     not null default 0,
  visible     boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-update updated_at on every row change
create or replace function public.set_home_storytelling_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger home_storytelling_cards_updated_at
  before update on public.home_storytelling_cards
  for each row execute function public.set_home_storytelling_updated_at();

-- ── Row Level Security ────────────────────────────────────────────
alter table public.home_storytelling_cards enable row level security;

-- Admins have full access
create policy "Admin full access"
  on public.home_storytelling_cards
  for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Anyone (including unauthenticated) can read visible cards
create policy "Public read visible cards"
  on public.home_storytelling_cards
  for select
  using (visible = true);

-- ── Seed: 7 work cards ───────────────────────────────────────────
insert into public.home_storytelling_cards
  (card_id, title, category, summary, role, outcome, href, alt, image_url, video_url, accent, themes, sort_order)
values
  (
    'sequence-room',
    'Sequence Room',
    'Spatial Narrative Interactive Tool',
    'An interactive workspace for sequencing, curating, and editing visual narratives in space.',
    'Concept · Interaction Design · Full-stack Development',
    'Live interactive app',
    '/work/sequence-room',
    'Animated preview of the Sequence Room visual storytelling canvas',
    'https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/misc/video-clips/sequence-room-comp.mp4',
    'https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/misc/video-clips/sequence-room-comp.mp4',
    'lime',
    array['Visual Narratives','Interaction Design','Digital Curation'],
    1
  ),
  (
    'into-the-flux',
    'Into the Flux',
    'Exhibition experience',
    'An abandoned London garage transformed into a public exhibition in two days.',
    'Exhibition Production · Photographic Documentation',
    '2,000+ visitors',
    '/work/into-the-flux',
    'Visitors inside the Into the Flux exhibition in London',
    'https://assets.abodid.com/photos/variants/exhibition-photos/1600/into-the-flux-iba-london103-baac9bdf57.webp',
    null,
    'yellow',
    array['Exhibitions','Creative Direction','Spatial Planning'],
    2
  ),
  (
    'obsidian-vault',
    'Obsidian Vault',
    'AI Knowledge Ecosystem',
    'A public, searchable space for notes, questions, ideas and research.',
    'Information Architecture · Interface',
    'A living research ecosystem',
    '/obsidian-vault',
    'Timelapse video preview of the connected Obsidian knowledge vault',
    null,
    'https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/misc/video-clips/Obsidian_Timelapse.mp4',
    'cyan',
    array['Knowledge Systems','Notes and Research','Information Architecture'],
    3
  ),
  (
    'gesture-control',
    'Hand Gesture Control',
    'Interaction Prototype',
    'A touch-free interface for browsing photographs as though they were physical cards.',
    'Concept · Interaction Design · Prototyping',
    'Live Interactive App',
    '/work/gesture-control',
    'Animated preview of hand interacting with a gesture-controlled digital interface',
    'https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/misc/gif/gesture-control-abodid-thumbnail-gif.gif',
    'https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/misc/video-clips/gesture-image.mp4',
    'orange',
    array['Gesture Interaction','Photography','Prototyping'],
    4
  ),
  (
    'punctum',
    'Punctum',
    'Participatory Research',
    'An interactive study of the details in photographs that move us, stay with us and shape memory.',
    'Research · Experience Design · AI Prototyping',
    'Live interactive app',
    '/work/punctum',
    'Interactive walkthrough animation of the Punctum visual-attention experiment',
    'https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/misc/video-clips/punctum_thumbnail_video.mp4',
    'https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/misc/video-clips/punctum_thumbnail_video.mp4',
    'pink',
    array['Photography','Human Attention','Memory'],
    5
  ),
  (
    'bfi',
    'British Film Institute',
    'Cultural Documentation',
    'Human-centred photography for a four-day programme of immersive and expanded cinema.',
    'Photography · Visual Storytelling',
    '20,000+ visitors across four days',
    '/work/bfi',
    'Audience members experiencing an immersive programme at the British Film Institute',
    'https://assets.abodid.com/photos/variants/british-film-institute-london/1600/1769335964323_qjq8j2g9q-da588df8ed.webp',
    null,
    'yellow',
    array['Cultural Documentation','Photography','Expanded Cinema'],
    6
  ),
  (
    'show-me-the-way',
    'Show Me the Way',
    'Film and visual storytelling',
    'A music video shaped through cinematography, visual effects and a tactile narrative language.',
    'Director · DOP · Editor · VFX',
    'Television broadcast in South Asia on VH1',
    '/work/show-me-the-way',
    'Show Me the Way music video still broadcast on VH1',
    'https://img.youtube.com/vi/fooE0W_mFSY/maxresdefault.jpg',
    'https://www.youtube.com/watch?v=fooE0W_mFSY',
    'pink',
    array['Music video','Cinematography','Visual effects'],
    7
  ),
-- ── Seed: 3 research cards ────────────────────────────────────────
  (
    'rejection-reactivates-unresolved-grief',
    'Rejection Re-Activates Unresolved Grief',
    'Artistic and sociological research',
    'A sociological framing of how romantic rejection can reactivate earlier grief when mourning remains unfinished.',
    'Researcher / Autoethnographer',
    'Accepted roundtable · Families & Relationships',
    '/research/rejection-reactivates-unresolved-grief',
    'Participatory written responses displayed beside an outdoor installation',
    '/images/research-portfolio/rejection-responses.jpg',
    null,
    'purple',
    array['Unresolved grief','Romantic rejection','Family'],
    8
  ),
  (
    'cambridge-cultural-heritage-data-school',
    'Cultural Heritage Data School, Cambridge',
    'Artistic and sociological research',
    'A methods-led research experience across cultural heritage data, co-design, photogrammetry and critical visualisation.',
    'Bursary participant / Researcher',
    'Full bursary · 2026 cohort',
    '/research/cambridge-cultural-heritage-data-school',
    'Participants collaborating at the Cultural Heritage Data School',
    'https://assets.abodid.com/photos/variants/my-life/1600/abodid-cambridge-university-cultural-heritage-data-school-group-359c529ec7.webp',
    null,
    'cyan',
    array['Cultural heritage','Co-design','Data ethics'],
    9
  ),
  (
    'do-ghosts-feel-jealous',
    'Do ghosts feel jealous if you miss the living ones more than them?',
    'Artistic and sociological research',
    'An ongoing autoethnographic inquiry into unrequited love, sibling loss, absence and unresolved grief.',
    'Artist-researcher / Photographer / Writer',
    'Ongoing research',
    '/research/do-ghosts-feel-jealous',
    'Project cover showing a family photograph and the title Do ghosts feel jealous',
    '/images/research-portfolio/ghosts-cover.jpg',
    null,
    'pink',
    array['Autoethnography','Grief','Phototherapy'],
    10
  )
on conflict (card_id) do nothing;
