-- Static moodboard HTML + change-driven search metadata in Supabase Storage.
-- No visitor calls a Vercel function, database RPC, or publisher function.
begin;

create schema if not exists moodboard_private;
revoke all on schema moodboard_private from public, anon, authenticated;
grant usage on schema moodboard_private to service_role;

create table moodboard_private.search_publication (
    singleton boolean primary key default true check (singleton),
    revision bigint not null default 1,
    published_revision bigint not null default 0,
    changed_at timestamptz not null default now(),
    published_at timestamptz,
    enabled boolean not null default false,
    publisher_url text,
    dispatch_token uuid,
    lease_token uuid,
    lease_until timestamptz,
    next_attempt_at timestamptz not null default now(),
    attempts integer not null default 0,
    last_error text,
    request_id bigint
);
alter table moodboard_private.search_publication enable row level security;
revoke all on moodboard_private.search_publication from public, anon, authenticated;
grant select, update on moodboard_private.search_publication to service_role;
insert into moodboard_private.search_publication (singleton) values (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('moodboard-search', 'moodboard-search', true, 4194304, array['application/json']);
-- No browser write policies are granted for this bucket. Only service_role
-- publishes; the existing permissive policies are scoped to other buckets.

-- A row update is cheap; never aggregate the archive or make HTTP calls inside
-- a user's save transaction. This catches UI, AI, scripts, and direct DB edits.
create function moodboard_private.mark_search_dirty()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
    if TG_OP = 'UPDATE' then
        if (OLD.title, OLD.artist_name, OLD.tags, OLD.published)
            is not distinct from (NEW.title, NEW.artist_name, NEW.tags, NEW.published)
            or (not OLD.published and not NEW.published) then
            return null;
        end if;
    elsif TG_OP = 'INSERT' then
        if not NEW.published then return null; end if;
    elsif TG_OP = 'DELETE' then
        if not OLD.published then return null; end if;
    end if;
    update moodboard_private.search_publication
    set revision = revision + 1, changed_at = now()
    where singleton;
    return null;
end;
$$;
revoke all on function moodboard_private.mark_search_dirty() from public, anon, authenticated;

create trigger moodboard_search_dirty
after insert or update or delete on public.moodboard_items
for each row execute function moodboard_private.mark_search_dirty();

-- Cron checks a single private row. It sends HTTP only for dirty, claimable
-- work. Twenty edits between checks therefore share one publication.
create function moodboard_private.dispatch_search_publication()
returns bigint language plpgsql security invoker set search_path = '' as $$
declare
    publication moodboard_private.search_publication;
    request bigint;
begin
    select * into publication from moodboard_private.search_publication
    where singleton and enabled and publisher_url is not null
        and revision > published_revision and next_attempt_at <= now()
        and (lease_until is null or lease_until < now())
    for update skip locked;
    if not found then return null; end if;

    publication.dispatch_token := gen_random_uuid();
    update moodboard_private.search_publication
    set dispatch_token = publication.dispatch_token,
        lease_token = null, lease_until = now() + interval '2 minutes',
        attempts = attempts + 1,
        next_attempt_at = now() + make_interval(secs => least(3600, 30 * power(2, least(attempts, 7)))::integer)
    where singleton;

    select net.http_post(
        url := publication.publisher_url,
        headers := '{"Content-Type":"application/json"}'::jsonb,
        body := jsonb_build_object('token', publication.dispatch_token),
        timeout_milliseconds := 55000
    ) into request;
    update moodboard_private.search_publication set request_id = request where singleton;
    return request;
end;
$$;
revoke all on function moodboard_private.dispatch_search_publication() from public, anon, authenticated;

-- These RPCs are SECURITY INVOKER and service-role-only. No privileged
-- SECURITY DEFINER function is exposed through the public Data API.
create function public.claim_moodboard_search_publish(p_token uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare publication moodboard_private.search_publication;
begin
    update moodboard_private.search_publication
    set lease_token = gen_random_uuid(), dispatch_token = null,
        lease_until = now() + interval '10 minutes'
    where singleton and enabled and dispatch_token = p_token
        and lease_token is null and lease_until > now()
    returning * into publication;
    if not found then return null; end if;
    return jsonb_build_object('lease', publication.lease_token, 'revision', publication.revision);
end;
$$;

create function public.read_moodboard_search_snapshot(p_lease uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
    -- The revision and all published rows share one MVCC snapshot. A concurrent
    -- edit leaves revision > published_revision, so the next check republishes.
    select jsonb_build_object(
        'schemaVersion', 1, 'revision', state.revision, 'generatedAt', now(),
        'items', coalesce((
            select jsonb_agg(jsonb_build_object(
                'id', item.id,
                'title', coalesce(nullif(btrim(item.title), ''), 'Untitled Mood'),
                'artistName', coalesce(btrim(item.artist_name), ''),
                'tags', coalesce(item.tags, '{}'::text[])
            ) order by item.id)
            from public.moodboard_items item where item.published
        ), '[]'::jsonb)
    ) from moodboard_private.search_publication state
    where state.singleton and state.lease_token = p_lease and state.lease_until > now();
$$;

create function public.complete_moodboard_search_publish(p_lease uuid, p_revision bigint, p_error text default null)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
    update moodboard_private.search_publication
    set published_revision = case when p_error is null then greatest(published_revision, p_revision) else published_revision end,
        published_at = case when p_error is null then now() else published_at end,
        last_error = left(p_error, 500),
        attempts = case when p_error is null then 0 else attempts end,
        next_attempt_at = case when p_error is null then now() else next_attempt_at end,
        dispatch_token = null, lease_token = null, lease_until = null
    where singleton and lease_token = p_lease and lease_until > now()
        and p_revision between 1 and revision;
    return found;
end;
$$;

revoke all on function public.claim_moodboard_search_publish(uuid) from public, anon, authenticated;
revoke all on function public.read_moodboard_search_snapshot(uuid) from public, anon, authenticated;
revoke all on function public.complete_moodboard_search_publish(uuid, bigint, text) from public, anon, authenticated;
grant execute on function public.claim_moodboard_search_publish(uuid) to service_role;
grant execute on function public.read_moodboard_search_snapshot(uuid) to service_role;
grant execute on function public.complete_moodboard_search_publish(uuid, bigint, text) to service_role;

select cron.schedule('moodboard-search-publish-ready', '* * * * *',
    'select moodboard_private.dispatch_search_publication();');

comment on table moodboard_private.search_publication is
    'One-row change counter and bounded-retry publisher lease; never read by visitors. Enable after deploying the publisher and setting publisher_url.';
commit;
