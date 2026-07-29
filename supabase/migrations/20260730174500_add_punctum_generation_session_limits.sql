begin;

alter table public.punctum_generations
  add column if not exists generation_session_hash text;

update public.punctum_generations
set generation_session_hash = access_token_hash
where generation_session_hash is null;

alter table public.punctum_generations
  alter column generation_session_hash set not null;

create index if not exists punctum_generations_session_created_idx
  on public.punctum_generations (generation_session_hash, created_at);

create unique index if not exists punctum_generations_one_active_per_session_idx
  on public.punctum_generations (generation_session_hash)
  where status in ('pending', 'processing');

commit;
