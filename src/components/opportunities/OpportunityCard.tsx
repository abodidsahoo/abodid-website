import React, { useState } from 'react';
import type { Opportunity, OpportunityStatus } from '../../lib/opportunities/types';
import {
    formatDaysRemaining,
    formatCategoryTitle,
    formatOpportunityTitle,
} from '../../lib/opportunities/ui-helpers';

interface OpportunityCardProps {
    opportunity: Opportunity;
    isAuthenticated?: boolean;
    onOpen: (opp: Opportunity) => void;
    onUpdateStatus: (id: string, status: OpportunityStatus) => Promise<void>;
    onUpdatePriority?: (id: string, priority: number) => Promise<void>;
    onSelectCategory?: (category: string) => void;
}

export const OpportunityCard: React.FC<OpportunityCardProps> = ({
    opportunity: opp,
    isAuthenticated = false,
    onOpen,
    onUpdateStatus,
    onUpdatePriority,
    onSelectCategory,
}) => {
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [priority, setPriority] = useState<number>(opp.priority || 1);

    const usesEventDate = !opp.deadline_at && Boolean(opp.event_date);
    const urgency = formatDaysRemaining(
        opp.deadline_at || opp.event_date,
        usesEventDate ? undefined : opp.deadline_confidence,
    );
    const urgencyLabel = usesEventDate
        ? urgency.label
            .replace(/ left$/, ' until event')
            .replace(/^Past deadline$/, 'Event passed')
        : urgency.label;
    const categoryLabel = formatCategoryTitle(opp.category);
    const displayTitle = formatOpportunityTitle(opp.title);

    const handlePriorityClick = async (e: React.MouseEvent, newLevel: number) => {
        e.stopPropagation();
        if (!isAuthenticated) return;
        setPriority(newLevel);
        if (onUpdatePriority) {
            await onUpdatePriority(opp.id, newLevel);
        }
    };

    return (
        <div
            className={`opp-card ${urgency.level === 'critical' ? 'urgent' : ''}`}
            onClick={() => onOpen(opp)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpen(opp);
                }
            }}
        >
                {/* Top Row: Only Days Remaining (Clean & Prominent) */}
                <div className="opp-card-top-row">
                    <div className={`opp-days-remaining ${urgency.level}`}>
                        <span className="opp-days-pulse-dot" />
                        {urgencyLabel}
                    </div>
                </div>

                {/* Title & Organisation */}
                <div className="opp-card-identity">
                    <h3 className="opp-card-title">{displayTitle}</h3>
                    <div className="opp-card-org">{opp.organisation}</div>
                </div>

                {/* Card Footer: Below the thin line - Stars & Category on Left, Open on Right */}
                <div className="opp-card-footer" onClick={(e) => e.stopPropagation()}>
                    <div className="opp-card-footer-left">
                        {/* Priority Circles */}
                        <div
                            className="opp-priority-circles"
                            onClick={(e) => e.stopPropagation()}
                            title={`Priority: ${priority === 3 ? 'High' : priority === 2 ? 'Medium' : 'Low'}`}
                        >
                            {[1, 2, 3].map((lvl) => (
                                <button
                                    key={lvl}
                                    type="button"
                                    className={`opp-circle-btn ${lvl <= priority ? 'active' : ''}`}
                                    onClick={(e) => handlePriorityClick(e, lvl)}
                                    aria-label={`Set priority ${lvl}`}
                                >
                                    <svg
                                        width="12"
                                        height="12"
                                        viewBox="0 0 24 24"
                                        className="opp-circle-svg"
                                    >
                                        <circle
                                            cx="12"
                                            cy="12"
                                            r="8.5"
                                            fill={lvl <= priority ? "#ffe44f" : "#ffffff"}
                                            stroke="#15130f"
                                            strokeWidth="2.5"
                                        />
                                    </svg>
                                </button>
                            ))}
                        </div>

                        {/* Category (Simple Clean Underlined Text - Clickable to filter) */}
                        <button
                            type="button"
                            className={`opp-category-text ${opp.category || 'other'}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onSelectCategory) {
                                    onSelectCategory(opp.category || 'other');
                                }
                            }}
                            title={`Filter all ${categoryLabel} listings`}
                        >
                            {categoryLabel}
                        </button>
                    </div>

                    <div className="opp-card-links">
                        <button
                            type="button"
                            className="opp-card-open-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                onOpen(opp);
                            }}
                        >
                            Open ↗
                        </button>
                    </div>
                </div>
            </div>
    );
};

