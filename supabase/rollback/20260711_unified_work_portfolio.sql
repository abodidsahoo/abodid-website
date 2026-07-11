-- DESTRUCTIVE ROLLBACK - documentation only. Never run without exporting portfolio data and storage first.
begin;

drop view if exists public.portfolio_public_redirects;
drop view if exists public.portfolio_public_index;
drop view if exists public.portfolio_public_projects;
drop function if exists public.portfolio_merge_taxonomy_terms(uuid, uuid);
drop function if exists public.portfolio_update_slug(uuid, text);
drop function if exists public.portfolio_reorder_projects(uuid[]);
drop function if exists public.portfolio_restore_revision(uuid, uuid);
drop function if exists public.portfolio_publish_project(uuid);
drop function if exists public.portfolio_save_draft(uuid, integer, jsonb);
drop function if exists public.portfolio_create_project(text);
drop function if exists public.portfolio_slugify(text);
drop function if exists public.portfolio_touch_updated_at();
drop function if exists public.portfolio_is_admin();

drop table if exists public.portfolio_slug_redirects;
drop table if exists public.portfolio_revision_links;
drop table if exists public.portfolio_revision_collaborators;
drop table if exists public.portfolio_collaborators;
drop table if exists public.portfolio_revision_organisations;
drop table if exists public.portfolio_organisations;
drop table if exists public.portfolio_revision_taxonomy;
drop table if exists public.portfolio_taxonomy_terms;
drop table if exists public.portfolio_project_blocks;
drop table if exists public.portfolio_media_assets;
alter table if exists public.portfolio_projects drop constraint if exists portfolio_projects_draft_revision_fk;
alter table if exists public.portfolio_projects drop constraint if exists portfolio_projects_published_revision_fk;
drop table if exists public.portfolio_project_revisions;
drop table if exists public.portfolio_projects;

delete from storage.objects where bucket_id = 'portfolio-media';
delete from storage.buckets where id = 'portfolio-media';

commit;

