begin;

-- Rows left without a revision relationship by the old save implementation
-- are not reachable anywhere in the admin or public application.
delete from public.portfolio_collaborators c
where not c.archived
  and not exists (
    select 1
    from public.portfolio_revision_collaborators rc
    where rc.collaborator_id = c.id
  );

create or replace function public.portfolio_save_draft(
  p_project_id uuid,
  p_expected_lock_version integer,
  p_payload jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.portfolio_projects%rowtype;
  v_revision public.portfolio_project_revisions%rowtype;
  v_existing_collaborator public.portfolio_collaborators%rowtype;
  v_item jsonb;
  v_term_id uuid;
  v_org_id uuid;
  v_collaborator_id uuid;
  v_collaborator_exists boolean;
  v_collaborator_changed boolean;
  v_index integer := 0;
  v_next_lock integer;
begin
  if not public.portfolio_is_admin() then raise exception 'PORTFOLIO_ADMIN_REQUIRED'; end if;
  select * into v_project from public.portfolio_projects where id = p_project_id for update;
  if not found then raise exception 'PORTFOLIO_PROJECT_NOT_FOUND'; end if;
  select * into v_revision from public.portfolio_project_revisions where id = v_project.draft_revision_id for update;
  if v_revision.state <> 'draft' then raise exception 'PORTFOLIO_DRAFT_REQUIRED'; end if;
  if v_revision.lock_version <> p_expected_lock_version then raise exception 'PORTFOLIO_CONFLICT'; end if;
  v_next_lock := v_revision.lock_version + 1;

  update public.portfolio_project_revisions set
    lock_version = v_next_lock,
    title = coalesce(nullif(trim(p_payload->>'title'), ''), 'Untitled project'),
    one_line_description = coalesce(p_payload->>'oneLineDescription', ''),
    context = coalesce(p_payload->>'context', ''),
    specific_contribution = coalesce(p_payload->>'specificContribution', ''),
    year_start = nullif(p_payload->>'yearStart', '')::integer,
    year_end = nullif(p_payload->>'yearEnd', '')::integer,
    location = coalesce(p_payload->>'location', ''),
    duration = coalesce(p_payload->>'duration', ''),
    outcome_heading = coalesce(p_payload->>'outcomeHeading', ''),
    outcome_text = coalesce(p_payload->>'outcomeText', ''),
    work_in_progress = coalesce((p_payload->>'workInProgress')::boolean, false),
    limited_public = coalesce((p_payload->>'limitedPublic')::boolean, false),
    cover_url = coalesce(p_payload->>'coverUrl', ''),
    cover_alt = coalesce(p_payload->>'coverAlt', ''),
    cover_focal_x = coalesce(nullif(p_payload->>'coverFocalX', '')::numeric, 50),
    cover_focal_y = coalesce(nullif(p_payload->>'coverFocalY', '')::numeric, 50),
    seo_title = coalesce(p_payload->>'seoTitle', ''),
    meta_description = coalesce(p_payload->>'metaDescription', ''),
    social_image_url = coalesce(p_payload->>'socialImageUrl', ''),
    search_visible = coalesce((p_payload->>'searchVisible')::boolean, true),
    layout_style = coalesce(nullif(p_payload->>'layoutStyle', '')::integer, 1)
  where id = v_revision.id;

  delete from public.portfolio_project_blocks where revision_id = v_revision.id;
  v_index := 0;
  for v_item in select * from jsonb_array_elements(coalesce(p_payload->'blocks', '[]'::jsonb)) loop
    insert into public.portfolio_project_blocks(id, revision_id, block_type, content_jsonb, settings_jsonb, visible, position)
    values (
      coalesce(nullif(v_item->>'id', '')::uuid, gen_random_uuid()), v_revision.id,
      v_item->>'blockType', coalesce(v_item->'content', '{}'::jsonb), coalesce(v_item->'settings', '{}'::jsonb),
      coalesce((v_item->>'visible')::boolean, true), coalesce((v_item->>'position')::integer, v_index)
    );
    v_index := v_index + 1;
  end loop;

  delete from public.portfolio_revision_taxonomy where revision_id = v_revision.id;
  v_index := 0;
  for v_item in select * from jsonb_array_elements(coalesce(p_payload->'taxonomies', '[]'::jsonb)) loop
    insert into public.portfolio_taxonomy_terms(group_type, label, slug, sort_order)
    values (v_item->>'groupType', trim(v_item->>'label'), v_item->>'slug', 1000)
    on conflict (group_type, slug) do update set label = excluded.label
    returning id into v_term_id;
    insert into public.portfolio_revision_taxonomy(revision_id, term_id, display_order)
    values (v_revision.id, v_term_id, v_index) on conflict do nothing;
    v_index := v_index + 1;
  end loop;

  delete from public.portfolio_revision_organisations where revision_id = v_revision.id;
  v_index := 0;
  for v_item in select * from jsonb_array_elements(coalesce(p_payload->'organisations', '[]'::jsonb)) loop
    if nullif(trim(v_item->>'name'), '') is not null then
      insert into public.portfolio_organisations(name, slug, url)
      values (trim(v_item->>'name'), public.portfolio_slugify(v_item->>'name'), coalesce(v_item->>'url', ''))
      on conflict (slug) do update set name = excluded.name, url = case when excluded.url <> '' then excluded.url else portfolio_organisations.url end
      returning id into v_org_id;
      insert into public.portfolio_revision_organisations(revision_id, organisation_id, relationship_label, display_order)
      values (v_revision.id, v_org_id, coalesce(v_item->>'relationshipLabel', ''), v_index) on conflict do nothing;
      v_index := v_index + 1;
    end if;
  end loop;

  delete from public.portfolio_revision_collaborators where revision_id = v_revision.id;
  v_index := 0;
  for v_item in select * from jsonb_array_elements(coalesce(p_payload->'collaborators', '[]'::jsonb)) loop
    if nullif(trim(v_item->>'name'), '') is not null then
      v_collaborator_id := coalesce(nullif(v_item->>'id', '')::uuid, gen_random_uuid());
      select * into v_existing_collaborator
      from public.portfolio_collaborators
      where id = v_collaborator_id;
      v_collaborator_exists := found;

      if v_collaborator_exists then
        v_collaborator_changed :=
          v_existing_collaborator.name is distinct from trim(v_item->>'name')
          or v_existing_collaborator.primary_url is distinct from coalesce(v_item->>'primaryUrl', '')
          or v_existing_collaborator.secondary_url is distinct from coalesce(v_item->>'secondaryUrl', '')
          or v_existing_collaborator.organisation is distinct from coalesce(v_item->>'organisation', '');

        if v_collaborator_changed and exists (
          select 1
          from public.portfolio_revision_collaborators rc
          join public.portfolio_project_revisions r on r.id = rc.revision_id
          where rc.collaborator_id = v_collaborator_id
            and r.published_at is not null
        ) then
          raise exception 'PORTFOLIO_COLLABORATOR_IMMUTABLE';
        end if;

        update public.portfolio_collaborators set
          name = trim(v_item->>'name'),
          primary_url = coalesce(v_item->>'primaryUrl', ''),
          secondary_url = coalesce(v_item->>'secondaryUrl', ''),
          organisation = coalesce(v_item->>'organisation', ''),
          archived = false
        where id = v_collaborator_id;
      else
        insert into public.portfolio_collaborators(id, name, primary_url, secondary_url, organisation)
        values (
          v_collaborator_id,
          trim(v_item->>'name'),
          coalesce(v_item->>'primaryUrl', ''),
          coalesce(v_item->>'secondaryUrl', ''),
          coalesce(v_item->>'organisation', '')
        );
      end if;

      insert into public.portfolio_revision_collaborators(revision_id, collaborator_id, role_label, primary_url, secondary_url, organisation, display_order)
      values (
        v_revision.id,
        v_collaborator_id,
        coalesce(v_item->>'roleLabel', ''),
        coalesce(v_item->>'primaryUrl', ''),
        coalesce(v_item->>'secondaryUrl', ''),
        coalesce(v_item->>'organisation', ''),
        v_index
      );
      v_index := v_index + 1;
    end if;
  end loop;

  delete from public.portfolio_revision_links where revision_id = v_revision.id;
  v_index := 0;
  for v_item in select * from jsonb_array_elements(coalesce(p_payload->'links', '[]'::jsonb)) loop
    if nullif(trim(v_item->>'url'), '') is not null then
      insert into public.portfolio_revision_links(revision_id, link_type, label, url, display_order)
      values (v_revision.id, coalesce(v_item->>'linkType', 'external'), coalesce(nullif(trim(v_item->>'label'), ''), 'Open link'), trim(v_item->>'url'), v_index);
      v_index := v_index + 1;
    end if;
  end loop;

  delete from public.portfolio_collaborators c
  where not c.archived
    and not exists (
      select 1
      from public.portfolio_revision_collaborators rc
      where rc.collaborator_id = c.id
    );

  return v_next_lock;
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
  if not found then raise exception 'PORTFOLIO_PROJECT_NOT_FOUND'; end if;
  select * into v_source
  from public.portfolio_project_revisions
  where id = p_revision_id
    and project_id = p_project_id
    and state in ('published', 'archived')
    and published_at is not null;
  if not found then raise exception 'PORTFOLIO_REVISION_NOT_FOUND'; end if;

  update public.portfolio_project_revisions
  set state = 'archived'
  where id = v_project.draft_revision_id and state = 'draft';

  select coalesce(max(revision_number), 0) + 1
  into v_number
  from public.portfolio_project_revisions
  where project_id = p_project_id;

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
  from public.portfolio_project_revisions
  where id = v_source.id;

  insert into public.portfolio_project_blocks(revision_id, block_type, content_jsonb, settings_jsonb, visible, position)
  select v_draft_id, block_type, content_jsonb, settings_jsonb, visible, position from public.portfolio_project_blocks where revision_id = v_source.id;
  insert into public.portfolio_revision_taxonomy(revision_id, term_id, display_order)
  select v_draft_id, term_id, display_order from public.portfolio_revision_taxonomy where revision_id = v_source.id;
  insert into public.portfolio_revision_organisations(revision_id, organisation_id, relationship_label, display_order)
  select v_draft_id, organisation_id, relationship_label, display_order from public.portfolio_revision_organisations where revision_id = v_source.id;
  insert into public.portfolio_revision_collaborators(revision_id, collaborator_id, role_label, primary_url, secondary_url, organisation, display_order)
  select v_draft_id, collaborator_id, role_label, primary_url, secondary_url, organisation, display_order from public.portfolio_revision_collaborators where revision_id = v_source.id;
  insert into public.portfolio_revision_links(revision_id, link_type, label, url, display_order)
  select v_draft_id, link_type, label, url, display_order from public.portfolio_revision_links where revision_id = v_source.id;

  update public.portfolio_projects
  set draft_revision_id = v_draft_id
  where id = p_project_id;

  return v_draft_id;
end;
$$;

commit;
