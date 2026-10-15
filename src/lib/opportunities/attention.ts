import type { Opportunity } from './types';

const HOUR_MS = 1000 * 60 * 60;
const ATTENTION_WINDOW_HOURS = 7 * 24;

export function getOpportunityActionAt(opportunity: Opportunity): string | null {
    return opportunity.deadline_at || opportunity.event_date || null;
}

export function doesOpportunityRequireAction(opportunity: Opportunity): boolean {
    return ['inbox', 'interested', 'preparing'].includes(opportunity.status);
}

export function isOpportunityAttention(opportunity: Opportunity, now = Date.now()): boolean {
    if (!doesOpportunityRequireAction(opportunity)) return false;
    if (opportunity.priority === 3) return true;

    const actionableAt = getOpportunityActionAt(opportunity);
    if (!actionableAt) return false;

    const diffHours = (new Date(actionableAt).getTime() - now) / HOUR_MS;
    return diffHours > 0 && diffHours <= ATTENTION_WINDOW_HOURS;
}

export function opportunityAttentionScore(opportunity: Opportunity, now = Date.now()): number {
    if (opportunity.status === 'done' || opportunity.status === 'dismissed') return 100000;

    if (!doesOpportunityRequireAction(opportunity)) {
        return 60000;
    }

    const priority = opportunity.priority || 1;
    const priorityPenalty = (3 - priority) * 50;
    const workflowAdjustment = opportunity.status === 'preparing'
        ? -300
        : opportunity.status === 'interested'
            ? -200
            : -100;
    const actionableAt = getOpportunityActionAt(opportunity);

    if (actionableAt) {
        const diffHours = (new Date(actionableAt).getTime() - now) / HOUR_MS;
        if (diffHours < 0) return 50000 + priorityPenalty;
        return Math.max(0, diffHours) + priorityPenalty + workflowAdjustment;
    }

    if (opportunity.deadline_confidence === 'rolling') return 8000 + priorityPenalty + workflowAdjustment;
    return 5000 + priorityPenalty + workflowAdjustment;
}

export function selectAttentionOpportunities(opportunities: Opportunity[], now = Date.now()): Opportunity[] {
    return opportunities
        .filter((opportunity) => isOpportunityAttention(opportunity, now))
        .sort((first, second) => (
            opportunityAttentionScore(first, now) - opportunityAttentionScore(second, now)
        ));
}
