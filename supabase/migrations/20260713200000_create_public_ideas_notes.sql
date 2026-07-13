create extension if not exists pgcrypto;

create table if not exists public.ideas_notes (
    id uuid primary key default gen_random_uuid(),
    title text,
    body text not null,
    created_at timestamptz not null default now(),
    constraint ideas_notes_title_length check (
        title is null or char_length(btrim(title)) between 1 and 120
    ),
    constraint ideas_notes_body_length check (
        char_length(btrim(body)) between 1 and 2000
    )
);

create index if not exists ideas_notes_created_at_idx
    on public.ideas_notes (created_at desc);

alter table public.ideas_notes enable row level security;

drop policy if exists "Ideas notes are publicly readable" on public.ideas_notes;
create policy "Ideas notes are publicly readable"
    on public.ideas_notes
    for select
    to anon, authenticated
    using (true);

revoke all on table public.ideas_notes from anon, authenticated;
grant select on table public.ideas_notes to anon, authenticated;
grant all on table public.ideas_notes to service_role;

comment on table public.ideas_notes is
    'Public scratchpad notes. Reads are public; writes pass through the rate-limited server endpoint.';
