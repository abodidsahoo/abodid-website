begin;

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

grant execute on function public.media_rebuild_portfolio_usages() to service_role;

commit;
