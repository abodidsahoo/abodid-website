-- A deliberately small presentation layer for the replaceable frontend.
-- Project content, media, brands, testimonials, papers and services remain in
-- their existing canonical tables.

create table if not exists public.site_curations (
  id uuid primary key default gen_random_uuid(),
  page_key text not null,
  section_key text not null,
  entity_type text not null,
  entity_id text,
  content jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_curations_page_key_check check (page_key ~ '^[a-z0-9][a-z0-9-]*$'),
  constraint site_curations_section_key_check check (section_key ~ '^[a-z0-9][a-z0-9-]*$')
);

create index if not exists site_curations_page_section_order_idx
  on public.site_curations (page_key, section_key, sort_order, created_at);

create table if not exists public.homepage_archives (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  active_period text,
  change_summary text,
  screenshot_url text,
  screenshot_media_asset_id uuid references public.media_assets(id) on delete set null,
  interactive_path text not null,
  sort_order integer not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint homepage_archives_slug_check check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  constraint homepage_archives_interactive_path_check check (interactive_path like '/archive/homepages/%')
);

create index if not exists homepage_archives_public_order_idx
  on public.homepage_archives (published, sort_order, created_at);

create or replace function public.set_site_presentation_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists site_curations_updated_at on public.site_curations;
create trigger site_curations_updated_at
before update on public.site_curations
for each row execute function public.set_site_presentation_updated_at();

drop trigger if exists homepage_archives_updated_at on public.homepage_archives;
create trigger homepage_archives_updated_at
before update on public.homepage_archives
for each row execute function public.set_site_presentation_updated_at();

alter table public.site_curations enable row level security;
alter table public.homepage_archives enable row level security;

drop policy if exists site_curations_public_read on public.site_curations;
create policy site_curations_public_read
on public.site_curations for select
using (visible);

drop policy if exists site_curations_admin_all on public.site_curations;
create policy site_curations_admin_all
on public.site_curations for all
using (public.portfolio_is_admin())
with check (public.portfolio_is_admin());

drop policy if exists homepage_archives_public_read on public.homepage_archives;
create policy homepage_archives_public_read
on public.homepage_archives for select
using (published);

drop policy if exists homepage_archives_admin_all on public.homepage_archives;
create policy homepage_archives_admin_all
on public.homepage_archives for all
using (public.portfolio_is_admin())
with check (public.portfolio_is_admin());

grant select on public.site_curations, public.homepage_archives to anon, authenticated;
grant insert, update, delete on public.site_curations, public.homepage_archives to authenticated;

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  title text,
  content text,
  items jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.services
  add column if not exists slug text,
  add column if not exists service_group text,
  add column if not exists summary text,
  add column if not exists price_label text,
  add column if not exists cta_label text,
  add column if not exists cta_href text,
  add column if not exists featured boolean not null default false;

create unique index if not exists services_slug_unique_idx
  on public.services (lower(slug))
  where slug is not null;

insert into public.services (
  slug, category, service_group, title, content, summary, price_label,
  cta_label, cta_href, items, featured, published, sort_order
)
values
  ('creative-direction-technology', 'creative', 'Creative engagements', 'Creative Direction and Technology',
   'For projects that need concept development, storytelling, systems thinking or an experimental technical direction.',
   'For projects that need concept development, storytelling, systems thinking or an experimental technical direction.',
   'Discuss an engagement', 'Send an enquiry', '#enquiry', '{}'::jsonb, true, true, 10),
  ('exhibition-documentation', 'photography', 'Photography', 'Exhibition Documentation',
   'Photography for exhibition archives, campaigns and installation records.',
   'Photography for exhibition archives, campaigns and installation records.',
   '£400–£800', 'Discuss the exhibition', '#enquiry',
   '{"examples":[{"label":"Into the Flux","href":"/photography/into-the-flux"},{"label":"RCA Gradshow in London","href":"/photography/rca-gradshow-in-london"},{"label":"Digital Direction","href":"/photography/digital-direction-rca-gradshow-in-white-city"}]}'::jsonb,
   true, true, 20),
  ('event-photography', 'photography', 'Photography', 'Event Photography',
   'For selected public, cultural and creative events.', 'For selected public, cultural and creative events.',
   '£400–£800', 'Discuss the event', '#enquiry',
   '{"examples":[{"label":"British Film Institute","href":"/photography/british-film-institute-london"},{"label":"Outernet London","href":"/photography/outernet-london-2025"},{"label":"England Women Football Team","href":"/photography/england-women-football-team-wins"}]}'::jsonb,
   true, true, 30),
  ('editorial-fashion-series', 'photography', 'Photography', 'Editorial and Fashion Series',
   'Open to paid assignments and selected collaborations with agencies and models.',
   'Open to paid assignments and selected collaborations with agencies and models.',
   'From £500/day', 'Discuss a shoot', '#enquiry',
   '{"examples":[{"label":"Uncanny Comforts with Emma","href":"/photography/uncanny-comforts-with-emma"},{"label":"Cries of an Unmarried Widow","href":"/photography/cries-of-an-unmarried-widow"}]}'::jsonb,
   true, true, 40),
  ('obsidian-tutoring', 'knowledge-systems', 'Obsidian and research systems', 'Obsidian Tutoring',
   'One-to-one help for learning Obsidian and building a system you can continue using yourself.',
   'One-to-one help for learning Obsidian and building a system you can continue using yourself.',
   '£60/hour', 'See tutoring and book', '/obsidian-tutoring', '{}'::jsonb, true, true, 50),
  ('research-workflow-consulting', 'knowledge-systems', 'Obsidian and research systems', 'Research Workflow Consulting',
   'For researchers and PhD students organising reading, notes, synthesis and writing.',
   'For researchers and PhD students organising reading, notes, synthesis and writing.',
   'From £150/hour', 'Send an enquiry', '#enquiry', '{}'::jsonb, true, true, 60),
  ('organisational-vault-design', 'knowledge-systems', 'Obsidian and research systems', 'Organisational Vault Design',
   'A bespoke Obsidian structure for complex creative or professional work.',
   'A bespoke Obsidian structure for complex creative or professional work.',
   'From £150/hour', 'Send an enquiry', '#enquiry', '{}'::jsonb, true, true, 70),
  ('visual-storytelling-masterclass', 'teaching', 'Teaching', 'Visual Storytelling Masterclass',
   'Three sessions covering narrative building, choosing a medium, research, outreach and distribution.',
   'Three sessions covering narrative building, choosing a medium, research, outreach and distribution.',
   '£600 · three sessions', 'Ask about the masterclass', '#enquiry',
   '{"session_price":"£200","sessions":3}'::jsonb, true, true, 80)
on conflict (lower(slug)) where slug is not null do update set
  category = excluded.category,
  service_group = excluded.service_group,
  title = excluded.title,
  content = excluded.content,
  summary = excluded.summary,
  price_label = excluded.price_label,
  cta_label = excluded.cta_label,
  cta_href = excluded.cta_href,
  items = excluded.items,
  featured = excluded.featured,
  published = excluded.published,
  sort_order = excluded.sort_order;

insert into public.homepage_archives (
  slug, title, active_period, change_summary, screenshot_url,
  interactive_path, sort_order, published
)
values
  ('text-led-portfolio', 'Text-led Portfolio', '2026',
   'A major shift toward a written introduction, selected writing and photography projects.',
   '/archive/homepages/text-led-portfolio.png', '/archive/homepages/text-led-portfolio', 10, true),
  ('visual-work-grid', 'Visual Work Grid', '2026',
   'A major grid-based homepage that brought work from several disciplines into one visual field.',
   '/archive/homepages/visual-work-grid.png', '/archive/homepages/visual-work-grid', 20, true)
on conflict (slug) do update set
  title = excluded.title,
  active_period = excluded.active_period,
  change_summary = excluded.change_summary,
  screenshot_url = excluded.screenshot_url,
  interactive_path = excluded.interactive_path,
  sort_order = excluded.sort_order,
  published = excluded.published;
