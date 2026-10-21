import type { Opportunity } from './types';

const HOUR_MS = 1000 * 60 * 60;
const ATTENTION_WINDOW_HOURS = 7 * 24;

export function getOpportunityActionAt(opportunity: Opportunity): string | null {
    return opportunity.deadline_at || opportunity.event_date || null;
}

export function doesOpportunityRequireAction(opportunity: Opportunity): boolean {
    return opportunity.status === 'reviewing';
}

export function isOutstandingDirectTask(opportunity: Opportunity): boolean {
    return doesOpportunityRequireAction(opportunity)
        && opportunity.source_url.startsWith('https://direct.entry/')
        && Boolean(opportunity.event_date);
}

export function isOpportunityPastDeadline(opportunity: Opportunity, now = Date.now()): boolean {
    if (opportunity.deadline_confidence === 'rolling') return false;

    const actionableAt = getOpportunityActionAt(opportunity);
    if (!actionableAt) return false;

    const actionableTimestamp = Date.parse(actionableAt);
    return Number.isFinite(actionableTimestamp) && actionableTimestamp < now;
}

export function isOpportunityAttention(opportunity: Opportunity, now = Date.now()): boolean {
    if (!doesOpportunityRequireAction(opportunity)) return false;
    if (opportunity.is_high_priority) return true;

    const actionableAt = getOpportunityActionAt(opportunity);
    if (!actionableAt) return false;

    const diffHours = (new Date(actionableAt).getTime() - now) / HOUR_MS;
    return diffHours > 0 && diffHours <= ATTENTION_WINDOW_HOURS;
}

export function opportunityAttentionScore(opportunity: Opportunity, now = Date.now()): number {
    if (!doesOpportunityRequireAction(opportunity)) return 100000;

    // High priority is the primary ordering key. Deadline proximity only
    // sequences opportunities within the same priority tier.
    const priorityTier = opportunity.is_high_priority ? 0 : 50000;
    const actionableAt = getOpportunityActionAt(opportunity);

    if (actionableAt) {
        const diffHours = (new Date(actionableAt).getTime() - now) / HOUR_MS;
        if (diffHours < 0) return priorityTier + 40000;
        return priorityTier + Math.max(0, diffHours);
    }

    if (opportunity.deadline_confidence === 'rolling') return priorityTier + 30000;
    return priorityTier + 35000;
}

export function selectAttentionOpportunities(opportunities: Opportunity[], now = Date.now()): Opportunity[] {
    return opportunities
        .filter((opportunity) => isOpportunityAttention(opportunity, now))
        .sort((first, second) => (
            opportunityAttentionScore(first, now) - opportunityAttentionScore(second, now)
        ));
}
