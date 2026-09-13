begin;

-- Lab catalogue content now uses the same portable project document and
-- ordered block editor as the main portfolio. Existing user-authored projects
-- win: a matching slug is never overwritten by this seed.
with lab_seed(
  slug,
  title,
  featured_order,
  cover_url,
  cover_alt,
  description,
  context,
  contribution,
  status_label,
  destination,
  discipline_one,
  discipline_two
) as (
  values
    (
      'punctum',
      'Punctum',
      10,
      'https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/misc/gif/punctum-walkthrough-abodid-shorter-duration.gif',
      'Interactive walkthrough animation of the Punctum visual-attention experiment',
      'A participatory study of the detail in a photograph that catches, moves, or stays with each viewer.',
      'What can the detail that catches a viewer reveal about memory, attention, and the different ways people experience the same photograph?',
      'I designed and developed a participatory visual-attention experiment that lets people mark their punctum, describe it, and compare their response with a growing collective archive.',
      'Live',
      '/lab/punctum',
      'Visual attention',
      'Participatory AI'
    ),
    (
      'image-flick',
      'Image Flick',
      20,
      'https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/misc/gif/gesture-control-abodid-thumbnail-gif.gif',
      'A hand gesture controlling a stack of digital photographs',
      'A physics-led photo stack controlled by cursor movement, hand gestures, and an optional voice trigger.',
      'How might browsing a photography archive feel physical, playful, and immediate instead of behaving like a conventional image grid?',
      'I built a browser-based interaction system combining spring physics, cursor input, camera-tracked hand gestures, and an optional voice trigger.',
      'Prototype',
      '/lab/image-flick',
      'Gesture interface',
      'Photography'
    ),
    (
      'glyph-loom',
      'Glyph Loom',
      30,
      '/images/research/glyph-loom-cover.png',
      'Generative typography outlines in the Glyph Loom instrument',
      'A generative typography instrument that reconstructs live letterforms from modular bars, dots, crosses, and woven structures.',
      'What new typographic forms emerge when letter outlines are treated as a live structure rather than a fixed contour?',
      'I designed and coded an interactive browser instrument that samples letterforms and rebuilds them through modular visual systems in real time.',
      'Live',
      '/lab/glyph-loom',
      'Generative typography',
      'Creative coding'
    ),
    (
      'sequence-room',
      'Sequence Room',
      40,
      'https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/misc/video-clips/sequence-room-comp.mp4',
      'Interactive Sequence Room photo workspace preview',
      'An immersive table for scattering, rearranging, and discovering new relationships between photographs.',
      'How can a digital photo archive support the intuitive, spatial act of spreading pictures across a table and discovering an unexpected sequence?',
      'I designed and developed an immersive workspace with draggable photographs, spatial grouping, responsive colour, and shareable arrangements.',
      'Prototype',
      '/lab/sequence-room',
      'Photo archive',
      'Spatial interaction'
    ),
    (
      'second-brain',
      'Second Brain, Made Visible',
      50,
      '/images/obsidian-timelapse/frame-1.webp',
      'An interactive field of tags revealing connections inside an Obsidian knowledge system',
      'A living, cursor-led window into my Obsidian knowledge system, where movement reveals the ideas and connections shaping my work.',
      'How can a private, interconnected knowledge practice become a playful public interface without flattening the richness of the archive?',
      'I translated a live Obsidian vault into a responsive visual field where a wand-like cursor movement surfaces tags, themes, and traces of the system behind my creative practice.',
      'Live system',
      '/obsidian-vault',
      'Knowledge systems',
      'Creative technology'
    )
), documents as (
  select
    lab_seed.*,
    jsonb_build_object(
      'title', title,
      'oneLineDescription', description,
      'context', context,
      'specificContribution', contribution,
      'yearStart', 2026,
      'yearEnd', null,
      'location', 'Browser-based',
      'duration', 'Ongoing',
      'outcomeHeading', 'Status',
      'outcomeText', status_label,
      'workInProgress', false,
      'limitedPublic', false,
      'coverUrl', cover_url,
      'coverMedia', null,
      'coverAlt', cover_alt,
      'coverFocalX', 50,
      'coverFocalY', 50,
      'seoTitle', title || ' — Abodid Sahoo Media Lab',
      'metaDescription', description,
      'socialImageUrl', cover_url,
      'socialImageMedia', null,
      'searchVisible', true,
      'layoutStyle', 1,
      'blocks', jsonb_build_array(
        jsonb_build_object(
          'id', slug || '-story',
          'blockType', 'body_text',
          'content', jsonb_build_object('text', description),
          'settings', jsonb_build_object('width', 'wide', 'alignment', 'left', 'spacing', 'default'),
          'visible', true,
          'position', 0
        ),
        jsonb_build_object(
          'id', slug || '-idea',
          'blockType', 'highlight',
          'content', jsonb_build_object('text', context),
          'settings', jsonb_build_object('width', 'wide', 'alignment', 'left', 'spacing', 'default'),
          'visible', true,
          'position', 1
        ),
        jsonb_build_object(
          'id', slug || '-status',
          'blockType', 'outcome',
          'content', jsonb_build_object('heading', 'Status', 'text', status_label),
          'settings', jsonb_build_object('width', 'standard', 'alignment', 'left', 'spacing', 'default'),
          'visible', true,
          'position', 2
        ),
        jsonb_build_object(
          'id', slug || '-destination',
          'blockType', 'external_link',
          'content', jsonb_build_object('label', 'Open experiment', 'url', destination),
          'settings', jsonb_build_object('width', 'standard', 'alignment', 'left', 'spacing', 'compact'),
          'visible', true,
          'position', 3
        )
      ),
      'taxonomies', jsonb_build_array(
        jsonb_build_object('groupType', 'project_type', 'label', 'Lab', 'slug', 'lab'),
        jsonb_build_object('groupType', 'genre', 'label', discipline_one, 'slug', public.portfolio_slugify(discipline_one)),
        jsonb_build_object('groupType', 'genre', 'label', discipline_two, 'slug', public.portfolio_slugify(discipline_two)),
        jsonb_build_object('groupType', 'role', 'label', 'Creative Technologist', 'slug', 'creative-technologist')
      ),
      'organisations', '[]'::jsonb,
      'collaborators', '[]'::jsonb,
      'links', '[]'::jsonb
    ) as document
  from lab_seed
), inserted as (
  insert into public.portfolio_projects(
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
    document,
    document,
    1,
    0,
    now()
  from documents
  on conflict (slug) do nothing
  returning id, slug, title, content
)
insert into public.portfolio_project_backups(
  project_id,
  version_number,
  title,
  slug,
  content
)
select id, 1, title, slug, content
from inserted
on conflict (project_id, version_number) do nothing;

notify pgrst, 'reload schema';

commit;
