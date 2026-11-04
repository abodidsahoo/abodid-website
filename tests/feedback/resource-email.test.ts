import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import seeds from '../../src/data/feedbackForms.seed.json';
import { renderResourceEmail, sendResourceEmail } from '../../src/lib/feedback/resource-email';
import type { FeedbackForm } from '../../src/lib/feedback/schema';

const form = { ...seeds[1], id: randomUUID(), form_version: 2, is_open: true, responses_public: true } as FeedbackForm;
const rows = new Map<string, any>();
let allowed = true;
let storageError = false;
let client: any;
let provider: ReturnType<typeof vi.fn>;

// Execute the helper's real optimistic claims against an in-memory query adapter.
// Reads return snapshots, and insert/update constraints are atomic, as in Postgres.
function query() {
    let action = 'read'; let value: any; const filters: Record<string, unknown> = {};
    const chain: any = {
        select: () => chain, single: () => chain, maybeSingle: () => chain,
        eq: (key: string, expected: unknown) => { filters[key] = expected; return chain; },
        insert: (row: any) => { action = 'insert'; value = row; return chain; },
        update: (row: any) => { action = 'update'; value = row; return chain; },
        then: (resolve: any, reject: any) => {
            let result: any;
            if (storageError) result = { data: null, error: { code: 'unavailable' } };
            else if (action === 'insert') {
                if ([...rows.values()].some((row) => row.form_id === value.form_id && row.request_key === value.request_key)) result = { data: null, error: { code: '23505' } };
                else {
                    const row = { id: randomUUID(), attempt_count: 0, delivery_status: 'pending', first_attempt_at: null, lease_until: null, ...value };
                    rows.set(row.id, row); result = { data: structuredClone(row), error: null };
                }
            } else {
                const row = [...rows.values()].find((row) => Object.entries(filters).every(([key, expected]) => row[key] === expected));
                if (row && action === 'update') Object.assign(row, value);
                result = { data: row ? structuredClone(row) : null, error: null };
            }
            return Promise.resolve(result).then(resolve, reject);
        },
    };
    return chain;
}
const send = (overrides = {}) => sendResourceEmail({ client, form, request: new Request('https://abodid.com/api/feedback/nift', { headers: { 'x-real-ip': '192.0.2.10' } }), requestKey: '65c2283c-2cbf-4c7e-a3c0-600b5ad34173', email: 'student@example.com', responseId: 'ec3e788f-4933-4354-9da6-f628cbaef91b', ...overrides });

beforeEach(() => {
    rows.clear(); allowed = true; storageError = false;
    vi.stubEnv('RESEND_API_KEY', 'test-provider-key');
    client = { from: vi.fn(() => query()), rpc: vi.fn(async () => ({ data: [{ allowed, retry_after_seconds: 120 }], error: null })) };
    provider = vi.fn(async () => Response.json({ id: 'provider-receipt' }));
    vi.stubGlobal('fetch', provider);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('resource email delivery', () => {
    it('sends all server-configured links and the community notice without PDF attachments', async () => {
        expect(await send({ name: 'Asha' })).toEqual({ status: 'sent' });
        const [url, options] = provider.mock.calls[0] as any;
        expect(url).toBe('https://api.resend.com/emails');
        const payload = JSON.parse(options.body);
        expect(payload.to).toEqual(['student@example.com']);
        expect(payload.text).toContain('Hi Asha,');
        expect(payload.html).toContain('Hi Asha,');
        expect(payload.text).toContain('Thank you for joining');
        for (const resource of form.content.resources) { expect(payload.text).toContain(resource.url); expect(payload.html).toContain(resource.url.replaceAll('&', '&amp;')); }
        expect(payload.text).toContain('Do not share them publicly or upload them to any platform.');
        expect(payload.text).not.toContain('+91 94390 94370');
        expect(payload.html).not.toContain('+91 94390 94370');
        expect(payload.html).toContain('View Online');
        expect(payload.html).toContain('Download PDF');
        expect(payload.html).toContain('View more details');
        expect(payload.html).not.toContain('workshops/obsidian');
        expect(payload.html).not.toContain('/photography');
        expect(payload.text).toContain('obsidian-tutoring');
        expect(payload.html).toContain('obsidian-tutoring');
        expect(payload.text).toContain('interviews');
        expect(payload.html).toContain('interviews');
        expect(payload).not.toHaveProperty('attachments');
        expect(client.rpc).toHaveBeenCalledTimes(3);
        expect([...rows.values()][0]).toMatchObject({ delivery_status: 'sent', provider_id: 'provider-receipt', attempt_count: 1 });
    });
    it('does not resend a completed receipt, including after the provider key expires', async () => {
        await send();
        [...rows.values()][0].first_attempt_at = '2020-01-01T00:00:00Z';
        expect(await send()).toEqual({ status: 'sent' });
        expect(provider).toHaveBeenCalledTimes(1);
    });
    it('claims concurrent requests once', async () => {
        const results = await Promise.all([send(), send()]);
        expect(provider).toHaveBeenCalledTimes(1);
        expect(results.map((r) => r.status)).toContain('sent');
        expect(rows.size).toBe(1);
    });
    it('retries uncertain provider failures with the same frozen payload and idempotency key', async () => {
        provider.mockRejectedValueOnce(new Error('timeout'));
        expect(await send()).toEqual({ status: 'failed' });
        const changed = { ...form, content: { ...form.content, resources: [{ label: 'Changed', url: 'https://example.com/changed' }] } };
        expect(await send({ form: changed })).toEqual({ status: 'sent' });
        expect((provider.mock.calls[0] as any)[1].body).toEqual((provider.mock.calls[1] as any)[1].body);
        expect((provider.mock.calls[0] as any)[1].headers['Idempotency-Key']).toEqual((provider.mock.calls[1] as any)[1].headers['Idempotency-Key']);
    });
    it('never reuses a request UUID for another recipient', async () => {
        await send();
        expect(await send({ email: 'changed@example.com' })).toEqual({ status: 'failed' });
        expect(provider).toHaveBeenCalledTimes(1);
    });
    it('fails closed on quota or storage failure without sending or creating a receipt', async () => {
        allowed = false;
        expect(await send()).toEqual({ status: 'failed', retryAfter: 120 });
        expect(rows.size).toBe(0);
        storageError = true;
        expect(await send()).toEqual({ status: 'failed' });
        expect(provider).not.toHaveBeenCalled();
    });
    it('does not retry an uncertain attempt outside the provider idempotency window', async () => {
        provider.mockRejectedValueOnce(new Error('timeout')); await send();
        [...rows.values()][0].first_attempt_at = '2020-01-01T00:00:00Z';
        expect(await send()).toEqual({ status: 'failed' });
        expect(provider).toHaveBeenCalledTimes(1);
    });
    it('does nothing for anonymous feedback or forms without resource email enabled', async () => {
        expect(await send({ email: '' })).toEqual({ status: 'not_requested' });
        expect(await send({ form: { ...form, content: { ...form.content, resourceEmailEnabled: false } } })).toEqual({ status: 'not_requested' });
        expect(client.from).not.toHaveBeenCalled();
    });
    it('escapes configuration text in the HTML email', () => {
        const payload = renderResourceEmail({ ...form, institution_name: '<script>bad</script>', content: { ...form.content, resources: [{ label: '<img src=x>', url: 'https://example.com/' }] } }, 'student@example.com');
        expect(payload.html).toContain('&lt;script&gt;');
        expect(payload.html).not.toContain('<img src=x>');
    });
});
