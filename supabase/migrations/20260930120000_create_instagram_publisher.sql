begin;

create extension if not exists pgcrypto;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  platform text not null default 'instagram' check (platform = 'instagram'),
  media_ids uuid[] not null,
  media_order uuid[] not null,
  caption text not null default '',
  hashtags text not null default '',
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'publishing', 'published', 'failed')),
  scheduled_at timestamptz,
  published_at timestamptz,
  publishing_started_at timestamptz,
  instagram_container_id text,
  instagram_media_id text,
  instagram_permalink text,
  publish_state jsonb not null default '{}'::jsonb,
  error_message text,
  attempts integer not null default 0 check (attempts >= 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(media_ids) between 1 and 10),
  check (media_ids = media_order),
  check (char_length(caption) <= 2200),
  check (char_length(hashtags) <= 2200),
  check (status <> 'scheduled' or scheduled_at is not null),
  check (status <> 'published' or (published_at is not null and instagram_media_id is not null))
);

create index if not exists social_posts_queue_idx
  on public.social_posts(status, scheduled_at)
  where status in ('scheduled', 'publishing');

create index if not exists social_posts_created_idx
  on public.social_posts(created_at desc);

create table if not exists public.social_instagram_settings (
  id boolean primary key default true check (id),
  default_hashtags text not null default '',
  username text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.social_instagram_settings (id)
values (true)
on conflict (id) do nothing;

-- This row is service-role only. It stores only a digest of the cron token;
-- the plaintext token stays inside Supabase Vault for pg_cron to send.
create table if not exists public.social_publisher_config (
  id boolean primary key default true check (id),
  cron_secret_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.social_is_admin()
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

create or replace function public.social_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists social_posts_touch on public.social_posts;
create trigger social_posts_touch
before update on public.social_posts
for each row execute function public.social_touch_updated_at();

drop trigger if exists social_instagram_settings_touch on public.social_instagram_settings;
create trigger social_instagram_settings_touch
before update on public.social_instagram_settings
for each row execute function public.social_touch_updated_at();

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
    raise exception 'A photograph can only appear once in a social post';
  end if;

  select count(*) into v_valid_count
  from public.media_assets
  where id = any(new.media_ids)
    and lower(mime_type) in ('image/jpeg', 'image/jpg');

  if v_valid_count <> cardinality(new.media_ids) then
    raise exception 'Every social post item must reference an existing JPEG in the Media Library';
  end if;
  return new;
end;
$$;

drop trigger if exists social_posts_validate_media on public.social_posts;
create trigger social_posts_validate_media
before insert or update of media_ids, media_order on public.social_posts
for each row execute function public.social_validate_media_ids();

alter table public.social_posts enable row level security;
alter table public.social_instagram_settings enable row level security;
alter table public.social_publisher_config enable row level security;

drop policy if exists social_posts_admin_all on public.social_posts;
create policy social_posts_admin_all
on public.social_posts for all to authenticated
using (public.social_is_admin())
with check (public.social_is_admin() and created_by = auth.uid());

drop policy if exists social_instagram_settings_admin_all on public.social_instagram_settings;
create policy social_instagram_settings_admin_all
on public.social_instagram_settings for all to authenticated
using (public.social_is_admin())
with check (public.social_is_admin());

grant select, insert, update, delete on public.social_posts to authenticated;
grant select, insert, update on public.social_instagram_settings to authenticated;
grant execute on function public.social_is_admin() to authenticated;
revoke all on public.social_publisher_config from anon, authenticated;

-- Atomically claims either one manually requested post or the next due post.
-- A stale publishing row can be reclaimed safely because the Edge Function
-- persists and reuses its Meta container id before calling media_publish.
create or replace function public.claim_social_post(p_post_id uuid default null)
returns setof public.social_posts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role required';
  end if;

  select id into v_id
  from public.social_posts
  where
    (
      p_post_id is not null
      and id = p_post_id
      and (
        status in ('draft', 'scheduled', 'failed')
        or (status = 'publishing' and publishing_started_at < now() - interval '15 minutes')
      )
    )
    or
    (
      p_post_id is null
      and (
        (status = 'scheduled' and scheduled_at <= now())
        or (status = 'publishing' and publishing_started_at < now() - interval '15 minutes')
      )
    )
  order by scheduled_at nulls last, created_at
  for update skip locked
  limit 1;

  if v_id is null then return; end if;

  return query
  update public.social_posts
  set status = 'publishing',
      publishing_started_at = now(),
      error_message = null,
      attempts = attempts + 1
  where id = v_id
  returning *;
end;
$$;

revoke all on function public.claim_social_post(uuid) from public, anon, authenticated;
grant execute on function public.claim_social_post(uuid) to service_role;

do $$
declare
  v_secret text;
  v_secret_id uuid;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'instagram_publisher_cron_secret'
  limit 1;

  if v_secret is null then
    v_secret := encode(gen_random_bytes(32), 'hex');
    select vault.create_secret(
      v_secret,
      'instagram_publisher_cron_secret',
      'Private token used only by pg_cron and the Instagram publisher Edge Function'
    ) into v_secret_id;
  end if;

  insert into public.social_publisher_config (id, cron_secret_hash)
  values (true, encode(digest(v_secret, 'sha256'), 'hex'))
  on conflict (id) do update
  set cron_secret_hash = excluded.cron_secret_hash,
      updated_at = now();
end;
$$;

do $$
begin
  perform cron.unschedule('instagram-publisher-every-minute')
  where exists (
    select 1 from cron.job where jobname = 'instagram-publisher-every-minute'
  );
end;
$$;

select cron.schedule(
  'instagram-publisher-every-minute',
  '* * * * *',
  $cron$
    select net.http_post(
      url := 'https://jwipqbjxpmgyevfzpjjx.supabase.co/functions/v1/instagram-publisher',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'reading_digest_publishable_key'
          limit 1
        ),
        'apikey', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'reading_digest_publishable_key'
          limit 1
        ),
        'x-cron-secret', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'instagram_publisher_cron_secret'
          limit 1
        )
      ),
      body := '{"source":"cron"}'::jsonb,
      timeout_milliseconds := 55000
    );
  $cron$
);

commit;
