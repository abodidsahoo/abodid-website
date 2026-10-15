import React, { useId, useState } from 'react';
import type { OpportunityStatus } from '../../lib/opportunities/types';

export interface StatusConfig {
    id: OpportunityStatus;
    label: string;
    description: string;
}

/**
 * The database keeps the original workflow enum for backwards compatibility.
 * The product UI deliberately presents the five stages people use while
 * applying, and folds legacy event/archive values into their closest stage.
 */
export const WORKFLOW_STATUSES = [
    { id: 'inbox', label: 'Saved', description: 'Captured and ready to review' },
    { id: 'interested', label: 'Reviewing', description: 'Checking fit and eligibility' },
    { id: 'preparing', label: 'Applying', description: 'Preparing the application' },
    { id: 'submitted', label: 'Submitted', description: 'Application sent' },
    { id: 'done', label: 'Archived', description: 'No further action needed' },
] as const satisfies readonly StatusConfig[];

export type TrackerStatus = typeof WORKFLOW_STATUSES[number]['id'];

export const normalizeOpportunityStatus = (status: OpportunityStatus): TrackerStatus => {
    if (status === 'registered' || status === 'attending') return 'submitted';
    if (status === 'dismissed') return 'done';
    return status;
};

export const opportunityMatchesTrackerStatus = (
    status: OpportunityStatus,
    trackerStatus: TrackerStatus,
) => normalizeOpportunityStatus(status) === trackerStatus;

export const getTrackerStatusConfig = (status: OpportunityStatus) => {
    const normalized = normalizeOpportunityStatus(status);
    return WORKFLOW_STATUSES.find((item) => item.id === normalized) || WORKFLOW_STATUSES[0];
};

interface OpportunityStatusPickerProps {
    status: OpportunityStatus;
    onChange: (status: OpportunityStatus) => Promise<void> | void;
    disabled?: boolean;
    position?: 'top' | 'bottom' | 'auto';
    size?: 'sm' | 'md';
    opportunityTitle?: string;
}

export const OpportunityStatusPicker: React.FC<OpportunityStatusPickerProps> = ({
    status,
    onChange,
    disabled = false,
    size = 'sm',
    opportunityTitle,
}) => {
    const selectId = useId();
    const [isUpdating, setIsUpdating] = useState(false);
    const currentStatus = normalizeOpportunityStatus(status);

    const handleChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
        const nextStatus = event.target.value as TrackerStatus;
        if (nextStatus === currentStatus) return;

        setIsUpdating(true);
        try {
            await onChange(nextStatus);
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <label className={`opp-status-picker ${size}`} htmlFor={selectId}>
            <span className="opp-status-picker-label">Status</span>
            <span className="opp-status-select-shell">
                <select
                    id={selectId}
                    className="opp-status-select"
                    value={currentStatus}
                    onChange={handleChange}
                    disabled={disabled || isUpdating}
                    aria-label={opportunityTitle ? `Status for ${opportunityTitle}` : 'Opportunity status'}
                >
                    {WORKFLOW_STATUSES.map((item) => (
                        <option key={item.id} value={item.id}>
                            {item.label}
                        </option>
                    ))}
                </select>
                <span className="opp-status-select-chevron" aria-hidden="true">⌄</span>
            </span>
            {isUpdating && <span className="opp-status-saving" role="status">Saving…</span>}
        </label>
    );
};
