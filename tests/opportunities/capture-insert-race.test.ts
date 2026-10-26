import { describe, expect, it, vi } from 'vitest';
import { insertCapturedOpportunity } from '../../src/lib/opportunities/captureService';
import { opportunityToSavedInsert } from '../../src/lib/opportunities/saved';

const context = { userId: 'user-a', canonicalUrl: 'https://example.org/call', source: 'extracted' as const };
const insert = opportunityToSavedInsert(context.userId, { title: 'New capture', source_url: context.canonicalUrl, canonical_url: context.canonicalUrl });
const row = { ...insert, id: 'winner', title: 'User edited title', notes: 'Keep my notes', status: 'done', created_at: '2026-10-26T00:00:00Z', updated_at: '2026-10-26T00:01:00Z' };
const client = (result: any, lookup: any) => {
    const chain: any = {
        insert: vi.fn(() => chain), select: vi.fn(() => chain), eq: vi.fn(() => chain),
        single: vi.fn(async () => result), maybeSingle: vi.fn(async () => lookup),
    };
    return { from: vi.fn(() => chain), chain };
};
describe('Concurrent opportunity capture saves', () => {
    it('returns the winning row without overwriting its edits after a unique collision', async () => {
        const db = client({ data: null, error: { code: '23505' } }, { data: row, error: null });
        const saved = await insertCapturedOpportunity(db as any, insert, context);
        expect(saved).toMatchObject({ is_duplicate: true, opportunity: { id: 'winner', title: 'User edited title', notes: 'Keep my notes', status: 'done' } });
        expect(db.chain.eq.mock.calls).toEqual([['user_id','user-a'],['canonical_url',context.canonicalUrl]]);
        expect(db.chain.insert).toHaveBeenCalledTimes(1);
        expect(db.chain).not.toHaveProperty('upsert');
    });
    it('marks a new insert as a new save', async () => {
        const db = client({ data: row, error: null }, null);
        expect(await insertCapturedOpportunity(db as any, insert, context)).toMatchObject({ is_duplicate: false });
        expect(db.chain.maybeSingle).not.toHaveBeenCalled();
    });
    it('does not call a failed duplicate lookup a successful save', async () => {
        const db = client({ data: null, error: { code: '23505' } }, { data: null, error: { code: '42501', message: 'Denied' } });
        const log = vi.spyOn(console, 'error').mockImplementation(() => {});
        try { await expect(insertCapturedOpportunity(db as any, insert, context)).rejects.toMatchObject({ code: 'OPPORTUNITY_SAVE_FAILED' }); }
        finally { log.mockRestore(); }
    });
});
