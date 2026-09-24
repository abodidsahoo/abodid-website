import type { Opportunity } from './types';

const HOUR_MS = 1000 * 60 * 60;
const ATTENTION_WINDOW_HOURS = 7 * 24;

export function getOpportunityActionAt(opportunity: Opportunity): string | null {
    return opportunity.deadline_at || opportunity.event_date || null;
}

export function isOpportunityAttention(opportunity: Opportunity, now = Date.now()): boolean {
    if (opportunity.status === 'done' || opportunity.status === 'dismissed') return false;
    if (opportunity.priority === 3) return true;

    const actionableAt = getOpportunityActionAt(opportunity);
    if (!actionableAt) return false;

    const diffHours = (new Date(actionableAt).getTime() - now) / HOUR_MS;
    return diffHours > 0 && diffHours <= ATTENTION_WINDOW_HOURS;
}

export function opportunityAttentionScore(opportunity: Opportunity, now = Date.now()): number {
    if (opportunity.status === 'done' || opportunity.status === 'dismissed') return 100000;

    const priority = opportunity.priority || 1;
    const priorityPenalty = (3 - priority) * 50;
    const actionableAt = getOpportunityActionAt(opportunity);

    if (actionableAt) {
        const diffHours = (new Date(actionableAt).getTime() - now) / HOUR_MS;
        if (diffHours < 0) return 90000;
        return Math.max(0, diffHours) + priorityPenalty;
    }

    if (opportunity.deadline_confidence === 'rolling') return 8000 + priorityPenalty;
    return 5000 + priorityPenalty;
}

export function selectAttentionOpportunities(opportunities: Opportunity[], now = Date.now()): Opportunity[] {
    return opportunities
        .filter((opportunity) => isOpportunityAttention(opportunity, now))
        .sort((first, second) => (
            opportunityAttentionScore(first, now) - opportunityAttentionScore(second, now)
        ));
}
