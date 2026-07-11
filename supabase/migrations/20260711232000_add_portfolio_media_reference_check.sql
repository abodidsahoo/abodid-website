begin;

create or replace function public.portfolio_media_reference_count(p_asset_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asset public.portfolio_media_assets%rowtype;
  v_count integer := 0;
begin
  if not public.portfolio_is_admin() then raise exception 'PORTFOLIO_ADMIN_REQUIRED'; end if;
  select * into v_asset from public.portfolio_media_assets where id = p_asset_id;
  if not found then return 0; end if;

  select count(*) into v_count
  from public.portfolio_project_revisions r
  where r.cover_url = v_asset.public_url or r.social_image_url = v_asset.public_url;

  v_count := v_count + (
    select count(*) from public.portfolio_project_blocks b
    where position(p_asset_id::text in b.content_jsonb::text) > 0
       or position(v_asset.storage_path in b.content_jsonb::text) > 0
       or position(v_asset.public_url in b.content_jsonb::text) > 0
  );

  v_count := v_count + (
    select count(*) from public.portfolio_organisations o where o.logo_media_id = p_asset_id
  );

  return v_count;
end;
$$;

grant execute on function public.portfolio_media_reference_count(uuid) to authenticated;
grant delete on public.portfolio_media_assets to authenticated;

commit;

