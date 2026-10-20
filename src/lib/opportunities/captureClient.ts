export const OPPORTUNITY_CAPTURE_TIMEOUT_MS = 80_000;

export type OpportunityCapturePayload = {
    opportunity?: unknown;
    job?: OpportunityCaptureJob;
    uploads?: OpportunityCaptureUploadTarget[];
    error?: string;
    can_manual_create?: boolean;
    canonical_url?: string;
    [key: string]: unknown;
};

export type OpportunityCaptureJob = {
    id: string;
    idempotency_key: string;
    channel: 'dashboard' | 'extension' | 'telegram' | 'whatsapp';
    input_kind: 'url' | 'text' | 'attachments' | 'mixed';
    status: 'uploading' | 'pending' | 'processing' | 'succeeded' | 'failed';
    source_url: string | null;
    source_title: string | null;
    attempt_count: number;
    max_attempts: number;
    available_at: string;
    started_at: string | null;
    completed_at: string | null;
    opportunity_id: string | null;
    is_duplicate: boolean;
    error_code: string | null;
    error_message: string | null;
    source_cleanup_at: string | null;
    source_cleaned_at: string | null;
    created_at: string;
    updated_at: string;
};

export type OpportunityCaptureUploadTarget = {
    path: string;
    token: string;
    name: string;
    type: string;
    size: number;
};

type FetchImplementation = (
    input: RequestInfo | URL,
    init?: RequestInit,
) => Promise<Response>;

type CaptureRequestOptions = {
    url: string;
    accessToken: string | null;
    refreshAccessToken?: () => Promise<string | null>;
    signal?: AbortSignal;
    timeoutMs?: number;
    fetchImpl?: FetchImplementation;
};

type CaptureJobRequestOptions = CaptureRequestOptions & {
    title?: string;
    pageText?: string;
    channel?: 'dashboard' | 'extension';
    idempotencyKey?: string;
    capturedAt?: string;
    captureTimezone?: string;
};

type CaptureInputJobRequestOptions = {
    text: string;
    attachments?: Array<Pick<File, 'name' | 'type' | 'size'>>;
    accessToken: string | null;
    refreshAccessToken?: () => Promise<string | null>;
    signal?: AbortSignal;
    channel?: 'dashboard' | 'extension';
    idempotencyKey?: string;
    capturedAt?: string;
    captureTimezone?: string;
    fetchImpl?: FetchImplementation;
};

export class OpportunityCaptureTimeoutError extends Error {
    constructor() {
        super('This extraction took too long. Please try the link again.');
        this.name = 'OpportunityCaptureTimeoutError';
    }
}

export const clearSubmittedCaptureUrl = (currentUrl: string, submittedUrl: string) =>
    currentUrl.trim() === submittedUrl ? '' : currentUrl;

const readPayload = async (response: Response): Promise<OpportunityCapturePayload> =>
    response.json().catch(() => ({}));

export const requestOpportunityCapture = async ({
    url,
    accessToken,
    refreshAccessToken,
    signal,
    timeoutMs = OPPORTUNITY_CAPTURE_TIMEOUT_MS,
    fetchImpl = fetch,
}: CaptureRequestOptions) => {
    const controller = new AbortController();
    let timedOut = false;
    let rejectTimeout: ((reason: OpportunityCaptureTimeoutError) => void) | undefined;

    const abortFromCaller = () => controller.abort(signal?.reason);
    if (signal?.aborted) abortFromCaller();
    else signal?.addEventListener('abort', abortFromCaller, { once: true });

    const timeout = new Promise<never>((_resolve, reject) => {
        rejectTimeout = reject;
    });
    const timeoutId = globalThis.setTimeout(() => {
        timedOut = true;
        controller.abort();
        rejectTimeout?.(new OpportunityCaptureTimeoutError());
    }, timeoutMs);

    const send = async (token: string | null) => {
        const response = await fetchImpl('/api/opportunities/capture', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ url }),
            signal: controller.signal,
        });
        return { response, payload: await readPayload(response) };
    };

    const execute = async () => {
        let result = await send(accessToken);

        if (result.response.status === 401 && refreshAccessToken && !controller.signal.aborted) {
            const refreshedToken = await refreshAccessToken();
            if (refreshedToken && !controller.signal.aborted) {
                result = await send(refreshedToken);
            }
        }

        return result;
    };

    try {
        return await Promise.race([execute(), timeout]);
    } catch (error) {
        if (timedOut) throw new OpportunityCaptureTimeoutError();
        throw error;
    } finally {
        globalThis.clearTimeout(timeoutId);
        signal?.removeEventListener('abort', abortFromCaller);
    }
};

const authorizedJsonRequest = async ({
    endpoint,
    method = 'GET',
    body,
    accessToken,
    refreshAccessToken,
    signal,
    fetchImpl = fetch,
}: {
    endpoint: string;
    method?: 'GET' | 'POST';
    body?: unknown;
    accessToken: string | null;
    refreshAccessToken?: () => Promise<string | null>;
    signal?: AbortSignal;
    fetchImpl?: FetchImplementation;
}) => {
    const send = async (token: string | null) => {
        const response = await fetchImpl(endpoint, {
            method,
            headers: {
                ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
            signal,
            cache: 'no-store',
        });
        return { response, payload: await readPayload(response) };
    };

    let result = await send(accessToken);
    if (result.response.status === 401 && refreshAccessToken && !signal?.aborted) {
        const refreshedToken = await refreshAccessToken();
        if (refreshedToken && !signal?.aborted) result = await send(refreshedToken);
    }
    return result;
};

export const requestOpportunityCaptureJob = async ({
    url,
    title = '',
    pageText = '',
    channel = 'dashboard',
    idempotencyKey = crypto.randomUUID(),
    capturedAt = new Date().toISOString(),
    captureTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    accessToken,
    refreshAccessToken,
    signal,
    fetchImpl = fetch,
}: CaptureJobRequestOptions) => authorizedJsonRequest({
    endpoint: '/api/opportunities/capture-jobs',
    method: 'POST',
    body: {
        url,
        title,
        page_text: pageText,
        channel,
        idempotency_key: idempotencyKey,
        captured_at: capturedAt,
        capture_timezone: captureTimezone,
    },
    accessToken,
    refreshAccessToken,
    signal,
    fetchImpl,
});

export const requestOpportunityInputCaptureJob = async ({
    text,
    attachments = [],
    channel = 'dashboard',
    idempotencyKey = crypto.randomUUID(),
    capturedAt = new Date().toISOString(),
    captureTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    accessToken,
    refreshAccessToken,
    signal,
    fetchImpl = fetch,
}: CaptureInputJobRequestOptions) => authorizedJsonRequest({
    endpoint: '/api/opportunities/capture-jobs',
    method: 'POST',
    body: {
        text,
        attachments: attachments.map(({ name, type, size }) => ({ name, type, size })),
        channel,
        idempotency_key: idempotencyKey,
        captured_at: capturedAt,
        capture_timezone: captureTimezone,
    },
    accessToken,
    refreshAccessToken,
    signal,
    fetchImpl,
});

export const finalizeOpportunityCaptureJob = async ({
    jobId,
    accessToken,
    refreshAccessToken,
    signal,
    fetchImpl = fetch,
}: {
    jobId: string;
    accessToken: string | null;
    refreshAccessToken?: () => Promise<string | null>;
    signal?: AbortSignal;
    fetchImpl?: FetchImplementation;
}) => authorizedJsonRequest({
    endpoint: `/api/opportunities/capture-jobs/${encodeURIComponent(jobId)}/finalize`,
    method: 'POST',
    accessToken,
    refreshAccessToken,
    signal,
    fetchImpl,
});

export const requestOpportunityCaptureJobStatus = async ({
    jobId,
    accessToken,
    refreshAccessToken,
    signal,
    fetchImpl = fetch,
}: {
    jobId: string;
    accessToken: string | null;
    refreshAccessToken?: () => Promise<string | null>;
    signal?: AbortSignal;
    fetchImpl?: FetchImplementation;
}) => authorizedJsonRequest({
    endpoint: `/api/opportunities/capture-jobs/${encodeURIComponent(jobId)}`,
    accessToken,
    refreshAccessToken,
    signal,
    fetchImpl,
});
