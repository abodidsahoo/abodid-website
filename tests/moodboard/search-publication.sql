-- Run against the target project after applying the publication migration.
-- All probe edits, state changes, and pg_net queue entries are rolled back.
begin;
do $$
declare
    before_revision bigint;
    old_tags text[];
    item_id uuid;
    claim jsonb;
    snapshot jsonb;
    dispatch uuid;
    saved_published_revision bigint;
begin
    assert not has_function_privilege('anon', 'public.claim_moodboard_search_publish(uuid)', 'EXECUTE');
    assert not has_function_privilege('authenticated', 'public.read_moodboard_search_snapshot(uuid)', 'EXECUTE');
    assert has_function_privilege('service_role', 'public.complete_moodboard_search_publish(uuid,bigint,text)', 'EXECUTE');
    assert not has_schema_privilege('anon', 'moodboard_private', 'USAGE');

    select revision into before_revision from moodboard_private.search_publication where singleton for update;
    select id, tags into item_id, old_tags from public.moodboard_items where published limit 1;
    update public.moodboard_items set tags = tags where id = item_id;
    assert (select revision = before_revision from moodboard_private.search_publication where singleton), 'No-op save requested publication';
    update public.moodboard_items set tags = tags || array['publication-regression-probe'] where id = item_id;
    assert (select revision = before_revision + 1 from moodboard_private.search_publication where singleton), 'Real tag edit was not queued';

    update moodboard_private.search_publication
    set enabled = true, publisher_url = 'https://example.invalid/publication-test',
        published_revision = revision, lease_until = null, next_attempt_at = now();
    assert moodboard_private.dispatch_search_publication() is null, 'Idle check invoked publisher';
    update moodboard_private.search_publication set revision = revision + 20 where singleton;
    assert moodboard_private.dispatch_search_publication() is not null, 'Dirty batch did not dispatch';
    assert moodboard_private.dispatch_search_publication() is null, 'Dirty batch dispatched twice';
    select dispatch_token into dispatch from moodboard_private.search_publication where singleton;
    assert public.claim_moodboard_search_publish(gen_random_uuid()) is null, 'Invalid token was accepted';
    claim := public.claim_moodboard_search_publish(dispatch);
    assert claim is not null, 'Valid dispatch could not be claimed';
    assert public.claim_moodboard_search_publish(dispatch) is null, 'Dispatch token could be replayed';
    snapshot := public.read_moodboard_search_snapshot((claim->>'lease')::uuid);
    assert jsonb_array_length(snapshot->'items') = (select count(*) from public.moodboard_items where published), 'Snapshot was truncated or included drafts';
    assert not exists (
        select 1 from jsonb_array_elements(snapshot->'items') entry
        where entry ? 'master_tagging' or entry ? 'image_url' or entry ? 'storage_path'
    ), 'Snapshot exposed non-search fields';
    assert public.read_moodboard_search_snapshot(gen_random_uuid()) is null, 'Snapshot accepted wrong lease';

    -- A write during publication must remain pending after the earlier snapshot
    -- is acknowledged, rather than being lost by a blanket clear-dirty flag.
    update public.moodboard_items set tags = old_tags where id = item_id;
    assert public.complete_moodboard_search_publish((claim->>'lease')::uuid, (snapshot->>'revision')::bigint);
    assert (select revision > published_revision from moodboard_private.search_publication where singleton), 'Concurrent edit was lost';
    assert not public.complete_moodboard_search_publish((claim->>'lease')::uuid, (snapshot->>'revision')::bigint), 'Expired lease was acknowledged twice';

    select published_revision into saved_published_revision from moodboard_private.search_publication where singleton;
    assert moodboard_private.dispatch_search_publication() is not null;
    select dispatch_token into dispatch from moodboard_private.search_publication where singleton;
    claim := public.claim_moodboard_search_publish(dispatch);
    assert public.complete_moodboard_search_publish((claim->>'lease')::uuid, (claim->>'revision')::bigint, 'Intentional retry test');
    assert (select published_revision = saved_published_revision and last_error = 'Intentional retry test' and attempts > 0 from moodboard_private.search_publication where singleton), 'Failure incorrectly acknowledged publication';
    assert moodboard_private.dispatch_search_publication() is null, 'Failure ignored retry backoff';
end;
$$;
rollback;
