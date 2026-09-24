const countryNames = typeof Intl.DisplayNames === 'function'
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null;

const toTimestamp = (visitor) => {
    const value = visitor?.startedAt || visitor?.timestamp || visitor?.started_at || visitor?.created_at;
    const timestamp = value ? new Date(value).getTime() : 0;
    return Number.isFinite(timestamp) ? timestamp : 0;
};

export const getRecentVisitorCount = (report) => {
    const value = Number(report?.summary?.visitors);
    return Number.isFinite(value) && value >= 0 ? value : 0;
};

export const getVisitorCountry = (visitor) => {
    const value = String(visitor?.country || '').trim();
    if (!value || value === 'Unknown') return 'an unknown country';

    try {
        return countryNames?.of(value.toUpperCase()) || value;
    } catch (_error) {
        return value;
    }
};

export const getVisitorSource = (visitor) => {
    const primary = visitor?.source || visitor?.acquisitionSource || visitor?.discoverySource;
    if (typeof primary === 'string' && primary.trim() && !primary.includes('[object')) {
        const clean = primary.trim();
        if (!['Direct Visit', 'Direct / Unknown', 'Direct'].includes(clean)) return clean;
    }

    if (typeof visitor?.referrerDomain === 'string' && visitor.referrerDomain.trim()) {
        return visitor.referrerDomain.trim().replace(/^www\./i, '');
    }
    if (typeof visitor?.utmSource === 'string' && visitor.utmSource.trim()) {
        return visitor.utmSource.trim();
    }
    return 'Direct';
};

export const formatVisitorTimeAgo = (visitor, now = Date.now()) => {
    const timestamp = toTimestamp(visitor);
    if (!timestamp) return 'recently';

    const elapsedSeconds = Math.max(0, Math.floor((Number(now) - timestamp) / 1000));
    if (elapsedSeconds < 60) return 'just now';

    const minutes = Math.floor(elapsedSeconds / 60);
    if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;

    const days = Math.floor(hours / 24);
    return `${days} ${days === 1 ? 'day' : 'days'} ago`;
};

export const describeRecentVisitor = (visitor, now = Date.now()) => {
    const country = getVisitorCountry(visitor);
    const source = getVisitorSource(visitor);
    const time = formatVisitorTimeAgo(visitor, now);
    const arrival = source === 'Direct' ? 'arrived directly' : `came from ${source}`;
    return `1 visitor from ${country} ${arrival} ${time}.`;
};

export const selectRecentHumanVisitors = (report, limit = 7) => {
    const feed = Array.isArray(report?.visitors?.feed) ? report.visitors.feed : [];
    const journeys = Array.isArray(report?.journeys) ? report.journeys : [];
    const seenVisitors = new Set();

    return [...feed, ...journeys]
        .sort((a, b) => toTimestamp(b) - toTimestamp(a))
        .filter((visitor) => {
            const visitorId = visitor?.sessionId || visitor?.id || visitor?.visitorId || visitor?.visitor_id;
            if (!visitorId || seenVisitors.has(visitorId)) return false;
            seenVisitors.add(visitorId);
            return true;
        })
        .slice(0, Math.max(0, Math.min(7, Number(limit) || 0)));
};
