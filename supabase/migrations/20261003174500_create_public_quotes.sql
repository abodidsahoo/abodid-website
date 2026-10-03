create extension if not exists pgcrypto;

create table if not exists public.quotes (
    id uuid primary key default gen_random_uuid(),
    body text not null,
    created_at timestamptz not null default now(),
    constraint quotes_body_not_blank check (char_length(btrim(body)) >= 1)
);

create index if not exists quotes_created_at_idx
    on public.quotes (created_at desc);

alter table public.quotes enable row level security;

drop policy if exists "Quotes are publicly readable" on public.quotes;
create policy "Quotes are publicly readable"
    on public.quotes
    for select
    to anon, authenticated
    using (true);

revoke all on table public.quotes from anon, authenticated;
grant select on table public.quotes to anon, authenticated;
grant all on table public.quotes to service_role;

comment on table public.quotes is
    'Public quote collection. Reads are public; writes pass through the rate-limited server endpoint.';

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'quotes'
    ) then
      execute 'alter publication supabase_realtime add table public.quotes';
    end if;
  end if;
end;
$$;
