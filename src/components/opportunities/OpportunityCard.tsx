import React from 'react';
import type { Opportunity } from '../../lib/opportunities/types';
import {
    formatDaysRemaining,
    formatCategoryTitle,
    formatOpportunityTitle,
} from '../../lib/opportunities/ui-helpers';

interface OpportunityCardProps {
    opportunity: Opportunity;
    onOpen: (opp: Opportunity) => void;
    onSelectCategory?: (category: string) => void;
    showRadarAction?: boolean;
    radarState?: RadarSaveState;
    onAddToRadar?: (opp: Opportunity) => void;
    showPriorityToggle?: boolean;
    onToggleHighPriority?: (isHighPriority: boolean) => Promise<void> | void;
}

export type RadarSaveState = 'idle' | 'adding' | 'added' | 'already' | 'error';

export const getRadarButtonLabel = (state: RadarSaveState) => {
    if (state === 'adding') return 'Adding…';
    if (state === 'added') return '✓ On your radar';
    if (state === 'already') return '✓ Already saved';
    if (state === 'error') return 'Try again';
    return '+ Add to radar';
};

export const OpportunityCard: React.FC<OpportunityCardProps> = ({
    opportunity: opp,
    onOpen,
    onSelectCategory,
    showRadarAction = false,
    radarState = 'idle',
    onAddToRadar,
    showPriorityToggle = false,
    onToggleHighPriority,
}) => {
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

    return (
        <article
            className={`opp-card ${urgency.level === 'critical' ? 'urgent' : ''}`}
            onClick={(event) => {
                const target = event.target as HTMLElement;
                if (!target.closest('button, a, input, select, textarea, summary')) onOpen(opp);
            }}
        >
                {/* The whole non-interactive card surface opens the compact detail dialog. */}
                <div className="opp-card-top-row">
                    <div className={`opp-days-remaining ${urgency.level}`}>
                        <span className="opp-days-pulse-dot" aria-hidden="true" />
                        {urgencyLabel}
                    </div>
                    {showPriorityToggle && (
                        <label className={`opp-high-priority-toggle ${opp.is_high_priority ? 'is-active' : ''}`} onClick={(event) => event.stopPropagation()}>
                            <input
                                type="checkbox"
                                checked={opp.is_high_priority}
                                onChange={(event) => void onToggleHighPriority?.(event.target.checked)}
                            />
                            <span>High priority</span>
                        </label>
                    )}
                </div>

                <div className="opp-card-identity">
                    <h3 className="opp-card-title">
                        <button
                            type="button"
                            className="opp-card-title-button"
                            onClick={(event) => {
                                event.stopPropagation();
                                onOpen(opp);
                            }}
                        >
                            {displayTitle}
                        </button>
                    </h3>
                    <div className="opp-card-org">{opp.organisation}</div>
                </div>

                <div className="opp-card-footer">
                    <button
                        type="button"
                        className={`opp-category-text ${opp.category || 'other'}`}
                        onClick={() => onSelectCategory?.(opp.category || 'other')}
                        title={`Filter all ${categoryLabel} listings`}
                    >
                        {categoryLabel}
                    </button>

                    {showRadarAction && (
                        <div className="opp-card-links">
                            <button
                                type="button"
                                className={`opp-radar-add-btn is-${radarState}`}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onAddToRadar?.(opp);
                                }}
                                disabled={radarState === 'adding' || radarState === 'added' || radarState === 'already'}
                                aria-label={`${getRadarButtonLabel(radarState)}: ${displayTitle}`}
                            >
                                {getRadarButtonLabel(radarState)}
                            </button>
                        </div>
                    )}
                </div>
            </article>
    );
};

