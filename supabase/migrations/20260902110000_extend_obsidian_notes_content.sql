alter table public.obsidian_notes
add column if not exists slug text,
add column if not exists markdown_content text not null default '',
add column if not exists tags text[] not null default '{}',
add column if not exists first_tag text,
add column if not exists source_sha text;

update public.obsidian_notes
set slug = regexp_replace(
  regexp_replace(file_path, '^.*/', ''),
  '\.md$',
  '',
  'i'
)
where slug is null or slug = '';

create unique index if not exists obsidian_notes_slug_lower_idx
on public.obsidian_notes ((lower(slug)))
where slug is not null;

comment on column public.obsidian_notes.markdown_content is
  'Complete public Markdown source used to render individual vault notes without a GitHub request.';

comment on column public.obsidian_notes.tags is
  'Wiki-link targets extracted only from explicit Tags: metadata lines in the note body.';

comment on column public.obsidian_notes.first_tag is
  'First wiki-link target from an explicit Tags: line; note-type metadata is intentionally excluded.';

comment on column public.obsidian_notes.source_sha is
  'Git blob SHA from the source repository, used for incremental webhook synchronization.';
