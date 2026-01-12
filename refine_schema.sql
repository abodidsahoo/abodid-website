-- Refine Schema for Films and Code

-- 1. Add ROLE to Films
alter table public.films 
add column if not exists role text;

-- 2. Create PROJECTS table (for Code/Research)
create table if not exists public.projects (
  id uuid default uuid_generate_v4() primary key,
  slug text not null unique,
  title text not null,
  description text, -- Short summary
  content text,     -- Full details (Markdown)
  tags text[],
  link text,        -- Live URL
  repo_link text,   -- GitHub URL
  image text,
  sort_order integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  published boolean default false
);

-- 3. RLS for Projects
alter table public.projects enable row level security;

drop policy if exists "Public projects are viewable by everyone" on public.projects;
create policy "Public projects are viewable by everyone" on public.projects for select using (true);

-- 4. Seed Data (Optional - just to have something)
insert into public.projects (slug, title, description, content, tags, repo_link, published) values
('personal-portfolio', 'Personal Portfolio', 'Built with Astro, Supabase, and a custom design system.', '# Personal Portfolio\nThis site itself is an open-source project.', ARRAY['Astro', 'Supabase'], 'https://github.com/abodidsahoo/personal-site', true)
on conflict do nothing;

insert into public.films (title, description, role, year, published) values
('Metropolis Reimagined', 'A visual study of light.', 'Director & Editor', '2024', true)
on conflict do nothing;
