begin;

-- Landing-page cards should resolve to a deliberate destination:
-- portfolio projects live under /work, research lives under /research,
-- and standalone tools such as the Obsidian Vault keep their direct URL.
update public.home_storytelling_cards
set href = '/work/image-flick', updated_at = now()
where card_id = 'gesture-control';

with seed_projects(slug, title, featured_order, content) as (
  values
    (
      'into-the-flux',
      'Into the Flux',
      50,
      jsonb_build_object(
        'title', 'Into the Flux',
        'oneLineDescription', 'An abandoned London garage transformed into a public exhibition in two days.',
        'context', 'Transform an empty London garage into a safe, coherent public exhibition in two days, then create a photographic record that could extend the exhibition beyond the venue.',
        'specificContribution', 'I helped clear and prepare the space, paint and install walls, set up lighting and digital screens, troubleshoot the build, support health and safety, and photograph the completed exhibition and its visitors.',
        'yearStart', 2025,
        'yearEnd', null,
        'location', 'London',
        'duration', 'Two-day build',
        'outcomeHeading', 'Public exhibition',
        'outcomeText', '2,000+ visitors, with photographs used by the organisers across social media and as an archival record of the exhibition.',
        'workInProgress', false,
        'limitedPublic', false,
        'coverUrl', 'https://assets.abodid.com/photos/variants/exhibition-photos/1600/into-the-flux-iba-london103-baac9bdf57.webp',
        'coverAlt', 'Visitors inside the Into the Flux exhibition in London',
        'coverFocalX', 50,
        'coverFocalY', 50,
        'seoTitle', 'Into the Flux — Exhibition Production and Photography',
        'metaDescription', 'How an abandoned London garage became a public exhibition in two days through collaborative production, installation and photographic documentation.',
        'socialImageUrl', 'https://assets.abodid.com/photos/variants/exhibition-photos/1600/into-the-flux-iba-london103-baac9bdf57.webp',
        'searchVisible', true,
        'layoutStyle', 1,
        'taxonomies', jsonb_build_array(
          jsonb_build_object('slug', 'exhibition-experience', 'label', 'Exhibition experience', 'groupType', 'project_type'),
          jsonb_build_object('slug', 'exhibition-production', 'label', 'Exhibition production', 'groupType', 'role'),
          jsonb_build_object('slug', 'photographic-documentation', 'label', 'Photographic documentation', 'groupType', 'role'),
          jsonb_build_object('slug', 'spatial-design', 'label', 'Spatial design', 'groupType', 'genre')
        ),
        'organisations', jsonb_build_array(
          jsonb_build_object('name', 'International Body of Art', 'slug', 'international-body-of-art', 'url', '', 'relationshipLabel', 'Commissioning organisation', 'displayOrder', 0)
        ),
        'collaborators', '[]'::jsonb,
        'links', '[]'::jsonb,
        'blocks', jsonb_build_array(
          jsonb_build_object(
            'id', 'into-the-flux-story', 'blockType', 'body_text', 'visible', true, 'position', 0,
            'content', jsonb_build_object('text', 'The work moved between practical exhibition production and visual authorship: preparing the venue, supporting installation, solving technical problems and documenting how people encountered the finished space.'),
            'settings', jsonb_build_object('width', 'wide', 'alignment', 'left', 'spacing', 'default')
          ),
          jsonb_build_object(
            'id', 'into-the-flux-photography', 'blockType', 'external_link', 'visible', true, 'position', 1,
            'content', jsonb_build_object('label', 'View the photography series', 'url', '/photography/into-the-flux'),
            'settings', jsonb_build_object('width', 'standard', 'alignment', 'left', 'spacing', 'compact')
          ),
          jsonb_build_object(
            'id', 'into-the-flux-writing', 'blockType', 'external_link', 'visible', true, 'position', 2,
            'content', jsonb_build_object('label', 'Read the behind-the-scenes story', 'url', '/blog/from-an-abandoned-garage-into-the-hottest-exhibition-spot-in-london-in-just-two-days'),
            'settings', jsonb_build_object('width', 'standard', 'alignment', 'left', 'spacing', 'compact')
          )
        )
      )
    ),
    (
      'bfi',
      'British Film Institute',
      60,
      jsonb_build_object(
        'title', 'British Film Institute',
        'oneLineDescription', 'Human-centred photography for a four-day programme of immersive and expanded cinema.',
        'context', 'Create a human-centred photographic record of a four-day British Film Institute programme, preserving the atmosphere of immersive installations while showing how audiences moved through and responded to the work.',
        'specificContribution', 'I photographed the programme, its installations and audience encounters, shaping a visual narrative that balanced the scale of the venue with intimate, human moments.',
        'yearStart', 2024,
        'yearEnd', null,
        'location', 'London',
        'duration', 'Four days',
        'outcomeHeading', 'Cultural documentation',
        'outcomeText', 'The programme welcomed 20,000+ visitors across four days, and the photography was used across the institution’s website and internal pages.',
        'workInProgress', false,
        'limitedPublic', false,
        'coverUrl', 'https://assets.abodid.com/photos/variants/british-film-institute-london/1600/1769335964323_qjq8j2g9q-da588df8ed.webp',
        'coverAlt', 'Audience members experiencing an immersive programme at the British Film Institute',
        'coverFocalX', 50,
        'coverFocalY', 50,
        'seoTitle', 'British Film Institute — Cultural Documentation',
        'metaDescription', 'Human-centred photography and visual documentation for a four-day British Film Institute programme of immersive and expanded cinema.',
        'socialImageUrl', 'https://assets.abodid.com/photos/variants/british-film-institute-london/1600/1769335964323_qjq8j2g9q-da588df8ed.webp',
        'searchVisible', true,
        'layoutStyle', 1,
        'taxonomies', jsonb_build_array(
          jsonb_build_object('slug', 'cultural-documentation', 'label', 'Cultural documentation', 'groupType', 'project_type'),
          jsonb_build_object('slug', 'photographer', 'label', 'Photographer', 'groupType', 'role'),
          jsonb_build_object('slug', 'visual-storytelling', 'label', 'Visual storytelling', 'groupType', 'role'),
          jsonb_build_object('slug', 'expanded-cinema', 'label', 'Expanded cinema', 'groupType', 'genre')
        ),
        'organisations', jsonb_build_array(
          jsonb_build_object('name', 'British Film Institute', 'slug', 'british-film-institute', 'url', 'https://www.bfi.org.uk/', 'relationshipLabel', 'Cultural institution', 'displayOrder', 0)
        ),
        'collaborators', '[]'::jsonb,
        'links', '[]'::jsonb,
        'blocks', jsonb_build_array(
          jsonb_build_object(
            'id', 'bfi-story', 'blockType', 'body_text', 'visible', true, 'position', 0,
            'content', jsonb_build_object('text', 'The documentation moves between installations, architectural scale and moments of attention, showing the programme through the people experiencing it.'),
            'settings', jsonb_build_object('width', 'wide', 'alignment', 'left', 'spacing', 'default')
          ),
          jsonb_build_object(
            'id', 'bfi-photography', 'blockType', 'external_link', 'visible', true, 'position', 1,
            'content', jsonb_build_object('label', 'View the photography series', 'url', '/photography/british-film-institute-london'),
            'settings', jsonb_build_object('width', 'standard', 'alignment', 'left', 'spacing', 'compact')
          )
        )
      )
    ),
    (
      'show-me-the-way',
      'Show Me the Way',
      70,
      jsonb_build_object(
        'title', 'Show Me the Way',
        'oneLineDescription', 'A music video shaped through cinematography, visual effects and a tactile narrative language.',
        'context', 'Create a cinematic music video for the electronic-pop duo XY, combining performance, cinematography and visual effects into a distinctive story-led piece.',
        'specificContribution', 'I directed, shot and edited the film, and developed its colour and visual-effects language from production through final delivery.',
        'yearStart', 2024,
        'yearEnd', null,
        'location', 'India',
        'duration', '',
        'outcomeHeading', 'Broadcast',
        'outcomeText', 'The finished music video was broadcast in South Asia on VH1 and featured by Rolling Stone India.',
        'workInProgress', false,
        'limitedPublic', false,
        'coverUrl', 'https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/misc/video-thumbnails/show-me-the-way-vh1-india.webp',
        'coverAlt', 'Show Me the Way music video still broadcast on VH1',
        'coverFocalX', 50,
        'coverFocalY', 50,
        'seoTitle', 'Show Me the Way — Music Video',
        'metaDescription', 'Show Me the Way, a cinematic music video directed, shot, edited and finished with visual effects by Abodid Sahoo.',
        'socialImageUrl', 'https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/misc/video-thumbnails/show-me-the-way-vh1-india.webp',
        'searchVisible', true,
        'layoutStyle', 1,
        'taxonomies', jsonb_build_array(
          jsonb_build_object('slug', 'music-video', 'label', 'Music video', 'groupType', 'project_type'),
          jsonb_build_object('slug', 'director', 'label', 'Director', 'groupType', 'role'),
          jsonb_build_object('slug', 'dop', 'label', 'DOP', 'groupType', 'role'),
          jsonb_build_object('slug', 'editor', 'label', 'Editor', 'groupType', 'role'),
          jsonb_build_object('slug', 'visual-effects', 'label', 'Visual effects', 'groupType', 'genre')
        ),
        'organisations', '[]'::jsonb,
        'collaborators', '[]'::jsonb,
        'links', '[]'::jsonb,
        'blocks', jsonb_build_array(
          jsonb_build_object(
            'id', 'show-me-the-way-video', 'blockType', 'video_embed', 'visible', true, 'position', 0,
            'content', jsonb_build_object('url', 'https://www.youtube.com/watch?v=fooE0W_mFSY', 'caption', 'Show Me the Way — official music video', 'poster', 'https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/misc/video-thumbnails/show-me-the-way-vh1-india.webp'),
            'settings', jsonb_build_object('width', 'wide', 'alignment', 'left', 'spacing', 'default')
          ),
          jsonb_build_object(
            'id', 'show-me-the-way-film', 'blockType', 'external_link', 'visible', true, 'position', 1,
            'content', jsonb_build_object('label', 'Open the film page', 'url', '/films/show-me-the-way-vh1-india'),
            'settings', jsonb_build_object('width', 'standard', 'alignment', 'left', 'spacing', 'compact')
          )
        )
      )
    )
)
insert into public.portfolio_projects (
  slug,
  status,
  visibility,
  featured_order,
  storage_folder,
  title,
  content,
  published_content,
  published_version,
  lock_version,
  published_at
)
select
  slug,
  'published',
  'public',
  featured_order,
  slug,
  title,
  content,
  content,
  1,
  0,
  now()
from seed_projects
on conflict (slug) do nothing;

insert into public.portfolio_slug_redirects (old_slug, project_id)
select 'gesture-control', id
from public.portfolio_projects
where slug = 'image-flick'
on conflict (old_slug) do update
set project_id = excluded.project_id;

commit;
