/** Clean display links without removing query parameters needed to identify the page. */
export function cleanOpportunityListingUrl(value: string | null | undefined): string | null {
    if (!value) return null;
    try {
        let url = new URL(value);
        for (let depth = 0; depth < 3; depth += 1) {
            const linkedIn = /(^|\.)linkedin\.com$/i.test(url.hostname) && /^\/safety\/go\/?$/i.test(url.pathname);
            const google = /^(?:www\.)?google\.com$/i.test(url.hostname) && url.pathname === '/url';
            const destination = linkedIn ? url.searchParams.get('url') : google ? (url.searchParams.get('q') || url.searchParams.get('url')) : null;
            if (!destination) break;
            url = new URL(destination);
        }
        if (!['https:', 'http:'].includes(url.protocol) || url.hostname === 'direct.entry') return null;
        for (const key of [...url.searchParams.keys()]) {
            if (/^(utm_.*|fbclid|gclid|dclid|msclkid|igshid|igsh|mc_cid|mc_eid|srsltid|_ga|_gl|vero_id|ref_src|ref_url)$/i.test(key)
                || (/^(ref|source|s|via)$/i.test(key) && /chatgpt|openai|chat.?chip/i.test(url.searchParams.get(key) || ''))) {
                url.searchParams.delete(key);
            }
        }
        if (/^#(?:utm_|:~:text=)/i.test(url.hash)) url.hash = '';
        return url.toString();
    } catch {
        return null;
    }
}
