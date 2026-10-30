import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ allowance: vi.fn(), extract: vi.fn(), release: vi.fn() }));
vi.mock('../../src/lib/opportunities/rateLimit', () => ({ consumeOpportunityAiLimit: mock.allowance }));
vi.mock('../../src/lib/opportunities/extractor', async (original) => ({
    ...await original<typeof import('../../src/lib/opportunities/extractor')>(),
    extractOpportunityWithLLM: mock.extract,
}));
import { captureOpportunityFromUrl } from '../../src/lib/opportunities/captureService';

const input = { url: 'https://example.org/opportunity', page_text: 'Public grant opportunity with a deadline and eligibility requirements. '.repeat(4) };
const clients = (existing: unknown = null) => {
    let inserted: unknown;
    const chain: any = {
        select: vi.fn(() => chain), eq: vi.fn(() => chain),
        maybeSingle: vi.fn(async () => ({ data: existing, error: null })),
        insert: vi.fn((value) => { inserted = value; return chain; }),
        single: vi.fn(async () => ({ data: { ...(inserted as object), id: 'saved-1' }, error: null })),
    };
    const curated: any = { select: () => curated, eq: () => curated, maybeSingle: async () => ({ data: null }) };
    return { userClient: { from: () => chain } as any, serviceClient: { from: () => curated } as any, chain };
};
beforeEach(() => {
    vi.clearAllMocks();
    mock.allowance.mockResolvedValue({ allowed: true, release: mock.release });
    mock.extract.mockResolvedValue({ data: { title: 'Public grant', category: 'grant', requirements: [] }, model: 'test/model' });
});
afterEach(() => vi.restoreAllMocks());

describe('Server AI allowance at the URL capture boundary', () => {
    it('blocks monthly exhaustion before any provider call or save', async () => {
        mock.allowance.mockResolvedValue({ allowed: false, code: 'AI_MONTHLY_LIMIT_REACHED', message: 'Monthly allowance used', retryAfter: 1000 });
        const db = clients();
        await expect(captureOpportunityFromUrl({ ...db, userId: 'owner-a', input }))
            .rejects.toMatchObject({ status: 429, code: 'AI_MONTHLY_LIMIT_REACHED' });
        expect(mock.extract).not.toHaveBeenCalled();
        expect(db.chain.insert).not.toHaveBeenCalled();
    });
    it('allows an already-saved page without reserving AI capacity', async () => {
        const db = clients({ id: 'saved-old', user_id: 'owner-a', title: 'Keep my edits', canonical_url: input.url, source_url: input.url, content: {} });
        expect(await captureOpportunityFromUrl({ ...db, userId: 'owner-a', input }))
            .toMatchObject({ is_duplicate: true, opportunity: { title: 'Keep my edits' } });
        expect(mock.allowance).not.toHaveBeenCalled();
        expect(mock.extract).not.toHaveBeenCalled();
    });
    it('releases capacity after a successful extraction and preserves its category', async () => {
        const db = clients();
        const result = await captureOpportunityFromUrl({ ...db, userId: 'owner-a', input });
        expect(result.opportunity.category).toBe('grant');
        expect(mock.allowance).toHaveBeenCalledWith(db.serviceClient, 'owner-a');
        expect(mock.release).toHaveBeenCalledOnce();
    });
    it('releases capacity after a provider failure and returns a nontechnical error', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        mock.extract.mockRejectedValueOnce(new Error('provider billing failure'));
        await expect(captureOpportunityFromUrl({ ...clients(), userId: 'owner-a', input }))
            .rejects.toMatchObject({ status: 502, code: 'EXTRACTION_FAILED', message: expect.not.stringContaining('billing') });
        expect(mock.release).toHaveBeenCalledOnce();
    });
});
