-- One row per artist. Insert/edit through the Supabase table editor.
-- Public visitors can read published profiles only; writes remain administrative.
create table public.art_globe_artists (
 id text primary key,
 name text not null check (length(trim(name)) > 0),
 origin text not null default '',
 current_city text not null,
 country text not null,
 latitude double precision not null check (latitude between -90 and 90),
 longitude double precision not null check (longitude between -180 and 180),
 disciplines text[] not null default '{}',
 tags text[] not null default '{}',
 biography text not null default '',
 artist_statement text not null default '',
 portfolio_url text,
 instagram_url text,
 public_email text,
 artwork_urls text[] not null default '{}',
 sources text[] not null default '{}',
 is_demo boolean not null default false,
 published boolean not null default false,
 created_at timestamptz not null default now()
);
alter table public.art_globe_artists enable row level security;
revoke all on public.art_globe_artists from anon, authenticated;
grant select on public.art_globe_artists to anon, authenticated;
grant all on public.art_globe_artists to service_role;
create policy "Read published artist profiles" on public.art_globe_artists for select to anon, authenticated using (published = true);
