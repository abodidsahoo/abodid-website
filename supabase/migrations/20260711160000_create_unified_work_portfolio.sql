begin;

create extension if not exists pgcrypto;
create extension if not exists unaccent;

create or replace function public.portfolio_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create table if not exists public.portfolio_projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  status text not null default 'draft' check (status in ('draft', 'published', 'wip', 'archived')),
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  featured_order integer not null default 1000,
  storage_folder text not null,
  draft_revision_id uuid,
  published_revision_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portfolio_project_revisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.portfolio_projects(id) on delete cascade,
  state text not null default 'draft' check (state in ('draft', 'published', 'archived')),
  revision_number integer not null,
  lock_version integer not null default 0,
  title text not null default 'Untitled project',
  one_line_description text not null default '',
  context text not null default '',
  specific_contribution text not null default '',
  year_start integer check (year_start between 1900 and 2200),
  year_end integer check (year_end between 1900 and 2200),
  location text not null default '',
  duration text not null default '',
  outcome_heading text not null default '',
  outcome_text text not null default '',
  work_in_progress boolean not null default false,
  limited_public boolean not null default false,
  cover_url text not null default '',
  cover_alt text not null default '',
  cover_focal_x numeric(5,2) not null default 50 check (cover_focal_x between 0 and 100),
  cover_focal_y numeric(5,2) not null default 50 check (cover_focal_y between 0 and 100),
  seo_title text not null default '',
  meta_description text not null default '',
  social_image_url text not null default '',
  search_visible boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  unique (project_id, revision_number),
  check (year_end is null or year_start is null or year_end >= year_start),
  check (not limited_public or work_in_progress)
);

alter table public.portfolio_projects
  add constraint portfolio_projects_draft_revision_fk
  foreign key (draft_revision_id) references public.portfolio_project_revisions(id) on delete set null;

alter table public.portfolio_projects
  add constraint portfolio_projects_published_revision_fk
  foreign key (published_revision_id) references public.portfolio_project_revisions(id) on delete set null;

create table if not exists public.portfolio_project_blocks (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references public.portfolio_project_revisions(id) on delete cascade,
  block_type text not null check (block_type in ('body_text','heading','quotation','highlight','testimonial','single_image','image_grid','image_gallery','video_embed','media_text','external_link','divider')),
  content_jsonb jsonb not null default '{}'::jsonb,
  settings_jsonb jsonb not null default '{}'::jsonb,
  visible boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portfolio_taxonomy_terms (
  id uuid primary key default gen_random_uuid(),
  group_type text not null check (group_type in ('primary','role','genre','theme','method','technology','project_type')),
  label text not null,
  slug text not null,
  aliases text[] not null default '{}',
  sort_order integer not null default 1000,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_type, slug)
);

create unique index if not exists portfolio_taxonomy_terms_normalized_label_idx
  on public.portfolio_taxonomy_terms (group_type, lower(label));

create table if not exists public.portfolio_revision_taxonomy (
  revision_id uuid not null references public.portfolio_project_revisions(id) on delete cascade,
  term_id uuid not null references public.portfolio_taxonomy_terms(id) on delete restrict,
  display_order integer not null default 0,
  primary key (revision_id, term_id)
);

create table if not exists public.portfolio_organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  url text not null default '',
  logo_media_id uuid,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists portfolio_organisations_normalized_name_idx
  on public.portfolio_organisations (lower(name));

create table if not exists public.portfolio_revision_organisations (
  revision_id uuid not null references public.portfolio_project_revisions(id) on delete cascade,
  organisation_id uuid not null references public.portfolio_organisations(id) on delete restrict,
  relationship_label text not null default '',
  display_order integer not null default 0,
  primary key (revision_id, organisation_id)
);

create table if not exists public.portfolio_collaborators (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  primary_url text not null default '',
  secondary_url text not null default '',
  organisation text not null default '',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portfolio_revision_collaborators (
  revision_id uuid not null references public.portfolio_project_revisions(id) on delete cascade,
  collaborator_id uuid not null references public.portfolio_collaborators(id) on delete restrict,
  role_label text not null default '',
  primary_url text not null default '',
  secondary_url text not null default '',
  organisation text not null default '',
  display_order integer not null default 0,
  primary key (revision_id, collaborator_id)
);

create table if not exists public.portfolio_media_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.portfolio_projects(id) on delete set null,
  storage_path text not null unique,
  public_url text not null,
  original_filename text not null,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','image/gif')),
  file_size bigint not null default 0 check (file_size <= 20971520),
  width integer,
  height integer,
  alt_text text not null default '',
  caption text not null default '',
  credit text not null default '',
  decorative boolean not null default false,
  focal_x numeric(5,2) not null default 50 check (focal_x between 0 and 100),
  focal_y numeric(5,2) not null default 50 check (focal_y between 0 and 100),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.portfolio_organisations
  add constraint portfolio_organisations_logo_media_fk
  foreign key (logo_media_id) references public.portfolio_media_assets(id) on delete set null;

create table if not exists public.portfolio_revision_links (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references public.portfolio_project_revisions(id) on delete cascade,
  link_type text not null default 'external' check (link_type in ('photography','film','website','publication','vimeo','youtube','external')),
  label text not null,
  url text not null,
  display_order integer not null default 0
);

create table if not exists public.portfolio_slug_redirects (
  old_slug text primary key,
  project_id uuid not null references public.portfolio_projects(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists portfolio_projects_order_idx on public.portfolio_projects(featured_order);
create index if not exists portfolio_revisions_project_idx on public.portfolio_project_revisions(project_id, revision_number desc);
create index if not exists portfolio_blocks_revision_order_idx on public.portfolio_project_blocks(revision_id, position);
create index if not exists portfolio_revision_taxonomy_term_idx on public.portfolio_revision_taxonomy(term_id, revision_id);

create or replace function public.portfolio_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists portfolio_projects_touch on public.portfolio_projects;
create trigger portfolio_projects_touch before update on public.portfolio_projects
for each row execute function public.portfolio_touch_updated_at();
drop trigger if exists portfolio_revisions_touch on public.portfolio_project_revisions;
create trigger portfolio_revisions_touch before update on public.portfolio_project_revisions
for each row execute function public.portfolio_touch_updated_at();
drop trigger if exists portfolio_blocks_touch on public.portfolio_project_blocks;
create trigger portfolio_blocks_touch before update on public.portfolio_project_blocks
for each row execute function public.portfolio_touch_updated_at();
drop trigger if exists portfolio_taxonomy_touch on public.portfolio_taxonomy_terms;
create trigger portfolio_taxonomy_touch before update on public.portfolio_taxonomy_terms
for each row execute function public.portfolio_touch_updated_at();
drop trigger if exists portfolio_organisations_touch on public.portfolio_organisations;
create trigger portfolio_organisations_touch before update on public.portfolio_organisations
for each row execute function public.portfolio_touch_updated_at();
drop trigger if exists portfolio_collaborators_touch on public.portfolio_collaborators;
create trigger portfolio_collaborators_touch before update on public.portfolio_collaborators
for each row execute function public.portfolio_touch_updated_at();
drop trigger if exists portfolio_media_touch on public.portfolio_media_assets;
create trigger portfolio_media_touch before update on public.portfolio_media_assets
for each row execute function public.portfolio_touch_updated_at();

create or replace function public.portfolio_slugify(value text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(extensions.unaccent(coalesce(value, ''))), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function public.portfolio_create_project(p_title text default 'Untitled project')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid := gen_random_uuid();
  v_revision_id uuid := gen_random_uuid();
  v_base_slug text := nullif(public.portfolio_slugify(p_title), '');
  v_slug text;
  v_order integer;
begin
  if not public.portfolio_is_admin() then raise exception 'PORTFOLIO_ADMIN_REQUIRED'; end if;
  v_base_slug := coalesce(v_base_slug, 'untitled-project');
  v_slug := v_base_slug;
  if exists (select 1 from public.portfolio_projects where slug = v_slug) then
    v_slug := v_base_slug || '-' || substr(replace(v_project_id::text, '-', ''), 1, 6);
  end if;
  select coalesce(max(featured_order), 0) + 10 into v_order from public.portfolio_projects;
  insert into public.portfolio_projects(id, slug, storage_folder, featured_order, created_by)
  values (v_project_id, v_slug, array_to_string((string_to_array(v_slug, '-'))[1:5], '-'), v_order, auth.uid());
  insert into public.portfolio_project_revisions(id, project_id, state, revision_number, title, created_by)
  values (v_revision_id, v_project_id, 'draft', 1, coalesce(nullif(trim(p_title), ''), 'Untitled project'), auth.uid());
  update public.portfolio_projects set draft_revision_id = v_revision_id where id = v_project_id;
  return v_project_id;
end;
$$;

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
  v_item jsonb;
  v_term_id uuid;
  v_org_id uuid;
  v_collaborator_id uuid;
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
    search_visible = coalesce((p_payload->>'searchVisible')::boolean, true)
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
      insert into public.portfolio_collaborators(name, primary_url, secondary_url, organisation)
      values (trim(v_item->>'name'), coalesce(v_item->>'primaryUrl', ''), coalesce(v_item->>'secondaryUrl', ''), coalesce(v_item->>'organisation', ''))
      returning id into v_collaborator_id;
      insert into public.portfolio_revision_collaborators(revision_id, collaborator_id, role_label, primary_url, secondary_url, organisation, display_order)
      values (v_revision.id, v_collaborator_id, coalesce(v_item->>'roleLabel', ''), coalesce(v_item->>'primaryUrl', ''), coalesce(v_item->>'secondaryUrl', ''), coalesce(v_item->>'organisation', ''), v_index);
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
    created_by, published_at
  ) select
    v_published_id, project_id, 'published', v_number, 0, title, one_line_description, context, specific_contribution,
    year_start, year_end, location, duration, outcome_heading, outcome_text, work_in_progress, limited_public,
    cover_url, cover_alt, cover_focal_x, cover_focal_y, seo_title, meta_description, social_image_url, search_visible,
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
    cover_url, cover_alt, cover_focal_x, cover_focal_y, seo_title, meta_description, social_image_url, search_visible, created_by
  ) select
    v_draft_id, project_id, 'draft', v_number, 0, title, one_line_description, context, specific_contribution,
    year_start, year_end, location, duration, outcome_heading, outcome_text, work_in_progress, limited_public,
    cover_url, cover_alt, cover_focal_x, cover_focal_y, seo_title, meta_description, social_image_url, search_visible, auth.uid()
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

create or replace function public.portfolio_reorder_projects(p_project_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.portfolio_is_admin() then raise exception 'PORTFOLIO_ADMIN_REQUIRED'; end if;
  update public.portfolio_projects p set featured_order = ordering.ordinality * 10
  from unnest(p_project_ids) with ordinality as ordering(id, ordinality)
  where p.id = ordering.id;
end;
$$;

create or replace function public.portfolio_update_slug(p_project_id uuid, p_slug text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_slug text;
  v_new_slug text := public.portfolio_slugify(p_slug);
begin
  if not public.portfolio_is_admin() then raise exception 'PORTFOLIO_ADMIN_REQUIRED'; end if;
  if nullif(v_new_slug, '') is null then raise exception 'PORTFOLIO_SLUG_REQUIRED'; end if;
  select slug into v_old_slug from public.portfolio_projects where id = p_project_id for update;
  if not found then raise exception 'PORTFOLIO_PROJECT_NOT_FOUND'; end if;
  if v_old_slug = v_new_slug then return v_new_slug; end if;
  if exists (select 1 from public.portfolio_projects where slug = v_new_slug and id <> p_project_id) then
    raise exception 'PORTFOLIO_SLUG_TAKEN';
  end if;
  insert into public.portfolio_slug_redirects(old_slug, project_id) values (v_old_slug, p_project_id)
  on conflict (old_slug) do update set project_id = excluded.project_id;
  delete from public.portfolio_slug_redirects where old_slug = v_new_slug and project_id = p_project_id;
  update public.portfolio_projects set slug = v_new_slug where id = p_project_id;
  return v_new_slug;
end;
$$;

create or replace function public.portfolio_merge_taxonomy_terms(p_source uuid, p_target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.portfolio_is_admin() then raise exception 'PORTFOLIO_ADMIN_REQUIRED'; end if;
  if p_source = p_target then return; end if;
  insert into public.portfolio_revision_taxonomy(revision_id, term_id, display_order)
  select revision_id, p_target, display_order from public.portfolio_revision_taxonomy where term_id = p_source
  on conflict do nothing;
  delete from public.portfolio_revision_taxonomy where term_id = p_source;
  update public.portfolio_taxonomy_terms set archived = true where id = p_source;
end;
$$;

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

create or replace view public.portfolio_public_index as
select project_id, slug, status, featured_order, revision_number, title, one_line_description,
  year_start, year_end, work_in_progress, limited_public, cover_url, cover_alt, cover_focal_x, cover_focal_y,
  search_visible, taxonomies, organisations
from public.portfolio_public_projects;

create or replace view public.portfolio_public_redirects as
select r.old_slug, p.slug
from public.portfolio_slug_redirects r
join public.portfolio_projects p on p.id = r.project_id
where p.visibility = 'public' and p.status in ('published','wip') and p.published_revision_id is not null;

alter table public.portfolio_projects enable row level security;
alter table public.portfolio_project_revisions enable row level security;
alter table public.portfolio_project_blocks enable row level security;
alter table public.portfolio_taxonomy_terms enable row level security;
alter table public.portfolio_revision_taxonomy enable row level security;
alter table public.portfolio_organisations enable row level security;
alter table public.portfolio_revision_organisations enable row level security;
alter table public.portfolio_collaborators enable row level security;
alter table public.portfolio_revision_collaborators enable row level security;
alter table public.portfolio_media_assets enable row level security;
alter table public.portfolio_revision_links enable row level security;
alter table public.portfolio_slug_redirects enable row level security;

create policy portfolio_projects_public_read on public.portfolio_projects for select
using (visibility = 'public' and status in ('published','wip') and published_revision_id is not null);
create policy portfolio_projects_admin_all on public.portfolio_projects for all
using (public.portfolio_is_admin()) with check (public.portfolio_is_admin());
create policy portfolio_revisions_public_read on public.portfolio_project_revisions for select
using (not limited_public and exists (select 1 from public.portfolio_projects p where p.published_revision_id = portfolio_project_revisions.id and p.visibility = 'public' and p.status in ('published','wip')));
create policy portfolio_revisions_admin_read on public.portfolio_project_revisions for select using (public.portfolio_is_admin());
create policy portfolio_revisions_admin_insert on public.portfolio_project_revisions for insert with check (public.portfolio_is_admin() and state = 'draft');
create policy portfolio_revisions_admin_update_draft on public.portfolio_project_revisions for update
using (public.portfolio_is_admin() and state = 'draft') with check (public.portfolio_is_admin() and state = 'draft');
create policy portfolio_blocks_public_read on public.portfolio_project_blocks for select
using (exists (select 1 from public.portfolio_projects p join public.portfolio_project_revisions r on r.id = p.published_revision_id where p.published_revision_id = portfolio_project_blocks.revision_id and not r.limited_public and p.visibility = 'public' and p.status in ('published','wip')));
create policy portfolio_blocks_admin_all on public.portfolio_project_blocks for all using (public.portfolio_is_admin()) with check (public.portfolio_is_admin());
create policy portfolio_taxonomy_public_read on public.portfolio_taxonomy_terms for select using (not archived);
create policy portfolio_taxonomy_admin_all on public.portfolio_taxonomy_terms for all using (public.portfolio_is_admin()) with check (public.portfolio_is_admin());
create policy portfolio_revision_taxonomy_public_read on public.portfolio_revision_taxonomy for select
using (exists (select 1 from public.portfolio_projects p where p.published_revision_id = portfolio_revision_taxonomy.revision_id and p.visibility = 'public' and p.status in ('published','wip')));
create policy portfolio_revision_taxonomy_admin_all on public.portfolio_revision_taxonomy for all using (public.portfolio_is_admin()) with check (public.portfolio_is_admin());
create policy portfolio_organisations_public_read on public.portfolio_organisations for select using (not archived);
create policy portfolio_organisations_admin_all on public.portfolio_organisations for all using (public.portfolio_is_admin()) with check (public.portfolio_is_admin());
create policy portfolio_revision_organisations_public_read on public.portfolio_revision_organisations for select
using (exists (select 1 from public.portfolio_projects p where p.published_revision_id = portfolio_revision_organisations.revision_id and p.visibility = 'public' and p.status in ('published','wip')));
create policy portfolio_revision_organisations_admin_all on public.portfolio_revision_organisations for all using (public.portfolio_is_admin()) with check (public.portfolio_is_admin());
create policy portfolio_collaborators_admin_all on public.portfolio_collaborators for all using (public.portfolio_is_admin()) with check (public.portfolio_is_admin());
create policy portfolio_collaborators_public_read on public.portfolio_collaborators for select
using (exists (select 1 from public.portfolio_revision_collaborators rc join public.portfolio_projects p on p.published_revision_id = rc.revision_id where rc.collaborator_id = portfolio_collaborators.id and p.visibility = 'public' and p.status in ('published','wip')));
create policy portfolio_revision_collaborators_public_read on public.portfolio_revision_collaborators for select
using (exists (select 1 from public.portfolio_projects p join public.portfolio_project_revisions r on r.id = p.published_revision_id where p.published_revision_id = portfolio_revision_collaborators.revision_id and not r.limited_public and p.visibility = 'public' and p.status in ('published','wip')));
create policy portfolio_revision_collaborators_admin_all on public.portfolio_revision_collaborators for all using (public.portfolio_is_admin()) with check (public.portfolio_is_admin());
create policy portfolio_media_public_read on public.portfolio_media_assets for select
using (exists (select 1 from public.portfolio_projects p where p.id = portfolio_media_assets.project_id and p.published_revision_id is not null and p.visibility = 'public' and p.status in ('published','wip')));
create policy portfolio_media_admin_all on public.portfolio_media_assets for all using (public.portfolio_is_admin()) with check (public.portfolio_is_admin());
create policy portfolio_links_public_read on public.portfolio_revision_links for select
using (exists (select 1 from public.portfolio_projects p join public.portfolio_project_revisions r on r.id = p.published_revision_id where p.published_revision_id = portfolio_revision_links.revision_id and not r.limited_public and p.visibility = 'public' and p.status in ('published','wip')));
create policy portfolio_links_admin_all on public.portfolio_revision_links for all using (public.portfolio_is_admin()) with check (public.portfolio_is_admin());
create policy portfolio_redirects_public_read on public.portfolio_slug_redirects for select using (true);
create policy portfolio_redirects_admin_all on public.portfolio_slug_redirects for all using (public.portfolio_is_admin()) with check (public.portfolio_is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portfolio-media', 'portfolio-media', true, 20971520, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy portfolio_storage_public_read on storage.objects for select
using (bucket_id = 'portfolio-media');
create policy portfolio_storage_admin_insert on storage.objects for insert
with check (bucket_id = 'portfolio-media' and public.portfolio_is_admin());
create policy portfolio_storage_admin_update on storage.objects for update
using (bucket_id = 'portfolio-media' and public.portfolio_is_admin())
with check (bucket_id = 'portfolio-media' and public.portfolio_is_admin());
create policy portfolio_storage_admin_delete on storage.objects for delete
using (bucket_id = 'portfolio-media' and public.portfolio_is_admin());

grant usage on schema public to anon, authenticated;
grant select on public.portfolio_public_projects, public.portfolio_public_index, public.portfolio_public_redirects to anon;
grant select on public.portfolio_projects, public.portfolio_project_revisions, public.portfolio_project_blocks,
  public.portfolio_taxonomy_terms, public.portfolio_revision_taxonomy, public.portfolio_organisations,
  public.portfolio_revision_organisations, public.portfolio_collaborators, public.portfolio_revision_collaborators,
  public.portfolio_media_assets, public.portfolio_revision_links, public.portfolio_slug_redirects,
  public.portfolio_public_projects, public.portfolio_public_index, public.portfolio_public_redirects to authenticated;
grant insert, update on public.portfolio_projects, public.portfolio_project_revisions, public.portfolio_project_blocks,
  public.portfolio_taxonomy_terms, public.portfolio_revision_taxonomy, public.portfolio_organisations,
  public.portfolio_revision_organisations, public.portfolio_collaborators, public.portfolio_revision_collaborators,
  public.portfolio_media_assets, public.portfolio_revision_links, public.portfolio_slug_redirects to authenticated;
grant execute on function public.portfolio_create_project(text), public.portfolio_save_draft(uuid, integer, jsonb),
  public.portfolio_publish_project(uuid), public.portfolio_restore_revision(uuid, uuid), public.portfolio_reorder_projects(uuid[]),
  public.portfolio_update_slug(uuid, text), public.portfolio_merge_taxonomy_terms(uuid, uuid) to authenticated;

commit;
