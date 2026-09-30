const PUBLIC_HOST_PATTERN = /(^|\.)abodid\.com$/i;

const INTERNAL_PATH_PATTERNS = [
    /^\/admin(?:\/|$)/i,
    /^\/api(?:\/|$)/i,
    /^\/preview(?:\/|$)/i,
    /^\/test(?:\/|$)/i,
    /^\/.*(?:^|[-_/])test(?:\/|$)/i,
    /^\/hand-tracking-test\/?$/i,
    /^\/landing-grid-test\/?$/i,
    /^\/work\/layout-preview\/?$/i,
    /^\/research\/admin(?:\/|$)/i,
    /^\/resources\/admin(?:\/|$)/i,
    /^\/feedback\/?$/i,
    /^\/unauthorized\/?$/i,
];

export const hasOwnerAnalyticsExclusion = (cookie = '', storageExcluded = false) => (
    Boolean(storageExcluded) || String(cookie).split(';').some((part) => (
        part.trim() === 'abodid_analytics_exclude=1'
    ))
);

export const hasOwnerExclusionRequest = (search = '') => {
    try {
        const params = new URLSearchParams(String(search).replace(/^\?/, ''));
        return params.get('owner') === '1' || params.get('exclude_analytics') === '1';
    } catch (_error) {
        return false;
    }
};

export const shouldLoadGoogleAnalytics = ({
    hostname = '',
    pathname = '/',
    cookie = '',
    storageExcluded = false,
} = {}) => {
    if (!PUBLIC_HOST_PATTERN.test(String(hostname).toLowerCase())) return false;
    if (INTERNAL_PATH_PATTERNS.some((pattern) => pattern.test(String(pathname)))) return false;
    return !hasOwnerAnalyticsExclusion(cookie, storageExcluded);
};

