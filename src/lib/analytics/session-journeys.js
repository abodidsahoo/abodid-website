export const MIN_SESSION_SECONDS = 5;
export const RECENT_SESSION_LIMIT = 100;

// Old rows received a default filtered tier when the signal columns were added.
// Keep these separately labelled; never retroactively call them verified humans.
export const isLegacySession = (session) => !Object.keys(session.human_signals || {}).length;
export const hasHumanInteractionEvidence = (signals) => signals?.evidenceVersion === 2 && signals?.evidenceLevel === 'likely_human';
export const isVisibleSession = (session) => (
    hasHumanInteractionEvidence(session.human_signals) || Number(session.total_engaged_seconds) >= MIN_SESSION_SECONDS
);

export const getMostEngagedPage = (pages) => {
    const totals = new Map();
    for (const page of pages) {
        const previous = totals.get(page.path);
        totals.set(page.path, {
            path: page.path,
            title: page.title || previous?.title,
            engagedSeconds: (previous?.engagedSeconds || 0) + Math.max(0, Number(page.engagedSeconds) || 0),
        });
    }
    return [...totals.values()].sort((a, b) => b.engagedSeconds - a.engagedSeconds)[0] || null;
};

export const selectSessionCards = (journeys, { filter = 'all', sort = 'newest', limit = 20 } = {}) => (
    journeys.filter((journey) => {
        if ((!hasHumanInteractionEvidence(journey.signals) && !(Number(journey.activeSeconds) >= MIN_SESSION_SECONDS)) || journey.conversion?.status === 'spam') return false;
        if (filter === 'human') return hasHumanInteractionEvidence(journey.signals);
        if (filter === 'uncertain') return !hasHumanInteractionEvidence(journey.signals);
        if (filter === 'long') return journey.activeSeconds >= 30;
        if (filter === 'converted') return Boolean(journey.conversion);
        if (filter === 'returning') return journey.returning;
        return true;
    }).sort((a, b) => (
        (sort === 'longest' ? b.activeSeconds - a.activeSeconds : 0) ||
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    )).slice(0, limit)
);

export const formatSessionPath = (value) => {
    if (!value || /^\(?not set\)?$/i.test(String(value))) return 'Entry page unavailable';
    const path = String(value).split('?')[0];
    if (path === '/') return 'Home';
    return path.replace(/^\//, '').split('/').filter(Boolean).map((part) => (
        part.replace(/[-_]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
    )).join(' · ').replace(/\bXr\b/g, 'XR');
};

export const formatNarrativeDuration = (value) => {
    const seconds = Math.max(0, Math.round(Number(value) || 0));
    const units = [[3600, 'hour'], [60, 'minute'], [1, 'second']];
    let remainder = seconds;
    const parts = [];
    for (const [size, unit] of units) {
        const count = Math.floor(remainder / size);
        remainder %= size;
        if (count) parts.push(`${count} ${unit}${count === 1 ? '' : 's'}`);
    }
    return parts.join(' ') || 'less than a second';
};

export const describeSession = (journey) => {
    let country = journey.country || '';
    if (/^[A-Z]{2}$/.test(country)) {
        try { country = new Intl.DisplayNames(['en'], { type: 'region' }).of(country); } catch { /* Keep the code. */ }
    }
    const location = [journey.city, country === 'Unknown' ? '' : country].filter(Boolean).join(', ');
    const person = location ? `A visitor, with a network location estimated as ${location},` : 'A visitor';
    const rawSource = journey.source || '';
    const discovery = !rawSource || /^(direct(?: visit)?|direct \/ unknown(?: source)?)$/i.test(rawSource)
        ? 'arrived without a recorded referral' : `found your site through ${rawSource}`;
    const entry = journey.landingPage ? `entered on ${formatSessionPath(journey.landingPage)}` : 'had no recorded entry page';
    const attention = journey.mostEngagedPage
        ? `They spent the most time on ${formatSessionPath(journey.mostEngagedPage.path)} (${formatNarrativeDuration(journey.mostEngagedPage.engagedSeconds)}).`
        : 'Page-by-page attention was not recorded.';
    const exit = journey.exitPage ? `Their last recorded page was ${formatSessionPath(journey.exitPage)}.` : 'Their last page was not recorded.';
    return `${person} ${discovery} and ${entry}. They actively used the site for ${formatNarrativeDuration(journey.activeSeconds)}. ${attention} ${exit}`;
};
