import { OpportunityBusy } from './OpportunityBusy';
import React from 'react';
import type { Opportunity } from '../../lib/opportunities/types';
import {
    formatDaysRemaining,
    formatCategoryTitle,
    formatOpportunityTitle,
    getOpportunityCategoryIconUrl,
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
    return 'Add to my radar';
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
    const iconUrl = getOpportunityCategoryIconUrl(opp.category);

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
                    className="opp-card-category-badge"
                    onClick={(event) => {
                        event.stopPropagation();
                        onSelectCategory?.(opp.category || 'other');
                    }}
                    aria-label={`Show ${categoryLabel} opportunities`}
                    title={`Filter all ${categoryLabel} listings`}
                >
                    <span className="opp-card-category-icon-box" aria-hidden="true">
                        <img
                            src={iconUrl}
                            alt=""
                            className="opp-card-category-icon"
                            loading="lazy"
                            decoding="async"
                            width="34"
                            height="34"
                        />
                    </span>
                    <span className="opp-card-category-label">{categoryLabel}</span>
                </button>

                <div className="opp-card-footer-spacer" />

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
                            {radarState === 'adding' ? <OpportunityBusy>Adding</OpportunityBusy> : getRadarButtonLabel(radarState)}
                        </button>
                    </div>
                )}

                {showPriorityToggle && (
                    <label className={`opp-high-priority-toggle is-card ${opp.is_high_priority ? 'is-active' : ''}`} onClick={(event) => event.stopPropagation()}>
                        <input
                            type="checkbox"
                            checked={opp.is_high_priority}
                            onChange={(event) => void onToggleHighPriority?.(event.target.checked)}
                        />
                        <span>High priority</span>
                    </label>
                )}
            </div>
        </article>
    );
};

