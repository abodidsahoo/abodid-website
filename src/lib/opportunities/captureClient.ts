export const OPPORTUNITY_CAPTURE_TIMEOUT_MS = 80_000;

export type OpportunityCapturePayload = {
    opportunity?: unknown;
    error?: string;
    can_manual_create?: boolean;
    canonical_url?: string;
    [key: string]: unknown;
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
