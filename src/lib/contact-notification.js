const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EXCLUDED_MEANINGFUL_PATHS = [
    /^\/contact\/?$/i,
    /^\/thank(?:-you|s)?(?:\/|$)/i,
    /^\/404\/?$/i,
    /^\/unauthorized\/?$/i,
    /^\/(?:login|logout|signup|sign-in|sign-up)(?:\/|$)/i,
    /^\/auth(?:\/|$)/i,
    /^\/admin(?:\/|$)/i,
    /^\/api(?:\/|$)/i,
    /^\/preview(?:\/|$)/i,
    /^\/test(?:\/|$)/i,
];

const TITLE_OVERRIDES = new Map([
    ['/premiere-pro-masterclass', 'Premiere Pro Masterclass'],
    ['/obsidian-tutoring', 'Obsidian Tutoring'],
    ['/video-editing-mentor', 'Video Editing Mentorship'],
    ['/superprof-video-editing-classes', 'Video Editing Classes'],
    ['/services', 'Services'],
    ['/workshops', 'Workshops'],
    ['/consulting', 'Consulting'],
]);

export const isUuid = (value) => typeof value === 'string' && UUID_PATTERN.test(value);

export const cleanContactString = (value, maxLength = 240) => (
    typeof value === 'string'
        ? value.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, maxLength)
        : ''
);

const normalizePath = (value) => {
    const cleaned = cleanContactString(value, 240);
    if (!cleaned) return '';
    try {
        const path = cleaned.startsWith('http') ? new URL(cleaned).pathname : cleaned.split(/[?#]/)[0];
        return `/${path.replace(/^\/+|\/+$/g, '')}`.replace(/\/$/, '') || '/';
    } catch (_error) {
        return '';
    }
};

const titleCase = (value) => value
    .replace(/[-_]+/g, ' ')
    .replace(/\b(?:enquir(?:y|e)|inquir(?:y|e)|contact|book|ask|hire|cta)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\bAi\b/g, 'AI')
    .replace(/\bSeo\b/g, 'SEO')
    .replace(/\bCv\b/g, 'CV');

export const readablePageTitle = ({ path = '', title = '' } = {}) => {
    const normalizedPath = normalizePath(path);
    const override = TITLE_OVERRIDES.get(normalizedPath);
    if (override) return override;

    const cleanedTitle = cleanContactString(title, 180)
        .replace(/\s+[|—–-]\s+(?:Abodid(?: Sahoo)?|Personal Site).*$/i, '')
        .trim();
    if (cleanedTitle && !/^contact(?: abodid sahoo)?$/i.test(cleanedTitle)) return cleanedTitle;

    const slug = normalizedPath.split('/').filter(Boolean).pop() || '';
    return titleCase(slug);
};

export const resolveEnquiryTitle = ({ enquiryPath = '', sourceName = '', cta = '' } = {}) => {
    const normalizedPath = normalizePath(enquiryPath);
    const override = TITLE_OVERRIDES.get(normalizedPath);
    if (override) return override;

    const sourceTitle = titleCase(cleanContactString(sourceName, 120));
    if (sourceTitle && !/^Contact$/i.test(sourceTitle)) return sourceTitle;

    const ctaTitle = titleCase(cleanContactString(cta, 120));
    if (ctaTitle) return ctaTitle;

    const pathTitle = readablePageTitle({ path: normalizedPath });
    return pathTitle && !/^Contact$/i.test(pathTitle) ? pathTitle : 'General';
};

export const isMeaningfulPage = (path) => {
    const normalizedPath = normalizePath(path);
    return Boolean(normalizedPath) && !EXCLUDED_MEANINGFUL_PATHS.some((pattern) => pattern.test(normalizedPath));
};

export const summarizeVisit = ({ session, pageViews, submittedAt }) => {
    if (!session || !submittedAt) return null;
    const submittedMs = new Date(submittedAt).getTime();
    const startedMs = new Date(session.started_at).getTime();
    if (!Number.isFinite(submittedMs) || !Number.isFinite(startedMs)) return null;

    const eligibleViews = (Array.isArray(pageViews) ? pageViews : []).filter((view) => {
        const viewedMs = new Date(view.viewed_at).getTime();
        return Number.isFinite(viewedMs) && viewedMs <= submittedMs && isMeaningfulPage(view.page_path);
    });
    const pages = new Map();
    eligibleViews.forEach((view) => {
        const path = normalizePath(view.page_path);
        const existing = pages.get(path) || { path, title: '', engagedSeconds: 0 };
        existing.title = readablePageTitle({ path, title: view.page_title }) || existing.title;
        existing.engagedSeconds += Math.max(0, Math.floor(Number(view.engaged_seconds) || 0));
        pages.set(path, existing);
    });

    const strongestPage = [...pages.values()]
        .filter((page) => page.title)
        .sort((a, b) => b.engagedSeconds - a.engagedSeconds)[0] || null;

    return {
        durationSeconds: Math.max(0, Math.floor((submittedMs - startedMs) / 1000)),
        distinctMeaningfulPages: pages.size,
        strongestPage,
    };
};

export const formatDuration = (seconds) => {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    if (total < 60) return `${total}s`;
    const minutes = Math.floor(total / 60);
    const remainder = total % 60;
    if (minutes < 60) return `${minutes}m${remainder ? ` ${remainder}s` : ''}`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h${remainingMinutes ? ` ${remainingMinutes}m` : ''}`;
};

export const readableLocation = ({ city = '', country = '' } = {}) => {
    const cleanCity = cleanContactString(city, 120);
    const countryCode = cleanContactString(country, 10).toUpperCase();
    let countryName = '';
    if (/^[A-Z]{2}$/.test(countryCode) && countryCode !== 'XX') {
        try {
            countryName = new Intl.DisplayNames(['en'], { type: 'region' }).of(countryCode) || '';
        } catch (_error) {
            countryName = countryCode;
        }
    } else if (countryCode && !/^UNKNOWN$/i.test(countryCode)) {
        countryName = cleanContactString(country, 120);
    }
    return [cleanCity, countryName].filter(Boolean).join(', ');
};

export const normalizedAcquisitionSource = (value) => {
    const source = cleanContactString(value, 120);
    if (!source || /^(?:direct\s*\/\s*unknown|unknown)$/i.test(source)) return 'Direct Visit';
    if (/^google$/i.test(source)) return 'Google Search';
    if (/^bing$/i.test(source)) return 'Bing Search';
    return source;
};
