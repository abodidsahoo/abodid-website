begin;

create or replace view public.portfolio_public_projects as
select
  p.id as project_id, p.slug, p.status, p.featured_order,
  r.revision_number, r.title, r.one_line_description,
  case when r.work_in_progress and r.limited_public then '' else r.context end as context,
  case when r.work_in_progress and r.limited_public then '' else r.specific_contribution end as specific_contribution,
  r.year_start, r.year_end,
  case when r.work_in_progress and r.limited_public then '' else r.location end as location,
  case when r.work_in_progress and r.limited_public then '' else r.duration end as duration,
  case when r.work_in_progress and r.limited_public then '' else r.outcome_heading end as outcome_heading,
  case when r.work_in_progress and r.limited_public then '' else r.outcome_text end as outcome_text,
  r.work_in_progress, r.limited_public, r.cover_url, r.cover_alt, r.cover_focal_x, r.cover_focal_y,
  r.seo_title, r.meta_description, r.social_image_url, r.search_visible,
  coalesce((
    select jsonb_agg(jsonb_build_object('id', b.id, 'block_type', b.block_type, 'content_jsonb', b.content_jsonb, 'settings_jsonb', b.settings_jsonb, 'visible', b.visible, 'position', b.position) order by b.position)
    from public.portfolio_project_blocks b where b.revision_id = r.id and b.visible
  ), '[]'::jsonb) as blocks,
  coalesce((
    select jsonb_agg(jsonb_build_object('id', t.id, 'group_type', t.group_type, 'label', t.label, 'slug', t.slug) order by rt.display_order)
    from public.portfolio_revision_taxonomy rt join public.portfolio_taxonomy_terms t on t.id = rt.term_id
    where rt.revision_id = r.id and not t.archived
  ), '[]'::jsonb) as taxonomies,
  coalesce((
    select jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'slug', o.slug, 'url', o.url, 'relationship_label', ro.relationship_label, 'display_order', ro.display_order) order by ro.display_order)
    from public.portfolio_revision_organisations ro join public.portfolio_organisations o on o.id = ro.organisation_id
    where ro.revision_id = r.id
  ), '[]'::jsonb) as organisations,
  case when r.work_in_progress and r.limited_public then '[]'::jsonb else coalesce((
    select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'role_label', rc.role_label, 'primary_url', coalesce(nullif(rc.primary_url,''),c.primary_url), 'secondary_url', coalesce(nullif(rc.secondary_url,''),c.secondary_url), 'organisation', coalesce(nullif(rc.organisation,''),c.organisation), 'display_order', rc.display_order) order by rc.display_order)
    from public.portfolio_revision_collaborators rc join public.portfolio_collaborators c on c.id = rc.collaborator_id
    where rc.revision_id = r.id
  ), '[]'::jsonb) end as collaborators,
  case when r.work_in_progress and r.limited_public then '[]'::jsonb else coalesce((
    select jsonb_agg(jsonb_build_object('id', l.id, 'link_type', l.link_type, 'label', l.label, 'url', l.url, 'display_order', l.display_order) order by l.display_order)
    from public.portfolio_revision_links l where l.revision_id = r.id
  ), '[]'::jsonb) end as links
from public.portfolio_projects p
join public.portfolio_project_revisions r on r.id = p.published_revision_id
where p.visibility = 'public' and p.status in ('published','wip');

grant select on public.portfolio_public_projects to anon, authenticated;

commit;

