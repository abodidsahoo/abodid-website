begin;

-- One immutable catalogue row represents the original object. Generated files
-- live in media_variants and can be replaced without changing portfolio data.
alter table public.media_assets
  add column if not exists origin_project_id uuid references public.portfolio_projects(id) on delete set null,
  add column if not exists processing_status text not null default 'uploaded',
  add column if not exists processing_error text,
  add column if not exists transform_version integer not null default 1,
  add column if not exists ready_at timestamptz,
  add column if not exists last_processed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'media_assets_processing_status_check'
  ) then
    alter table public.media_assets
      add constraint media_assets_processing_status_check
      check (processing_status in ('uploaded', 'processing', 'ready', 'failed', 'ignored'));
  end if;
end;
$$;

create index if not exists media_assets_processing_idx
  on public.media_assets(processing_status, updated_at desc);
create index if not exists media_assets_origin_project_idx
  on public.media_assets(origin_project_id, created_at desc);

create unique index if not exists portfolio_projects_storage_folder_unique_idx
  on public.portfolio_projects(lower(storage_folder));

create table if not exists public.media_variants (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.media_assets(id) on delete cascade,
  variant_key text not null check (variant_key in ('800', '1600')),
  target_width integer not null check (target_width in (800, 1600)),
  actual_width integer not null check (actual_width > 0),
  actual_height integer not null check (actual_height > 0),
  object_key text not null unique,
  public_url text not null,
  mime_type text not null default 'image/webp' check (mime_type = 'image/webp'),
  file_size bigint not null default 0 check (file_size >= 0),
  etag text,
  quality integer not null default 82 check (quality between 1 and 100),
  animated boolean not null default false,
  source_etag text,
  transform_version integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (asset_id, variant_key)
);

create index if not exists media_variants_asset_idx
  on public.media_variants(asset_id, target_width);

drop trigger if exists media_variants_touch on public.media_variants;
create trigger media_variants_touch
before update on public.media_variants
for each row execute function public.media_assets_touch_updated_at();

-- Covers and social images use direct foreign keys. Block media remains in the
-- block JSON for authoring, while this usage table supplies referential
-- integrity, deletion safety, and efficient public manifest hydration.
alter table public.portfolio_project_revisions
  add column if not exists cover_media_id uuid references public.media_assets(id) on delete set null,
  add column if not exists social_image_media_id uuid references public.media_assets(id) on delete set null;

create table if not exists public.portfolio_media_usages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.portfolio_projects(id) on delete cascade,
  revision_id uuid not null references public.portfolio_project_revisions(id) on delete cascade,
  block_id uuid references public.portfolio_project_blocks(id) on delete cascade,
  asset_id uuid not null references public.media_assets(id) on delete restrict,
  usage_kind text not null check (usage_kind in ('cover', 'social', 'block')),
  media_index integer not null default 0 check (media_index >= 0),
  created_at timestamptz not null default now()
);

create unique index if not exists portfolio_media_usages_block_slot_idx
  on public.portfolio_media_usages(block_id, media_index)
  where block_id is not null;
create unique index if not exists portfolio_media_usages_revision_cover_idx
  on public.portfolio_media_usages(revision_id, usage_kind)
  where block_id is null;
create index if not exists portfolio_media_usages_asset_idx
  on public.portfolio_media_usages(asset_id, revision_id);
create index if not exists portfolio_media_usages_project_idx
  on public.portfolio_media_usages(project_id, revision_id);

create or replace function public.media_asset_id_from_url(p_url text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from (
    select a.id, 0 as priority
    from public.media_assets a
    where a.public_url = nullif(trim(p_url), '')
    union all
    select v.asset_id, 1 as priority
    from public.media_variants v
    where v.public_url = nullif(trim(p_url), '')
  ) matches
  order by priority
  limit 1;
$$;

create or replace function public.media_asset_manifest(p_asset_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', a.id,
    'url', a.public_url,
    'originalUrl', a.public_url,
    'storagePath', a.object_key,
    'objectKey', a.object_key,
    'originalFilename', a.original_filename,
    'mimeType', a.mime_type,
    'fileSize', a.file_size,
    'width', a.width,
    'height', a.height,
    'alt', a.alt_text,
    'caption', a.caption,
    'credit', a.credit,
    'focalX', 50,
    'focalY', 50,
    'processingStatus', a.processing_status,
    'processingError', a.processing_error,
    'variants', coalesce((
      select jsonb_object_agg(
        v.variant_key,
        jsonb_build_object(
          'key', v.variant_key,
          'url', v.public_url,
          'width', v.actual_width,
          'height', v.actual_height,
          'targetWidth', v.target_width,
          'fileSize', v.file_size,
          'mimeType', v.mime_type
        )
        order by v.target_width
      )
      from public.media_variants v
      where v.asset_id = a.id
    ), '{}'::jsonb)
  )
  from public.media_assets a
  where a.id = p_asset_id;
$$;

create or replace function public.portfolio_resolve_revision_media_ids()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.cover_media_id := case
      when nullif(trim(new.cover_url), '') is null then null
      else coalesce(new.cover_media_id, public.media_asset_id_from_url(new.cover_url))
    end;
    new.social_image_media_id := case
      when nullif(trim(new.social_image_url), '') is null then null
      else coalesce(new.social_image_media_id, public.media_asset_id_from_url(new.social_image_url))
    end;
    return new;
  end if;

  if nullif(trim(new.cover_url), '') is null then
    new.cover_media_id := null;
  elsif new.cover_media_id is null
     or new.cover_url is distinct from old.cover_url then
    new.cover_media_id := public.media_asset_id_from_url(new.cover_url);
  end if;

  if nullif(trim(new.social_image_url), '') is null then
    new.social_image_media_id := null;
  elsif new.social_image_media_id is null
     or new.social_image_url is distinct from old.social_image_url then
    new.social_image_media_id := public.media_asset_id_from_url(new.social_image_url);
  end if;

  return new;
end;
$$;

drop trigger if exists portfolio_resolve_revision_media_ids on public.portfolio_project_revisions;
create trigger portfolio_resolve_revision_media_ids
before insert or update of cover_url, social_image_url, cover_media_id, social_image_media_id
on public.portfolio_project_revisions
for each row execute function public.portfolio_resolve_revision_media_ids();

create or replace function public.portfolio_sync_revision_media_usages()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.portfolio_media_usages
  where revision_id = new.id and block_id is null;

  if new.cover_media_id is not null then
    insert into public.portfolio_media_usages(project_id, revision_id, asset_id, usage_kind, media_index)
    values (new.project_id, new.id, new.cover_media_id, 'cover', 0);
  end if;

  if new.social_image_media_id is not null then
    insert into public.portfolio_media_usages(project_id, revision_id, asset_id, usage_kind, media_index)
    values (new.project_id, new.id, new.social_image_media_id, 'social', 0);
  end if;

  return new;
end;
$$;

drop trigger if exists portfolio_sync_revision_media_usages on public.portfolio_project_revisions;
create trigger portfolio_sync_revision_media_usages
after insert or update of cover_media_id, social_image_media_id
on public.portfolio_project_revisions
for each row execute function public.portfolio_sync_revision_media_usages();

create or replace function public.portfolio_sync_block_media_usages()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
  v_media jsonb;
  v_item jsonb;
  v_asset_text text;
  v_asset_id uuid;
  v_index integer := 0;
begin
  if tg_op = 'DELETE' then
    delete from public.portfolio_media_usages where block_id = old.id;
    return old;
  end if;

  delete from public.portfolio_media_usages where block_id = new.id;
  select r.project_id into v_project_id
  from public.portfolio_project_revisions r
  where r.id = new.revision_id;

  v_media := new.content_jsonb->'media';
  if v_media is null then return new; end if;

  for v_item in
    select item
    from (
      select value as item
      from jsonb_array_elements(
        case when jsonb_typeof(v_media) = 'array' then v_media else jsonb_build_array(v_media) end
      )
    ) media_items
  loop
    v_asset_text := coalesce(v_item->>'id', v_item->>'assetId');
    v_asset_id := null;
    if v_asset_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      v_asset_id := v_asset_text::uuid;
    end if;

    if v_asset_id is not null and exists (
      select 1 from public.media_assets where id = v_asset_id
    ) then
      insert into public.portfolio_media_usages(
        project_id, revision_id, block_id, asset_id, usage_kind, media_index
      ) values (
        v_project_id, new.revision_id, new.id, v_asset_id, 'block', v_index
      );
    end if;
    v_index := v_index + 1;
  end loop;

  return new;
end;
$$;

drop trigger if exists portfolio_sync_block_media_usages on public.portfolio_project_blocks;
create trigger portfolio_sync_block_media_usages
after insert or update of content_jsonb, revision_id or delete
on public.portfolio_project_blocks
for each row execute function public.portfolio_sync_block_media_usages();

create or replace function public.media_rebuild_portfolio_usages()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.portfolio_media_usages where id is not null;

  update public.portfolio_project_revisions r
  set cover_media_id = public.media_asset_id_from_url(r.cover_url),
      social_image_media_id = public.media_asset_id_from_url(r.social_image_url)
  where r.id is not null;

  update public.portfolio_project_blocks
  set content_jsonb = content_jsonb
  where id is not null;
end;
$$;

create or replace function public.portfolio_media_reference_count(p_asset_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.portfolio_is_admin() then
    raise exception 'PORTFOLIO_ADMIN_REQUIRED';
  end if;
  return (
    select count(*)::integer
    from public.portfolio_media_usages
    where asset_id = p_asset_id
  );
end;
$$;

alter table public.media_variants enable row level security;
alter table public.portfolio_media_usages enable row level security;

drop policy if exists media_variants_admin_all on public.media_variants;
create policy media_variants_admin_all
on public.media_variants for all to authenticated
using (public.media_assets_is_admin())
with check (public.media_assets_is_admin());

drop policy if exists portfolio_media_usages_admin_all on public.portfolio_media_usages;
create policy portfolio_media_usages_admin_all
on public.portfolio_media_usages for all to authenticated
using (public.portfolio_is_admin())
with check (public.portfolio_is_admin());

grant select, insert, update, delete on public.media_variants to authenticated;
grant select on public.portfolio_media_usages to authenticated;
grant all on public.media_variants, public.portfolio_media_usages to service_role;
grant execute on function public.media_asset_id_from_url(text) to authenticated, service_role;
grant execute on function public.media_asset_manifest(uuid) to authenticated, service_role;
grant execute on function public.media_rebuild_portfolio_usages() to service_role;
grant execute on function public.portfolio_media_reference_count(uuid) to authenticated;

-- Public portfolio views expose an asset manifest. The renderer hydrates block
-- media by immutable ID and falls back to the original until variants exist.
drop view if exists public.portfolio_public_index cascade;
drop view if exists public.portfolio_public_projects cascade;

create view public.portfolio_public_projects as
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
  r.work_in_progress, r.limited_public,
  r.cover_url, r.cover_media_id, public.media_asset_manifest(r.cover_media_id) as cover_media,
  r.cover_alt, r.cover_focal_x, r.cover_focal_y,
  r.seo_title, r.meta_description,
  r.social_image_url, r.social_image_media_id,
  public.media_asset_manifest(r.social_image_media_id) as social_image_media,
  r.search_visible, r.layout_style,
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', b.id,
      'block_type', b.block_type,
      'content_jsonb', b.content_jsonb,
      'settings_jsonb', b.settings_jsonb,
      'visible', b.visible,
      'position', b.position
    ) order by b.position)
    from public.portfolio_project_blocks b
    where b.revision_id = r.id and b.visible
  ), '[]'::jsonb) as blocks,
  coalesce((
    select jsonb_agg(public.media_asset_manifest(used.asset_id))
    from (
      select distinct u.asset_id
      from public.portfolio_media_usages u
      left join public.portfolio_project_blocks b on b.id = u.block_id
      where u.revision_id = r.id
        and (u.block_id is null or b.visible)
    ) used
  ), '[]'::jsonb) as media_assets,
  coalesce((
    select jsonb_agg(jsonb_build_object('id', t.id, 'group_type', t.group_type, 'label', t.label, 'slug', t.slug) order by rt.display_order)
    from public.portfolio_revision_taxonomy rt
    join public.portfolio_taxonomy_terms t on t.id = rt.term_id
    where rt.revision_id = r.id and not t.archived
  ), '[]'::jsonb) as taxonomies,
  coalesce((
    select jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'slug', o.slug, 'url', o.url, 'relationship_label', ro.relationship_label, 'display_order', ro.display_order) order by ro.display_order)
    from public.portfolio_revision_organisations ro
    join public.portfolio_organisations o on o.id = ro.organisation_id
    where ro.revision_id = r.id
  ), '[]'::jsonb) as organisations,
  case when r.work_in_progress and r.limited_public then '[]'::jsonb else coalesce((
    select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'role_label', rc.role_label, 'primary_url', coalesce(nullif(rc.primary_url,''),c.primary_url), 'secondary_url', coalesce(nullif(rc.secondary_url,''),c.secondary_url), 'organisation', coalesce(nullif(rc.organisation,''),c.organisation), 'display_order', rc.display_order) order by rc.display_order)
    from public.portfolio_revision_collaborators rc
    join public.portfolio_collaborators c on c.id = rc.collaborator_id
    where rc.revision_id = r.id
  ), '[]'::jsonb) end as collaborators,
  case when r.work_in_progress and r.limited_public then '[]'::jsonb else coalesce((
    select jsonb_agg(jsonb_build_object('id', l.id, 'link_type', l.link_type, 'label', l.label, 'url', l.url, 'display_order', l.display_order) order by l.display_order)
    from public.portfolio_revision_links l
    where l.revision_id = r.id
  ), '[]'::jsonb) end as links
from public.portfolio_projects p
join public.portfolio_project_revisions r on r.id = p.published_revision_id
where p.visibility = 'public' and p.status in ('published','wip');

create view public.portfolio_public_index as
select project_id, slug, status, featured_order, revision_number, title, one_line_description,
  year_start, year_end, work_in_progress, limited_public,
  cover_url, cover_media_id, cover_media, cover_alt, cover_focal_x, cover_focal_y,
  search_visible, layout_style, taxonomies, organisations
from public.portfolio_public_projects;

grant select on public.portfolio_public_projects, public.portfolio_public_index to anon, authenticated;

commit;
