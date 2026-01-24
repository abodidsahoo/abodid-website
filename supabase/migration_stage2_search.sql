-- Enable Full Text Search (FTS) for Resource Hub

-- 1. Add generated column for search tokens
-- We combine Title, Description, and Tags (via a subquery logic usually, but for generated columns it must be immutable row data).
-- Since tags are in a many-to-many, we can't easily index them in a generated column on the resource table itself without triggers.
-- For simpler Stage 2: We index Title, Description, URL, and Audience.

alter table public.hub_resources
add column fts tsvector generated always as (
  to_tsvector('english', 
    title || ' ' || 
    coalesce(description, '') || ' ' || 
    coalesce(audience, '') || ' ' ||
    url
  )
) stored;

-- 2. Create GIN index for fast search
create index resources_fts_idx on public.hub_resources using GIN (fts);

-- 3. Verify it works
-- select title from hub_resources where fts @@ websearch_to_tsquery('english', 'design');
