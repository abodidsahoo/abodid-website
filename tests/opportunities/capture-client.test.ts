import { describe, expect, it, vi } from 'vitest';

import {
    clearSubmittedCaptureUrl,
    finalizeOpportunityCaptureJob,
    OpportunityCaptureTimeoutError,
    requestOpportunityCapture,
    requestOpportunityCaptureJob,
    requestOpportunityCaptureJobStatus,
    requestOpportunityInputCaptureJob,
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

    it('records a durable capture receipt without waiting for extraction', async () => {
        const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
            accepted: true,
            job: { id: 'job-1', status: 'pending' },
        }), {
            status: 202,
            headers: { 'Content-Type': 'application/json' },
        }));

        const result = await requestOpportunityCaptureJob({
            url: 'https://example.org/opportunity',
            accessToken: 'token',
            idempotencyKey: '10000000-0000-4000-8000-000000000001',
            fetchImpl,
        });

        expect(result.response.status).toBe(202);
        expect(result.payload.job).toMatchObject({ id: 'job-1', status: 'pending' });
        expect(fetchImpl).toHaveBeenCalledWith('/api/opportunities/capture-jobs', expect.objectContaining({
            method: 'POST',
            cache: 'no-store',
        }));
        expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))).toMatchObject({
            idempotency_key: '10000000-0000-4000-8000-000000000001',
            channel: 'dashboard',
        });
    });

    it('loads job status through the authenticated receipt endpoint', async () => {
        const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
            job: { id: 'job with spaces', status: 'succeeded' },
        }), { status: 200 }));

        await requestOpportunityCaptureJobStatus({
            jobId: 'job with spaces',
            accessToken: 'token',
            fetchImpl,
        });

        expect(fetchImpl).toHaveBeenCalledWith(
            '/api/opportunities/capture-jobs/job%20with%20spaces',
            expect.objectContaining({ method: 'GET', cache: 'no-store' }),
        );
    });

    it('records note and attachment metadata before direct upload', async () => {
        const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
            accepted: false,
            job: { id: 'job-2', status: 'uploading' },
            uploads: [{ path: 'user/job/file.pdf', token: 'signed-token' }],
        }), { status: 202, headers: { 'Content-Type': 'application/json' } }));

        await requestOpportunityInputCaptureJob({
            text: 'A pasted note',
            attachments: [{ name: 'brief.pdf', type: 'application/pdf', size: 2048 }],
            accessToken: 'token',
            idempotencyKey: '10000000-0000-4000-8000-000000000002',
            fetchImpl,
        });

        const body = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body));
        expect(body).toMatchObject({
            text: 'A pasted note',
            attachments: [{ name: 'brief.pdf', type: 'application/pdf', size: 2048 }],
        });
    });

    it('finalizes uploaded attachments through the receipt endpoint', async () => {
        const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
            accepted: true,
            job: { id: 'job/with spaces', status: 'pending' },
        }), { status: 202, headers: { 'Content-Type': 'application/json' } }));

        await finalizeOpportunityCaptureJob({
            jobId: 'job/with spaces',
            accessToken: 'token',
            fetchImpl,
        });

        expect(fetchImpl).toHaveBeenCalledWith(
            '/api/opportunities/capture-jobs/job%2Fwith%20spaces/finalize',
            expect.objectContaining({ method: 'POST', cache: 'no-store' }),
        );
    });
});
