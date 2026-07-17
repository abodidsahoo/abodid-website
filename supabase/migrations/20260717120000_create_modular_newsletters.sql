begin;

create extension if not exists pgcrypto;

create table if not exists public.newsletters (
  id uuid primary key default gen_random_uuid(),
  subject text not null default 'Untitled newsletter',
  preview_text text not null default '',
  blocks jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{"version":1,"canvasWidth":640,"outerBackgroundColor":"#f3f2ef","canvasBackgroundColor":"#ffffff","headingFont":"satoshi","bodyFont":"satoshi","fontFamily":"''Satoshi'', ''Helvetica Neue'', Arial, sans-serif"}'::jsonb,
  sender_name text not null default 'Abodid',
  sender_email text not null default 'hello@abodid.com',
  status text not null default 'draft' check (status in ('draft', 'sent', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists newsletters_updated_idx
  on public.newsletters(updated_at desc);

create index if not exists newsletters_status_idx
  on public.newsletters(status, updated_at desc);

create or replace function public.newsletter_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.newsletters_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists newsletters_touch on public.newsletters;
create trigger newsletters_touch
before update on public.newsletters
for each row execute function public.newsletters_touch_updated_at();

alter table public.newsletters enable row level security;

drop policy if exists newsletters_admin_read on public.newsletters;
create policy newsletters_admin_read
on public.newsletters for select
to authenticated
using (public.newsletter_is_admin());

drop policy if exists newsletters_admin_insert on public.newsletters;
create policy newsletters_admin_insert
on public.newsletters for insert
to authenticated
with check (public.newsletter_is_admin() and created_by = auth.uid());

drop policy if exists newsletters_admin_update on public.newsletters;
create policy newsletters_admin_update
on public.newsletters for update
to authenticated
using (public.newsletter_is_admin())
with check (public.newsletter_is_admin());

drop policy if exists newsletters_admin_delete on public.newsletters;
create policy newsletters_admin_delete
on public.newsletters for delete
to authenticated
using (public.newsletter_is_admin());

create table if not exists public.newsletter_broadcasts (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  message text,
  sent_count integer default 0,
  created_at timestamptz not null default now()
);

alter table public.newsletter_broadcasts
  add column if not exists newsletter_id uuid references public.newsletters(id) on delete set null;

create index if not exists newsletter_broadcasts_newsletter_idx
  on public.newsletter_broadcasts(newsletter_id, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'newsletter-assets',
  'newsletter-assets',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists newsletter_assets_public_read on storage.objects;
create policy newsletter_assets_public_read
on storage.objects for select
using (bucket_id = 'newsletter-assets');

drop policy if exists newsletter_assets_admin_insert on storage.objects;
create policy newsletter_assets_admin_insert
on storage.objects for insert
to authenticated
with check (bucket_id = 'newsletter-assets' and public.newsletter_is_admin());

drop policy if exists newsletter_assets_admin_update on storage.objects;
create policy newsletter_assets_admin_update
on storage.objects for update
to authenticated
using (bucket_id = 'newsletter-assets' and public.newsletter_is_admin())
with check (bucket_id = 'newsletter-assets' and public.newsletter_is_admin());

drop policy if exists newsletter_assets_admin_delete on storage.objects;
create policy newsletter_assets_admin_delete
on storage.objects for delete
to authenticated
using (bucket_id = 'newsletter-assets' and public.newsletter_is_admin());

grant select, insert, update, delete on public.newsletters to authenticated;
grant execute on function public.newsletter_is_admin() to authenticated;

commit;
