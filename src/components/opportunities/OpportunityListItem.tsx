import { ExternalLink } from 'lucide-react';
import React, { useState } from 'react';
import { OpportunityBusy } from './OpportunityBusy';
import type { Opportunity } from '../../lib/opportunities/types';
import {
    formatCategoryTitle,
    formatDaysRemaining,
    formatOpportunityTitle,
    getOpportunityCategoryIconUrl,
} from '../../lib/opportunities/ui-helpers';
import { cleanOpportunityListingUrl } from '../../lib/opportunities/listingUrl';
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
    const categoryIcon = getOpportunityCategoryIconUrl(opportunity.category);
    const iconUrl = cleanOpportunityListingUrl(opportunity.organisation_icon_url);
    const [failedIcon, setFailedIcon] = useState<string | null>(null);
    const listingUrl = cleanOpportunityListingUrl(opportunity.source_url)
        || cleanOpportunityListingUrl(opportunity.application_url);
    const usesEventDate = !opportunity.deadline_at && Boolean(opportunity.event_date);
    const date = opportunity.deadline_at || opportunity.event_date;
    const urgency = formatDaysRemaining(date, usesEventDate ? undefined : opportunity.deadline_confidence);
    const deadlineLabel = usesEventDate
        ? urgency.label.replace(/ left$/, ' until event').replace(/^Past deadline$/, 'Event passed')
        : urgency.label;

    return (
        <article
            className={`opp-list-item${opportunity.is_high_priority ? ' is-high-priority' : ''}`}
            onClick={(event) => {
                if (!(event.target instanceof Element) || !event.target.closest('button, a, input, label, select, textarea, summary')) {
                    onOpen(opportunity);
                }
            }}
        >
            <div className="opp-list-organisation-icon" aria-hidden="true">
                <img
                    src={iconUrl && failedIcon !== iconUrl ? iconUrl : categoryIcon}
                    className={iconUrl && failedIcon !== iconUrl ? 'is-organisation' : 'is-category-fallback'}
                    alt=""
                    width="56"
                    height="56"
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onError={() => { if (iconUrl && failedIcon !== iconUrl) setFailedIcon(iconUrl); }}
                />
            </div>
            <div className="opp-list-identity">
                <h3>
                    <button type="button" onClick={(event) => {
                        event.stopPropagation();
                        onOpen(opportunity);
                    }}>{displayTitle}</button>
                </h3>
                {opportunity.organisation && <p>{opportunity.organisation}</p>}
                <button type="button" className={`opp-card-category-badge opp-list-category-mark ${opportunity.category || 'other'}`}
                    onClick={(event) => {
                        event.stopPropagation();
                        onSelectCategory?.(opportunity.category || 'other');
                    }}
                    aria-label={`Show ${categoryLabel} opportunities`} title={`Filter all ${categoryLabel} listings`}>
                    <span className="opp-card-category-icon-box" aria-hidden="true">
                        <img src={categoryIcon} className="opp-card-category-icon" alt="" width="34" height="34" loading="lazy" decoding="async" />
                    </span>
                    <span className="opp-card-category-label">{categoryLabel}</span>
                </button>
            </div>
            <div className="opp-list-meta">
                <span className={`opp-days-remaining opp-list-deadline ${urgency.level}`}>
                    <span className="opp-days-pulse-dot" aria-hidden="true" />
                    {deadlineLabel}
                </span>
            </div>
            <div className="opp-list-actions">
                {showPriorityToggle && (
                    <label className={`opp-high-priority-toggle is-list ${opportunity.is_high_priority ? 'is-active' : ''}`} onClick={(event) => event.stopPropagation()}>
                        <input type="checkbox" checked={opportunity.is_high_priority}
                            onChange={(event) => void onToggleHighPriority?.(event.target.checked)} />
                        <span>High priority</span>
                    </label>
                )}
                {showRadarAction && (
                    <button type="button" className={`opp-radar-add-btn is-${radarState}`}
                        onClick={(event) => { event.stopPropagation(); onAddToRadar?.(opportunity); }}
                        disabled={radarState === 'adding' || radarState === 'added' || radarState === 'already'}
                        aria-label={`${getRadarButtonLabel(radarState)}: ${displayTitle}`}>
                        {radarState === 'adding' ? <OpportunityBusy>Adding</OpportunityBusy> : getRadarButtonLabel(radarState)}
                    </button>
                )}
                {listingUrl && (
                    <a className="opp-list-source-link" href={listingUrl} target="_blank" rel="noopener noreferrer"
                        aria-label={`Open original listing: ${displayTitle}`} onClick={(event) => event.stopPropagation()}>
                        <ExternalLink size={20} aria-hidden="true" />
                    </a>
                )}
            </div>
        </article>
    );
};
