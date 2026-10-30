import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { extractOpportunityWithLLM } from '../../src/lib/opportunities/extractor';

const extractionPayload = (title: string) => ({
    title,
    organisation: 'Concurrent Arts',
    category: 'grant',
    deadline: null,
    timezone: null,
    event_date: null,
    location: null,
    requirements: [],
    next_action: null,
    application_url: null,
    meeting_url: null,
    fee_or_funding: null,
    application_fee: null,
    summary: null,
});

const successfulOpenRouterResponse = (title: string, model = 'mock/concurrent-model') => (
    new Response(JSON.stringify({
        model,
        choices: [{ message: { content: JSON.stringify(extractionPayload(title)) } }],
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    })
);

describe('Concurrent OpenRouter opportunity extraction', () => {
    beforeEach(() => {
        vi.stubEnv('OPENROUTER_API_KEY', 'general-test-key');
        vi.stubEnv('OPENROUTER_OPPORTUNITIES_API_KEY', 'test-key');
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    it('keeps 50 parallel extractions independent without shared request state', async () => {
        const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
            const body = JSON.parse(String(init?.body || '{}')) as {
                models?: string[];
                messages?: Array<{ role: string; content: string }>;
            };
            const prompt = body.messages?.find((message) => message.role === 'user')?.content || '';
            const requestNumber = Number(prompt.match(/Concurrent page (\d+)/)?.[1] || -1);

            await new Promise((resolve) => globalThis.setTimeout(resolve, requestNumber % 4));
            return successfulOpenRouterResponse(`Opportunity ${requestNumber}`);
        });
        vi.stubGlobal('fetch', fetchMock);

        const results = await Promise.all(Array.from({ length: 50 }, (_, index) => (
            extractOpportunityWithLLM(`Concurrent page ${index}`, `Page ${index}`, {
                sourceUrl: `https://example.org/opportunity-${index}`,
            })
        )));

        expect(results.map((result) => result.data.title)).toEqual(
            Array.from({ length: 50 }, (_, index) => `Opportunity ${index}`),
        );
        expect(fetchMock).toHaveBeenCalledTimes(50);
        for (const [, init] of fetchMock.mock.calls) {
            const body = JSON.parse(String(init?.body || '{}')) as { model?: string; models?: string[] };
            expect(body.model).toBeUndefined();
            expect(body.models).toHaveLength(2);
        }
    });

    it('honours a transient rate-limit response and retries once', async () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 429 } }), {
                status: 429,
                headers: { 'Content-Type': 'application/json', 'Retry-After': '0' },
            }))
            .mockResolvedValueOnce(successfulOpenRouterResponse('Recovered opportunity', 'mock/fallback'));
        vi.stubGlobal('fetch', fetchMock);

        const result = await extractOpportunityWithLLM('Rate-limited page');

        expect(result.data.title).toBe('Recovered opportunity');
        expect(result.model).toBe('mock/fallback');
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('does not retry a permanent authentication failure', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
            error: { code: 401 },
        }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        }));
        vi.stubGlobal('fetch', fetchMock);

        await expect(extractOpportunityWithLLM('Authentication failure page'))
            .rejects.toThrow('HTTP 401');
        expect(fetchMock).toHaveBeenCalledOnce();
    });

    it.each(['', 'general-test-key'])('fails closed in production without a distinct opportunity key', async (key) => {
        vi.stubEnv('DEV', false);
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('OPENROUTER_OPPORTUNITIES_API_KEY', key);
        const provider = vi.fn();
        vi.stubGlobal('fetch', provider);
        await expect(extractOpportunityWithLLM('Public opportunity'))
            .rejects.toThrow('dedicated opportunity processing key');
        expect(provider).not.toHaveBeenCalled();
    });

    it('never falls back to the generic key during local development either', async () => {
        vi.stubEnv('DEV', true);
        vi.stubEnv('NODE_ENV', 'development');
        vi.stubEnv('OPENROUTER_OPPORTUNITIES_API_KEY', '');
        const provider = vi.fn();
        vi.stubGlobal('fetch', provider);
        await expect(extractOpportunityWithLLM('Public opportunity')).rejects.toThrow('dedicated opportunity processing key');
        expect(provider).not.toHaveBeenCalled();
    });

    it('uses only the dedicated key for production opportunity processing', async () => {
        vi.stubEnv('DEV', false);
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('OPENROUTER_OPPORTUNITIES_API_KEY', 'dedicated-test-key');
        const provider = vi.fn().mockResolvedValue(successfulOpenRouterResponse('Production result'));
        vi.stubGlobal('fetch', provider);
        expect((await extractOpportunityWithLLM('Public opportunity')).data.title).toBe('Production result');
        expect(provider.mock.calls[0][1].headers.Authorization).toBe('Bearer dedicated-test-key');
    });
});
