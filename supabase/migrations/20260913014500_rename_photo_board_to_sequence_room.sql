-- Rename the pre-launch Photo Board persistence layer to Sequence Room while
-- preserving existing boards, items, ownership, and share tokens.

alter table public.photo_boards rename to sequence_room_boards;
alter table public.photo_board_items rename to sequence_room_items;

alter table public.sequence_room_boards rename constraint photo_boards_pkey to sequence_room_boards_pkey;
alter table public.sequence_room_boards rename constraint photo_boards_share_token_key to sequence_room_boards_share_token_key;
alter table public.sequence_room_boards rename constraint photo_boards_share_token_state to sequence_room_boards_share_token_state;
alter table public.sequence_room_items rename constraint photo_board_items_pkey to sequence_room_items_pkey;
alter table public.sequence_room_items rename constraint photo_board_items_board_id_id_key to sequence_room_items_board_id_id_key;

alter index if exists public.photo_boards_user_updated_idx rename to sequence_room_boards_user_updated_idx;
alter index if exists public.photo_board_items_board_z_idx rename to sequence_room_items_board_z_idx;
alter index if exists public.photo_board_items_asset_idx rename to sequence_room_items_asset_idx;

drop trigger if exists photo_boards_touch_updated_at on public.sequence_room_boards;
drop trigger if exists photo_board_items_touch_updated_at on public.sequence_room_items;
drop trigger if exists photo_boards_enforce_quota on public.sequence_room_boards;
drop trigger if exists photo_board_items_enforce_owner_quota on public.sequence_room_items;
drop trigger if exists photo_board_items_touch_parent on public.sequence_room_items;

drop function if exists public.duplicate_photo_board(uuid);
drop function if exists public.touch_parent_photo_board();
drop function if exists public.enforce_photo_board_owner_and_quotas();
drop function if exists public.touch_photo_board_updated_at();

create or replace function public.touch_sequence_room_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

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

create or replace function public.touch_parent_sequence_room()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    update public.sequence_room_boards
       set updated_at = now()
     where id = coalesce(new.board_id, old.board_id);
    return coalesce(new, old);
end;
$$;

create trigger sequence_room_boards_touch_updated_at
before update on public.sequence_room_boards
for each row execute function public.touch_sequence_room_updated_at();

create trigger sequence_room_items_touch_updated_at
before update on public.sequence_room_items
for each row execute function public.touch_sequence_room_updated_at();

create trigger sequence_room_boards_enforce_quota
before insert on public.sequence_room_boards
for each row execute function public.enforce_sequence_room_owner_and_quotas();

create trigger sequence_room_items_enforce_owner_quota
before insert on public.sequence_room_items
for each row execute function public.enforce_sequence_room_owner_and_quotas();

create trigger sequence_room_items_touch_parent
after insert or update or delete on public.sequence_room_items
for each row execute function public.touch_parent_sequence_room();

drop policy if exists "photo board owners read boards" on public.sequence_room_boards;
drop policy if exists "photo board owners create boards" on public.sequence_room_boards;
drop policy if exists "photo board owners update boards" on public.sequence_room_boards;
drop policy if exists "photo board owners delete boards" on public.sequence_room_boards;
drop policy if exists "photo board owners read assets" on public.user_photo_assets;
drop policy if exists "photo board owners create assets" on public.user_photo_assets;
drop policy if exists "photo board owners update assets" on public.user_photo_assets;
drop policy if exists "photo board owners delete assets" on public.user_photo_assets;
drop policy if exists "photo board owners read items" on public.sequence_room_items;
drop policy if exists "photo board owners create items" on public.sequence_room_items;
drop policy if exists "photo board owners update items" on public.sequence_room_items;
drop policy if exists "photo board owners delete items" on public.sequence_room_items;

create policy "sequence room owners read boards" on public.sequence_room_boards
for select to authenticated using (auth.uid() = user_id);
create policy "sequence room owners create boards" on public.sequence_room_boards
for insert to authenticated with check (auth.uid() = user_id);
create policy "sequence room owners update boards" on public.sequence_room_boards
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sequence room owners delete boards" on public.sequence_room_boards
for delete to authenticated using (auth.uid() = user_id);

create policy "sequence room owners read assets" on public.user_photo_assets
for select to authenticated using (auth.uid() = user_id);
create policy "sequence room owners create assets" on public.user_photo_assets
for insert to authenticated with check (auth.uid() = user_id);
create policy "sequence room owners update assets" on public.user_photo_assets
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sequence room owners delete assets" on public.user_photo_assets
for delete to authenticated using (auth.uid() = user_id);

create policy "sequence room owners read items" on public.sequence_room_items
for select to authenticated using (
    exists (select 1 from public.sequence_room_boards b where b.id = board_id and b.user_id = auth.uid())
);
create policy "sequence room owners create items" on public.sequence_room_items
for insert to authenticated with check (
    exists (select 1 from public.sequence_room_boards b where b.id = board_id and b.user_id = auth.uid())
);
create policy "sequence room owners update items" on public.sequence_room_items
for update to authenticated using (
    exists (select 1 from public.sequence_room_boards b where b.id = board_id and b.user_id = auth.uid())
) with check (
    exists (select 1 from public.sequence_room_boards b where b.id = board_id and b.user_id = auth.uid())
);
create policy "sequence room owners delete items" on public.sequence_room_items
for delete to authenticated using (
    exists (select 1 from public.sequence_room_boards b where b.id = board_id and b.user_id = auth.uid())
);

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

revoke all on public.sequence_room_boards, public.user_photo_assets, public.sequence_room_items from anon;
grant select, insert, update, delete on public.sequence_room_boards, public.user_photo_assets, public.sequence_room_items to authenticated;
