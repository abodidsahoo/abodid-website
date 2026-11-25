-- Remove two seeded presentation notes that describe the website instead of
-- the research. Match the exact blocks; preserve later authored edits.
-- Keep the Markdown fallback aligned with the editable block list.
with targets(slug, heading_id, heading_text, note_id, note_text) as (
  values
    ('cries-of-an-unmarried-widow',
     'cries-of-an-unmarried-widow-04', 'Year',
     'cries-of-an-unmarried-widow-05',
     'A conceptual photographic body of work accompanied by long-form writing, presented here as a text-image research project rather than a conventional photography gallery.'),
    ('photogrammetry-physical-evidence',
     'photogrammetry-physical-evidence-04', 'Context',
     'photogrammetry-physical-evidence-05',
     'A technical research poster and workflow study, presented as an origin point for the spatial and computational strand of the research practice.')
), cleaned as (
  select r.id,
    (
      select coalesce(jsonb_agg(block order by position), '[]'::jsonb)
      from jsonb_array_elements(r.blocks) with ordinality as b(block, position)
      where not coalesce(
        (block->>'id' = t.heading_id and block->>'blockType' = 'heading'
          and block#>>'{content,text}' = t.heading_text)
        or (block->>'id' = t.note_id and block->>'blockType' = 'highlight'
          and block#>>'{content,text}' = t.note_text),
        false
      )
    ) as blocks,
    replace(r.content, E'\n\n## ' || t.heading_text || E'\n\n> ' || t.note_text, '') as content
  from public.research r
  join targets t on t.slug = r.slug
  where r.blocks @> jsonb_build_array(jsonb_build_object(
    'id', t.note_id, 'blockType', 'highlight', 'content', jsonb_build_object('text', t.note_text)
  ))
)
update public.research r
set blocks = cleaned.blocks, content = cleaned.content, updated_at = now()
from cleaned
where r.id = cleaned.id
  and (r.blocks is distinct from cleaned.blocks or r.content is distinct from cleaned.content);
