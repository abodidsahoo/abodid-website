-- Sequence Room reliability pass: persistent reject bin, cloud background,
-- first-board starter photographs, and explicit most-recent-board tracking.

alter table public.sequence_room_boards
    add column if not exists background_color text not null default '#fff8e8'
        check (background_color ~ '^#[0-9A-Fa-f]{6}$'),
    add column if not exists last_opened_at timestamptz not null default now();

alter table public.sequence_room_boards alter column logical_height set default 3600;

-- Preserve the real recency order for boards that existed before this column.
update public.sequence_room_boards set last_opened_at = updated_at;

alter table public.sequence_room_items
    add column if not exists is_rejected boolean not null default false,
    add column if not exists annotation jsonb not null default '{}'::jsonb
        check (jsonb_typeof(annotation) = 'object');

alter table public.user_photo_assets
    add column if not exists is_library_asset boolean not null default false;

create index if not exists sequence_room_boards_user_opened_idx
    on public.sequence_room_boards (user_id, last_opened_at desc);
create index if not exists sequence_room_items_board_rejected_idx
    on public.sequence_room_items (board_id, is_rejected, z_index);

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

    insert into public.sequence_room_boards
        (user_id, name, logical_width, logical_height, background_color, last_opened_at)
    values
        (auth.uid(), left(source_board.name || ' copy', 80), source_board.logical_width,
         source_board.logical_height, source_board.background_color, now())
    returning * into copied_board;

    insert into public.sequence_room_items
        (board_id, asset_id, x, y, rotation, scale, z_index, is_rejected, annotation)
    select copied_board.id, asset_id, x, y, rotation, scale, z_index, is_rejected, annotation
      from public.sequence_room_items
     where board_id = source_board.id;

    return copied_board;
end;
$$;

revoke all on function public.duplicate_sequence_room(uuid) from public;
grant execute on function public.duplicate_sequence_room(uuid) to authenticated;

create or replace function public.create_sequence_room_starter_board()
returns public.sequence_room_boards
language plpgsql security invoker set search_path = public as $$
declare
    starter_board public.sequence_room_boards;
    starter_asset_id uuid;
    starter record;
begin
    if auth.uid() is null then
        raise exception 'SIGN_IN_REQUIRED' using errcode = '42501';
    end if;

    select * into starter_board
      from public.sequence_room_boards
     where user_id = auth.uid()
     order by last_opened_at desc, updated_at desc
     limit 1;
    if found then return starter_board; end if;

    insert into public.sequence_room_boards
        (user_id, name, logical_width, logical_height, background_color, last_opened_at)
    values (auth.uid(), 'My first sequence', 1440, 3600, '#fff8e8', now())
    returning * into starter_board;

    for starter in
        select * from (values
            (1, 'breathe-variations-rca-2023-abodid-sahoo-12-d06e2bea64.webp', -320::double precision, 280::double precision, -4.5::double precision),
            (2, 'breathe-variations-rca-2023-abodid-sahoo-7-e349cb9d57.webp', 0::double precision, 330::double precision, 2.5::double precision),
            (3, 'hidden-exhibition-rca-abodid-17-72de495288.webp', 320::double precision, 270::double precision, 5::double precision)
        ) as photographs(ordinal, filename, x, y, rotation)
    loop
        insert into public.user_photo_assets
            (user_id, cloudflare_key, working_url, stored_bytes, width, height, mime_type, is_library_asset)
        values
            (auth.uid(), 'sequence-room-starter/' || auth.uid()::text || '/' || starter.ordinal::text,
             'https://assets.abodid.com/photos/variants/exhibition-photos/800/' || starter.filename,
             1, 800, 800, 'image/webp', true)
        returning id into starter_asset_id;

        insert into public.sequence_room_items
            (board_id, asset_id, x, y, rotation, scale, z_index, is_rejected)
        values
            (starter_board.id, starter_asset_id, starter.x, starter.y, starter.rotation,
             1, starter.ordinal, false);
    end loop;

    return starter_board;
end;
$$;

revoke all on function public.create_sequence_room_starter_board() from public;
grant execute on function public.create_sequence_room_starter_board() to authenticated;
