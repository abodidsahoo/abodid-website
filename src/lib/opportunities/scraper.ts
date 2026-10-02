import * as cheerio from 'cheerio';
import crypto from 'node:crypto';

const MAX_PAGE_TEXT_CHARS = 12000;
const FETCH_TIMEOUT_MS = 12000;

const TRACKING_PARAMS = new Set([
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'utm_id',
    'ref',
    'source',
    'fbclid',
    'gclid',
    'igshid',
    'mc_cid',
    'mc_eid',
    '_ga',
    '_gl',
    'trk',
    'tracking_id',
]);

/**
 * Normalizes and canonicalizes a URL for consistent storage and deduplication.
 * Strips tracking parameters, hash fragments, and standardizes casing and trailing slashes.
 */
export function canonicalizeUrl(rawUrl: string): string {
    if (!rawUrl || typeof rawUrl !== 'string') {
        throw new Error('Invalid URL provided');
    }

    let urlString = rawUrl.trim();
    if (!/^https?:\/\//i.test(urlString)) {
        urlString = `https://${urlString}`;
    }

    let parsed: URL;
    try {
        parsed = new URL(urlString);
    } catch {
        throw new Error(`Invalid URL format: ${rawUrl}`);
    }

    // Lowercase protocol and host
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase();

    // Strip hash fragment
    parsed.hash = '';

    // Remove tracking query parameters
    const searchParams = new URLSearchParams(parsed.search);
    const keysToRemove: string[] = [];
    for (const key of searchParams.keys()) {
        if (TRACKING_PARAMS.has(key.toLowerCase()) || key.startsWith('utm_')) {
            keysToRemove.push(key);
        }
    }
    for (const key of keysToRemove) {
        searchParams.delete(key);
    }
    parsed.search = searchParams.toString();

    // Standardize pathname (strip redundant trailing slash if not root)
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
        parsed.pathname = parsed.pathname.slice(0, -1);
    }

    return parsed.toString();
}

const EVENT_FRAGMENT_PATTERN = /(?:^|[-_])(event|events|session|sessions|webinar|workshop|open[-_]?day|information|info)(?:$|[-_])/i;

/**
 * Canonicalizes URLs captured from the browser without discarding a fragment
 * that identifies a distinct event or information-session section.
 *
 * Generic navigation fragments such as #apply remain stripped so ordinary
 * duplicate captures still collapse to one record.
 */
export function canonicalizeCaptureUrl(rawUrl: string): string {
    const canonical = canonicalizeUrl(rawUrl);
    const parsed = new URL(/^https?:\/\//i.test(rawUrl.trim()) ? rawUrl.trim() : `https://${rawUrl.trim()}`);
    const fragment = decodeURIComponent(parsed.hash.replace(/^#/, '')).trim();

    if (!fragment || !EVENT_FRAGMENT_PATTERN.test(fragment)) {
        return canonical;
    }

    return `${canonical}#${encodeURIComponent(fragment)}`;
}

/**
 * Computes a SHA-256 hash of a string.
 */
export function computeContentHash(content: string): string {
    return crypto.createHash('sha256').update(content || '').digest('hex');
}

/**
 * Cleans an HTML string by removing scripts, styles, navigation, footers, cookie banners,
 * and extracts readable plain text with a sensible maximum length.
 */
export function cleanHtmlToText(html: string): string {
    if (!html || typeof html !== 'string') return '';

    const $ = cheerio.load(html);

    // Preserve concise schema.org opportunity metadata before removing scripts.
    // Job boards and event platforms often render the useful fields only in JSON-LD.
    const structuredDataBlocks: string[] = [];
    const structuredKeys = [
        '@type', 'name', 'title', 'description', 'url', 'datePosted', 'validThrough',
        'startDate', 'endDate', 'applicationDeadline', 'deadline', 'employmentType',
        'hiringOrganization', 'organizer', 'location', 'jobLocation', 'baseSalary',
        'currency', 'value',
    ];
    const structuredEntries: unknown[] = [];
    const collectStructuredEntries = (value: unknown) => {
        if (Array.isArray(value)) {
            value.forEach(collectStructuredEntries);
            return;
        }
        if (!value || typeof value !== 'object') return;

        const record = value as Record<string, unknown>;
        if (record['@graph']) collectStructuredEntries(record['@graph']);

        const type = String(record['@type'] || '');
        const isOpportunityType = /jobposting|event|course|scholarship|grant|fellowship|offer/i.test(type);
        const hasOpportunityDates = ['validThrough', 'applicationDeadline', 'deadline', 'startDate', 'endDate']
            .some((key) => record[key] != null);
        if (isOpportunityType || hasOpportunityDates) structuredEntries.push(record);
    };
    $('script[type="application/ld+json"]').slice(0, 10).each((_, element) => {
        try {
            const parsed = JSON.parse($(element).text());
            collectStructuredEntries(parsed);
        } catch {
            // Ignore invalid third-party structured data and continue with visible text.
        }
    });
    structuredEntries.slice(0, 10).forEach((entry) => {
        const compact = JSON.stringify(entry, structuredKeys);
        if (compact && compact !== '{}' && compact !== '[]') structuredDataBlocks.push(compact);
    });

    // Remove unwanted non-content elements
    $(
        'script, style, noscript, svg, canvas, iframe, audio, video, ' +
        'nav, header, footer, [role="navigation"], [role="banner"], [role="contentinfo"], ' +
        '.cookie-banner, .cookie-consent, #cookie-notice, .modal, .popup, ' +
        '.advertisement, .ad, .ads, .sidebar, aside, .social-share, .newsletter-signup'
    ).remove();

    // Extract structured readable text
    const textBlocks: string[] = [];

    // Focus on main semantic content containers first if present
    const mainContainer = $('main, article, [role="main"], #content, .content, .job-description, .posting, body').first();
    const root = mainContainer.length ? mainContainer : $('body');

    root.find('h1, h2, h3, h4, h5, h6, p, li, dt, dd, th, td, blockquote').each((_, el) => {
        const text = $(el).text().replace(/\s+/g, ' ').trim();
        if (text.length > 0) {
            textBlocks.push(text);
        }
    });

    if (textBlocks.length === 0) {
        // Fallback to body inner text if standard block selectors returned nothing
        const fallbackText = $('body').text().replace(/\s+/g, ' ').trim();
        return truncateSmartly([
            structuredDataBlocks.length ? `STRUCTURED PAGE DATA:\n${structuredDataBlocks.join('\n')}` : '',
            fallbackText,
        ].filter(Boolean).join('\n\n'));
    }

    const combinedText = [
        structuredDataBlocks.length ? `STRUCTURED PAGE DATA:\n${structuredDataBlocks.join('\n')}` : '',
        ...textBlocks,
    ].filter(Boolean).join('\n\n');
    return truncateSmartly(combinedText);
}

/**
 * Smart truncation: If a page exceeds the model-input budget:
 * 1. Preserves the opening content (Title, Org, Overview, Intro)
 * 2. Scans middle text for high-priority deadline & requirement keywords
 * 3. Preserves the closing content (application instructions and links often live there)
 * The final output never exceeds the configured character budget.
 */
export function prioritizeOpportunityText(text: string, maxChars = MAX_PAGE_TEXT_CHARS): string {
    if (!text || typeof text !== 'string') return '';
    if (text.length <= maxChars) return text;

    const markerBudget = 180;
    const topSize = Math.min(5500, Math.floor(maxChars * 0.48));
    const bottomSize = Math.min(3500, Math.floor(maxChars * 0.3));
    const middleBudget = Math.max(0, maxChars - topSize - bottomSize - markerBudget);
    const topChunk = text.slice(0, topSize);
    const bottomChunk = text.slice(-bottomSize);

    const middleText = text.slice(topSize, -bottomSize);
    const middleParagraphs = middleText.split(/\n{2,}/);
    const priorityKeywords = /\b(application deadline|submission deadline|closing date|applications? close|apply by|submit by|deadline|how to apply|eligibility|requirements|submission|stipend|funding|grant amount|timeline|schedule)\b/i;

    const criticalMiddleBlocks: string[] = [];
    let middleCharCount = 0;

    for (const paragraph of middleParagraphs) {
        const block = paragraph.trim();
        if (!block || !priorityKeywords.test(block)) continue;
        const separatorLength = criticalMiddleBlocks.length ? 2 : 0;
        const remaining = middleBudget - middleCharCount - separatorLength;
        if (remaining <= 0) break;
        const preserved = block.slice(0, remaining);
        criticalMiddleBlocks.push(preserved);
        middleCharCount += preserved.length + separatorLength;
    }

    const middleSection = criticalMiddleBlocks.length
        ? `[...CRITICAL OPPORTUNITY SECTIONS...]\n\n${criticalMiddleBlocks.join('\n\n')}`
        : '[...CONTENT CONTINUES...]';
    const result = `${topChunk}\n\n${middleSection}\n\n[...CLOSING SECTIONS & LINKS...]\n\n${bottomChunk}`;
    return result.slice(0, maxChars);
}

function truncateSmartly(text: string): string {
    return prioritizeOpportunityText(text, MAX_PAGE_TEXT_CHARS);
}

export function extractHtmlTitle(html: string): string {
    if (!html || typeof html !== 'string') return '';
    const $ = cheerio.load(html);
    return $('title').first().text().replace(/\s+/g, ' ').trim();
}

import { extractText } from 'unpdf';

const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB limit
const MAX_PDF_PAGES = 30; // 30 pages limit

/**
 * Fetches the webpage or PDF content server-side with timeout and realistic User-Agent.
 */
export async function fetchWebpageContent(url: string): Promise<{ html: string; text: string; status: number; title: string }> {
    const canonical = canonicalizeUrl(url);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const response = await fetch(canonical, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            signal: controller.signal,
            redirect: 'follow',
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Failed to fetch page: HTTP ${response.status} ${response.statusText}`);
        }

        const contentType = (response.headers.get('content-type') || '').toLowerCase();
        const contentLength = Number(response.headers.get('content-length') || 0);
        const urlWithoutQuery = canonical.split('?')[0].toLowerCase();
        const isPdf = contentType.includes('application/pdf') || urlWithoutQuery.endsWith('.pdf');

        // Handle direct PDF documents
        if (isPdf) {
            if (contentLength > MAX_PDF_SIZE_BYTES) {
                const sizeMb = (contentLength / (1024 * 1024)).toFixed(1);
                throw new Error(`PDF exceeds the 10 MB limit (${sizeMb} MB). Please add this opportunity manually to conserve AI tokens.`);
            }

            const arrayBuffer = await response.arrayBuffer();
            if (arrayBuffer.byteLength > MAX_PDF_SIZE_BYTES) {
                const sizeMb = (arrayBuffer.byteLength / (1024 * 1024)).toFixed(1);
                throw new Error(`PDF exceeds the 10 MB limit (${sizeMb} MB). Please add this opportunity manually to conserve AI tokens.`);
            }

            const { text: pdfPagesText, totalPages } = await extractText(new Uint8Array(arrayBuffer), { mergePages: true });

            if (totalPages > MAX_PDF_PAGES) {
                throw new Error(`PDF exceeds the 30-page limit (${totalPages} pages). Please add this opportunity manually to conserve AI tokens.`);
            }

            const fullPdfText = typeof pdfPagesText === 'string' ? pdfPagesText : (Array.isArray(pdfPagesText) ? (pdfPagesText as string[]).join('\n\n') : '');
            const cleanText = truncateSmartly(
                fullPdfText.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
            );

            return {
                html: '',
                text: cleanText,
                status: response.status,
                title: '',
            };
        }

        // Handle HTML / text pages
        if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml') && !contentType.includes('text/plain')) {
            throw new Error(`Unsupported content type: ${contentType}`);
        }

        const html = await response.text();
        let text = cleanHtmlToText(html);

        // If the HTML page is just an empty wrapper around an embedded PDF, extract the embedded PDF
        if (text.length < 150) {
            const $ = cheerio.load(html);
            const embeddedPdfSrc = $('iframe[src*=".pdf"], embed[src*=".pdf"], object[data*=".pdf"], a[href*=".pdf"]').first().attr('src') ||
                                   $('embed[src*=".pdf"]').first().attr('src') ||
                                   $('object[data*=".pdf"]').first().attr('data') ||
                                   $('a[href*=".pdf"]').first().attr('href');

            if (embeddedPdfSrc) {
                try {
                    const resolvedPdfUrl = new URL(embeddedPdfSrc, canonical).toString();
                    const pdfRes = await fetch(resolvedPdfUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                            'Accept': 'application/pdf',
                        },
                    });
                    if (pdfRes.ok) {
                        const pdfLength = Number(pdfRes.headers.get('content-length') || 0);
                        if (pdfLength <= MAX_PDF_SIZE_BYTES) {
                            const pdfBuf = await pdfRes.arrayBuffer();
                            if (pdfBuf.byteLength <= MAX_PDF_SIZE_BYTES) {
                                const { text: embeddedPdfText, totalPages } = await extractText(new Uint8Array(pdfBuf), { mergePages: true });
                                if (totalPages <= MAX_PDF_PAGES) {
                                    const fullText = typeof embeddedPdfText === 'string' ? embeddedPdfText : (Array.isArray(embeddedPdfText) ? (embeddedPdfText as string[]).join('\n\n') : '');
                                    if (fullText.trim().length > 100) {
                                        text = truncateSmartly(fullText.trim());
                                    }
                                }
                            }
                        }
                    }
                } catch {
                    // Fallback to original HTML text
                }
            }
        }

        return {
            html,
            text,
            status: response.status,
            title: extractHtmlTitle(html),
        };
    } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            throw new Error(`Fetch timed out after ${FETCH_TIMEOUT_MS}ms for ${canonical}`);
        }
        throw err;
    }
}
