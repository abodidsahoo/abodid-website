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
                </div>

                <div className="opp-card-identity">
                    <h3 className="opp-card-title">{displayTitle}</h3>
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

                    <div className="opp-card-links">
                        {showRadarAction && (
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
                        )}
                        <button
                            type="button"
                            className="opp-card-open-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                onOpen(opp);
                            }}
                        >
                            <span>More details</span><span aria-hidden="true">→</span>
                        </button>
                    </div>
                </div>
            </article>
    );
};

