import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import seeds from '../../src/data/feedbackForms.seed.json';
import collections from '../../src/data/photographyCollections.json';
import { questionsSchema, validateAnswers } from '../../src/lib/feedback/schema';

const mocks = vi.hoisted(() => ({ getFeedbackForm: vi.fn(), feedbackClient: vi.fn(), sendResourceEmail: vi.fn(), requestIdentity: vi.fn(), updateIdentity: vi.fn() }));
vi.mock('../../src/lib/feedback/server', () => mocks);
vi.mock('../../src/lib/feedback/resource-email', () => ({ sendResourceEmail: mocks.sendResourceEmail }));
vi.mock('../../src/lib/feedback/identity', async (original) => ({ ...await original<any>(), requestIdentity: mocks.requestIdentity, updateIdentity: mocks.updateIdentity }));
import { POST } from '../../src/pages/api/feedback/[slug]';

const nift = {
    ...seeds[1], id: '32126e26-ea16-403a-bbc5-67f85f81e548', form_version: 1,
    is_open: true, responses_public: true, questions: questionsSchema.parse(seeds[1].questions),
};
let results: Array<object>;
let insert: ReturnType<typeof vi.fn>;
let client: { from: ReturnType<typeof vi.fn> };

beforeEach(() => {
    vi.stubEnv('FEEDBACK_RECEIPT_SECRET', 'unit-test-only-signing-secret');
    vi.clearAllMocks();
    mocks.sendResourceEmail.mockResolvedValue({ status: 'sent' });
    mocks.requestIdentity.mockResolvedValue(null); mocks.updateIdentity.mockResolvedValue(undefined);
    results = [{ data: null, error: null }, { data: { id: 'saved-id', created_at: '2026-11-04' }, error: null }];
    const chain: Record<string, any> = {};
    for (const method of ['select', 'eq', 'maybeSingle', 'single', 'upsert']) chain[method] = vi.fn(() => chain);
    insert = vi.fn(() => chain);
    chain.insert = insert;
    chain.then = (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => {
        const result: any = results.shift();
        if (result?.data?.id === 'saved-id') result.data = { ...insert.mock.lastCall?.[0], ...result.data };
        return Promise.resolve(result).then(resolve, reject);
    };
    client = { from: vi.fn(() => chain) };
    mocks.feedbackClient.mockReturnValue(client);
    mocks.getFeedbackForm.mockResolvedValue(nift);
});
afterEach(() => vi.unstubAllEnvs());

async function submit(fields: Record<string, string>, options: { origin?: string; native?: boolean } = {}) {
    const data = new URLSearchParams();
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    return POST({
        request: new Request(`https://abodid.com/api/feedback/${nift.slug}`, {
            method: 'POST', body: data,
            headers: { Origin: options.origin || 'https://abodid.com', Accept: options.native ? 'text/html' : 'application/json' },
        }),
        params: { slug: nift.slug },
        redirect: (location: string, status: number) => new Response(null, { status, headers: { Location: location } }),
    } as any);
}

describe('shared feedback submission', () => {
    it('stores only configured answers against the server-selected form with a question snapshot', async () => {
        const response = await submit({ feedback: '  The material experiments.  ', unknown: 'Ignore this', institution_slug: 'spoofed' });
        expect(response.status).toBe(200);
        expect(insert).toHaveBeenCalledWith(expect.objectContaining({
            form_id: nift.id, answers: { feedback: 'The material experiments.' }, question_snapshot: nift.questions,
            newsletter_consent: false,
        }));
        expect(client.from).not.toHaveBeenCalledWith('subscribers');
    });
    it('emails resource links after saving feedback when an email is supplied', async () => {
        const response = await submit({ feedback: 'Useful', email: ' Student@Example.com ', submission_key: '65c2283c-2cbf-4c7e-a3c0-600b5ad34173' });
        expect(await response.json()).toMatchObject({ ok: true, resource_email_status: 'sent' });
        expect(mocks.sendResourceEmail).toHaveBeenCalledWith(expect.objectContaining({ email: 'student@example.com', responseId: 'saved-id', requestKey: '65c2283c-2cbf-4c7e-a3c0-600b5ad34173' }));
        expect(insert).toHaveBeenCalledWith(expect.objectContaining({ answers: { feedback: 'Useful' }, metadata: expect.objectContaining({ resource_email_requested: true }) }));
    });
    it('keeps a successful feedback receipt even when email delivery fails', async () => {
        mocks.sendResourceEmail.mockResolvedValue({ status: 'failed' });
        const response = await submit({ feedback: 'Useful', name: 'Test student', email: 'student@example.com' });
        expect(await response.json()).toMatchObject({ ok: true, id: 'saved-id', resource_email_status: 'failed', redirect_to: '/nift-workshop-resources?resource_email=failed' });
        expect(response.headers.getSetCookie()).toHaveLength(2);
        expect(response.headers.getSetCookie().every(cookie => cookie.includes('Path=/;') && cookie.includes('HttpOnly'))).toBe(true);
    });
    it('retries email using the saved recipient, never the replay body, and keeps contacts private', async () => {
        results = [{ data: { id: 'previous-id', submission_key: '65c2283c-2cbf-4c7e-a3c0-600b5ad34173', participant_email: 'original@example.com', metadata: { resource_email_requested: true } }, error: null }];
        const payload = await (await submit({ submission_key: '65c2283c-2cbf-4c7e-a3c0-600b5ad34173', email: 'spoofed@example.com' })).json();
        expect(mocks.sendResourceEmail).toHaveBeenCalledWith(expect.objectContaining({ email: 'original@example.com' }));
        expect(payload).not.toHaveProperty('participant_email');
        expect(payload).not.toHaveProperty('metadata');
    });
    it('preserves DU multi-question submission without enabling resource mail', async () => {
        mocks.getFeedbackForm.mockResolvedValue({ ...nift, ...seeds[0], questions: questionsSchema.parse(seeds[0].questions) });
        expect((await submit({ best_part: 'Filming', improvements: 'More time', email: 'du@example.com' })).status).toBe(200);
        expect(insert).toHaveBeenCalledWith(expect.objectContaining({ answers: { best_part: 'Filming', improvements: 'More time' } }));
        expect(mocks.sendResourceEmail).not.toHaveBeenCalled();
    });
    it('keeps album responses in their own private collection with the same participant identity', async () => {
        mocks.getFeedbackForm.mockResolvedValue({ ...collections[0], id: 'album-form-id', form_version: 1, is_open: true, questions: questionsSchema.parse(collections[0].questions) });
        mocks.requestIdentity.mockResolvedValue({ id: 'a7b0b28e-398b-46b0-a1e6-1fed1241a11b', name: 'Existing student', email: 'existing@example.com' });
        const response = await submit({ album_thoughts: 'Album sequencing', name: 'Updated student', email: 'updated@example.com' });
        expect(await response.json()).toMatchObject({ ok: true, redirect_to: '/photo-album-feedback?submitted=1' });
        expect(insert).toHaveBeenCalledWith(expect.objectContaining({ form_id: 'album-form-id', answers: { album_thoughts: 'Album sequencing' }, metadata: expect.objectContaining({ participant_id: 'a7b0b28e-398b-46b0-a1e6-1fed1241a11b' }) }));
        expect(mocks.updateIdentity).toHaveBeenCalledWith(client, 'a7b0b28e-398b-46b0-a1e6-1fed1241a11b', 'Updated student', 'updated@example.com', '2026-11-04');
        expect(mocks.sendResourceEmail).not.toHaveBeenCalled();
    });
    it('does not silently publish saved private identity when lecture identity fields are left blank', async () => {
        mocks.requestIdentity.mockResolvedValue({ id: 'a7b0b28e-398b-46b0-a1e6-1fed1241a11b', name: 'Private name', email: 'private@example.com' });
        await submit({ feedback: 'A public lecture response' });
        expect(insert).toHaveBeenCalledWith(expect.objectContaining({ participant_name: null, participant_email: null }));
    });
    it('rejects an empty response', async () => {
        expect((await submit({ feedback: '   ' })).status).toBe(400);
        expect(insert).not.toHaveBeenCalled();
    });
    it('rejects invalid email without silently dropping it', async () => {
        expect((await submit({ feedback: 'Great', email: 'not-an-email' })).status).toBe(400);
    });
    it('does not subscribe someone merely for supplying an email', async () => {
        await submit({ feedback: 'Great', email: 'student@example.com' });
        expect(insert).toHaveBeenCalledWith(expect.objectContaining({ participant_email: 'student@example.com', newsletter_consent: false }));
        expect(client.from).not.toHaveBeenCalledWith('subscribers');
    });
    it('returns the saved response on retry without inserting again', async () => {
        results = [{ data: { id: 'previous-id', created_at: '2026-11-04' }, error: null }];
        const response = await submit({ submission_key: '65c2283c-2cbf-4c7e-a3c0-600b5ad34173' });
        expect(await response.json()).toMatchObject({ ok: true, id: 'previous-id' });
        expect(insert).not.toHaveBeenCalled();
    });
    it('resolves concurrent submissions through the database unique constraint', async () => {
        results = [{ data: null, error: null }, { data: null, error: { code: '23505' } }, { data: { id: 'winner-id' }, error: null }];
        expect(await (await submit({ feedback: 'Great' })).json()).toMatchObject({ ok: true, id: 'winner-id' });
    });
    it('rejects stale questions and closed collections', async () => {
        expect((await submit({ feedback: 'Great', form_version: '2' })).status).toBe(409);
        results = [{ data: null, error: null }];
        mocks.getFeedbackForm.mockResolvedValue({ ...nift, is_open: false });
        expect((await submit({ feedback: 'Great' })).status).toBe(410);
    });
    it('rejects cross-site submissions before reading storage', async () => {
        expect((await submit({ feedback: 'Great' }, { origin: 'https://another.example' })).status).toBe(403);
        expect(mocks.getFeedbackForm).not.toHaveBeenCalled();
    });
    it('silently discards honeypot submissions', async () => {
        expect(await (await submit({ feedback: 'spam', website: 'bot' })).json()).toEqual({ ok: true });
        expect(insert).not.toHaveBeenCalled();
    });
    it('supports native form submission without JavaScript', async () => {
        const response = await submit({ feedback: 'Great' }, { native: true });
        expect(response.status).toBe(303);
        expect(response.headers.get('location')).toBe('/nift-workshop-resources?resource_email=not_requested');
        expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    });
    it('rejects oversized bodies and overlong answers', async () => {
        expect((await submit({ feedback: 'a'.repeat(100000) })).status).toBe(400);
        expect((await submit({ feedback: 'a'.repeat(8001) })).status).toBe(400);
    });
});

describe('flexible question definitions', () => {
    it('supports required text, enumerated choices, and ratings while rejecting invented choices', () => {
        const questions = questionsSchema.parse([
            { id: 'thought', label: 'A thought', type: 'text', required: true },
            { id: 'topic', label: 'Topic', type: 'choice', options: ['Materials', 'Budgeting'] },
            { id: 'rating', label: 'Rating', type: 'rating' },
        ]);
        const data = new FormData();
        expect(() => validateAnswers(questions, data)).toThrow('A thought');
        data.set('thought', 'Useful'); data.set('topic', 'Invented');
        expect(() => validateAnswers(questions, data)).toThrow('available answer');
        data.set('topic', 'Materials'); data.set('rating', '6');
        expect(() => validateAnswers(questions, data)).toThrow('1 to 5');
        data.set('rating', '5');
        expect(validateAnswers(questions, data)).toEqual({ thought: 'Useful', topic: 'Materials', rating: '5' });
    });
    it('rejects ambiguous duplicate question IDs and choice questions without options', () => {
        expect(questionsSchema.safeParse([{ id: 'x', label: 'One' }, { id: 'x', label: 'Two' }]).success).toBe(false);
        expect(questionsSchema.safeParse([{ id: 'x', label: 'One', type: 'choice' }]).success).toBe(false);
    });
    it('keeps question IDs separate from participant details and native form methods', () => {
        for (const id of ['email', 'name', 'website', 'form_version', 'action', 'reset', 'submit']) {
            expect(questionsSchema.safeParse([{ id, label: 'Reserved' }]).success).toBe(false);
        }
    });
});
