begin;

create or replace function public.portfolio_publish_project(p_project_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.portfolio_projects%rowtype;
  v_draft public.portfolio_project_revisions%rowtype;
  v_published_id uuid := gen_random_uuid();
  v_number integer;
begin
  if not public.portfolio_is_admin() then raise exception 'PORTFOLIO_ADMIN_REQUIRED'; end if;
  select * into v_project from public.portfolio_projects where id = p_project_id for update;
  if not found then raise exception 'PORTFOLIO_PROJECT_NOT_FOUND'; end if;
  select * into v_draft from public.portfolio_project_revisions where id = v_project.draft_revision_id for update;
  if nullif(trim(v_draft.title), '') is null then raise exception 'PORTFOLIO_VALIDATION:title'; end if;
  if nullif(trim(v_draft.one_line_description), '') is null then raise exception 'PORTFOLIO_VALIDATION:one_line_description'; end if;
  if v_draft.year_start is null then raise exception 'PORTFOLIO_VALIDATION:year_start'; end if;
  if nullif(trim(v_draft.cover_url), '') is null then raise exception 'PORTFOLIO_VALIDATION:cover_url'; end if;
  if nullif(trim(v_draft.cover_alt), '') is null then raise exception 'PORTFOLIO_VALIDATION:cover_alt'; end if;
  if not v_draft.work_in_progress and not v_draft.limited_public then
    if nullif(trim(v_draft.context), '') is null then raise exception 'PORTFOLIO_VALIDATION:context'; end if;
    if nullif(trim(v_draft.specific_contribution), '') is null then raise exception 'PORTFOLIO_VALIDATION:specific_contribution'; end if;
  end if;
  if exists (
    select 1 from public.portfolio_project_blocks
    where revision_id = v_draft.id and visible and block_type in ('single_image','image_grid','image_gallery','media_text')
      and content_jsonb::text ~ '"url"\s*:\s*"[^"]+"'
      and content_jsonb::text !~ '"decorative"\s*:\s*true'
      and content_jsonb::text !~ '"alt"\s*:\s*"[^"[:space:]][^"]*"'
  ) then raise exception 'PORTFOLIO_VALIDATION:block_alt_text'; end if;

  select coalesce(max(revision_number), 0) + 1 into v_number from public.portfolio_project_revisions where project_id = p_project_id;
  insert into public.portfolio_project_revisions(
    id, project_id, state, revision_number, lock_version, title, one_line_description, context, specific_contribution,
    year_start, year_end, location, duration, outcome_heading, outcome_text, work_in_progress, limited_public,
    cover_url, cover_alt, cover_focal_x, cover_focal_y, seo_title, meta_description, social_image_url, search_visible,
    layout_style,
    created_by, published_at
  ) select
    v_published_id, project_id, 'published', v_number, 0, title, one_line_description, context, specific_contribution,
    year_start, year_end, location, duration, outcome_heading, outcome_text, work_in_progress, limited_public,
    cover_url, cover_alt, cover_focal_x, cover_focal_y, seo_title, meta_description, social_image_url, search_visible,
    layout_style,
    auth.uid(), now()
  from public.portfolio_project_revisions where id = v_draft.id;

  insert into public.portfolio_project_blocks(revision_id, block_type, content_jsonb, settings_jsonb, visible, position)
  select v_published_id, block_type, content_jsonb, settings_jsonb, visible, position from public.portfolio_project_blocks where revision_id = v_draft.id;
  insert into public.portfolio_revision_taxonomy(revision_id, term_id, display_order)
  select v_published_id, term_id, display_order from public.portfolio_revision_taxonomy where revision_id = v_draft.id;
  insert into public.portfolio_revision_organisations(revision_id, organisation_id, relationship_label, display_order)
  select v_published_id, organisation_id, relationship_label, display_order from public.portfolio_revision_organisations where revision_id = v_draft.id;
  insert into public.portfolio_revision_collaborators(revision_id, collaborator_id, role_label, primary_url, secondary_url, organisation, display_order)
  select v_published_id, collaborator_id, role_label, primary_url, secondary_url, organisation, display_order from public.portfolio_revision_collaborators where revision_id = v_draft.id;
  insert into public.portfolio_revision_links(revision_id, link_type, label, url, display_order)
  select v_published_id, link_type, label, url, display_order from public.portfolio_revision_links where revision_id = v_draft.id;

  update public.portfolio_projects set
    published_revision_id = v_published_id,
    status = case when v_draft.work_in_progress then 'wip' else 'published' end
  where id = p_project_id;
  
  update public.portfolio_project_revisions set state = 'archived'
  where project_id = p_project_id and state = 'published' and id <> v_published_id;
  
  return v_published_id;
end;
$$;

create or replace function public.portfolio_restore_revision(p_project_id uuid, p_revision_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.portfolio_projects%rowtype;
  v_source public.portfolio_project_revisions%rowtype;
  v_draft_id uuid := gen_random_uuid();
  v_number integer;
begin
  if not public.portfolio_is_admin() then raise exception 'PORTFOLIO_ADMIN_REQUIRED'; end if;
  select * into v_project from public.portfolio_projects where id = p_project_id for update;
  select * into v_source from public.portfolio_project_revisions where id = p_revision_id and project_id = p_project_id and state = 'published';
  if not found then raise exception 'PORTFOLIO_REVISION_NOT_FOUND'; end if;
  update public.portfolio_project_revisions set state = 'archived' where id = v_project.draft_revision_id and state = 'draft';
  select coalesce(max(revision_number), 0) + 1 into v_number from public.portfolio_project_revisions where project_id = p_project_id;
  insert into public.portfolio_project_revisions(
    id, project_id, state, revision_number, lock_version, title, one_line_description, context, specific_contribution,
    year_start, year_end, location, duration, outcome_heading, outcome_text, work_in_progress, limited_public,
    cover_url, cover_alt, cover_focal_x, cover_focal_y, seo_title, meta_description, social_image_url, search_visible, 
    layout_style, created_by
  ) select
    v_draft_id, project_id, 'draft', v_number, 0, title, one_line_description, context, specific_contribution,
    year_start, year_end, location, duration, outcome_heading, outcome_text, work_in_progress, limited_public,
    cover_url, cover_alt, cover_focal_x, cover_focal_y, seo_title, meta_description, social_image_url, search_visible, 
    layout_style, auth.uid()
  from public.portfolio_project_revisions where id = p_revision_id;
  insert into public.portfolio_project_blocks(revision_id, block_type, content_jsonb, settings_jsonb, visible, position)
  select v_draft_id, block_type, content_jsonb, settings_jsonb, visible, position from public.portfolio_project_blocks where revision_id = p_revision_id;
  insert into public.portfolio_revision_taxonomy(revision_id, term_id, display_order)
  select v_draft_id, term_id, display_order from public.portfolio_revision_taxonomy where revision_id = p_revision_id;
  insert into public.portfolio_revision_organisations(revision_id, organisation_id, relationship_label, display_order)
  select v_draft_id, organisation_id, relationship_label, display_order from public.portfolio_revision_organisations where revision_id = p_revision_id;
  insert into public.portfolio_revision_collaborators(revision_id, collaborator_id, role_label, primary_url, secondary_url, organisation, display_order)
  select v_draft_id, collaborator_id, role_label, primary_url, secondary_url, organisation, display_order from public.portfolio_revision_collaborators where revision_id = p_revision_id;
  insert into public.portfolio_revision_links(revision_id, link_type, label, url, display_order)
  select v_draft_id, link_type, label, url, display_order from public.portfolio_revision_links where revision_id = p_revision_id;
  update public.portfolio_projects set draft_revision_id = v_draft_id where id = p_project_id;
  return v_draft_id;
end;
$$;

commit;
