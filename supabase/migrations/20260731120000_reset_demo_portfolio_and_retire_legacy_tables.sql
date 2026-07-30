begin;

-- The existing projects are disposable demonstrations. Removing the canonical
-- project rows also clears their backups and redirects, while media catalogue
-- rows are retained with origin_project_id set to null.
delete from public.portfolio_projects
where id is not null;

-- Disconnect triggers before removing the legacy trigger functions.
drop trigger if exists portfolio_project_blocks_from_document
  on public.portfolio_project_revisions;
drop trigger if exists portfolio_resolve_revision_media_ids
  on public.portfolio_project_revisions;
drop trigger if exists portfolio_sync_revision_media_usages
  on public.portfolio_project_revisions;
drop trigger if exists portfolio_sync_block_media_usages
  on public.portfolio_project_blocks;

drop function if exists public.media_rebuild_portfolio_usages();
drop function if exists public.portfolio_project_blocks_from_document();
drop function if exists public.portfolio_resolve_revision_media_ids();
drop function if exists public.portfolio_sync_revision_media_usages();
drop function if exists public.portfolio_sync_block_media_usages();
drop function if exists public.portfolio_revision_document(uuid);
drop function if exists public.portfolio_merge_taxonomy_terms(uuid, uuid);

-- Break the circular foreign-key relationship before retiring the revision
-- tables. The pointer columns stay briefly because legacy RLS policies still
-- refer to published_revision_id and will disappear with their tables.
alter table public.portfolio_projects
  drop constraint if exists portfolio_projects_draft_revision_fk,
  drop constraint if exists portfolio_projects_published_revision_fk;

-- Retire the normalized revision model without using CASCADE. An unexpected
-- dependency will stop and roll back this migration instead of being removed.
drop policy if exists portfolio_collaborators_public_read
  on public.portfolio_collaborators;

drop table if exists public.portfolio_media_usages;
drop table if exists public.portfolio_revision_links;
drop table if exists public.portfolio_revision_collaborators;
drop table if exists public.portfolio_revision_organisations;
drop table if exists public.portfolio_revision_taxonomy;
drop table if exists public.portfolio_project_blocks;
drop table if exists public.portfolio_project_revisions;
drop table if exists public.portfolio_collaborators;
drop table if exists public.portfolio_organisations;
drop table if exists public.portfolio_taxonomy_terms;

-- With every legacy policy gone, the obsolete pointer columns can be removed
-- from the canonical single-row project table.
alter table public.portfolio_projects
  drop column if exists draft_revision_id,
  drop column if exists published_revision_id;

notify pgrst, 'reload schema';

commit;
