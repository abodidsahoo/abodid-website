import { describe, expect, it, vi } from 'vitest';

import {
    clearSubmittedCaptureUrl,
    OpportunityCaptureTimeoutError,
    requestOpportunityCapture,
} from '../../src/lib/opportunities/captureClient';

describe('Opportunity capture client lifecycle', () => {
    it('retries one unauthorized capture with a refreshed access token', async () => {
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Invalid or expired session' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ opportunity: { id: 'saved' } }), {
                status: 201,
                headers: { 'Content-Type': 'application/json' },
            }));
        const refreshAccessToken = vi.fn().mockResolvedValue('fresh-token');

        const result = await requestOpportunityCapture({
            url: 'https://example.org/opportunity',
            accessToken: 'expired-token',
            refreshAccessToken,
            fetchImpl,
        });

        expect(result.response.status).toBe(201);
        expect(refreshAccessToken).toHaveBeenCalledOnce();
        expect(fetchImpl).toHaveBeenCalledTimes(2);
        expect(fetchImpl.mock.calls[0][1]?.headers).toMatchObject({
            Authorization: 'Bearer expired-token',
        });
        expect(fetchImpl.mock.calls[1][1]?.headers).toMatchObject({
            Authorization: 'Bearer fresh-token',
        });
    });

    it('turns a stalled capture into a recoverable timeout error', async () => {
        const fetchImpl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => (
            new Promise<Response>((_resolve, reject) => {
                init?.signal?.addEventListener('abort', () => {
                    reject(new DOMException('Aborted', 'AbortError'));
                }, { once: true });
            })
        ));

        await expect(requestOpportunityCapture({
            url: 'https://example.org/slow-opportunity',
            accessToken: 'token',
            timeoutMs: 5,
            fetchImpl,
        })).rejects.toBeInstanceOf(OpportunityCaptureTimeoutError);
    });

    it('keeps the same timeout while an expired session is being refreshed', async () => {
        const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Expired' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        }));
        const refreshAccessToken = vi.fn(() => new Promise<string | null>(() => {}));

        await expect(requestOpportunityCapture({
            url: 'https://example.org/refresh-stalled',
            accessToken: 'expired-token',
            refreshAccessToken,
            timeoutMs: 5,
            fetchImpl,
        })).rejects.toBeInstanceOf(OpportunityCaptureTimeoutError);
    });

    it('does not erase a second URL pasted while the first capture is finishing', () => {
        expect(clearSubmittedCaptureUrl(
            'https://example.org/second',
            'https://example.org/first',
        )).toBe('https://example.org/second');

        expect(clearSubmittedCaptureUrl(
            ' https://example.org/first ',
            'https://example.org/first',
        )).toBe('');
    });
});
