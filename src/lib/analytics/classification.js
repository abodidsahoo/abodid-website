const SOURCE_MATCHERS = [
    { label: 'ChatGPT', hosts: ['chatgpt.com', 'chat.openai.com', 'oaistatic.com'], sources: ['chatgpt', 'openai'] },
    { label: 'Perplexity', hosts: ['perplexity.ai'], sources: ['perplexity'] },
    { label: 'Claude', hosts: ['claude.ai'], sources: ['claude', 'anthropic'] },
    { label: 'Gemini', hosts: ['gemini.google.com', 'bard.google.com'], sources: ['gemini', 'bard'] },
    { label: 'Microsoft Copilot', hosts: ['copilot.microsoft.com'], sources: ['copilot', 'microsoft copilot'] },
    { label: 'Google Search', hosts: ['google.', 'google.com', 'google.co.in', 'google.co.uk', 'google.ca', 'google.de', 'com.google.android.googlequicksearchbox', 'googlequicksearchbox'], sources: ['google', 'google-search', 'google_search', 'organic-google'] },
    { label: 'Bing Search', hosts: ['bing.com', 'bing.co.uk'], sources: ['bing', 'bing-search'] },
    { label: 'DuckDuckGo', hosts: ['duckduckgo.com', 'ddg.gg'], sources: ['duckduckgo', 'ddg'] },
    { label: 'Yahoo Search', hosts: ['yahoo.com', 'search.yahoo.com'], sources: ['yahoo'] },
    { label: 'Ecosia', hosts: ['ecosia.org'], sources: ['ecosia'] },
    { label: 'Baidu', hosts: ['baidu.com'], sources: ['baidu'] },
    { label: 'LinkedIn', hosts: ['linkedin.com', 'lnkd.in', 'l.linkedin.com', 'com.linkedin.android'], sources: ['linkedin', 'linkedin-post', 'linkedin-feed'] },
    { label: 'X / Twitter', hosts: ['x.com', 'twitter.com', 't.co', 'com.twitter.android'], sources: ['x', 'twitter', 't.co'] },
    { label: 'Instagram', hosts: ['instagram.com', 'l.instagram.com', 'ig.me', 'com.instagram.android'], sources: ['instagram', 'ig', 'insta'] },
    { label: 'Facebook', hosts: ['facebook.com', 'fb.com', 'fb.me', 'l.facebook.com', 'm.facebook.com', 'com.facebook.katana'], sources: ['facebook', 'fb'] },
    { label: 'YouTube', hosts: ['youtube.com', 'youtu.be', 'm.youtube.com', 'com.google.android.youtube'], sources: ['youtube', 'yt'] },
    { label: 'GitHub', hosts: ['github.com'], sources: ['github'] },
    { label: 'Reddit', hosts: ['reddit.com', 'redd.it', 'com.reddit.frontpage'], sources: ['reddit'] },
    { label: 'Obsidian Community', hosts: ['obsidian.md', 'forum.obsidian.md', 'publish.obsidian.md'], sources: ['obsidian', 'obsidian-forum', 'obsidian-hub'] },
    { label: 'Hacker News', hosts: ['news.ycombinator.com', 'ycombinator.com'], sources: ['hn', 'hackernews', 'ycombinator'] },
    { label: 'Telegram', hosts: ['t.me', 'telegram.org', 'org.telegram.messenger'], sources: ['telegram', 'tg'] },
    { label: 'Discord', hosts: ['discord.com', 'discord.gg'], sources: ['discord'] },
    { label: 'Threads', hosts: ['threads.net'], sources: ['threads'] },
    { label: 'Bluesky', hosts: ['bsky.app', 'bluesky.social'], sources: ['bluesky', 'bsky'] },
    { label: 'Medium', hosts: ['medium.com'], sources: ['medium'] },
    { label: 'Pinterest', hosts: ['pinterest.com', 'pin.it'], sources: ['pinterest'] },
    { label: 'Substack', hosts: ['substack.com'], sources: ['substack'] },
    { label: 'Quora', hosts: ['quora.com'], sources: ['quora'] },
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

const PRIVATE_IP_PATTERNS = [
    /^127\./,                         // IPv4 loopback (127.0.0.0/8)
    /^10\./,                          // IPv4 private Class A (10.0.0.0/8)
    /^192\.168\./,                    // IPv4 private Class C (192.168.0.0/16)
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // IPv4 private Class B (172.16.0.0/12)
    /^169\.254\./,                    // IPv4 link-local (169.254.0.0/16)
    /^0\.0\.0\.0$/,                   // IPv4 non-routable
    /^::1$/,                          // IPv6 loopback
    /^::$/,                           // IPv6 unspecified
    /^fe80:/i,                        // IPv6 link-local
    /^f[cd][0-9a-f]{2}:/i,            // IPv6 unique local (fc00::/7)
];

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
    return host === candidate || host.endsWith(`.${candidate}`) || host.includes(candidate);
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
        if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('android-app://')) {
            return normalizeHost(new URL(value).hostname);
        }
        return normalizeHost(new URL(`https://${value}`).hostname);
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
    if (match) return match.label;

    return `Referral (${referrerDomain})`;
};

export const extractSearchKeyword = ({ utmTerm, utmContent, utmCampaign, referrer } = {}) => {
    const term = cleanAnalyticsString(utmTerm, 120);
    if (term) return term;

    const campaign = cleanAnalyticsString(utmCampaign, 120);
    if (campaign && campaign !== 'none' && campaign !== 'direct') return campaign;

    const content = cleanAnalyticsString(utmContent, 120);
    if (content) return content;

    const refString = cleanAnalyticsString(referrer, 500);
    if (!refString) return '';

    try {
        const url = new URL(refString);
        const q = url.searchParams.get('q') ||
                  url.searchParams.get('query') ||
                  url.searchParams.get('k') ||
                  url.searchParams.get('p') ||
                  url.searchParams.get('search');
        if (q) return cleanAnalyticsString(decodeURIComponent(q), 120);
    } catch (_e) {
        // no-op
    }

    return '';
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

export const resolveAnalyticsRegion = (headers) => {
    const rawValue = headers?.get?.('x-vercel-ip-country-region') || headers?.get?.('x-vercel-ip-region') || '';
    return cleanAnalyticsString(rawValue, 60);
};

export const extractClientIp = (headers) => {
    if (!headers) return '';
    const rawIp = headers.get?.('x-forwarded-for') ||
                  headers.get?.('x-real-ip') ||
                  headers.get?.('cf-connecting-ip') ||
                  headers.get?.('x-vercel-forwarded-for') ||
                  headers.get?.('fastly-client-ip') ||
                  '';
    const firstIp = rawIp.split(',')[0].trim();
    return cleanAnalyticsString(firstIp, 80);
};

export const isExcludedIpAddress = (ip, env = {}) => {
    const cleanIp = cleanAnalyticsString(ip, 80).toLowerCase();
    if (!cleanIp) return false;

    if (PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(cleanIp))) {
        return true;
    }

    const envSource = env.OWNER_EXCLUDED_IPS || (typeof process !== 'undefined' ? process.env?.OWNER_EXCLUDED_IPS : '');
    const configuredIps = cleanAnalyticsString(envSource, 1000);

    if (configuredIps) {
        const excludedList = configuredIps
            .split(/[,;\s]+/)
            .map((item) => item.trim().toLowerCase())
            .filter(Boolean);

        for (const item of excludedList) {
            if (item === cleanIp) return true;
            if (item.endsWith('*')) {
                const prefix = item.slice(0, -1);
                if (cleanIp.startsWith(prefix)) return true;
            }
        }
    }

    return false;
};

export const isExcludedDeveloperLocation = ({ country, city, region } = {}, env = {}) => {
    const envCitySource = env.OWNER_EXCLUDED_CITIES || (typeof process !== 'undefined' ? process.env?.OWNER_EXCLUDED_CITIES : '');
    const configuredCities = cleanAnalyticsString(envCitySource, 1000).toLowerCase();

    if (configuredCities && city) {
        const cleanCity = cleanAnalyticsString(city, 120).toLowerCase();
        const cityList = configuredCities.split(/[,;]+/).map((c) => c.trim()).filter(Boolean);
        if (cityList.some((excluded) => cleanCity === excluded || cleanCity.includes(excluded))) {
            return true;
        }
    }

    const envRegionSource = env.OWNER_EXCLUDED_REGIONS || (typeof process !== 'undefined' ? process.env?.OWNER_EXCLUDED_REGIONS : '');
    const configuredRegions = cleanAnalyticsString(envRegionSource, 1000).toLowerCase();

    if (configuredRegions && region) {
        const cleanRegion = cleanAnalyticsString(region, 120).toLowerCase();
        const regionList = configuredRegions.split(/[,;]+/).map((r) => r.trim()).filter(Boolean);
        if (regionList.some((excluded) => cleanRegion === excluded)) {
            return true;
        }
    }

    const envCountrySource = env.OWNER_EXCLUDED_COUNTRIES || (typeof process !== 'undefined' ? process.env?.OWNER_EXCLUDED_COUNTRIES : '');
    const configuredCountries = cleanAnalyticsString(envCountrySource, 1000).toUpperCase();

    if (configuredCountries && country) {
        const cleanCountry = cleanAnalyticsString(country, 10).toUpperCase();
        const countryList = configuredCountries.split(/[,;]+/).map((c) => c.trim()).filter(Boolean);
        if (countryList.some((excluded) => cleanCountry === excluded)) {
            return true;
        }
    }

    return false;
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
        const urlObj = new URL(value);
        const hostname = urlObj.hostname.toLowerCase();
        const port = urlObj.port;
        if (
            hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname === '0.0.0.0' ||
            hostname === '::1' ||
            hostname.endsWith('.local') ||
            hostname.endsWith('.internal') ||
            hostname.endsWith('.lan') ||
            PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(hostname))
        ) {
            return true;
        }
        if (port === '4321' || port === '3000' || port === '5173' || port === '8080') {
            return true;
        }
        return false;
    } catch (_error) {
        return true;
    }
};

export const resolveAnalyticsDevice = (userAgent) => {
    const ua = cleanAnalyticsString(userAgent, 500);
    if (!ua) {
        return { type: 'desktop', label: 'Laptop / Desktop' };
    }

    const isTablet = /iPad|Tablet|PlayBook|Silk/i.test(ua);
    const isMobile = !isTablet && /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);

    if (isTablet) {
        const isIpad = /iPad/i.test(ua);
        return {
            type: 'tablet',
            label: isIpad ? 'iPad' : 'Tablet',
        };
    }

    if (isMobile) {
        if (/iPhone/i.test(ua)) {
            return { type: 'mobile', label: 'iPhone' };
        }
        if (/Android/i.test(ua)) {
            return { type: 'mobile', label: 'Android Phone' };
        }
        return { type: 'mobile', label: 'Mobile Phone' };
    }

    if (/Macintosh|Mac OS X/i.test(ua)) {
        return { type: 'desktop', label: 'MacBook / macOS' };
    }
    if (/Windows/i.test(ua)) {
        return { type: 'desktop', label: 'Windows PC' };
    }
    if (/Linux/i.test(ua)) {
        return { type: 'desktop', label: 'Linux Desktop' };
    }

    return { type: 'desktop', label: 'Laptop / Desktop' };
};

