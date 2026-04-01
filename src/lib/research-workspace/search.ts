export type SearchProvider = 'google' | 'openalex' | 'crossref';

export type ResearchSearchResult = {
    id: string;
    title: string;
    authors: string[];
    year: number | null;
    relevanceNote: string;
    sourceLabel: string;
    venue: string | null;
    doi: string | null;
    actionLabel: string;
    actionUrl: string | null;
    pdfUrl: string | null;
    landingPageUrl: string | null;
    isOpenAccess: boolean;
    provider: SearchProvider;
};

export type ResearchSearchResponse = {
    query: string;
    results: ResearchSearchResult[];
    meta: {
        providersUsed: SearchProvider[];
        providerSummary: string;
        openAlexEnabled: boolean;
        googleEnabled: boolean;
        fallbackUsed: boolean;
    };
};

type ProviderResult = {
    provider: SearchProvider;
    status: 'success' | 'error' | 'skipped';
    results: ResearchSearchResult[];
    error?: string;
};

type ProviderAvailability = {
    googleEnabled: boolean;
    openAlexEnabled: boolean;
};

type OpenAlexWork = {
    id?: string;
    display_name?: string | null;
    doi?: string | null;
    publication_year?: number | null;
    authorships?: Array<{
        author?: {
            display_name?: string | null;
        } | null;
    }> | null;
    open_access?: {
        is_oa?: boolean | null;
        oa_status?: string | null;
    } | null;
    best_oa_location?: OpenAlexLocation | null;
    primary_location?: OpenAlexLocation | null;
    primary_topic?: {
        display_name?: string | null;
    } | null;
    type?: string | null;
};

type OpenAlexLocation = {
    pdf_url?: string | null;
    landing_page_url?: string | null;
    source?: {
        display_name?: string | null;
    } | null;
};

type OpenAlexResponse = {
    results?: OpenAlexWork[];
};

type CrossrefWork = {
    DOI?: string;
    title?: string[];
    author?: Array<{
        given?: string;
        family?: string;
        name?: string;
    }>;
    issued?: {
        'date-parts'?: number[][];
    };
    URL?: string;
    subject?: string[];
    type?: string;
    link?: Array<{
        URL?: string;
        'content-type'?: string;
    }>;
    publisher?: string;
    'container-title'?: string[];
};

type CrossrefResponse = {
    message?: {
        items?: CrossrefWork[];
    };
};

type GoogleSearchResponse = {
    items?: GoogleSearchItem[];
};

type GoogleSearchItem = {
    title?: string;
    link?: string;
    snippet?: string;
    displayLink?: string;
    mime?: string;
    fileFormat?: string;
    pagemap?: {
        metatags?: Array<Record<string, string>>;
    };
};

const DEFAULT_LIMIT = 6;

export async function searchResearchPapers(
    query: string,
    options?: { limit?: number }
): Promise<ResearchSearchResponse> {
    const normalizedQuery = query.trim();
    const limit = options?.limit ?? DEFAULT_LIMIT;

    if (!normalizedQuery) {
        throw new Error('A research question is required.');
    }

    const [googleResult, openAlexResult, crossrefResult] = await Promise.all([
        searchGooglePdf(normalizedQuery, Math.min(Math.max(limit, 6), 10)),
        searchOpenAlex(normalizedQuery, limit),
        searchCrossref(normalizedQuery, limit)
    ]);

    const providersUsed: SearchProvider[] = [];
    const results: ResearchSearchResult[] = [];

    if (googleResult.status === 'success' && googleResult.results.length > 0) {
        providersUsed.push('google');
        results.push(...googleResult.results);
    }

    if (openAlexResult.status === 'success' && openAlexResult.results.length > 0) {
        providersUsed.push('openalex');
        for (const result of openAlexResult.results) {
            if (results.length >= limit) {
                break;
            }

            if (!isDuplicateResult(results, result)) {
                results.push(result);
            }
        }
    }

    if (crossrefResult.status === 'success' && crossrefResult.results.length > 0) {
        providersUsed.push('crossref');
        for (const result of crossrefResult.results) {
            if (results.length >= limit) {
                break;
            }

            if (!isDuplicateResult(results, result)) {
                results.push(result);
            }
        }
    }

    if (results.length === 0) {
        const combinedError = [googleResult, openAlexResult, crossrefResult]
            .filter((provider) => provider.status === 'error' && provider.error)
            .map((provider) => provider.error)
            .join(' ');

        if (combinedError) {
            throw new Error(combinedError);
        }
    }

    const availability: ProviderAvailability = {
        googleEnabled: googleResult.status !== 'skipped',
        openAlexEnabled: openAlexResult.status !== 'skipped'
    };

    return {
        query: normalizedQuery,
        results: results.slice(0, limit),
        meta: {
            providersUsed,
            providerSummary: summarizeProviders(providersUsed, availability),
            openAlexEnabled: availability.openAlexEnabled,
            googleEnabled: availability.googleEnabled,
            fallbackUsed:
                googleResult.status !== 'success' ||
                googleResult.results.length === 0 ||
                openAlexResult.status !== 'success' ||
                openAlexResult.results.length === 0 ||
                (crossrefResult.status === 'success' &&
                    crossrefResult.results.length > 0 &&
                    providersUsed.includes('crossref'))
        }
    };
}

async function searchGooglePdf(
    query: string,
    limit: number
): Promise<ProviderResult> {
    const googleApiKey = import.meta.env.GOOGLE_API_KEY;
    const googleCseId =
        import.meta.env.GOOGLE_CSE_ID ||
        import.meta.env.GOOGLE_PROGRAMMABLE_SEARCH_ENGINE_ID;

    if (!googleApiKey || !googleCseId) {
        return {
            provider: 'google',
            status: 'skipped',
            results: []
        };
    }

    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.set('key', googleApiKey);
    url.searchParams.set('cx', googleCseId);
    url.searchParams.set('q', `${query} research paper`);
    url.searchParams.set('fileType', 'pdf');
    url.searchParams.set('num', String(Math.min(Math.max(limit, 6), 10)));
    url.searchParams.set('filter', '1');
    url.searchParams.set('safe', 'off');

    try {
        const response = await fetchJson<GoogleSearchResponse>(url.toString());
        const normalized = await Promise.all(
            (response.items ?? []).map((item) => normalizeGooglePdfItem(item))
        );

        return {
            provider: 'google',
            status: 'success',
            results: normalized
                .filter((item): item is ResearchSearchResult => Boolean(item && item.pdfUrl))
                .slice(0, limit)
        };
    } catch (error) {
        console.error('[research-search] Google PDF search failed:', error);
        return {
            provider: 'google',
            status: 'error',
            results: [],
            error: 'Google PDF search is currently unavailable.'
        };
    }
}

async function searchOpenAlex(
    query: string,
    limit: number
): Promise<ProviderResult> {
    const openAlexApiKey = import.meta.env.OPENALEX_API_KEY;
    const contactEmail = getContactEmail();

    if (!openAlexApiKey) {
        return {
            provider: 'openalex',
            status: 'skipped',
            results: []
        };
    }

    const url = new URL('https://api.openalex.org/works');
    url.searchParams.set('search', query);
    url.searchParams.set('per-page', String(Math.max(limit, 6)));
    url.searchParams.set('api_key', openAlexApiKey);

    if (contactEmail) {
        url.searchParams.set('mailto', contactEmail);
    }

    try {
        const response = await fetchJson<OpenAlexResponse>(url.toString(), {
            headers: {
                Accept: 'application/json'
            }
        });

        const results = (response.results ?? [])
            .map(normalizeOpenAlexWork)
            .filter((work): work is ResearchSearchResult => Boolean(work && work.pdfUrl))
            .slice(0, limit);

        return {
            provider: 'openalex',
            status: 'success',
            results
        };
    } catch (error) {
        console.error('[research-search] OpenAlex failed:', error);
        return {
            provider: 'openalex',
            status: 'error',
            results: [],
            error: 'OpenAlex search is currently unavailable.'
        };
    }
}

async function searchCrossref(
    query: string,
    limit: number
): Promise<ProviderResult> {
    const contactEmail = getContactEmail();
    const url = new URL('https://api.crossref.org/works');
    url.searchParams.set('query.bibliographic', query);
    url.searchParams.set('rows', String(Math.max(limit, 6)));

    if (contactEmail) {
        url.searchParams.set('mailto', contactEmail);
    }

    try {
        const response = await fetchJson<CrossrefResponse>(url.toString(), {
            headers: {
                Accept: 'application/json',
                'User-Agent': buildUserAgent(contactEmail)
            }
        });

        const results = (response.message?.items ?? [])
            .map(normalizeCrossrefWork)
            .filter((work): work is ResearchSearchResult => Boolean(work && work.pdfUrl))
            .slice(0, limit);

        return {
            provider: 'crossref',
            status: 'success',
            results
        };
    } catch (error) {
        console.error('[research-search] Crossref failed:', error);
        return {
            provider: 'crossref',
            status: 'error',
            results: [],
            error: 'Crossref search is currently unavailable.'
        };
    }
}

function normalizeOpenAlexWork(work: OpenAlexWork): ResearchSearchResult | null {
    const title = work.display_name?.trim();

    if (!title) {
        return null;
    }

    const authors = (work.authorships ?? [])
        .map((authorship) => authorship.author?.display_name?.trim())
        .filter((author): author is string => Boolean(author))
        .slice(0, 5);

    const pdfUrl =
        work.best_oa_location?.pdf_url ??
        work.primary_location?.pdf_url ??
        null;
    const landingPageUrl =
        work.best_oa_location?.landing_page_url ??
        work.primary_location?.landing_page_url ??
        normalizeDoiUrl(work.doi) ??
        null;
    const venue =
        work.primary_location?.source?.display_name?.trim() ??
        work.best_oa_location?.source?.display_name?.trim() ??
        null;
    const isOpenAccess = Boolean(work.open_access?.is_oa || pdfUrl);
    const topic = work.primary_topic?.display_name?.trim();
    const workType = work.type?.replace(/_/g, ' ');

    return {
        id: work.id ?? `openalex-${slugifyTitle(title)}`,
        title,
        authors,
        year: work.publication_year ?? null,
        relevanceNote: buildRelevanceNote({
            year: work.publication_year ?? null,
            topic,
            venue,
            isOpenAccess,
            providerLabel: 'OpenAlex',
            workType
        }),
        sourceLabel: 'OpenAlex',
        venue,
        doi: normalizeDoiUrl(work.doi),
        actionLabel: 'Download PDF',
        actionUrl: pdfUrl,
        pdfUrl,
        landingPageUrl,
        isOpenAccess,
        provider: 'openalex'
    };
}

function normalizeCrossrefWork(work: CrossrefWork): ResearchSearchResult | null {
    const title = work.title?.[0]?.trim();

    if (!title) {
        return null;
    }

    const authors = (work.author ?? [])
        .map((author) => {
            if (author.name?.trim()) {
                return author.name.trim();
            }

            const fullName = [author.given, author.family]
                .filter(Boolean)
                .join(' ')
                .trim();

            return fullName || null;
        })
        .filter((author): author is string => Boolean(author))
        .slice(0, 5);

    const pdfUrl =
        work.link?.find((link) =>
            String(link['content-type'] || '').toLowerCase().includes('pdf')
        )?.URL ?? null;
    const landingPageUrl = work.URL ?? normalizeDoiUrl(work.DOI) ?? null;
    const year = work.issued?.['date-parts']?.[0]?.[0] ?? null;
    const venue = work['container-title']?.[0]?.trim() || work.publisher?.trim() || null;
    const topic = work.subject?.[0]?.trim();

    return {
        id: work.DOI ? `crossref-${work.DOI}` : `crossref-${slugifyTitle(title)}`,
        title,
        authors,
        year,
        relevanceNote: buildRelevanceNote({
            year,
            topic,
            venue,
            isOpenAccess: Boolean(pdfUrl),
            providerLabel: 'Crossref',
            workType: work.type?.replace(/-/g, ' ') ?? null
        }),
        sourceLabel: 'Crossref',
        venue,
        doi: normalizeDoiUrl(work.DOI),
        actionLabel: 'Download PDF',
        actionUrl: pdfUrl,
        pdfUrl,
        landingPageUrl,
        isOpenAccess: Boolean(pdfUrl),
        provider: 'crossref'
    };
}

async function normalizeGooglePdfItem(
    item: GoogleSearchItem
): Promise<ResearchSearchResult | null> {
    const candidateUrl = item.link?.trim();
    const title = sanitizeGoogleTitle(item.title);

    if (!candidateUrl || !title) {
        return null;
    }

    const verifiedPdfUrl = await verifyDirectPdfUrl(candidateUrl);

    if (!verifiedPdfUrl) {
        return null;
    }

    const metatag = item.pagemap?.metatags?.[0];
    const authors = extractGoogleAuthors(metatag);
    const year = extractGoogleYear(metatag, item.snippet);
    const venue =
        metatag?.['citation_journal_title']?.trim() ||
        metatag?.['citation_conference_title']?.trim() ||
        item.displayLink?.trim() ||
        null;

    return {
        id: `google-${slugifyTitle(`${title}-${verifiedPdfUrl}`)}`,
        title,
        authors,
        year,
        relevanceNote: buildGoogleRelevanceNote(item.snippet, venue),
        sourceLabel: 'Google PDF',
        venue,
        doi: normalizeDoiUrl(metatag?.['citation_doi']),
        actionLabel: 'Download PDF',
        actionUrl: verifiedPdfUrl,
        pdfUrl: verifiedPdfUrl,
        landingPageUrl: verifiedPdfUrl,
        isOpenAccess: true,
        provider: 'google'
    };
}

function buildRelevanceNote(input: {
    year: number | null;
    topic?: string | null;
    venue?: string | null;
    isOpenAccess: boolean;
    providerLabel: string;
    workType?: string | null;
}): string {
    const parts: string[] = [];

    if (input.year) {
        parts.push(`Published in ${input.year}.`);
    }

    if (input.workType) {
        parts.push(`${capitalize(input.workType)} metadata matched your question.`);
    }

    if (input.topic) {
        parts.push(`Topic signal: ${input.topic}.`);
    }

    if (input.venue) {
        parts.push(`Source: ${input.venue}.`);
    }

    parts.push(
        input.isOpenAccess
            ? 'A direct open-access PDF is available.'
            : `Metadata found via ${input.providerLabel}; full-text availability depends on the source record.`
    );

    return parts.join(' ');
}

function buildGoogleRelevanceNote(
    snippet?: string,
    venue?: string | null
): string {
    const parts: string[] = [];

    if (snippet?.trim()) {
        parts.push(snippet.trim());
    }

    if (venue) {
        parts.push(`Source: ${venue}.`);
    }

    parts.push('Verified direct PDF link discovered through Google search.');

    return parts.join(' ');
}

function summarizeProviders(
    providersUsed: SearchProvider[],
    availability: ProviderAvailability
): string {
    if (providersUsed.length === 0) {
        if (!availability.googleEnabled && !availability.openAlexEnabled) {
            return 'No PDF results returned. Google PDF search and OpenAlex are not configured yet.';
        }

        if (!availability.googleEnabled) {
            return 'No PDF results returned. Google PDF search is not configured yet.';
        }

        if (!availability.openAlexEnabled) {
            return 'No PDF results returned. OpenAlex is not configured yet.';
        }

        return 'No PDF results returned from the configured providers.';
    }

    const providerSummary =
        providersUsed.length === 1
            ? `Live PDF search powered by ${formatProviderName(providersUsed[0])}.`
            : `Live PDF search powered by ${providersUsed
        .map(formatProviderName)
        .join(' + ')}.`;

    if (!availability.googleEnabled && !availability.openAlexEnabled) {
        return `${providerSummary} Add GOOGLE_CSE_ID and OPENALEX_API_KEY for broader coverage.`;
    }

    if (!availability.googleEnabled) {
        return `${providerSummary} Add GOOGLE_CSE_ID to include Google PDF discovery.`;
    }

    if (!availability.openAlexEnabled) {
        return `${providerSummary} Add OPENALEX_API_KEY to blend in OpenAlex metadata too.`;
    }

    return providerSummary;
}

function isDuplicateResult(
    existingResults: ResearchSearchResult[],
    candidate: ResearchSearchResult
): boolean {
    const candidateDoi = normalizeDoiUrl(candidate.doi);
    const candidateKey = normalizeKey(candidate.title, candidate.year);
    const candidatePdfKey = normalizePdfKey(candidate.pdfUrl);

    return existingResults.some((existing) => {
        const existingDoi = normalizeDoiUrl(existing.doi);

        if (candidateDoi && existingDoi && candidateDoi === existingDoi) {
            return true;
        }

        if (candidatePdfKey && normalizePdfKey(existing.pdfUrl) === candidatePdfKey) {
            return true;
        }

        return normalizeKey(existing.title, existing.year) === candidateKey;
    });
}

function normalizeKey(title: string, year: number | null): string {
    return `${slugifyTitle(title)}::${year ?? 'unknown'}`;
}

function normalizePdfKey(url: string | null): string | null {
    if (!url) {
        return null;
    }

    return url
        .toLowerCase()
        .replace(/[?#].*$/, '');
}

function normalizeDoiUrl(doi: string | null | undefined): string | null {
    if (!doi) {
        return null;
    }

    if (doi.startsWith('http://') || doi.startsWith('https://')) {
        return doi;
    }

    return `https://doi.org/${doi.replace(/^doi:/i, '').trim()}`;
}

function slugifyTitle(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
}

function capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function sanitizeGoogleTitle(value: string | undefined): string | null {
    if (!value) {
        return null;
    }

    return value
        .replace(/\s*\[PDF\]\s*/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function extractGoogleAuthors(
    metatag?: Record<string, string>
): string[] {
    if (!metatag) {
        return [];
    }

    const authorValue =
        metatag['citation_author'] ||
        metatag['author'] ||
        metatag['dc.creator'] ||
        '';

    return authorValue
        .split(/;|\|/)
        .map((segment) => segment.trim())
        .filter(Boolean)
        .slice(0, 5);
}

function extractGoogleYear(
    metatag?: Record<string, string>,
    snippet?: string
): number | null {
    const candidates = [
        metatag?.['citation_publication_date'],
        metatag?.['citation_online_date'],
        metatag?.['citation_date'],
        snippet
    ].filter(Boolean) as string[];

    for (const value of candidates) {
        const match = value.match(/\b(19|20)\d{2}\b/);

        if (match) {
            return Number(match[0]);
        }
    }

    return null;
}

function getContactEmail(): string {
    return (
        import.meta.env.RESEARCH_WORKSPACE_CONTACT_EMAIL ||
        import.meta.env.OWNER_NOTIFICATION_EMAIL ||
        ''
    );
}

function buildUserAgent(contactEmail: string): string {
    const appName = import.meta.env.PUBLIC_SITE_NAME || 'Abodid Research Workspace';
    const siteUrl = import.meta.env.PUBLIC_SITE_URL || 'https://abodid.com';

    return contactEmail
        ? `${appName} (${siteUrl}; mailto:${contactEmail})`
        : `${appName} (${siteUrl})`;
}

async function verifyDirectPdfUrl(url: string): Promise<string | null> {
    const normalizedUrl = url.trim();

    if (!normalizedUrl) {
        return null;
    }

    const headResult = await inspectPdfResponse(normalizedUrl, 'HEAD');

    if (headResult) {
        return headResult;
    }

    return inspectPdfResponse(normalizedUrl, 'GET');
}

async function inspectPdfResponse(
    url: string,
    method: 'HEAD' | 'GET'
): Promise<string | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
        const response = await fetch(url, {
            method,
            redirect: 'follow',
            headers: {
                Accept: 'application/pdf,*/*;q=0.8',
                ...(method === 'GET' ? { Range: 'bytes=0-0' } : {}),
                'User-Agent': buildUserAgent(getContactEmail())
            },
            signal: controller.signal
        });

        const finalUrl = response.url || url;
        const contentType = response.headers.get('content-type') || '';
        const contentDisposition = response.headers.get('content-disposition') || '';
        const isPdf =
            contentType.toLowerCase().includes('application/pdf') ||
            contentDisposition.toLowerCase().includes('.pdf') ||
            looksLikePdfUrl(finalUrl);

        if (response.body) {
            void response.body.cancel().catch(() => undefined);
        }

        return response.ok && isPdf ? finalUrl : null;
    } catch (_error) {
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

function looksLikePdfUrl(url: string): boolean {
    return /\.pdf(?:$|[?#])/i.test(url);
}

async function fetchJson<T>(
    url: string,
    init?: RequestInit
): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
        const response = await fetch(url, {
            ...init,
            signal: controller.signal
        });

        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
        }

        return (await response.json()) as T;
    } finally {
        clearTimeout(timeout);
    }
}

function formatProviderName(provider: SearchProvider): string {
    if (provider === 'google') {
        return 'Google';
    }

    return provider === 'openalex' ? 'OpenAlex' : 'Crossref';
}
