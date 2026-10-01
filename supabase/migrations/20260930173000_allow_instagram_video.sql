begin;

create or replace function public.social_validate_media_ids()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_valid_count integer;
begin
  if cardinality(new.media_ids) <> (
    select count(distinct item) from unnest(new.media_ids) item
  ) then
    raise exception 'A media item can only appear once in a social post';
  end if;

  select count(*) into v_valid_count
  from public.media_assets
  where id = any(new.media_ids)
    and lower(mime_type) in ('image/jpeg', 'image/jpg', 'video/mp4');

  if v_valid_count <> cardinality(new.media_ids) then
    raise exception 'Every social post item must reference an Instagram-ready JPEG or MP4 in the Media Library';
  end if;
  return new;
end;
$$;

commit;
