export const ANALYTICS_RANGES = new Set(['today', '7d', '30d', '90d']);

export const normalizeAnalyticsRange = (value) => ANALYTICS_RANGES.has(value) ? value : '7d';

const clampTimezoneOffset = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(-840, Math.min(840, Math.round(parsed)));
};

export const getAnalyticsRangeStart = (range, now = new Date(), timezoneOffsetMinutes = 0) => {
    const normalizedRange = normalizeAnalyticsRange(range);
    const nowMs = now.getTime();

    if (normalizedRange !== 'today') {
        const days = normalizedRange === '90d' ? 90 : normalizedRange === '30d' ? 30 : 7;
        return new Date(nowMs - (days * 24 * 60 * 60 * 1000));
    }

    const offset = clampTimezoneOffset(timezoneOffsetMinutes);
    const localNow = new Date(nowMs - (offset * 60 * 1000));
    localNow.setUTCHours(0, 0, 0, 0);
    return new Date(localNow.getTime() + (offset * 60 * 1000));
};

export const emptyAnalyticsReport = () => ({
    summary: {
        visitors: 0,
        sessions: 0,
        pageViews: 0,
        averageEngagedSeconds: 0,
    },
    sources: [],
    countries: [],
    timeline: [],
    pages: [],
    journeys: [],
    commonJourneys: [],
    navigation: {
        summary: {
            opens: 0,
            selections: 0,
            dismissals: 0,
            socialClicks: 0,
            ctaClicks: 0,
            selectionRate: 0,
        },
        links: [],
        countries: [],
    },
});
