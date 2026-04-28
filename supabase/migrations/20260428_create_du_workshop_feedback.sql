create extension if not exists pgcrypto;

create table if not exists public.du_workshop_feedback (
    id uuid primary key default gen_random_uuid(),
    created_at timestamp with time zone not null default timezone('utc'::text, now()),
    updated_at timestamp with time zone not null default timezone('utc'::text, now()),
    workshop_slug text not null default 'delhi-university-ethnographic-filmmaking',
    participant_name text,
    participant_email text,
    newsletter_consent boolean not null default false,
    best_part text,
    improvements text,
    future_workshop_topics text,
    other_comments text,
    submission_status text not null default 'received',
    metadata jsonb not null default '{}'::jsonb,
    constraint du_workshop_feedback_email_check check (
        participant_email is null
        or participant_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
    ),
    constraint du_workshop_feedback_payload_check check (
        nullif(btrim(coalesce(best_part, '')), '') is not null
        or nullif(btrim(coalesce(improvements, '')), '') is not null
        or nullif(btrim(coalesce(future_workshop_topics, '')), '') is not null
        or nullif(btrim(coalesce(other_comments, '')), '') is not null
    ),
    constraint du_workshop_feedback_status_check check (
        submission_status in ('received', 'reviewed', 'archived', 'spam')
    )
);

comment on table public.du_workshop_feedback is
    'Optional feedback responses from Delhi University students after the ethnographic filmmaking workshop.';

comment on column public.du_workshop_feedback.participant_email is
    'Optional email ID provided when the respondent wants future notes, newsletter updates, tips, or tricks.';

comment on column public.du_workshop_feedback.newsletter_consent is
    'True when the respondent provided an email ID in the optional newsletter/tips field.';

create index if not exists idx_du_workshop_feedback_created_at
on public.du_workshop_feedback (created_at desc);

create index if not exists idx_du_workshop_feedback_workshop_created_at
on public.du_workshop_feedback (workshop_slug, created_at desc);

create index if not exists idx_du_workshop_feedback_status
on public.du_workshop_feedback (submission_status, created_at desc);

alter table public.du_workshop_feedback enable row level security;

create or replace function public.set_du_workshop_feedback_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$;

drop trigger if exists trg_du_workshop_feedback_updated_at on public.du_workshop_feedback;
create trigger trg_du_workshop_feedback_updated_at
before update on public.du_workshop_feedback
for each row
execute function public.set_du_workshop_feedback_updated_at();

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'du_workshop_feedback'
          and policyname = 'Authenticated users can read DU workshop feedback'
    ) then
        create policy "Authenticated users can read DU workshop feedback"
        on public.du_workshop_feedback
        for select
        using (auth.role() = 'authenticated');
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'du_workshop_feedback'
          and policyname = 'Authenticated users can update DU workshop feedback'
    ) then
        create policy "Authenticated users can update DU workshop feedback"
        on public.du_workshop_feedback
        for update
        using (auth.role() = 'authenticated')
        with check (auth.role() = 'authenticated');
    end if;
end;
$$;

create table if not exists public.subscribers (
    id uuid primary key default gen_random_uuid(),
    email text not null unique,
    name text,
    status text default 'active',
    source text default 'footer',
    subscribed_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.subscribers
add column if not exists name text;

alter table public.subscribers
add column if not exists status text default 'active';

alter table public.subscribers
add column if not exists source text default 'footer';

alter table public.subscribers
add column if not exists subscribed_at timestamp with time zone default timezone('utc'::text, now()) not null;

alter table public.subscribers enable row level security;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'subscribers'
          and policyname = 'Public insert subscribers'
    ) then
        create policy "Public insert subscribers"
        on public.subscribers
        for insert
        with check (true);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'subscribers'
          and policyname = 'Authenticated users can read subscribers'
    ) then
        create policy "Authenticated users can read subscribers"
        on public.subscribers
        for select
        using (auth.role() = 'authenticated');
    end if;
end;
$$;
