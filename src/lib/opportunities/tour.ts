export const OPPORTUNITY_TOUR_STEPS = [
    { target: '#opportunity-save-form', title: 'Save an opportunity.', copy: 'Paste a link or note, or choose Attach for images, videos and PDFs.' },
    { target: '#opportunity-urgency-views', title: 'Pick your view.', copy: 'Closing Soon shows urgent items. Newly Added shows your latest saves.' },
    { target: '#opportunity-refresh-list', title: 'Refresh your list.', copy: 'Missing a recent save? Refresh list brings in the latest updates.' },
    { target: '#opportunity-integrations', title: 'Save from anywhere.', copy: 'Connect Telegram for messages and voice notes, or open the Chrome installation guide.' },
] as const;

export const opportunityTourStorageKey = (username: string) => `opportunity-quick-tour:v1:${username.trim().toLowerCase()}`;

export function readOpportunityTourStep(value: string | null): number | null {
    if (!value) return 0;
    try {
        const progress = JSON.parse(value);
        if (progress.complete === true) return null;
        return Number.isInteger(progress.step) && progress.step >= 0 && progress.step < OPPORTUNITY_TOUR_STEPS.length ? progress.step : 0;
    } catch { return 0; }
}

export function positionOpportunityTour(target: { top: number; bottom: number; left: number; width: number }, card: { width: number; height: number }, viewport: { width: number; height: number; top?: number }) {
    const gap = 18;
    const edge = 14;
    const safeTop = (viewport.top || 0) + edge;
    const bottom = (viewport.top || 0) + viewport.height - edge;
    const below = target.bottom + gap;
    const above = target.top - gap - card.height;
    const placement = below + card.height <= bottom || above < safeTop ? 'below' : 'above';
    const top = Math.max(safeTop, Math.min(placement === 'below' ? below : above, bottom - card.height));
    const left = Math.max(edge, Math.min(target.left + target.width / 2 - card.width / 2, viewport.width - edge - card.width));
    return { top, left, placement, arrow: Math.max(24, Math.min(target.left + target.width / 2 - left, card.width - 24)) };
}
