begin;

alter table public.media_mentions
  add column if not exists sort_order integer,
  add column if not exists image_alt text not null default '',
  add column if not exists updated_at timestamptz not null default now();

with ranked as (
  select
    id,
    row_number() over (
      order by published_at desc nulls last, created_at desc nulls last, id
    ) - 1 as position
  from public.media_mentions
)
update public.media_mentions as mention
set sort_order = ranked.position
from ranked
where mention.id = ranked.id
  and mention.sort_order is null;

alter table public.media_mentions
  alter column sort_order set default 0,
  alter column sort_order set not null;

create index if not exists media_mentions_public_order_idx
  on public.media_mentions (published, sort_order, published_at desc);

create or replace function public.media_mentions_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists media_mentions_touch on public.media_mentions;
create trigger media_mentions_touch
before update on public.media_mentions
for each row execute function public.media_mentions_touch_updated_at();

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'media_mentions'
      and policyname = 'Media mentions admin write'
  ) then
    create policy "Media mentions admin write"
      on public.media_mentions
      for all
      to authenticated
      using (public.portfolio_is_admin())
      with check (public.portfolio_is_admin());
  end if;
end;
$$;

grant insert, update, delete on public.media_mentions to authenticated;

commit;
