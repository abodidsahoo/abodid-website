begin;

alter table public.research
  add column if not exists content text not null default '',
  add column if not exists gallery_images jsonb not null default '[]'::jsonb,
  add column if not exists experiment_url text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.research
  drop constraint if exists research_gallery_images_is_array,
  add constraint research_gallery_images_is_array
    check (jsonb_typeof(gallery_images) = 'array');

create or replace function public.set_research_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists research_set_updated_at on public.research;
create trigger research_set_updated_at
before update on public.research
for each row execute function public.set_research_updated_at();

notify pgrst, 'reload schema';

commit;
