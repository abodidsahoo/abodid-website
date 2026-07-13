const SOURCE_MATCHERS = [
    { label: 'ChatGPT', hosts: ['chatgpt.com', 'chat.openai.com'], sources: ['chatgpt', 'openai'] },
    { label: 'Perplexity', hosts: ['perplexity.ai'], sources: ['perplexity'] },
    { label: 'Claude', hosts: ['claude.ai'], sources: ['claude', 'anthropic'] },
    { label: 'Gemini', hosts: ['gemini.google.com', 'bard.google.com'], sources: ['gemini', 'bard'] },
    { label: 'Microsoft Copilot', hosts: ['copilot.microsoft.com'], sources: ['copilot', 'microsoft copilot'] },
    { label: 'Google Search', hosts: ['google.'], sources: ['google'] },
    { label: 'Bing Search', hosts: ['bing.com'], sources: ['bing'] },
    { label: 'LinkedIn', hosts: ['linkedin.com', 'lnkd.in'], sources: ['linkedin'] },
    { label: 'X / Twitter', hosts: ['x.com', 'twitter.com', 't.co'], sources: ['x', 'twitter'] },
    { label: 'Instagram', hosts: ['instagram.com'], sources: ['instagram'] },
    { label: 'Facebook', hosts: ['facebook.com', 'fb.com', 'fb.me'], sources: ['facebook', 'fb'] },
    { label: 'YouTube', hosts: ['youtube.com', 'youtu.be'], sources: ['youtube'] },
];

const INTERNAL_PATH_PATTERNS = [
    /^\/admin(?:\/|$)/,
    /^\/api(?:\/|$)/,
    /^\/preview(?:\/|$)/,
    /^\/test(?:\/|$)/,
    /^\/.*(?:^|[-_/])test(?:\/|$)/,
    /^\/hand-tracking-test\/?$/,
    /^\/landing-grid-test\/?$/,
    /^\/work\/layout-preview\/?$/,
    /^\/research\/admin(?:\/|$)/,
    /^\/resources\/admin(?:\/|$)/,
];

const BOT_USER_AGENT_PATTERN = /bot|crawler|spider|crawling|slurp|bingpreview|facebookexternalhit|facebot|twitterbot|linkedinbot|discordbot|slackbot|whatsapp|telegrambot|embedly|quora link preview|pinterest|uptimerobot|pingdom|statuscake|headlesschrome|lighthouse|pagespeed|playwright|puppeteer|selenium|webdriver/i;

export const cleanAnalyticsString = (value, maxLength = 180) => {
    if (typeof value !== 'string') return '';
    return value.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, maxLength);
};

const normalizeHost = (value) => cleanAnalyticsString(value, 255)
    .toLowerCase()
    .replace(/^www\./, '')
    .replace(/\.$/, '');

const hostMatches = (host, candidate) => {
    if (candidate.endsWith('.')) return host.includes(candidate);
    return host === candidate || host.endsWith(`.${candidate}`);
};

const recognizedSourceFromToken = (value) => {
    const token = cleanAnalyticsString(value, 100).toLowerCase();
    if (!token) return '';

    const match = SOURCE_MATCHERS.find(({ sources }) => sources.some((source) => (
        token === source || (source.length > 2 && token.includes(source))
    )));
    return match?.label || '';
};

const readableUtmSource = (value) => {
    const token = cleanAnalyticsString(value, 100).toLowerCase();
    if (!token) return '';

    return token
        .split(/[\s_-]+/)
        .filter(Boolean)
        .slice(0, 4)
        .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
        .join(' ')
        .slice(0, 100);
};

export const getReferrerDomain = (referrer) => {
    const value = cleanAnalyticsString(referrer, 500);
    if (!value) return '';

    try {
        return normalizeHost(new URL(value).hostname);
    } catch (_error) {
        return '';
    }
};

export const classifyAcquisitionSource = ({ utmSource, utmMedium, referrer, siteOrigin }) => {
    const explicitSource = recognizedSourceFromToken(utmSource);
    if (explicitSource) return explicitSource;
    if (/^(?:email|e-mail|newsletter)$/i.test(cleanAnalyticsString(utmMedium, 100))) return 'Email Campaign';
    const campaignSource = readableUtmSource(utmSource);
    if (campaignSource) return campaignSource;

    const referrerDomain = getReferrerDomain(referrer);
    if (!referrerDomain) return 'Direct Visit';

    let siteDomain = '';
    try {
        siteDomain = normalizeHost(new URL(siteOrigin).hostname);
    } catch (_error) {
        siteDomain = normalizeHost(siteOrigin);
    }

    if (siteDomain && hostMatches(referrerDomain, siteDomain)) return 'Direct Visit';

    const match = SOURCE_MATCHERS.find(({ hosts }) => hosts.some((host) => hostMatches(referrerDomain, host)));
    return match?.label || 'External Website';
};

export const shouldTrackAnalyticsPath = (value) => {
    const path = cleanAnalyticsString(value, 240);
    if (!path || !path.startsWith('/')) return false;
    return !INTERNAL_PATH_PATTERNS.some((pattern) => pattern.test(path));
};

export const isAnalyticsBot = (userAgent) => BOT_USER_AGENT_PATTERN.test(cleanAnalyticsString(userAgent, 500));

export const resolveAnalyticsCountry = (headers) => {
    const value = headers?.get?.('x-vercel-ip-country') || '';
    const country = cleanAnalyticsString(value, 10).toUpperCase();
    return /^[A-Z]{2}$/.test(country) && country !== 'XX' ? country : 'Unknown';
};

export const resolveAnalyticsCity = (headers) => {
    const rawValue = headers?.get?.('x-vercel-ip-city') || '';
    let decoded = rawValue;
    try { decoded = decodeURIComponent(rawValue); } catch (_error) { /* use the clean raw value */ }
    return cleanAnalyticsString(decoded, 120);
};

export const isSameOriginAnalyticsRequest = (request) => {
    const requestUrl = new URL(request.url);
    const origin = request.headers.get('origin');
    const fetchSite = request.headers.get('sec-fetch-site');

    if (fetchSite === 'cross-site') return false;
    if (!origin) return true;

    try {
        return new URL(origin).origin === requestUrl.origin;
    } catch (_error) {
        return false;
    }
};

export const isPreviewAnalyticsEnvironment = (env = {}) => {
    if (env.DEV === true || env.MODE === 'test') return true;
    return env.VERCEL_ENV === 'preview' || env.VERCEL_ENV === 'development';
};

export const isLocalAnalyticsUrl = (value) => {
    try {
        const hostname = new URL(value).hostname.toLowerCase();
        return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname.endsWith('.local');
    } catch (_error) {
        return true;
    }
};
