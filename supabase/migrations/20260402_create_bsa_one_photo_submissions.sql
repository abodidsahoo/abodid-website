create extension if not exists pgcrypto;

insert into storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
values (
    'one-photo-submissions',
    'one-photo-submissions',
    false,
    26214400,
    array[
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'image/heic',
        'image/heif',
        'audio/webm',
        'audio/mp4',
        'audio/mpeg',
        'audio/wav',
        'audio/ogg',
        'audio/aac'
    ]
)
on conflict (id) do update
set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.bsa_one_photo_submissions (
    id uuid primary key default gen_random_uuid(),
    created_at timestamp with time zone not null default timezone('utc'::text, now()),
    updated_at timestamp with time zone not null default timezone('utc'::text, now()),
    project_slug text not null default 'one-photo',
    source_context text not null default 'bsa-2026-poster',
    response_text text,
    image_path text,
    image_file_name text,
    image_mime text,
    image_size_bytes integer,
    audio_path text,
    audio_file_name text,
    audio_mime text,
    audio_size_bytes integer,
    audio_duration_seconds numeric(8, 2),
    submission_status text not null default 'received',
    metadata jsonb not null default '{}'::jsonb,
    constraint bsa_one_photo_submissions_payload_check check (
        nullif(btrim(coalesce(response_text, '')), '') is not null
        or nullif(btrim(coalesce(image_path, '')), '') is not null
        or nullif(btrim(coalesce(audio_path, '')), '') is not null
    ),
    constraint bsa_one_photo_submissions_status_check check (
        submission_status in ('received', 'reviewed', 'archived', 'spam')
    )
);

comment on table public.bsa_one_photo_submissions is
    'Responses collected from the BSA poster page asking for the one photograph that stays with someone.';

comment on column public.bsa_one_photo_submissions.response_text is
    'Written story behind the image, or the typed response when no image is uploaded.';

comment on column public.bsa_one_photo_submissions.image_path is
    'Path inside the private one-photo-submissions storage bucket.';

comment on column public.bsa_one_photo_submissions.audio_path is
    'Path inside the private one-photo-submissions storage bucket.';

create index if not exists idx_bsa_one_photo_submissions_created_at
on public.bsa_one_photo_submissions (created_at desc);

create index if not exists idx_bsa_one_photo_submissions_project_source
on public.bsa_one_photo_submissions (project_slug, source_context, created_at desc);

create index if not exists idx_bsa_one_photo_submissions_status
on public.bsa_one_photo_submissions (submission_status, created_at desc);

alter table public.bsa_one_photo_submissions enable row level security;

create or replace function public.set_bsa_one_photo_submissions_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$;

drop trigger if exists trg_bsa_one_photo_submissions_updated_at on public.bsa_one_photo_submissions;
create trigger trg_bsa_one_photo_submissions_updated_at
before update on public.bsa_one_photo_submissions
for each row
execute function public.set_bsa_one_photo_submissions_updated_at();
