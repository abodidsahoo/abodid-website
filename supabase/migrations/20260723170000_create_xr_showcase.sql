-- XR Showcase: one-table content model with public reads and admin-only writes.
-- Automatic website metadata and manual image overrides both resolve into
-- effective_image_url, while tags remain a native text[] for fast filtering.

create extension if not exists pgcrypto;

create table if not exists public.xr_showcase_items (
    id uuid primary key default gen_random_uuid(),
    slug text not null unique,
    title text not null,
    description text not null default '',
    source_url text,
    canonical_url text,
    source_name text,
    source_domain text,
    primary_genre text not null default 'Creative Concepts',
    tags text[] not null default '{}'::text[],
    preview_image_url text,
    manual_image_url text,
    effective_image_url text generated always as (
        coalesce(
            nullif(btrim(manual_image_url), ''),
            nullif(btrim(preview_image_url), '')
        )
    ) stored,
    image_alt text,
    status text not null default 'draft',
    metadata_status text not null default 'pending',
    metadata_error text,
    metadata jsonb not null default '{}'::jsonb,
    featured boolean not null default false,
    sort_order integer not null default 0,
    search_document tsvector,
    published_at timestamptz,
    created_by uuid,
    updated_by uuid,
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now()),
    constraint xr_showcase_slug_format check (
        slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
        and char_length(slug) between 1 and 120
    ),
    constraint xr_showcase_title_length check (
        char_length(btrim(title)) between 1 and 180
    ),
    constraint xr_showcase_description_length check (
        char_length(description) <= 1200
    ),
    constraint xr_showcase_source_url_format check (
        source_url is null or source_url ~* '^https?://'
    ),
    constraint xr_showcase_canonical_url_format check (
        canonical_url is null or canonical_url ~* '^https?://'
    ),
    constraint xr_showcase_preview_url_format check (
        preview_image_url is null or preview_image_url ~* '^https?://'
    ),
    constraint xr_showcase_manual_url_format check (
        manual_image_url is null or manual_image_url ~* '^https?://'
    ),
    constraint xr_showcase_status_value check (
        status in ('draft', 'published', 'archived')
    ),
    constraint xr_showcase_metadata_status_value check (
        metadata_status in ('pending', 'ready', 'no_image', 'error')
    ),
    constraint xr_showcase_primary_genre_value check (
        primary_genre in (
            'Fashion XR',
            'Augmented Reality',
            'Virtual Reality',
            'Immersive Installation',
            'Retail',
            'Travel',
            'Museums & Culture',
            'Creative Concepts',
            'Research',
            'Audience Insight',
            'Education & Mentorship',
            'Funding'
        )
    ),
    constraint xr_showcase_tags_limit check (
        cardinality(tags) <= 30
    ),
    constraint xr_showcase_published_requires_url check (
        status <> 'published' or source_url is not null
    )
);

create unique index if not exists xr_showcase_source_url_unique
    on public.xr_showcase_items (source_url)
    where source_url is not null;

create index if not exists xr_showcase_public_order_idx
    on public.xr_showcase_items (status, sort_order, created_at);

create index if not exists xr_showcase_genre_idx
    on public.xr_showcase_items (primary_genre);

create index if not exists xr_showcase_tags_gin_idx
    on public.xr_showcase_items using gin (tags);

create index if not exists xr_showcase_search_gin_idx
    on public.xr_showcase_items using gin (search_document);

create or replace function public.set_xr_showcase_derived_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
    generated_slug text;
begin
    generated_slug := regexp_replace(
        regexp_replace(
            lower(
                translate(
                    coalesce(nullif(btrim(new.slug), ''), new.title),
                    'àáâãäåāăąçćčďđèéêëēĕėęěğìíîïīįıłñńňòóôõöøōőřśšşťùúûüūůűųýÿžźż',
                    'aaaaaaaaacccddeeeeeeeeegiiiiiiilnnnoooooooorssstuuuuuuuuyyzzz'
                )
            ),
            '[^a-z0-9]+',
            '-',
            'g'
        ),
        '(^-+|-+$)',
        '',
        'g'
    );
    if generated_slug = '' then
        generated_slug := 'xr-' || left(replace(new.id::text, '-', ''), 12);
    end if;
    new.slug := left(generated_slug, 120);

    select coalesce(array_agg(normalized.tag order by normalized.first_position), '{}'::text[])
    into new.tags
    from (
        select
            (array_agg(btrim(source_tag.value) order by source_tag.position))[1] as tag,
            min(source_tag.position) as first_position
        from unnest(coalesce(new.tags, '{}'::text[]))
            with ordinality as source_tag(value, position)
        where nullif(btrim(source_tag.value), '') is not null
        group by lower(btrim(source_tag.value))
    ) as normalized;

    new.search_document :=
        setweight(to_tsvector('simple', coalesce(new.title, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(new.primary_genre, '')), 'A') ||
        setweight(to_tsvector('simple', array_to_string(coalesce(new.tags, '{}'::text[]), ' ')), 'B') ||
        setweight(to_tsvector('simple', coalesce(new.description, '')), 'C') ||
        setweight(to_tsvector('simple', coalesce(new.source_name, '') || ' ' || coalesce(new.source_domain, '')), 'D');

    if new.status = 'published' and new.published_at is null then
        new.published_at := timezone('utc'::text, now());
    end if;
    if new.status <> 'published' then
        new.published_at := null;
    end if;

    if tg_op = 'INSERT' then
        new.created_by := coalesce(new.created_by, auth.uid());
    end if;
    new.updated_by := coalesce(auth.uid(), new.updated_by);
    new.updated_at := timezone('utc'::text, now());
    return new;
end;
$$;

drop trigger if exists trg_xr_showcase_derived_fields on public.xr_showcase_items;
create trigger trg_xr_showcase_derived_fields
before insert or update on public.xr_showcase_items
for each row
execute function public.set_xr_showcase_derived_fields();

alter table public.xr_showcase_items enable row level security;

drop policy if exists "Public can read published XR showcase items"
    on public.xr_showcase_items;
create policy "Public can read published XR showcase items"
    on public.xr_showcase_items
    for select
    to anon, authenticated
    using (status = 'published');

drop policy if exists "Admins can read all XR showcase items"
    on public.xr_showcase_items;
create policy "Admins can read all XR showcase items"
    on public.xr_showcase_items
    for select
    to authenticated
    using (
        exists (
            select 1
            from public.profiles
            where profiles.id = auth.uid()
              and profiles.role = 'admin'
        )
    );

drop policy if exists "Admins can insert XR showcase items"
    on public.xr_showcase_items;
create policy "Admins can insert XR showcase items"
    on public.xr_showcase_items
    for insert
    to authenticated
    with check (
        exists (
            select 1
            from public.profiles
            where profiles.id = auth.uid()
              and profiles.role = 'admin'
        )
    );

drop policy if exists "Admins can update XR showcase items"
    on public.xr_showcase_items;
create policy "Admins can update XR showcase items"
    on public.xr_showcase_items
    for update
    to authenticated
    using (
        exists (
            select 1
            from public.profiles
            where profiles.id = auth.uid()
              and profiles.role = 'admin'
        )
    )
    with check (
        exists (
            select 1
            from public.profiles
            where profiles.id = auth.uid()
              and profiles.role = 'admin'
        )
    );

drop policy if exists "Admins can delete XR showcase items"
    on public.xr_showcase_items;
create policy "Admins can delete XR showcase items"
    on public.xr_showcase_items
    for delete
    to authenticated
    using (
        exists (
            select 1
            from public.profiles
            where profiles.id = auth.uid()
              and profiles.role = 'admin'
        )
    );

revoke all on table public.xr_showcase_items from anon, authenticated;
grant select on table public.xr_showcase_items to anon;
grant select, insert, update, delete on table public.xr_showcase_items to authenticated;
grant all on table public.xr_showcase_items to service_role;

comment on table public.xr_showcase_items is
    'Single source of truth for public and draft XR Showcase references.';
comment on column public.xr_showcase_items.source_url is
    'The original link pasted into the admin editor.';
comment on column public.xr_showcase_items.preview_image_url is
    'Automatically discovered Open Graph, Twitter, structured-data or content image.';
comment on column public.xr_showcase_items.manual_image_url is
    'Optional manual override. When present, it wins over preview_image_url.';
comment on column public.xr_showcase_items.effective_image_url is
    'Read-only generated value used by the public card; manual override first, automatic preview second.';
comment on column public.xr_showcase_items.tags is
    'Admin-editable filter labels. Entered as individual chips and indexed with GIN.';
comment on column public.xr_showcase_items.metadata is
    'Raw enrichment context such as fetch time and provider-specific identifiers.';

insert into public.xr_showcase_items (
    slug,
    title,
    description,
    source_url,
    canonical_url,
    source_name,
    source_domain,
    primary_genre,
    tags,
    preview_image_url,
    image_alt,
    status,
    metadata_status,
    sort_order,
    featured
)
values
  ('projection-mapping-latex', 'Projection Mapping on Latex', 'Using latex as a canvas for projected moving images and visuals as part of an installation.', null, null, null, null, 'Creative Concepts', array['Harri', 'Projection Mapping', 'Installation', 'Creative Concept']::text[], null, 'Projection Mapping on Latex preview image', 'draft', 'pending', 0, false),
  ('cafe-buransh-mr-travel-guide', 'Cafe Buransh MR Travel Guide', 'A LumeXR mixed-reality travel case study created around Cafe Buransh.', 'https://www.youtube.com/watch?v=pvh-Ith1Vrs', 'https://www.youtube.com/watch?v=pvh-Ith1Vrs', 'YouTube', 'youtube.com', 'Travel', array['Travel', 'Mixed Reality', 'Case Study']::text[], 'https://i.ytimg.com/vi/pvh-Ith1Vrs/maxresdefault.jpg', 'Cafe Buransh MR Travel Guide preview image', 'published', 'ready', 10, false),
  ('oxytocine-machine', 'The Oxytocine Machine', 'A project combining light installation and virtual reality to explore social connection.', 'https://www.studio-vrij.com/en/projecten/oxytocine-machine', 'https://www.studio-vrij.com/en/projecten/oxytocine-machine', 'studio-vrij.com', 'studio-vrij.com', 'Immersive Installation', array['Virtual Reality', 'Light Installation', 'Social XR', 'Visual Reference']::text[], 'https://cdn.prod.website-files.com/6828ca4de4eedca9a6b7839b/6a0ca5f05091b719d1a0d292_oxytocine-machine-VR-installation-inflatable-cocoon-Katoenhuis-Studio-Vrij.avif', 'The Oxytocine Machine preview image', 'published', 'ready', 20, false),
  ('eurydice-descent-infinity', 'Eurydice, A Descent Into Infinity', 'A VR opera with a distinctive visual style and approach to interaction.', 'https://www.labiennale.org/en/cinema/2022/venice-immersive/eurydice-een-afdaling-oneindigheid-eurydice-descent-infinity', 'https://www.labiennale.org/en/cinema/2022/venice-immersive/eurydice-een-afdaling-oneindigheid-eurydice-descent-infinity', 'La Biennale di Venezia', 'labiennale.org', 'Virtual Reality', array['VR Opera', 'Performance', 'Visual Reference']::text[], 'https://static.labiennale.org/files/styles/seo_thumbnail/public/cinema/2022/Schede_film/970x647/Venice_Immersive/daemen_.jpg?itok=82bMSMjG', 'Eurydice, A Descent Into Infinity preview image', 'published', 'ready', 30, false),
  ('multiverse-bakery', 'The Multiverse Bakery', 'An animated virtual-reality short exploring magic, alchemy, and imagined worlds.', 'https://studiosyro.com/tales-from-soda-island/the-multiverse-bakery', 'https://studiosyro.com/tales-from-soda-island/the-multiverse-bakery', 'Studio Syro', 'studiosyro.com', 'Virtual Reality', array['VR Animation', 'Immersive Film', 'Visual Reference']::text[], 'https://static1.squarespace.com/static/67955b705a944f59c065f900/67db1e0ff64e2b0f18945f24/67db1e0ff64e2b0f18945fba/1743460091521/1_TheMultiverseBakery_notimecode.png?format=1500w', 'The Multiverse Bakery preview image', 'published', 'ready', 40, false),
  ('loook-ai', 'loook.ai', 'An augmented-reality mirror platform with fashion and retail applications.', 'https://www.instagram.com/loook.ai/', 'https://www.instagram.com/loook.ai/', 'instagram.com', 'instagram.com', 'Fashion XR', array['Fashion', 'Augmented Reality', 'AR Mirror', 'Technology Reference']::text[], 'https://scontent.cdninstagram.com/v/t51.2885-19/474389220_3805271719788020_5322880656898071446_n.jpg?stp=dst-jpg_s100x100_tt6&_nc_cat=105&ccb=7-5&_nc_sid=bf7eb4&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLnd3dy4xMDgwLkMzIn0%3D&_nc_ohc=51LEX3hucasQ7kNvwEs3WQp&_nc_oc=AdroUeG1dkGV8_bKBtGB0OGYE9BjxcbmcUylrQEYJTUXTZFMvv2HE0I45NIwdeoOkbY&_nc_zt=24&_nc_ht=scontent.cdninstagram.com&_nc_ss=7c689&oh=00_AQAca6bY4P1_TMml3PCx1-UHhkpFxx7zdfuIou8c4rRFVg&oe=6A67C842', 'loook.ai preview image', 'published', 'ready', 50, false),
  ('inside-felix-paul-studios', 'Inside Felix & Paul Studios', 'A behind-the-scenes video series about one of the most established immersive-media studios.', 'https://www.youtube.com/watch?v=RIlAHMXrmHc&list=PLrgNJiDpkRKaQtwSItzSwudeW-Nr7XWg5', 'https://www.youtube.com/watch?v=RIlAHMXrmHc&list=PLrgNJiDpkRKaQtwSItzSwudeW-Nr7XWg5', 'YouTube', 'youtube.com', 'Creative Concepts', array['Immersive Media', 'Studio Practice', 'Technology Reference']::text[], 'https://i.ytimg.com/vi/RIlAHMXrmHc/maxresdefault.jpg', 'Inside Felix & Paul Studios preview image', 'published', 'ready', 60, false),
  ('end-to-end-immersive-media', 'End-to-End Immersive Media Value Proposition', 'An immersive-media project combining exhibition-making, audiovisual production, and spatial experience.', 'https://abodid.com/blog/from-an-abandoned-garage-into-the-hottest-exhibition-spot-in-london-in-just-two-days', 'https://abodid.com/blog/from-an-abandoned-garage-into-the-hottest-exhibition-spot-in-london-in-just-two-days', 'abodid.com', 'abodid.com', 'Immersive Installation', array['Installation', 'Exhibition', 'Immersive Media', 'Case Study']::text[], 'https://abodid.com/api/og?title=From+an+abandoned+garage+into+the+hottest+exhibition+spot+in+London+in+just+two+days%21+%7C+Abodid+Sahoo&description=I+helped+turn+an+empty%2C+messy+space+into+a+full-blown+exhibition%2C+and+then+documented+the+whole+thing.+The+best+part%3F+My+photos+made+it+to+the+official+social+media+pages.&image=https%3A%2F%2Fjwipqbjxpmgyevfzpjjx.supabase.co%2Fstorage%2Fv1%2Fobject%2Fpublic%2Fblog%2Fcovers%2F1768388109568_dwd696tcj.webp', 'End-to-End Immersive Media Value Proposition preview image', 'published', 'ready', 70, false),
  ('digital-materialism-gen-z', 'Exploring Retail Through Immersive Fashion', 'Research into digital materialism and how Gen Z audiences are creating pathways towards XR and virtual-production acceptance.', 'https://www.fialondon.com/projects/digital-materialism-and-how-gen-z-are-building-pathways-to-xr-and-vp-acceptance/', 'https://www.fialondon.com/projects/digital-materialism-and-how-gen-z-are-building-pathways-to-xr-and-vp-acceptance/', 'Fashion Innovation Agency', 'fialondon.com', 'Fashion XR', array['Fashion', 'Retail', 'XR', 'Virtual Production', 'Research', 'Mentorship', 'Harri']::text[], 'https://www.fialondon.com/wp-content/uploads/2024/04/Screenshot-2024-04-03-at-11.53.53.png', 'Exploring Retail Through Immersive Fashion preview image', 'published', 'ready', 80, false),
  ('fashion-innovation-agency', 'FIA - Disrupting Existing Practices in Fashion and Retail', 'An overview of the Fashion Innovation Agency and its work across technology, fashion, retail, and emerging media.', 'https://www.fialondon.com/about-the-fashion-innovation-agency/', 'https://www.fialondon.com/about-the-fashion-innovation-agency/', 'Fashion Innovation Agency', 'fialondon.com', 'Fashion XR', array['Fashion', 'Retail', 'Mentorship', 'Technology', 'Harri']::text[], 'https://www.fialondon.com/wp-content/uploads/2020/09/Screenshot-2020-09-16-at-10.03.30.png', 'FIA - Disrupting Existing Practices in Fashion and Retail preview image', 'published', 'ready', 90, false),
  ('xr-network-plus-funding', 'XR Network+ Funding', 'A funding and research network supporting innovation in extended reality.', 'https://xrnetworkplus.xrstories.co.uk/', 'https://xrnetworkplus.xrstories.co.uk/', 'XR Network+', 'xrnetworkplus.xrstories.co.uk', 'Funding', array['Funding', 'Research Network', 'XR']::text[], null, 'XR Network+ Funding preview image', 'published', 'no_image', 100, false),
  ('fyodor-golan-microsoft', 'A Catwalk Show Augmented by Real-Time Computer Graphics', 'A fashion presentation combining a physical catwalk with live, real-time computer-generated visuals.', 'https://www.fialondon.com/projects/fyodor-golan-x-microsoft/', 'https://www.fialondon.com/projects/fyodor-golan-x-microsoft/', 'Fashion Innovation Agency', 'fialondon.com', 'Fashion XR', array['Fashion', 'Real-Time Graphics', 'Creative Concept', 'Catwalk']::text[], 'https://www.fialondon.com/wp-content/uploads/2020/09/green_phone.png', 'A Catwalk Show Augmented by Real-Time Computer Graphics preview image', 'published', 'ready', 110, false),
  ('digital-fashion-cloth-simulation', 'Digital Fashion and Cloth Simulation', 'A collaboration exploring digital garments, cloth simulation, and fashion visualisation.', 'https://www.fialondon.com/projects/sadie-clayton-x-the-fabricant-x-clo/', 'https://www.fialondon.com/projects/sadie-clayton-x-the-fabricant-x-clo/', 'Fashion Innovation Agency', 'fialondon.com', 'Fashion XR', array['Fashion', 'Cloth Simulation', 'The Fabricant', 'CLO', 'Harri']::text[], 'https://www.fialondon.com/wp-content/uploads/2020/09/SadieClayton_SS16_Lookbook4-scaled.jpg', 'Digital Fashion and Cloth Simulation preview image', 'published', 'ready', 120, false),
  ('steventai-ilmxlab', 'Creating a Metaverse at London Fashion Week', 'A London Fashion Week project combining fashion presentation, virtual environments, and immersive technology.', 'https://www.fialondon.com/projects/steventai-x-ilmxlab/', 'https://www.fialondon.com/projects/steventai-x-ilmxlab/', 'Fashion Innovation Agency', 'fialondon.com', 'Fashion XR', array['Fashion', 'Metaverse', 'London Fashion Week', 'Creative Concept', 'Harri']::text[], 'https://www.fialondon.com/wp-content/uploads/2020/09/DSCF8942-scaled.jpg', 'Creating a Metaverse at London Fashion Week preview image', 'published', 'ready', 130, false),
  ('steventai-digitally-augmented-presentation', 'STEVENTAI Debuts Digitally Augmented Fashion Presentation', 'Coverage of STEVENTAI''s digitally augmented approach to presenting a fashion collection.', 'https://www.interlaced.co/article/steventai-debuts-digitally-augmented-fashion-presentation', 'https://www.interlaced.co/article/steventai-debuts-digitally-augmented-fashion-presentation', 'interlaced.co', 'interlaced.co', 'Fashion XR', array['Fashion', 'Augmented Presentation', 'Creative Concept', 'Harri']::text[], 'https://www.interlaced.co/assets/images/steventaiILMxLAB_KRL4816-1080x675.jpg', 'STEVENTAI Debuts Digitally Augmented Fashion Presentation preview image', 'published', 'ready', 140, false),
  ('fashion-twinmotion', 'Visualising Fashion in Real Time with Twinmotion', 'A case study exploring real-time fashion visualisation using Twinmotion.', 'https://www.fialondon.com/projects/visualising-fashion-in-real-time-with-twinmotion/', 'https://www.fialondon.com/projects/visualising-fashion-in-real-time-with-twinmotion/', 'Fashion Innovation Agency', 'fialondon.com', 'Fashion XR', array['Fashion', 'Twinmotion', 'Real-Time Graphics', 'Case Study', 'Harri']::text[], 'https://www.fialondon.com/wp-content/uploads/2025/09/Image44.png', 'Visualising Fashion in Real Time with Twinmotion preview image', 'published', 'ready', 150, false),
  ('westfield-destination-2028', 'Westfield Destination 2028 - A Vision for the Future of Retail', 'A speculative project examining how future retail destinations could combine physical and digital experiences.', 'https://www.fialondon.com/projects/westfield-destination-2028/', 'https://www.fialondon.com/projects/westfield-destination-2028/', 'Fashion Innovation Agency', 'fialondon.com', 'Retail', array['Retail', 'Future Experience', 'Travel', 'Case Study']::text[], 'https://www.fialondon.com/wp-content/uploads/2020/09/Westfield-Exterior.jpg-768x461.png', 'Westfield Destination 2028 - A Vision for the Future of Retail preview image', 'published', 'ready', 160, false),
  ('fia-mentorship-reachout', 'Fashion Innovation Agency Mentorship', 'A reference for potential mentorship, collaboration, or professional outreach.', 'https://www.instagram.com/fashioninnovationagency/', 'https://www.instagram.com/fashioninnovationagency/', 'instagram.com', 'instagram.com', 'Education & Mentorship', array['Fashion', 'Mentorship', 'Professional Outreach', 'Harri']::text[], 'https://scontent.cdninstagram.com/v/t51.2885-19/65057371_433715100513716_4912551398089949184_n.jpg?stp=dst-jpg_s100x100_tt6&_nc_cat=106&ccb=7-5&_nc_sid=bf7eb4&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLnd3dy45MTcuQzMifQ%3D%3D&_nc_ohc=AsoIaHAf7VcQ7kNvwFijWTQ&_nc_oc=AdqaeFDDqxfWpVPT0_2KswVAw6Atu9jd8TB8jkFmpeQQnH6o49YE0P8XHzUeJq0mMWw&_nc_zt=24&_nc_ht=scontent.cdninstagram.com&_nc_ss=7c689&oh=00_AQC5nORTlsf-Ozw8hQQMld6gnlqWBMXUu9dS9nVkaWQBjw&oe=6A67BA69', 'Fashion Innovation Agency Mentorship preview image', 'published', 'ready', 170, false),
  ('immersive-art-exhibitions-awful', 'Immersive Art Exhibitions Are Everywhere and They''re Awful', 'A critical article examining recurring problems in commercially produced immersive art exhibitions.', 'https://www.vice.com/en/article/why-immersive-art-exhibitions-are-awful/', 'https://www.vice.com/en/article/why-immersive-art-exhibitions-are-awful/', 'VICE', 'vice.com', 'Audience Insight', array['Critical Essay', 'Immersive Art', 'Audience Insight']::text[], 'https://www.vice.com/wp-content/uploads/sites/2/2023/01/1674730436399-gettyimages-1244236885.jpeg?resize=2000,1331', 'Immersive Art Exhibitions Are Everywhere and They''re Awful preview image', 'published', 'ready', 180, false),
  ('rca-snap-augmented-unrealities', 'RCA x Snap - Augmented UnRealities', 'A Royal College of Art and Snap collaboration exploring experimental augmented-reality practices.', 'https://www.rca.ac.uk/business/case-studies/rca-x-snap-augmented-unrealities/', 'https://www.rca.ac.uk/business/case-studies/rca-x-snap-augmented-unrealities/', 'RCA Website', 'rca.ac.uk', 'Augmented Reality', array['RCA', 'Snap', 'Augmented Reality', 'Education', 'Mentorship']::text[], 'https://rca-media2.rca.ac.uk/images/14_sdjteBg.2a6cc853.fill-1200x1200.jpg', 'RCA x Snap - Augmented UnRealities preview image', 'published', 'ready', 190, false),
  ('unfinished-bodies-ar-research', 'Unfinished Bodies - Research on AR and Immersive Experiences', 'Research into augmented reality, immersive experience, bodies, and curatorial practice.', 'https://blogs.ed.ac.uk/s2706336_curating-2024-2025sem2/2025/03/29/026-week-11-research-on-ar-and-immersive-experiences/', 'https://blogs.ed.ac.uk/s2706336_curating-2024-2025sem2/2025/03/29/026-week-11-research-on-ar-and-immersive-experiences/', 'blogs.ed.ac.uk', 'blogs.ed.ac.uk', 'Research', array['Augmented Reality', 'Curatorial Research', 'Immersive Experience']::text[], 'https://blogs.ed.ac.uk/s2706336_curating-2024-2025sem2/wp-content/uploads/sites/11193/2025/02/WechatIMG1139-1.jpg', 'Unfinished Bodies - Research on AR and Immersive Experiences preview image', 'published', 'ready', 200, false),
  ('sciencedirect-immersive-technology', 'ScienceDirect Article on Immersive Technology', 'An academic reference examining immersive technology and user experience.', 'https://www.sciencedirect.com/science/article/pii/S0747563221002740?via%3Dihub', 'https://www.sciencedirect.com/science/article/pii/S0747563221002740?via%3Dihub', 'sciencedirect.com', 'sciencedirect.com', 'Research', array['Academic Research', 'Immersive Technology', 'Case Study']::text[], null, 'ScienceDirect Article on Immersive Technology preview image', 'published', 'no_image', 210, false),
  ('immersive-multimedia-art-intelligent-vr', 'Application of Immersive Multimedia Art', 'Research into immersive multimedia art design using intelligent virtual-reality technology.', 'https://www.researchgate.net/publication/391945161_Research_on_the_Application_of_Immersive_Multimedia_Art_Design_Based_on_Intelligent_VR_Technology', 'https://www.researchgate.net/publication/391945161_Research_on_the_Application_of_Immersive_Multimedia_Art_Design_Based_on_Intelligent_VR_Technology', 'researchgate.net', 'researchgate.net', 'Research', array['Academic Research', 'Virtual Reality', 'Multimedia Art']::text[], null, 'Application of Immersive Multimedia Art preview image', 'published', 'no_image', 220, false),
  ('present-futures-rca', 'Present Futures: Virtual and Augmented Reality in Art', 'An RCA programme examining virtual reality and augmented reality within contemporary art practice.', 'https://www.rca.ac.uk/study/programme-finder/present-futures-virtual-and-augmented-reality-in-art/', 'https://www.rca.ac.uk/study/programme-finder/', 'RCA Website', 'rca.ac.uk', 'Education & Mentorship', array['RCA', 'Education', 'Virtual Reality', 'Augmented Reality']::text[], 'https://rca-media2.rca.ac.uk/images/RCA_7-19_1831_low_res.2e16d0ba.fill-1200x1200.jpg', 'Present Futures: Virtual and Augmented Reality in Art preview image', 'published', 'ready', 230, false),
  ('museums-using-ar', 'How Museums Are Using Augmented Reality', 'Examples of museums using augmented reality for interpretation, engagement, and visitor experience.', 'https://www.museumnext.com/article/how-museums-are-using-augmented-reality/', 'https://www.museumnext.com/article/how-museums-are-using-augmented-reality/', 'MuseumNext', 'museumnext.com', 'Museums & Culture', array['Museums', 'Augmented Reality', 'Visitor Experience', 'Case Study']::text[], 'https://www.museumnext.com/wp-content/uploads/2024/04/museum_using_augmented_reality.jpg', 'How Museums Are Using Augmented Reality preview image', 'published', 'ready', 240, false),
  ('vr-art-exhibition-user-experience', 'Investigating User Experience of VR Art Exhibitions', 'An academic study examining how audiences experience virtual-reality art exhibitions.', 'https://www.mdpi.com/2227-9709/11/2/30', 'https://www.mdpi.com/2227-9709/11/2/30', 'mdpi.com', 'mdpi.com', 'Audience Insight', array['Virtual Reality', 'Art Exhibition', 'User Experience', 'Research']::text[], null, 'Investigating User Experience of VR Art Exhibitions preview image', 'published', 'no_image', 250, false),
  ('frameless-whats-on', 'What''s On at FRAMELESS', 'Current immersive art experiences and installations presented by FRAMELESS in London.', 'https://frameless.com/whats-on/', 'https://frameless.com/whats-on/', 'frameless.com', 'frameless.com', 'Immersive Installation', array['Immersive Exhibition', 'Installation', 'London', 'Visual Reference']::text[], 'https://frameless.com/Frameless_Share_1200X600.png', 'What''s On at FRAMELESS preview image', 'published', 'ready', 260, false)
on conflict (slug) do nothing;
