import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import seeds from '../../src/data/feedbackForms.seed.json';

const database = vi.hoisted(() => ({ row: null as Record<string, unknown> | null }));
vi.mock('../../src/lib/supabaseServer', () => ({
    createSupabaseServiceClient: () => ({
        from: () => ({ select: () => ({ eq: () => ({
            maybeSingle: async () => ({ data: database.row, error: null }),
        }) }) }),
    }),
}));
import { getFeedbackForm } from '../../src/lib/feedback/server';

beforeEach(() => {
    vi.stubEnv('DEV', false);
    database.row = {
        ...seeds[1], questions: seeds[0].questions, id: 'test-nift', form_version: 1, is_open: true, responses_public: true,
        content: {
            ...seeds[1].content, resourceNote: 'Existing live copy', resourceNotice: undefined,
            resourceInstructions: undefined,
            resources: [{ label: 'Existing live deck', url: 'https://pitch.com/v/the-retail-window-magxqs' }],
        },
    };
});
afterEach(() => vi.unstubAllEnvs());

describe('feedback draft publication boundary', () => {
    it('previews the new PDFs, session order and community notice in development', async () => {
        vi.stubEnv('DEV', true);
        const form = await getFeedbackForm(seeds[1].slug);
        expect(form?.content.resources[0]).toMatchObject({
            label: 'Session 01 — The Retail Window',
            url: 'https://drive.google.com/file/d/1am-OG6yy9n8bf8vGucJ8BHVxWuSMPxHt/view?usp=sharing',
        });
        expect(form?.content.resources[1]).toMatchObject({
            label: 'Session 02 — Tanishq, Bhubaneswar',
            url: 'https://drive.google.com/file/d/1d8fC90updrTx0kMZ4ydlgG9yyH5C5-w5/view?usp=sharing',
        });
        expect(form?.content.resources[2].url).toBe('https://tiled.art/en/art/TurtleIsland/');
        expect(form?.content.resourceNotice?.text).toContain('Do not share them publicly or upload them to any platform.');
        expect(form?.form_version).toBe(2);
        expect(form?.questions.map((q) => q.id)).toEqual(['feedback']);
        expect(form?.content.resourceEmailEnabled).toBe(true);
    });
    it('keeps production content on the database version until its migration is applied', async () => {
        const form = await getFeedbackForm(seeds[1].slug);
        expect(form?.content.resourceNote).toBe('Existing live copy');
        expect(form?.content.resources[0].url).toContain('pitch.com');
        expect(form?.content.resourceNotice).toBeUndefined();
    });
    it('does not increment an already-published version because JSONB keys have a different order', async () => {
        vi.stubEnv('DEV', true);
        database.row = { ...database.row, form_version: 2, questions: seeds[1].questions.map((q) => Object.fromEntries(Object.entries(q).reverse())) };
        const form = await getFeedbackForm(seeds[1].slug);
        expect(form?.form_version).toBe(2);
    });
    it('keeps DU resources and copy separate from the NIFT PDF restrictions', async () => {
        vi.stubEnv('DEV', true);
        database.row = { ...seeds[0], id: 'test-du', form_version: 1, is_open: true, responses_public: true };
        const form = await getFeedbackForm(seeds[0].slug);
        expect(form?.content.resources).toEqual(seeds[0].content.resources);
        expect(form?.content.resourceNotice).toBeUndefined();
    });
});
