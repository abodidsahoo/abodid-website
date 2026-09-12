-- Sequence Room V1
-- Purpose-built, user-owned persistence for /lab/sequence-room.
-- This deliberately does not reuse the legacy moodboard tables.

create extension if not exists pgcrypto;

create table if not exists public.sequence_room_boards (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null default 'Untitled Board' check (char_length(name) between 1 and 80),
    logical_width integer not null default 1440 check (logical_width between 960 and 2400),
    logical_height integer not null default 1600 check (logical_height between 1000 and 12000),
    sharing_enabled boolean not null default false,
    share_token text unique,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint sequence_room_boards_share_token_state check (
        (sharing_enabled and share_token is not null) or
        (not sharing_enabled)
    )
);

create table if not exists public.user_photo_assets (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    cloudflare_key text not null unique,
    working_url text not null,
    stored_bytes integer not null check (stored_bytes between 1 and 1048576),
    width integer not null check (width > 0),
    height integer not null check (height > 0),
    mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
    created_at timestamptz not null default now(),
    pending_delete boolean not null default false
);

create table if not exists public.sequence_room_items (
    id uuid primary key default gen_random_uuid(),
    board_id uuid not null references public.sequence_room_boards(id) on delete cascade,
    asset_id uuid not null references public.user_photo_assets(id) on delete restrict,
    x double precision not null default 0,
    y double precision not null default 0,
    rotation double precision not null default 0,
    scale double precision not null default 1 check (scale between 0.25 and 3),
    z_index integer not null default 1,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (board_id, id)
);

create index if not exists sequence_room_boards_user_updated_idx
    on public.sequence_room_boards (user_id, updated_at desc);
create index if not exists user_photo_assets_user_idx
    on public.user_photo_assets (user_id);
create index if not exists sequence_room_items_board_z_idx
    on public.sequence_room_items (board_id, z_index);
create index if not exists sequence_room_items_asset_idx
    on public.sequence_room_items (asset_id);

create or replace function public.touch_sequence_room_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists sequence_room_boards_touch_updated_at on public.sequence_room_boards;
create trigger sequence_room_boards_touch_updated_at
before update on public.sequence_room_boards
for each row execute function public.touch_sequence_room_updated_at();

drop trigger if exists sequence_room_items_touch_updated_at on public.sequence_room_items;
create trigger sequence_room_items_touch_updated_at
before update on public.sequence_room_items
for each row execute function public.touch_sequence_room_updated_at();

create or replace function public.enforce_sequence_room_owner_and_quotas()
returns trigger language plpgsql security definer set search_path = public as $$
declare
    owner_id uuid;
    asset_owner_id uuid;
begin
    if tg_table_name = 'sequence_room_boards' then
        if (select count(*) from public.sequence_room_boards where user_id = new.user_id) >= 3 then
            raise exception 'FREE_BOARD_LIMIT' using errcode = 'P0001';
        end if;
        return new;
    end if;

    select user_id into owner_id from public.sequence_room_boards where id = new.board_id;
    select user_id into asset_owner_id from public.user_photo_assets where id = new.asset_id;

    if owner_id is null or asset_owner_id is null or owner_id <> asset_owner_id then
        raise exception 'SEQUENCE_ROOM_OWNERSHIP_MISMATCH' using errcode = '42501';
    end if;

    if (select count(*) from public.sequence_room_items where board_id = new.board_id) >= 30 then
        raise exception 'FREE_PHOTO_LIMIT' using errcode = 'P0001';
    end if;

    return new;
end;
$$;

drop trigger if exists sequence_room_boards_enforce_quota on public.sequence_room_boards;
create trigger sequence_room_boards_enforce_quota
before insert on public.sequence_room_boards
for each row execute function public.enforce_sequence_room_owner_and_quotas();

drop trigger if exists sequence_room_items_enforce_owner_quota on public.sequence_room_items;
create trigger sequence_room_items_enforce_owner_quota
before insert on public.sequence_room_items
for each row execute function public.enforce_sequence_room_owner_and_quotas();

create or replace function public.touch_parent_sequence_room()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    update public.sequence_room_boards
       set updated_at = now()
     where id = coalesce(new.board_id, old.board_id);
    return coalesce(new, old);
end;
$$;

drop trigger if exists sequence_room_items_touch_parent on public.sequence_room_items;
create trigger sequence_room_items_touch_parent
after insert or update or delete on public.sequence_room_items
for each row execute function public.touch_parent_sequence_room();

alter table public.sequence_room_boards enable row level security;
alter table public.user_photo_assets enable row level security;
alter table public.sequence_room_items enable row level security;

drop policy if exists "sequence room owners read boards" on public.sequence_room_boards;
create policy "sequence room owners read boards" on public.sequence_room_boards
for select to authenticated using (auth.uid() = user_id);
drop policy if exists "sequence room owners create boards" on public.sequence_room_boards;
create policy "sequence room owners create boards" on public.sequence_room_boards
for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "sequence room owners update boards" on public.sequence_room_boards;
create policy "sequence room owners update boards" on public.sequence_room_boards
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "sequence room owners delete boards" on public.sequence_room_boards;
create policy "sequence room owners delete boards" on public.sequence_room_boards
for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "sequence room owners read assets" on public.user_photo_assets;
create policy "sequence room owners read assets" on public.user_photo_assets
for select to authenticated using (auth.uid() = user_id);
drop policy if exists "sequence room owners create assets" on public.user_photo_assets;
create policy "sequence room owners create assets" on public.user_photo_assets
for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "sequence room owners update assets" on public.user_photo_assets;
create policy "sequence room owners update assets" on public.user_photo_assets
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "sequence room owners delete assets" on public.user_photo_assets;
create policy "sequence room owners delete assets" on public.user_photo_assets
for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "sequence room owners read items" on public.sequence_room_items;
create policy "sequence room owners read items" on public.sequence_room_items
for select to authenticated using (
    exists (select 1 from public.sequence_room_boards b where b.id = board_id and b.user_id = auth.uid())
);
drop policy if exists "sequence room owners create items" on public.sequence_room_items;
create policy "sequence room owners create items" on public.sequence_room_items
for insert to authenticated with check (
    exists (select 1 from public.sequence_room_boards b where b.id = board_id and b.user_id = auth.uid())
);
drop policy if exists "sequence room owners update items" on public.sequence_room_items;
create policy "sequence room owners update items" on public.sequence_room_items
for update to authenticated using (
    exists (select 1 from public.sequence_room_boards b where b.id = board_id and b.user_id = auth.uid())
) with check (
    exists (select 1 from public.sequence_room_boards b where b.id = board_id and b.user_id = auth.uid())
);
drop policy if exists "sequence room owners delete items" on public.sequence_room_items;
create policy "sequence room owners delete items" on public.sequence_room_items
for delete to authenticated using (
    exists (select 1 from public.sequence_room_boards b where b.id = board_id and b.user_id = auth.uid())
);

-- Duplicate rows and asset references only; image binaries are never copied.
create or replace function public.duplicate_sequence_room(source_board_id uuid)
returns public.sequence_room_boards
language plpgsql security invoker set search_path = public as $$
declare
    source_board public.sequence_room_boards;
    copied_board public.sequence_room_boards;
begin
    select * into source_board
      from public.sequence_room_boards
     where id = source_board_id and user_id = auth.uid();
    if not found then raise exception 'BOARD_NOT_FOUND' using errcode = 'P0002'; end if;

    insert into public.sequence_room_boards (user_id, name, logical_width, logical_height)
    values (auth.uid(), left(source_board.name || ' copy', 80), source_board.logical_width, source_board.logical_height)
    returning * into copied_board;

    insert into public.sequence_room_items (board_id, asset_id, x, y, rotation, scale, z_index)
    select copied_board.id, asset_id, x, y, rotation, scale, z_index
      from public.sequence_room_items
     where board_id = source_board.id;

    return copied_board;
end;
$$;

revoke all on function public.duplicate_sequence_room(uuid) from public;
grant execute on function public.duplicate_sequence_room(uuid) to authenticated;

-- Shared visitors never query these tables directly. The public server route validates
-- the random token and returns only the read-only fields required for rendering.
revoke all on public.sequence_room_boards, public.user_photo_assets, public.sequence_room_items from anon;
grant select, insert, update, delete on public.sequence_room_boards, public.user_photo_assets, public.sequence_room_items to authenticated;
