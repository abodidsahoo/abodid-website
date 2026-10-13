import { canonicalizeCaptureUrl } from './scraper';

const MAX_REDIRECT_WRAPPERS = 3;

const parseHttpUrl = (rawUrl: string): URL => {
    let candidate = rawUrl.trim();
    if (/^[a-z][a-z0-9+.-]*:/i.test(candidate) && !/^https?:\/\//i.test(candidate)) {
        throw new Error('Unsupported URL protocol');
    }
    if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate}`;

    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            const parsed = new URL(candidate);
            if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Unsupported URL protocol');
            return parsed;
        } catch {
            if (attempt > 0) break;
            try {
                candidate = decodeURIComponent(candidate);
            } catch {
                break;
            }
        }
    }

    throw new Error('Invalid URL');
};

const isLinkedInSafetyRedirect = (url: URL) =>
    (url.hostname === 'linkedin.com' || url.hostname.endsWith('.linkedin.com'))
    && /^\/safety\/go\/?$/i.test(url.pathname);

/**
 * Removes known browser safety wrappers before fetching and storing a URL.
 * LinkedIn wraps outbound links as /safety/go?url=..., and fetching that
 * interstitial server-side is unreliable even when the destination is public.
 */
export const unwrapOpportunityRedirect = (rawUrl: string): string => {
    let current = parseHttpUrl(rawUrl);

    for (let depth = 0; depth < MAX_REDIRECT_WRAPPERS; depth += 1) {
        if (!isLinkedInSafetyRedirect(current)) break;
        const destination = current.searchParams.get('url');
        if (!destination) break;
        current = parseHttpUrl(destination);
    }

    return current.toString();
};

export const normalizeOpportunityCaptureUrl = (rawUrl: string) => {
    const sourceUrl = unwrapOpportunityRedirect(rawUrl);
    return {
        sourceUrl,
        canonicalUrl: canonicalizeCaptureUrl(sourceUrl),
    };
};
