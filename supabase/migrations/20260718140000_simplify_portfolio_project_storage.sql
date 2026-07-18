begin;

-- One row is now the complete working state of a project. The content column
-- is the editable draft, published_content is the current public snapshot,
-- and portfolio_project_backups contains one immutable snapshot per publish.
alter table public.portfolio_projects
  add column if not exists title text not null default 'Untitled project',
  add column if not exists content jsonb not null default '{}'::jsonb,
  add column if not exists published_content jsonb,
  add column if not exists published_version integer not null default 0,
  add column if not exists lock_version integer not null default 0,
  add column if not exists published_at timestamptz;

alter table public.portfolio_projects
  drop constraint if exists portfolio_projects_content_object;
alter table public.portfolio_projects
  add constraint portfolio_projects_content_object
  check (jsonb_typeof(content) = 'object');

alter table public.portfolio_projects
  drop constraint if exists portfolio_projects_published_content_object;
alter table public.portfolio_projects
  add constraint portfolio_projects_published_content_object
  check (published_content is null or jsonb_typeof(published_content) = 'object');

create table if not exists public.portfolio_project_backups (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.portfolio_projects(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  title text not null,
  slug text not null,
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (project_id, version_number)
);

create index if not exists portfolio_project_backups_history_idx
  on public.portfolio_project_backups(project_id, version_number desc);

comment on column public.portfolio_projects.content is
  'Complete editable project document. URLs and media metadata are embedded; binary files remain in object storage.';
comment on column public.portfolio_projects.published_content is
  'Current public project document, replaced only by an explicit publish.';
comment on table public.portfolio_project_backups is
  'Append-only project snapshots. One row is created for every successful publish.';

-- Convert one legacy revision and its relation rows into the portable document
-- format used by the editor and CSV/JSON exports.
create or replace function public.portfolio_revision_document(p_revision_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'title', r.title,
    'oneLineDescription', r.one_line_description,
    'context', r.context,
    'specificContribution', r.specific_contribution,
    'yearStart', r.year_start,
    'yearEnd', r.year_end,
    'location', r.location,
    'duration', r.duration,
    'outcomeHeading', r.outcome_heading,
    'outcomeText', r.outcome_text,
    'workInProgress', r.work_in_progress,
    'limitedPublic', r.limited_public,
    'coverUrl', r.cover_url,
    'coverMedia', public.media_asset_manifest(r.cover_media_id),
    'coverAlt', r.cover_alt,
    'coverFocalX', r.cover_focal_x,
    'coverFocalY', r.cover_focal_y,
    'seoTitle', r.seo_title,
    'metaDescription', r.meta_description,
    'socialImageUrl', r.social_image_url,
    'socialImageMedia', public.media_asset_manifest(r.social_image_media_id),
    'searchVisible', r.search_visible,
    'layoutStyle', r.layout_style,
    'blocks', coalesce(r.content_blocks, '[]'::jsonb),
    'taxonomies', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id,
        'groupType', t.group_type,
        'label', t.label,
        'slug', t.slug
      ) order by rt.display_order)
      from public.portfolio_revision_taxonomy rt
      join public.portfolio_taxonomy_terms t on t.id = rt.term_id
      where rt.revision_id = r.id and not t.archived
    ), '[]'::jsonb),
    'organisations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id,
        'name', o.name,
        'slug', o.slug,
        'url', o.url,
        'relationshipLabel', ro.relationship_label,
        'displayOrder', ro.display_order
      ) order by ro.display_order)
      from public.portfolio_revision_organisations ro
      join public.portfolio_organisations o on o.id = ro.organisation_id
      where ro.revision_id = r.id
    ), '[]'::jsonb),
    'collaborators', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'roleLabel', rc.role_label,
        'primaryUrl', coalesce(nullif(rc.primary_url, ''), c.primary_url),
        'secondaryUrl', coalesce(nullif(rc.secondary_url, ''), c.secondary_url),
        'organisation', coalesce(nullif(rc.organisation, ''), c.organisation),
        'displayOrder', rc.display_order
      ) order by rc.display_order)
      from public.portfolio_revision_collaborators rc
      join public.portfolio_collaborators c on c.id = rc.collaborator_id
      where rc.revision_id = r.id
    ), '[]'::jsonb),
    'links', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id,
        'linkType', l.link_type,
        'label', l.label,
        'url', l.url,
        'displayOrder', l.display_order
      ) order by l.display_order)
      from public.portfolio_revision_links l
      where l.revision_id = r.id
    ), '[]'::jsonb)
  )
  from public.portfolio_project_revisions r
  where r.id = p_revision_id;
$$;

-- Backfill every current draft into its project row.
update public.portfolio_projects p
set
  title = coalesce(nullif(public.portfolio_revision_document(p.draft_revision_id)->>'title', ''), p.title),
  content = coalesce(public.portfolio_revision_document(p.draft_revision_id), p.content),
  lock_version = coalesce((
    select r.lock_version
    from public.portfolio_project_revisions r
    where r.id = p.draft_revision_id
  ), p.lock_version)
where p.draft_revision_id is not null;

-- Preserve every historical publication as an explicit backup row.
insert into public.portfolio_project_backups(
  project_id, version_number, title, slug, content, created_by, created_at
)
select
  r.project_id,
  r.revision_number,
  r.title,
  p.slug,
  public.portfolio_revision_document(r.id),
  r.created_by,
  coalesce(r.published_at, r.created_at)
from public.portfolio_project_revisions r
join public.portfolio_projects p on p.id = r.project_id
where r.published_at is not null
  and r.state in ('published', 'archived')
on conflict (project_id, version_number) do update
set
  title = excluded.title,
  slug = excluded.slug,
  content = excluded.content,
  created_by = excluded.created_by,
  created_at = excluded.created_at;

-- The latest public document also lives directly on the project row.
update public.portfolio_projects p
set
  published_content = public.portfolio_revision_document(p.published_revision_id),
  published_version = coalesce((
    select r.revision_number
    from public.portfolio_project_revisions r
    where r.id = p.published_revision_id
  ), p.published_version),
  published_at = coalesce((
    select r.published_at
    from public.portfolio_project_revisions r
    where r.id = p.published_revision_id
  ), p.published_at)
where p.published_revision_id is not null;

-- A focused export view avoids the legacy pointer columns and produces a
-- clean one-row-per-project CSV from the Supabase table editor.
create or replace view public.portfolio_projects_export
with (security_invoker = true)
as
select
  id as project_id,
  title as project_title,
  slug as project_name,
  status,
  visibility,
  featured_order,
  content,
  published_content,
  published_version,
  published_at,
  created_at,
  updated_at
from public.portfolio_projects;

create or replace function public.portfolio_create_project(p_title text default 'Untitled project')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid := gen_random_uuid();
  v_title text := coalesce(nullif(trim(p_title), ''), 'Untitled project');
  v_base_slug text := nullif(public.portfolio_slugify(v_title), '');
  v_slug text;
  v_order integer;
  v_content jsonb;
begin
  if not public.portfolio_is_admin() then raise exception 'PORTFOLIO_ADMIN_REQUIRED'; end if;
  v_base_slug := coalesce(v_base_slug, 'untitled-project');
  v_slug := v_base_slug;
  if exists (select 1 from public.portfolio_projects where slug = v_slug) then
    v_slug := v_base_slug || '-' || substr(replace(v_project_id::text, '-', ''), 1, 6);
  end if;

  select coalesce(max(featured_order), 0) + 10 into v_order
  from public.portfolio_projects;

  v_content := jsonb_build_object(
    'title', v_title,
    'oneLineDescription', '',
    'context', '',
    'specificContribution', '',
    'yearStart', extract(year from current_date)::integer,
    'yearEnd', null,
    'location', '',
    'duration', '',
    'outcomeHeading', '',
    'outcomeText', '',
    'workInProgress', false,
    'limitedPublic', false,
    'coverUrl', '',
    'coverMedia', null,
    'coverAlt', '',
    'coverFocalX', 50,
    'coverFocalY', 50,
    'seoTitle', '',
    'metaDescription', '',
    'socialImageUrl', '',
    'socialImageMedia', null,
    'searchVisible', true,
    'layoutStyle', 1,
    'blocks', '[]'::jsonb,
    'taxonomies', '[]'::jsonb,
    'organisations', '[]'::jsonb,
    'collaborators', '[]'::jsonb,
    'links', '[]'::jsonb
  );

  insert into public.portfolio_projects(
    id, slug, title, content, storage_folder, featured_order, created_by
  ) values (
    v_project_id,
    v_slug,
    v_title,
    v_content,
    array_to_string((string_to_array(v_slug, '-'))[1:5], '-'),
    v_order,
    auth.uid()
  );

  return v_project_id;
end;
$$;

-- Keep the existing RPC signature so deployed clients can transition without
-- a coordinated cut-over. It now updates only the canonical project row.
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
  v_title text;
  v_document jsonb;
  v_next_lock integer;
begin
  if not public.portfolio_is_admin() then raise exception 'PORTFOLIO_ADMIN_REQUIRED'; end if;
  if jsonb_typeof(p_payload) <> 'object' then raise exception 'PORTFOLIO_INVALID_DOCUMENT'; end if;

  select * into v_project
  from public.portfolio_projects
  where id = p_project_id
  for update;
  if not found then raise exception 'PORTFOLIO_PROJECT_NOT_FOUND'; end if;
  if v_project.lock_version <> p_expected_lock_version then raise exception 'PORTFOLIO_CONFLICT'; end if;

  v_title := coalesce(nullif(trim(p_payload->>'title'), ''), 'Untitled project');
  v_document := p_payload - 'id' - 'lockVersion' - 'revisionNumber';
  v_document := jsonb_set(v_document, '{title}', to_jsonb(v_title), true);
  v_next_lock := v_project.lock_version + 1;

  update public.portfolio_projects
  set
    title = v_title,
    content = v_document,
    lock_version = v_next_lock
  where id = p_project_id;

  return v_next_lock;
end;
$$;

create or replace function public.portfolio_publish_project(p_project_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.portfolio_projects%rowtype;
  v_backup_id uuid := gen_random_uuid();
  v_version integer;
  v_work_in_progress boolean;
  v_limited_public boolean;
begin
  if not public.portfolio_is_admin() then raise exception 'PORTFOLIO_ADMIN_REQUIRED'; end if;

  select * into v_project
  from public.portfolio_projects
  where id = p_project_id
  for update;
  if not found then raise exception 'PORTFOLIO_PROJECT_NOT_FOUND'; end if;

  if nullif(trim(v_project.content->>'title'), '') is null then raise exception 'PORTFOLIO_VALIDATION:title'; end if;
  if nullif(trim(v_project.content->>'oneLineDescription'), '') is null then raise exception 'PORTFOLIO_VALIDATION:one_line_description'; end if;
  if nullif(v_project.content->>'yearStart', '') is null then raise exception 'PORTFOLIO_VALIDATION:year_start'; end if;
  if nullif(trim(v_project.content->>'coverUrl'), '') is null then raise exception 'PORTFOLIO_VALIDATION:cover_url'; end if;

  v_work_in_progress := coalesce((v_project.content->>'workInProgress')::boolean, false);
  v_limited_public := coalesce((v_project.content->>'limitedPublic')::boolean, false);
  if not v_work_in_progress and not v_limited_public then
    if nullif(trim(v_project.content->>'context'), '') is null then raise exception 'PORTFOLIO_VALIDATION:context'; end if;
    if nullif(trim(v_project.content->>'specificContribution'), '') is null then raise exception 'PORTFOLIO_VALIDATION:specific_contribution'; end if;
  end if;

  select greatest(
    v_project.published_version,
    coalesce(max(version_number), 0)
  ) + 1 into v_version
  from public.portfolio_project_backups
  where project_id = p_project_id;

  insert into public.portfolio_project_backups(
    id, project_id, version_number, title, slug, content, created_by
  ) values (
    v_backup_id,
    p_project_id,
    v_version,
    v_project.title,
    v_project.slug,
    v_project.content,
    auth.uid()
  );

  update public.portfolio_projects
  set
    published_content = content,
    published_version = v_version,
    published_at = now(),
    status = case when v_work_in_progress then 'wip' else 'published' end
  where id = p_project_id;

  return v_backup_id;
end;
$$;

-- Restoring a backup only replaces the editable document. The live document
-- changes after the user explicitly publishes again.
create or replace function public.portfolio_restore_revision(
  p_project_id uuid,
  p_revision_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_backup public.portfolio_project_backups%rowtype;
begin
  if not public.portfolio_is_admin() then raise exception 'PORTFOLIO_ADMIN_REQUIRED'; end if;

  select * into v_backup
  from public.portfolio_project_backups
  where id = p_revision_id and project_id = p_project_id;
  if not found then raise exception 'PORTFOLIO_BACKUP_NOT_FOUND'; end if;

  update public.portfolio_projects
  set
    title = v_backup.title,
    content = v_backup.content,
    lock_version = lock_version + 1
  where id = p_project_id;
  if not found then raise exception 'PORTFOLIO_PROJECT_NOT_FOUND'; end if;

  return v_backup.id;
end;
$$;

create or replace function public.portfolio_json_uuid(p_value text)
returns uuid
language plpgsql
immutable
as $$
begin
  if p_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return p_value::uuid;
  end if;
  return null;
end;
$$;

create or replace function public.portfolio_project_media_manifests(p_content jsonb)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with raw_media as (
    select
      coalesce(p_content #>> '{coverMedia,id}', p_content #>> '{coverMedia,assetId}') as asset_text,
      p_content->>'coverUrl' as media_url
    union all
    select
      coalesce(p_content #>> '{socialImageMedia,id}', p_content #>> '{socialImageMedia,assetId}'),
      p_content->>'socialImageUrl'
    union all
    select
      coalesce(item->>'id', item->>'assetId'),
      coalesce(item->>'url', item->>'originalUrl')
    from jsonb_array_elements(coalesce(p_content->'blocks', '[]'::jsonb)) block
    cross join lateral jsonb_array_elements(
      case jsonb_typeof(block->'content'->'media')
        when 'array' then block->'content'->'media'
        when 'object' then jsonb_build_array(block->'content'->'media')
        else '[]'::jsonb
      end
    ) item
    where coalesce((block->>'visible')::boolean, true)
  ), resolved as (
    select distinct coalesce(
      public.portfolio_json_uuid(asset_text),
      public.media_asset_id_from_url(media_url)
    ) as asset_id
    from raw_media
  )
  select coalesce(jsonb_agg(public.media_asset_manifest(asset_id)), '[]'::jsonb)
  from resolved
  where asset_id is not null;
$$;

-- Public reads now project directly from the explicit published document.
drop view if exists public.portfolio_public_index cascade;
drop view if exists public.portfolio_public_projects cascade;

create view public.portfolio_public_projects as
select
  p.id as project_id,
  p.slug,
  p.status,
  p.featured_order,
  p.published_version as revision_number,
  coalesce(nullif(c->>'title', ''), p.title) as title,
  coalesce(c->>'oneLineDescription', '') as one_line_description,
  case when flags.is_limited then '' else coalesce(c->>'context', '') end as context,
  case when flags.is_limited then '' else coalesce(c->>'specificContribution', '') end as specific_contribution,
  nullif(c->>'yearStart', '')::integer as year_start,
  nullif(c->>'yearEnd', '')::integer as year_end,
  case when flags.is_limited then '' else coalesce(c->>'location', '') end as location,
  case when flags.is_limited then '' else coalesce(c->>'duration', '') end as duration,
  case when flags.is_limited then '' else coalesce(c->>'outcomeHeading', '') end as outcome_heading,
  case when flags.is_limited then '' else coalesce(c->>'outcomeText', '') end as outcome_text,
  flags.is_wip as work_in_progress,
  flags.is_limited as limited_public,
  coalesce(c->>'coverUrl', '') as cover_url,
  coalesce(
    public.portfolio_json_uuid(coalesce(c #>> '{coverMedia,id}', c #>> '{coverMedia,assetId}')),
    public.media_asset_id_from_url(c->>'coverUrl')
  ) as cover_media_id,
  public.media_asset_manifest(coalesce(
    public.portfolio_json_uuid(coalesce(c #>> '{coverMedia,id}', c #>> '{coverMedia,assetId}')),
    public.media_asset_id_from_url(c->>'coverUrl')
  )) as cover_media,
  coalesce(c->>'coverAlt', '') as cover_alt,
  coalesce(nullif(c->>'coverFocalX', '')::numeric, 50) as cover_focal_x,
  coalesce(nullif(c->>'coverFocalY', '')::numeric, 50) as cover_focal_y,
  coalesce(c->>'seoTitle', '') as seo_title,
  coalesce(c->>'metaDescription', '') as meta_description,
  coalesce(c->>'socialImageUrl', '') as social_image_url,
  coalesce(
    public.portfolio_json_uuid(coalesce(c #>> '{socialImageMedia,id}', c #>> '{socialImageMedia,assetId}')),
    public.media_asset_id_from_url(c->>'socialImageUrl')
  ) as social_image_media_id,
  public.media_asset_manifest(coalesce(
    public.portfolio_json_uuid(coalesce(c #>> '{socialImageMedia,id}', c #>> '{socialImageMedia,assetId}')),
    public.media_asset_id_from_url(c->>'socialImageUrl')
  )) as social_image_media,
  coalesce((c->>'searchVisible')::boolean, true) as search_visible,
  coalesce(nullif(c->>'layoutStyle', '')::integer, 1) as layout_style,
  coalesce((
    select jsonb_agg(block order by ordinal)
    from jsonb_array_elements(coalesce(c->'blocks', '[]'::jsonb))
      with ordinality as blocks(block, ordinal)
    where coalesce((block->>'visible')::boolean, true)
  ), '[]'::jsonb) as blocks,
  public.portfolio_project_media_manifests(c) as media_assets,
  coalesce(c->'taxonomies', '[]'::jsonb) as taxonomies,
  coalesce(c->'organisations', '[]'::jsonb) as organisations,
  case when flags.is_limited then '[]'::jsonb else coalesce(c->'collaborators', '[]'::jsonb) end as collaborators,
  case when flags.is_limited then '[]'::jsonb else coalesce(c->'links', '[]'::jsonb) end as links
from public.portfolio_projects p
cross join lateral (select p.published_content as c) document
cross join lateral (
  select
    coalesce((c->>'workInProgress')::boolean, false) as is_wip,
    coalesce((c->>'workInProgress')::boolean, false)
      and coalesce((c->>'limitedPublic')::boolean, false) as is_limited
) flags
where p.visibility = 'public'
  and p.status in ('published', 'wip')
  and p.published_content is not null;

create view public.portfolio_public_index as
select
  project_id, slug, status, featured_order, revision_number, title, one_line_description,
  year_start, year_end, work_in_progress, limited_public,
  cover_url, cover_media_id, cover_media, cover_alt, cover_focal_x, cover_focal_y,
  search_visible, layout_style, taxonomies, organisations
from public.portfolio_public_projects;

create or replace view public.portfolio_public_redirects as
select r.old_slug, p.slug
from public.portfolio_slug_redirects r
join public.portfolio_projects p on p.id = r.project_id
where p.visibility = 'public'
  and p.status in ('published', 'wip')
  and p.published_content is not null;

-- Media deletion checks the portable documents and backups instead of the
-- legacy revision usage table, so newly uploaded Cloudflare/Supabase URLs are
-- protected as soon as the project is saved.
create or replace function public.portfolio_media_reference_count(p_asset_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_needle text := p_asset_id::text;
  v_count integer;
begin
  if not public.portfolio_is_admin() then
    raise exception 'PORTFOLIO_ADMIN_REQUIRED';
  end if;

  select
    (select count(*) from public.portfolio_projects p
      where p.content::text like '%' || v_needle || '%'
         or coalesce(p.published_content, '{}'::jsonb)::text like '%' || v_needle || '%')
    +
    (select count(*) from public.portfolio_project_backups b
      where b.content::text like '%' || v_needle || '%')
  into v_count;

  return v_count;
end;
$$;

alter table public.portfolio_project_backups enable row level security;

drop policy if exists portfolio_projects_public_read on public.portfolio_projects;
drop policy if exists portfolio_project_backups_admin_all on public.portfolio_project_backups;
create policy portfolio_project_backups_admin_all
on public.portfolio_project_backups for all to authenticated
using (public.portfolio_is_admin())
with check (public.portfolio_is_admin());

grant select on public.portfolio_public_projects, public.portfolio_public_index, public.portfolio_public_redirects
  to anon, authenticated;
grant select on public.portfolio_project_backups, public.portfolio_projects_export to authenticated;
grant execute on function public.portfolio_create_project(text), public.portfolio_save_draft(uuid, integer, jsonb),
  public.portfolio_publish_project(uuid), public.portfolio_restore_revision(uuid, uuid),
  public.portfolio_media_reference_count(uuid) to authenticated;

commit;
