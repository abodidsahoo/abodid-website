import { OpportunityBusy } from './OpportunityBusy';
import React from 'react';
import type { Opportunity } from '../../lib/opportunities/types';
import {
    formatCategoryTitle,
    formatDaysRemaining,
    formatOpportunityTitle,
    getOpportunityCategoryIconUrl,
} from '../../lib/opportunities/ui-helpers';
import { getRadarButtonLabel, type RadarSaveState } from './OpportunityCard';

interface OpportunityListItemProps {
    opportunity: Opportunity;
    onOpen: (opportunity: Opportunity) => void;
    onSelectCategory?: (category: string) => void;
    showRadarAction?: boolean;
    radarState?: RadarSaveState;
    onAddToRadar?: (opportunity: Opportunity) => void;
    showPriorityToggle?: boolean;
    onToggleHighPriority?: (isHighPriority: boolean) => Promise<void> | void;
}

const getCountdownParts = (opportunity: Opportunity) => {
    const usesEventDate = !opportunity.deadline_at && Boolean(opportunity.event_date);
    const urgency = formatDaysRemaining(
        opportunity.deadline_at || opportunity.event_date,
        usesEventDate ? undefined : opportunity.deadline_confidence,
    );

    if (urgency.level === 'rolling') {
        return { urgency, value: null, label: 'Rolling deadline' };
    }

    const compactMatch = urgency.label.match(/^(\d+)m left$/i);
    if (compactMatch) {
        return {
            urgency,
            value: compactMatch[1],
            label: usesEventDate ? 'minutes until event' : 'minutes left',
        };
    }

    const timedMatch = urgency.label.match(/^(\d+)\s+(hours?|days?) left$/i);
    if (timedMatch) {
        const unit = timedMatch[2].toLowerCase();
        return {
            urgency,
            value: timedMatch[1],
            label: usesEventDate ? `${unit} until event` : `${unit} left`,
        };
    }

    return {
        urgency,
        value: null,
        label: usesEventDate && urgency.label === 'Past deadline'
            ? 'Event passed'
            : urgency.label,
    };
};

export const OpportunityListItem: React.FC<OpportunityListItemProps> = ({
    opportunity,
    onOpen,
    onSelectCategory,
    showRadarAction = false,
    radarState = 'idle',
    onAddToRadar,
    showPriorityToggle = false,
    onToggleHighPriority,
}) => {
    const displayTitle = formatOpportunityTitle(opportunity.title);
    const categoryLabel = formatCategoryTitle(opportunity.category);
    const countdown = getCountdownParts(opportunity);
    const iconUrl = getOpportunityCategoryIconUrl(opportunity.category);

    const openFromSurface = (target: EventTarget | null) => {
        if (!(target instanceof HTMLElement) || !target.closest('button, a, input, select, textarea, summary')) {
            onOpen(opportunity);
        }
    };

    return (
        <article
            className="opp-list-item"
            onClick={(event) => openFromSurface(event.target)}
        >
            <div
                className={`opp-list-countdown ${countdown.urgency.level}`}
                aria-label={countdown.value ? `${countdown.value} ${countdown.label}` : countdown.label}
            >
                {countdown.value && <strong>{countdown.value}</strong>}
                <span>{countdown.label}</span>
            </div>

            <div className="opp-list-main">
                <div className="opp-list-identity">
                    <button
                        type="button"
                        className={`opp-list-category-mark ${opportunity.category || 'other'}`}
                        onClick={(event) => {
                            event.stopPropagation();
                            onSelectCategory?.(opportunity.category || 'other');
                        }}
                        aria-label={`Show ${categoryLabel} opportunities`}
                        title={`Filter all ${categoryLabel} listings`}
                    >
                        <span className="opp-list-category-icon-box" aria-hidden="true">
                            <img
                                src={iconUrl}
                                alt=""
                                className="opp-list-category-icon"
                                loading="lazy"
                                decoding="async"
                                width="24"
                                height="24"
                            />
                        </span>
                        <span className="opp-list-category-label">{categoryLabel}</span>
                    </button>
                    <h3>
                        <button
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation();
                                onOpen(opportunity);
                            }}
                        >
                            {displayTitle}
                        </button>
                    </h3>
                    {opportunity.organisation && <p>{opportunity.organisation}</p>}
                </div>

                <div className="opp-list-actions">
                    {showPriorityToggle && (
                        <label className={`opp-high-priority-toggle is-list ${opportunity.is_high_priority ? 'is-active' : ''}`} onClick={(event) => event.stopPropagation()}>
                            <input
                                type="checkbox"
                                checked={opportunity.is_high_priority}
                                onChange={(event) => void onToggleHighPriority?.(event.target.checked)}
                            />
                            <span>High priority</span>
                        </label>
                    )}
                    {showRadarAction && (
                        <button
                            type="button"
                            className={`opp-radar-add-btn is-${radarState}`}
                            onClick={(event) => {
                                event.stopPropagation();
                                onAddToRadar?.(opportunity);
                            }}
                            disabled={radarState === 'adding' || radarState === 'added' || radarState === 'already'}
                            aria-label={`${getRadarButtonLabel(radarState)}: ${displayTitle}`}
                        >
                            {radarState === 'adding' ? <OpportunityBusy>Adding…</OpportunityBusy> : getRadarButtonLabel(radarState)}
                        </button>
                    )}
                </div>
            </div>
        </article>
    );
};
