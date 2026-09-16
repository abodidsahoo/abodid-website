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
        return truncateSmartly(fallbackText);
    }

    const combinedText = textBlocks.join('\n\n');
    return truncateSmartly(combinedText);
}

/**
 * Smart truncation: If a page is unusually long (>14,000 chars):
 * 1. Preserves the first 7,500 chars (Title, Org, Overview, Intro)
 * 2. Scans middle text for high-priority deadline & requirement keywords
 * 3. Preserves the bottom 4,500 chars (Deadlines, Application instructions & Links usually at the end)
 * This guarantees you NEVER lose deadlines or application links on massive pages.
 */
function truncateSmartly(text: string): string {
    if (text.length <= MAX_PAGE_TEXT_CHARS) {
        return text;
    }

    const topChunk = text.slice(0, 7500);
    const bottomChunk = text.slice(-4500);

    // Extract any middle paragraphs that contain critical deadline/submission keywords
    const middleText = text.slice(7500, -4500);
    const middleParagraphs = middleText.split('\n\n');
    const priorityKeywords = /\b(deadline|closing date|due date|how to apply|eligibility|requirements|submission|stipend|funding|grant amount|timeline|schedule)\b/i;

    const criticalMiddleBlocks: string[] = [];
    let middleCharCount = 0;

    for (const p of middleParagraphs) {
        if (priorityKeywords.test(p)) {
            if (middleCharCount + p.length < 3000) {
                criticalMiddleBlocks.push(p);
                middleCharCount += p.length;
            }
        }
    }

    if (criticalMiddleBlocks.length > 0) {
        return `${topChunk}\n\n[...CRITICAL OPPORTUNITY SECTIONS...]\n\n${criticalMiddleBlocks.join('\n\n')}\n\n[...CLOSING SECTIONS & LINKS...]\n\n${bottomChunk}`;
    }

    return `${topChunk}\n\n[...CONTENT CONTINUES...]\n\n${bottomChunk}`;
}

/**
 * Fetches the webpage content server-side with timeout and realistic User-Agent.
 */
export async function fetchWebpageContent(url: string): Promise<{ html: string; text: string; status: number }> {
    const canonical = canonicalizeUrl(url);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const response = await fetch(canonical, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            signal: controller.signal,
            redirect: 'follow',
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Failed to fetch page: HTTP ${response.status} ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml') && !contentType.includes('text/plain')) {
            throw new Error(`Unsupported content type: ${contentType}`);
        }

        const html = await response.text();
        const text = cleanHtmlToText(html);

        return {
            html,
            text,
            status: response.status,
        };
    } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            throw new Error(`Fetch timed out after ${FETCH_TIMEOUT_MS}ms for ${canonical}`);
        }
        throw err;
    }
}
