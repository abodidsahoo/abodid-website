-- Fills sample markdown stories for unlocked rows in public.photo_stories.
-- It does NOT mark rows as manually locked (green). Only manual Update Story should do that.
--
-- Safety bootstrap:
-- If sample-story migrations were not applied yet, add missing columns so this
-- script can run standalone.
alter table public.photo_stories
    add column if not exists sample_story_markdown text not null default '',
    add column if not exists is_story_locked boolean not null default false,
    add column if not exists is_art boolean not null default false,
    add column if not exists is_commercial boolean not null default false,
    add column if not exists genre text;

-- Preserve existing manual stories as locked if lock state was not present before.
update public.photo_stories
set is_story_locked = true
where coalesce(trim(story_markdown), '') <> ''
  and coalesce(is_story_locked, false) = false;
--
-- Allotment strategy:
-- 1) infer genre from title/slug/category/tags (+ existing labels when present)
-- 2) randomize targets inside each genre
-- 3) randomize a large template pool per genre
-- 4) assign templates in round-robin by genre so coverage is even before repeats
--
-- Testing re-randomization:
-- force_regenerate defaults to true so each run refreshes unlocked sample stories.
-- set it to false if you only want to fill empty sample_story_markdown rows.

with settings as (
    select true::boolean as force_regenerate
),
matched as (
    select
        ps.id,
        ps.photo_url,
        coalesce(nullif(trim(ph.title), ''), 'Untitled Series') as series_title,
        lower(
            concat_ws(
                ' ',
                coalesce(ph.title, ''),
                coalesce(ph.slug, ''),
                coalesce(ph.category::text, ''),
                coalesce(ph.tags::text, ''),
                coalesce(ps.genre, '')
            )
        ) as context_text,
        case
            when coalesce(ps.is_commercial, false) = true then 'commercial'
            when lower(coalesce(trim(ps.genre), '')) in (
                'fashion',
                'exhibition',
                'travel',
                'street',
                'portrait',
                'documentary',
                'performance',
                'architecture',
                'nature',
                'commercial',
                'nightlife',
                'experimental'
            ) then lower(trim(ps.genre))
            when lower(
                concat_ws(
                    ' ',
                    coalesce(ph.title, ''),
                    coalesce(ph.slug, ''),
                    coalesce(ph.category::text, ''),
                    coalesce(ph.tags::text, ''),
                    coalesce(ps.genre, '')
                )
            ) ~ '(fashion|runway|catwalk|editorial|lookbook|styling|couture)' then 'fashion'
            when lower(
                concat_ws(
                    ' ',
                    coalesce(ph.title, ''),
                    coalesce(ph.slug, ''),
                    coalesce(ph.category::text, ''),
                    coalesce(ph.tags::text, ''),
                    coalesce(ps.genre, '')
                )
            ) ~ '(exhibition|gallery|museum|biennale|showcase|graduate show|grad show|degree show|installation)' then 'exhibition'
            when lower(
                concat_ws(
                    ' ',
                    coalesce(ph.title, ''),
                    coalesce(ph.slug, ''),
                    coalesce(ph.category::text, ''),
                    coalesce(ph.tags::text, ''),
                    coalesce(ps.genre, '')
                )
            ) ~ '(travel|journey|trip|city|abroad|airport|station|road|coast|voyage)' then 'travel'
            when lower(
                concat_ws(
                    ' ',
                    coalesce(ph.title, ''),
                    coalesce(ph.slug, ''),
                    coalesce(ph.category::text, ''),
                    coalesce(ph.tags::text, ''),
                    coalesce(ps.genre, '')
                )
            ) ~ '(street|urban|sidewalk|alley|market|crosswalk|public)' then 'street'
            when lower(
                concat_ws(
                    ' ',
                    coalesce(ph.title, ''),
                    coalesce(ph.slug, ''),
                    coalesce(ph.category::text, ''),
                    coalesce(ph.tags::text, ''),
                    coalesce(ps.genre, '')
                )
            ) ~ '(portrait|face|self|identity|body|gaze)' then 'portrait'
            when lower(
                concat_ws(
                    ' ',
                    coalesce(ph.title, ''),
                    coalesce(ph.slug, ''),
                    coalesce(ph.category::text, ''),
                    coalesce(ph.tags::text, ''),
                    coalesce(ps.genre, '')
                )
            ) ~ '(documentary|archive|memory|ritual|community|witness)' then 'documentary'
            when lower(
                concat_ws(
                    ' ',
                    coalesce(ph.title, ''),
                    coalesce(ph.slug, ''),
                    coalesce(ph.category::text, ''),
                    coalesce(ph.tags::text, ''),
                    coalesce(ps.genre, '')
                )
            ) ~ '(performance|dance|theatre|stage|concert|music|choreography)' then 'performance'
            when lower(
                concat_ws(
                    ' ',
                    coalesce(ph.title, ''),
                    coalesce(ph.slug, ''),
                    coalesce(ph.category::text, ''),
                    coalesce(ph.tags::text, ''),
                    coalesce(ps.genre, '')
                )
            ) ~ '(architecture|building|interior|structure|spatial|corridor|facade)' then 'architecture'
            when lower(
                concat_ws(
                    ' ',
                    coalesce(ph.title, ''),
                    coalesce(ph.slug, ''),
                    coalesce(ph.category::text, ''),
                    coalesce(ph.tags::text, ''),
                    coalesce(ps.genre, '')
                )
            ) ~ '(landscape|nature|forest|river|mountain|sea|outdoor|park)' then 'nature'
            when lower(
                concat_ws(
                    ' ',
                    coalesce(ph.title, ''),
                    coalesce(ph.slug, ''),
                    coalesce(ph.category::text, ''),
                    coalesce(ph.tags::text, ''),
                    coalesce(ps.genre, '')
                )
            ) ~ '(night|nocturne|neon|after dark|midnight|club)' then 'nightlife'
            else 'experimental'
        end as inferred_genre
    from public.photo_stories ps
    left join lateral (
        select p.title, p.slug, p.category, p.tags
        from public.photography p
        where p.cover_image = ps.photo_url
           or exists (
                select 1
                from jsonb_array_elements(
                    case
                        when jsonb_typeof(p.gallery_images) = 'array' then p.gallery_images
                        else '[]'::jsonb
                    end
                ) g(item)
                where g.item ->> 'url' = ps.photo_url
           )
        order by p.created_at desc nulls last
        limit 1
    ) ph on true
    cross join settings s
    where coalesce(ps.is_story_locked, false) = false
      and coalesce(trim(ps.story_markdown), '') = ''
      and (s.force_regenerate or coalesce(trim(ps.sample_story_markdown), '') = '')
),
template_bank as (
    select *
    from (
        values
            -- fashion (6)
            ('fashion', 'In "{title}", styling becomes a language of posture, tension, and permission. I framed this moment to keep the gesture louder than the garment.'),
            ('fashion', '"{title}" began as surface, but the frame kept pulling me toward vulnerability and control. The silhouette here feels like a negotiation, not a costume.'),
            ('fashion', 'While shooting "{title}", I treated the runway like a moving essay on identity. The image holds that split second when confidence and fragility meet.'),
            ('fashion', 'I made this frame during "{title}" to keep texture, body, and attitude in one sentence. It is less about trend and more about who is allowed to occupy space.'),
            ('fashion', '"{title}" pushed me to photograph style as behavior, not just appearance. The pose is composed, but the emotion inside it stays intentionally unresolved.'),
            ('fashion', 'This still from "{title}" carries the rhythm of backstage decisions. Every fold and glance reads like a small argument about visibility.'),

            -- exhibition (6)
            ('exhibition', 'I photographed this in "{title}" while the room moved between quiet looking and strong opinions. The frame keeps that museum tension alive.'),
            ('exhibition', 'During "{title}", this wall felt like a stage for slow conversations. I kept the composition open so viewers could bring their own reading.'),
            ('exhibition', 'This image from "{title}" sits between documentation and interpretation. I wanted the installation energy without flattening it into proof.'),
            ('exhibition', '"{title}" taught me that display is never neutral. The frame records how light, distance, and audience behavior reshape meaning.'),
            ('exhibition', 'I shot this moment in "{title}" when the gallery became less formal and more intimate. That shift is the real subject for me.'),
            ('exhibition', 'Inside "{title}", this photograph arrived as a pause between two crowds. It reads like evidence of attention rather than spectacle.'),

            -- travel (6)
            ('travel', 'I made this image during "{title}" while moving through unfamiliar streets with a familiar camera rhythm. The frame keeps the feeling of transit intact.'),
            ('travel', '"{title}" was full of small encounters that changed the day. This shot holds one of those moments where place and mood lock together.'),
            ('travel', 'This frame from "{title}" is about orientation as much as scenery. I wanted the viewer to feel both wonder and slight dislocation.'),
            ('travel', 'In "{title}", I kept photographing thresholds: stations, corners, crossings, pauses. This image holds that in-between state I was chasing.'),
            ('travel', 'I took this during "{title}" to preserve how the city introduced itself over time. The photograph is a map of attention, not just location.'),
            ('travel', 'While working on "{title}", I treated movement as the main character. The scene stays still, but the emotional momentum keeps travelling forward.'),

            -- street (4)
            ('street', '"{title}" gave me a street scene where ordinary gestures carried unusual weight. I framed it fast, but I edited it slowly.'),
            ('street', 'This moment in "{title}" happened in public view and private feeling at once. The sidewalk became a stage without warning.'),
            ('street', 'I shot this during "{title}" when traffic, bodies, and weather aligned for a second. The image keeps that fragile timing.'),
            ('street', 'For "{title}", I wanted a street frame that felt conversational instead of dramatic. The eye contact and spacing do most of the storytelling.'),

            -- portrait (4)
            ('portrait', 'In "{title}", I approached this portrait as a collaboration, not extraction. The expression settles somewhere between guard and openness.'),
            ('portrait', 'This portrait from "{title}" is built around gaze and breathing room. I left enough silence in the frame for complexity to stay visible.'),
            ('portrait', 'I photographed this face in "{title}" to keep presence stronger than polish. The light reveals detail, but the mood resists easy labels.'),
            ('portrait', '"{title}" reminded me that portraiture is also about distance and trust. This image holds both without forcing closure.'),

            -- documentary (4)
            ('documentary', 'I made this documentary frame in "{title}" to preserve context alongside emotion. The scene reads like testimony rather than spectacle.'),
            ('documentary', 'During "{title}", this moment felt historically small but personally sharp. I kept it because memory often hides inside ordinary details.'),
            ('documentary', 'This image from "{title}" sits close to witness work for me. I tried to stay precise without pretending to be neutral.'),
            ('documentary', 'In "{title}", I used the camera as an archive tool and a listening tool. The result carries both record and reflection.'),

            -- performance (3)
            ('performance', 'I shot this in "{title}" when movement and stillness kept trading places. The frame captures choreography, but also concentration.'),
            ('performance', '"{title}" gave me a performance moment where timing mattered more than perfection. You can feel the breath right before the next action.'),
            ('performance', 'This still from "{title}" comes from the edge of the stage logic. I wanted motion residue to remain visible in a single frame.'),

            -- architecture (3)
            ('architecture', 'In "{title}", architecture behaves like a character, not a background. I composed this to show how space directs attention.'),
            ('architecture', 'This frame from "{title}" studies geometry, scale, and human trace together. The structure feels stable, but the mood keeps shifting.'),
            ('architecture', 'I photographed this scene in "{title}" to keep lines, shadows, and circulation in dialogue. It is a spatial portrait as much as a place image.'),

            -- nature (3)
            ('nature', 'While making "{title}", I looked for a nature frame that felt intimate rather than panoramic. This image keeps texture and weather close to the body.'),
            ('nature', 'This photograph from "{title}" is about atmosphere before scenery. Light and air do the storytelling as much as the subject does.'),
            ('nature', 'In "{title}", I framed this landscape to hold both calm and unpredictability. It reads like a quiet event still unfolding.'),

            -- commercial (3)
            ('commercial', '"{title}" sits in a commercial language, but I still framed it with personal rhythm. Clarity matters here, yet I kept room for feeling.'),
            ('commercial', 'I shot this for "{title}" with campaign precision and documentary patience. The image balances brand intent with human detail.'),
            ('commercial', 'This frame from "{title}" is structured for client readability without losing atmosphere. The subject stays legible, but never flat.'),

            -- nightlife (2)
            ('nightlife', 'In "{title}", night light became both stage and filter. I kept the grain and glow because they carry the social energy of the hour.'),
            ('nightlife', 'This moment from "{title}" arrived after dark when color shifted from description to mood. The frame leans into that nocturnal uncertainty.'),

            -- experimental (4)
            ('experimental', '"{title}" gave me permission to photograph uncertainty directly. I kept the frame slightly unresolved so interpretation stays active.'),
            ('experimental', 'This image from "{title}" comes from an experimental workflow where accident is part of authorship. The imperfections are intentional evidence.'),
            ('experimental', 'I approached "{title}" as a visual question instead of a statement. The photograph answers partially and leaves the rest open.'),
            ('experimental', 'In "{title}", I let process marks remain visible in the final frame. The result carries both decision and doubt.')
    ) as t(genre, template_text)
),
ranked_targets as (
    select
        m.*,
        row_number() over (
            partition by m.inferred_genre
            order by random()
        ) as target_rn
    from matched m
),
ranked_templates as (
    select
        t.*,
        row_number() over (
            partition by t.genre
            order by random()
        ) as template_rn,
        count(*) over (
            partition by t.genre
        ) as template_count
    from template_bank t
),
allotted as (
    select
        rt.id,
        rt.photo_url,
        rt.inferred_genre,
        rt.context_text,
        replace(tp.template_text, '{title}', rt.series_title) as base_story
    from ranked_targets rt
    join ranked_templates tp
      on tp.genre = rt.inferred_genre
     and tp.template_rn = ((rt.target_rn - 1) % tp.template_count) + 1
),
composed as (
    select
        a.id,
        a.inferred_genre as final_genre,
        trim(
            a.base_story || ' ' ||
            case
                when a.context_text ~ '(fashion|runway|catwalk|editorial|lookbook|styling|couture)' then
                    'The styling reads like an argument about visibility and desire.'
                when a.context_text ~ '(exhibition|gallery|museum|biennale|showcase|installation)' then
                    'I keep returning to how the viewing space itself shaped this image.'
                when a.context_text ~ '(travel|journey|trip|city|abroad|airport|station|road|coast|voyage)' then
                    'What stays with me is the travel tempo: arriving, observing, moving again.'
                when a.context_text ~ '(street|urban|sidewalk|alley|market|crosswalk|public)' then
                    'It still feels like a public moment carrying a private aftertaste.'
                when a.context_text ~ '(portrait|face|self|identity|body|gaze)' then
                    'The portrait works for me because it protects ambiguity instead of solving it.'
                when a.context_text ~ '(documentary|archive|memory|ritual|community|witness)' then
                    'I read it now as a small archive entry with emotional weight.'
                when a.context_text ~ '(performance|dance|theatre|stage|concert|music|choreography)' then
                    'The frame is still, but the choreography keeps moving in my memory.'
                when a.context_text ~ '(architecture|building|interior|structure|spatial|corridor|facade)' then
                    'Space leads the eye here, but human trace is what makes it resonate.'
                when a.context_text ~ '(landscape|nature|forest|river|mountain|sea|outdoor|park)' then
                    'It remains a weathered memory: tactile, quiet, and slightly unstable.'
                when a.context_text ~ '(commercial|campaign|brand|product|client)' then
                    'Even in a commissioned context, I try to keep authorship visible.'
                when a.context_text ~ '(night|nocturne|neon|after dark|midnight|club)' then
                    'Night exaggerates color and erases certainty, and that tension is the point.'
                else
                    'I keep the frame open enough for ambiguity, because certainty would flatten what I felt there.'
            end
        ) as sample_text
    from allotted a
)
update public.photo_stories ps
set sample_story_markdown = c.sample_text,
    genre = case
        when coalesce(trim(ps.genre), '') = '' then c.final_genre
        else ps.genre
    end
from composed c
where ps.id = c.id
  and coalesce(ps.is_story_locked, false) = false
  and coalesce(trim(ps.story_markdown), '') = ''
returning
    ps.id,
    ps.photo_url,
    c.final_genre as assigned_genre,
    left(ps.sample_story_markdown, 160) as sample_preview;
