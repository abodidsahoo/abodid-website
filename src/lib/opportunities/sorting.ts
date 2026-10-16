import { opportunityAttentionScore } from './attention';
import type { Opportunity } from './types';

export type OpportunitySortMode = 'date_added' | 'deadline';

const createdAtTimestamp = (opportunity: Opportunity) => {
    const timestamp = Date.parse(opportunity.created_at);
    return Number.isFinite(timestamp) ? timestamp : 0;
};

export function sortRadarOpportunities(
    opportunities: Opportunity[],
    mode: OpportunitySortMode,
    now = Date.now(),
): Opportunity[] {
    return [...opportunities].sort((first, second) => {
        if (mode === 'date_added') {
            const createdAtDifference = createdAtTimestamp(second) - createdAtTimestamp(first);
            if (createdAtDifference !== 0) return createdAtDifference;
        } else {
            const attentionDifference = (
                opportunityAttentionScore(first, now) - opportunityAttentionScore(second, now)
            );
            if (attentionDifference !== 0) return attentionDifference;
        }

        return first.title.localeCompare(second.title);
    });
}
