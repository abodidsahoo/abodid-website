import { createClient } from 'npm:@supabase/supabase-js@2.112.0';

const json = (body: unknown, status = 200) => Response.json(body, {
    status, headers: { 'Cache-Control': 'no-store' },
});

Deno.serve(async (request: Request) => {
    if (request.method !== 'POST') return json({ error: 'POST required.' }, 405);
    // A one-use dispatch token is issued by the private database scheduler.
    // It is never included in the public file or in browser code.
    let token: string;
    try {
        token = (await request.json()).token;
        if (typeof token !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) throw new Error();
    } catch {
        return json({ error: 'Invalid publication request.' }, 401);
    }
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: claim, error: claimError } = await client.rpc('claim_moodboard_search_publish', { p_token: token });
    if (claimError) return json({ error: 'Publication unavailable.' }, 503);
    if (!claim) return json({ error: 'Expired or unauthorized publication request.' }, 401);
    const lease = claim.lease;
    let revision = claim.revision;
    try {
        const { data: snapshot, error } = await client.rpc('read_moodboard_search_snapshot', { p_lease: lease });
        if (error) throw error;
        if (!snapshot || snapshot.schemaVersion !== 1 || !Array.isArray(snapshot.items)) {
            throw new Error('No valid snapshot available for this lease.');
        }
        revision = snapshot.revision;
        // Match the existing public catalogue's normalization without rewriting
        // stored/manual tags. Legacy text[] values can contain null/blank slots.
        for (const item of snapshot.items) {
            item.tags = (item.tags || []).filter((tag: unknown) => typeof tag === 'string' && tag.trim())
                .map((tag: string) => tag.trim());
        }
        const body = JSON.stringify(snapshot);
        if (new TextEncoder().encode(body).length > 4 * 1024 * 1024) throw new Error('Snapshot exceeds 4 MB.');
        const { error: uploadError } = await client.storage.from('moodboard-search').upload('search-v1.json', body, {
            contentType: 'application/json', cacheControl: '60', upsert: true,
        });
        if (uploadError) throw uploadError;
        const { data: completed, error: completeError } = await client.rpc('complete_moodboard_search_publish', {
            p_lease: lease, p_revision: revision,
        });
        if (completeError || !completed) throw completeError || new Error('Publication lease expired.');
        return json({ published: true, revision, items: snapshot.items.length });
    } catch (error) {
        console.error('Moodboard search publication failed:', error);
        await client.rpc('complete_moodboard_search_publish', {
            p_lease: lease, p_revision: revision,
            p_error: error instanceof Error ? error.message : 'Publication failed.',
        });
        return json({ error: 'Publication will be retried; the previous file is retained.' }, 503);
    }
});
