begin;

-- Older Research records only had catalogue metadata. Give each one a normal
-- editable story block so every visible project participates in the same block
-- workflow as Blog and the newly migrated case studies.
update public.research
set
  blocks = jsonb_build_array(
    jsonb_build_object(
      'id', slug || '-starting-story',
      'blockType', 'body_text',
      'content', jsonb_build_object('text', description),
      'settings', jsonb_build_object('width', 'standard', 'spacing', 'default')
    )
  ),
  content = case
    when nullif(btrim(content), '') is null then description
    else content
  end,
  updated_at = now()
where jsonb_typeof(blocks) = 'array'
  and jsonb_array_length(blocks) = 0
  and nullif(btrim(description), '') is not null;

notify pgrst, 'reload schema';

commit;
