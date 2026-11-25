-- Remove the unrelated test quotation from the Cambridge case study. Keep the
-- block list and its Markdown fallback aligned so editing cannot restore it.
-- Match this quotation exactly; other authored quotations are untouched.
with cleaned as (
  select r.id,
    (
      select jsonb_agg(
        case
          when block->>'id' = 'cambridge-cultural-heritage-data-school-06'
            and block->>'blockType' = 'heading'
            and block#>>'{content,text}' = 'Year'
          then jsonb_set(block, '{content,text}', '"Outcome"'::jsonb)
          else block
        end order by position
      )
      from jsonb_array_elements(r.blocks) with ordinality as b(block, position)
      where not (
        block->>'blockType' = 'quotation'
        and btrim(coalesce(block#>>'{content,quote}', '')) =
          'भाई, एकदम तगड़ा quotation है। मेरी बात सुन, बोल डाल, बस काम खत्म।'
      )
    ) as blocks,
    replace(
      replace(r.content,
        E'\n\n> भाई, एकदम तगड़ा quotation है। मेरी बात सुन, बोल डाल, बस काम खत्म। \n> — Abodid Sahoo ',
        ''),
      E'## Year\n\n> Full bursary',
      E'## Outcome\n\n> Full bursary'
    ) as content
  from public.research r
  where r.slug = 'cambridge-cultural-heritage-data-school'
)
update public.research r
set blocks = cleaned.blocks, content = cleaned.content, updated_at = now()
from cleaned
where r.id = cleaned.id
  and (r.blocks is distinct from cleaned.blocks
    or r.content is distinct from cleaned.content);
