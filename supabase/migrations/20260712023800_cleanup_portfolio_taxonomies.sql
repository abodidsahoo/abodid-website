begin;

-- 1. Delete junction records for taxonomies that belong to removed groups
delete from public.portfolio_revision_taxonomy
where term_id in (
  select id from public.portfolio_taxonomy_terms
  where group_type not in ('role', 'genre', 'project_type')
);

-- 2. Delete the actual taxonomy terms for the removed groups
delete from public.portfolio_taxonomy_terms
where group_type not in ('role', 'genre', 'project_type');

commit;
