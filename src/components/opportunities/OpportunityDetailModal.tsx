import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Opportunity, OpportunityStatus } from '../../lib/opportunities/types';
import { generateGoogleCalendarUrl } from '../../lib/opportunities/calendar';
import {
    extractEligibility,
    formatCategoryTitle,
    formatDaysRemaining,
    formatOpportunityTitle,
    getOpportunityNextAction,
} from '../../lib/opportunities/ui-helpers';
import { OpportunityStatusPicker } from './OpportunityStatusPicker';
import { getRadarButtonLabel, type RadarSaveState } from './OpportunityCard';

interface OpportunityDetailModalProps {
    opportunity: Opportunity;
    isOpen: boolean;
    isAuthenticated?: boolean;
    onClose: () => void;
    onUpdateStatus: (id: string, status: OpportunityStatus) => Promise<void>;
    onUpdatePriority?: (id: string, priority: number) => Promise<void>;
    onUpdateChecklist?: (id: string, completedRequirements: string[]) => Promise<void>;
    onUpdateDeadline?: (id: string, deadline: string) => Promise<void>;
    onSelectCategory?: (category: string) => void;
    onEdit: (opp: Opportunity) => void;
    onReExtract: (id: string) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    onNavigateNext?: () => void;
    onNavigatePrev?: () => void;
    currentIndex?: number;
    totalCount?: number;
    showRadarAction?: boolean;
    radarState?: RadarSaveState;
    onAddToRadar?: (opportunity: Opportunity) => void;
}

type DataState = 'verified' | 'ai' | 'missing' | 'suggested';

const DataBadge = ({ state }: { state: DataState }) => {
    const labels: Record<DataState, string> = {
        verified: 'Verified / user entered',
        ai: 'AI extracted · verify',
        missing: 'Missing information',
        suggested: 'Tracker suggestion',
    };
    return <span className={`opp-data-badge is-${state}`}>{labels[state]}</span>;
};

export const OpportunityDetailModal: React.FC<OpportunityDetailModalProps> = ({
    opportunity: opp,
    isOpen,
    isAuthenticated = false,
    onClose,
    onUpdateStatus,
    onUpdatePriority,
    onUpdateChecklist,
    onUpdateDeadline,
    onSelectCategory,
    onEdit,
    onReExtract,
    onDelete,
    onNavigateNext,
    onNavigatePrev,
    currentIndex,
    totalCount,
    showRadarAction = false,
    radarState = 'idle',
    onAddToRadar,
}) => {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const dateInputRef = useRef<HTMLInputElement>(null);
    const [isReExtracting, setIsReExtracting] = useState(false);
    const [currentDeadline, setCurrentDeadline] = useState<string | null>(opp.deadline_at);
    const [completedRequirements, setCompletedRequirements] = useState<string[]>(opp.completed_requirements || []);
    const [isUpdatingDate, setIsUpdatingDate] = useState(false);
    const [dateError, setDateError] = useState('');
    const [checklistError, setChecklistError] = useState('');
    const [savingRequirement, setSavingRequirement] = useState<string | null>(null);
    const [priority, setPriority] = useState(opp.priority || 1);
    const [isUpdatingPriority, setIsUpdatingPriority] = useState(false);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;

        if (isOpen && !dialog.open) dialog.showModal();
        if (!isOpen && dialog.open) dialog.close();

        return () => {
            if (dialog.open) dialog.close();
        };
    }, [isOpen]);

    useEffect(() => {
        setCurrentDeadline(opp.deadline_at);
        setCompletedRequirements(opp.completed_requirements || []);
        setDateError('');
        setChecklistError('');
        setPriority(opp.priority || 1);
    }, [opp.id, opp.deadline_at, opp.completed_requirements, opp.priority]);

    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest('button, a, input, textarea, select, summary')) return;

            if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                event.preventDefault();
                onNavigateNext?.();
            } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                event.preventDefault();
                onNavigatePrev?.();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onNavigateNext, onNavigatePrev]);

    const eligibilityTags = useMemo(() => extractEligibility(opp), [opp]);
    const requirements = opp.requirements || [];
    const completedCount = requirements.filter((item) => completedRequirements.includes(item)).length;
    const completionPercentage = requirements.length
        ? Math.round((completedCount / requirements.length) * 100)
        : 0;
    const displayTitle = formatOpportunityTitle(opp.title);
    const categoryLabel = formatCategoryTitle(opp.category);
    const nextAction = getOpportunityNextAction({ ...opp, completed_requirements: completedRequirements });
    const urgency = formatDaysRemaining(currentDeadline, opp.deadline_confidence);
    const extractedState: DataState = opp.llm_model ? 'ai' : 'verified';

    let sourceDomain = 'Original source';
    try {
        sourceDomain = new URL(opp.source_url).hostname.replace(/^www\./, '');
    } catch {
        // Keep the readable fallback for malformed legacy URLs.
    }

    const openDatePicker = () => {
        const input = dateInputRef.current;
        if (!input) return;
        try {
            input.showPicker?.();
        } catch {
            input.focus();
            input.click();
        }
    };

    const handleDateSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        if (!value || !onUpdateDeadline) return;

        const previousDeadline = currentDeadline;
        const nextDeadline = new Date(`${value}T23:59:00`).toISOString();
        setCurrentDeadline(nextDeadline);
        setDateError('');
        setIsUpdatingDate(true);
        try {
            await onUpdateDeadline(opp.id, value);
        } catch {
            setCurrentDeadline(previousDeadline);
            setDateError('The deadline could not be saved. Try again.');
        } finally {
            setIsUpdatingDate(false);
        }
    };

    const handleRequirementToggle = async (requirement: string) => {
        if (!isAuthenticated || !onUpdateChecklist || savingRequirement) return;

        const previous = completedRequirements;
        const next = previous.includes(requirement)
            ? previous.filter((item) => item !== requirement)
            : [...previous, requirement];

        setCompletedRequirements(next);
        setChecklistError('');
        setSavingRequirement(requirement);
        try {
            await onUpdateChecklist(opp.id, next);
        } catch {
            setCompletedRequirements(previous);
            setChecklistError('Checklist progress could not be saved. Try again.');
        } finally {
            setSavingRequirement(null);
        }
    };

    const handlePriorityChange = async (nextPriority: number) => {
        if (!isAuthenticated || !onUpdatePriority || isUpdatingPriority || nextPriority === priority) return;

        const previousPriority = priority;
        setPriority(nextPriority);
        setIsUpdatingPriority(true);
        try {
            await onUpdatePriority(opp.id, nextPriority);
        } catch {
            setPriority(previousPriority);
        } finally {
            setIsUpdatingPriority(false);
        }
    };

    const handleReExtractClick = async () => {
        if (!window.confirm(`Re-extract "${displayTitle}" using AI? Existing extracted details may change.`)) return;
        setIsReExtracting(true);
        try {
            await onReExtract(opp.id);
        } finally {
            setIsReExtracting(false);
        }
    };

    const handleDeleteClick = async () => {
        if (!window.confirm(`Permanently delete "${displayTitle}"? This cannot be undone.`)) return;
        onClose();
        await onDelete(opp.id);
    };

    if (!isOpen) return null;

    return (
        <dialog
            ref={dialogRef}
            className="opp-detail-dialog"
            aria-labelledby="opp-detail-title"
            onCancel={(event) => {
                event.preventDefault();
                onClose();
            }}
            onClick={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div className="opp-modal opp-detail-modal">
                <div className="opp-detail-modal-header">
                    <div className="opp-detail-header-meta">
                        <div className={`opp-days-remaining ${urgency.level}`}>
                            <span className="opp-days-pulse-dot" aria-hidden="true" />
                            {urgency.label}
                        </div>
                        {currentIndex && totalCount ? (
                            <span className="opp-nav-index-badge">{currentIndex} / {totalCount}</span>
                        ) : null}
                    </div>
                    <button
                        type="button"
                        className="opp-btn opp-btn-secondary opp-btn-sm opp-modal-close-btn"
                        onClick={onClose}
                        aria-label={`Close ${displayTitle}`}
                    >
                        ✕
                    </button>
                </div>

                <div className="opp-detail-identity">
                    <h2 id="opp-detail-title" className="opp-detail-title">{displayTitle}</h2>
                    <p className="opp-detail-org">{opp.organisation}</p>
                    <button
                        type="button"
                        className={`opp-category-text ${opp.category || 'other'}`}
                        onClick={() => {
                            onSelectCategory?.(opp.category || 'other');
                            onClose();
                        }}
                    >
                        {categoryLabel}
                    </button>
                </div>

                {isAuthenticated && (
                    <div className="opp-detail-workflow-controls">
                        <fieldset className="opp-detail-priority-fieldset">
                            <legend>Priority</legend>
                            <div className="opp-priority-options">
                                {[
                                    { level: 1, label: 'Low' },
                                    { level: 2, label: 'Medium' },
                                    { level: 3, label: 'High' },
                                ].map(({ level, label }) => (
                                    <button
                                        key={level}
                                        type="button"
                                        className="opp-priority-option"
                                        aria-pressed={priority === level}
                                        disabled={isUpdatingPriority}
                                        onClick={() => void handlePriorityChange(level)}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </fieldset>
                        <OpportunityStatusPicker
                            status={opp.status}
                            onChange={(status) => onUpdateStatus(opp.id, status)}
                            size="md"
                            opportunityTitle={displayTitle}
                        />
                    </div>
                )}

                <div className="opp-detail-body">
                    <div className="opp-detail-glance-grid">
                        <section className="opp-detail-section" aria-labelledby="opp-deadline-heading">
                            <div className="opp-detail-section-heading">
                                <h3 id="opp-deadline-heading">Deadline</h3>
                                <DataBadge state={currentDeadline ? extractedState : 'missing'} />
                            </div>
                            {isAuthenticated && onUpdateDeadline ? (
                                <button
                                    type="button"
                                    className="opp-detail-deadline-card"
                                    onClick={openDatePicker}
                                    disabled={isUpdatingDate}
                                >
                                    <span className="opp-detail-deadline-value">
                                        {currentDeadline
                                            ? new Date(currentDeadline).toLocaleDateString('en-GB', {
                                                day: 'numeric', month: 'short', year: 'numeric',
                                            })
                                            : 'No deadline set'}
                                    </span>
                                    <span className="opp-deadline-edit-tag">
                                        {isUpdatingDate ? 'Saving…' : 'Change'}
                                    </span>
                                </button>
                            ) : (
                                <div className="opp-detail-deadline-card is-static">
                                    <span className="opp-detail-deadline-value">
                                        {currentDeadline
                                            ? new Date(currentDeadline).toLocaleDateString('en-GB', {
                                                day: 'numeric', month: 'short', year: 'numeric',
                                            })
                                            : 'No deadline provided'}
                                    </span>
                                </div>
                            )}
                            <input
                                ref={dateInputRef}
                                type="date"
                                className="opp-hidden-date-input"
                                value={currentDeadline ? new Date(currentDeadline).toISOString().slice(0, 10) : ''}
                                onChange={handleDateSelect}
                                tabIndex={-1}
                                aria-hidden="true"
                            />
                            {dateError && <p className="opp-inline-error" role="alert">{dateError}</p>}
                        </section>

                        <section className="opp-detail-section is-next-action" aria-labelledby="opp-next-action-heading">
                            <div className="opp-detail-section-heading">
                                <h3 id="opp-next-action-heading">Next action</h3>
                                <DataBadge state={opp.next_action ? extractedState : 'suggested'} />
                            </div>
                            <p className="opp-detail-next-action-text">{nextAction}</p>
                        </section>
                    </div>

                    <details className="opp-detail-more-info">
                        <summary>
                            <span>Show more details</span>
                            <span aria-hidden="true">＋</span>
                        </summary>
                        <div className="opp-detail-more-info-body">
                            <section className="opp-detail-section" aria-labelledby="opp-eligibility-heading">
                                <div className="opp-detail-section-heading">
                                    <h3 id="opp-eligibility-heading">Eligibility</h3>
                                    <DataBadge state={eligibilityTags.length ? extractedState : 'missing'} />
                                </div>
                                {eligibilityTags.length ? (
                                    <ul className="opp-eligibility-row" role="list">
                                        {eligibilityTags.map((tag) => <li key={tag} className="opp-eligibility-tag">{tag}</li>)}
                                    </ul>
                                ) : (
                                    <p className="opp-detail-empty-copy">Eligibility was not found. Check the source before applying.</p>
                                )}
                            </section>

                            <section className="opp-detail-section" aria-labelledby="opp-requirements-heading">
                                <div className="opp-detail-section-heading">
                                    <h3 id="opp-requirements-heading">Requirements</h3>
                                    <DataBadge state={requirements.length ? extractedState : 'missing'} />
                                </div>
                                {requirements.length ? (
                                    <>
                                        <div className="opp-checklist-progress-row">
                                            <progress value={completedCount} max={requirements.length}>
                                                {completionPercentage}%
                                            </progress>
                                            <strong>{completedCount} of {requirements.length} complete</strong>
                                        </div>
                                        <ul className="opp-requirements-checklist" role="list">
                                            {requirements.map((requirement, index) => {
                                                const checked = completedRequirements.includes(requirement);
                                                const inputId = `opp-requirement-${opp.id}-${index}`;
                                                return (
                                                    <li key={`${requirement}-${index}`}>
                                                        <label htmlFor={inputId} className="opp-requirement-check">
                                                            <input
                                                                id={inputId}
                                                                type="checkbox"
                                                                checked={checked}
                                                                onChange={() => void handleRequirementToggle(requirement)}
                                                                disabled={!isAuthenticated || !onUpdateChecklist || Boolean(savingRequirement)}
                                                            />
                                                            <span>{requirement}</span>
                                                        </label>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </>
                                ) : (
                                    <p className="opp-detail-empty-copy">No requirements were found. Review the source before applying.</p>
                                )}
                                {checklistError && <p className="opp-inline-error" role="alert">{checklistError}</p>}
                            </section>

                            <div className="opp-detail-secondary-grid">
                                <section className="opp-detail-section" aria-labelledby="opp-funding-heading">
                                    <div className="opp-detail-section-heading">
                                        <h3 id="opp-funding-heading">Funding</h3>
                                        <DataBadge state={opp.fee_or_funding ? extractedState : 'missing'} />
                                    </div>
                                    <p className="opp-detail-field-value">
                                        {opp.fee_or_funding || 'Funding or fee information was not found.'}
                                    </p>
                                </section>

                                <section className="opp-detail-section" aria-labelledby="opp-source-heading">
                                    <div className="opp-detail-section-heading">
                                        <h3 id="opp-source-heading">Source</h3>
                                        <DataBadge state={opp.source_url ? 'verified' : 'missing'} />
                                    </div>
                                    {opp.source_url ? (
                                        <a
                                            href={opp.source_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="opp-source-card-link"
                                        >
                                            <span>{sourceDomain}</span>
                                            <span aria-hidden="true">↗</span>
                                        </a>
                                    ) : (
                                        <p className="opp-detail-empty-copy">No source URL is available.</p>
                                    )}
                                </section>
                            </div>

                            {(opp.event_date || opp.location || opp.summary || opp.notes) && (
                                <section className="opp-detail-context-body" aria-label="Additional context">
                                    {opp.event_date && <p><strong>Event:</strong> {new Date(opp.event_date).toLocaleDateString('en-GB')}</p>}
                                    {opp.location && <p><strong>Location:</strong> {opp.location}</p>}
                                    {opp.summary && <p><strong>AI summary:</strong> {opp.summary}</p>}
                                    {opp.notes && <p><strong>Personal notes:</strong> {opp.notes}</p>}
                                </section>
                            )}

                            {isAuthenticated && (
                                <div className="opp-detail-curator-inline-bar">
                                    <button type="button" className="opp-curator-inline-btn" onClick={() => { onClose(); onEdit(opp); }}>
                                        Edit details
                                    </button>
                                    <button type="button" className="opp-curator-inline-btn" onClick={handleReExtractClick} disabled={isReExtracting}>
                                        {isReExtracting ? 'Re-extracting…' : 'Re-extract with AI'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </details>
                </div>

                <div className="opp-detail-footer">
                    <div className="opp-detail-primary-actions">
                        {showRadarAction && (
                            <button
                                type="button"
                                className={`opp-btn opp-btn-sm opp-radar-add-btn opp-detail-radar-btn is-${radarState}`}
                                onClick={() => onAddToRadar?.(opp)}
                                disabled={radarState === 'adding' || radarState === 'added' || radarState === 'already'}
                            >
                                {getRadarButtonLabel(radarState)}
                            </button>
                        )}
                        {opp.application_url ? (
                            <a
                                href={opp.application_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="opp-btn opp-btn-primary opp-apply-now-btn"
                            >
                                <span>Apply Now</span><span aria-hidden="true">↗</span>
                            </a>
                        ) : (
                            <span className="opp-btn opp-btn-disabled opp-apply-now-btn" aria-disabled="true">
                                Application URL missing
                            </span>
                        )}
                        {currentDeadline && (
                            <a
                                href={generateGoogleCalendarUrl({ ...opp, deadline_at: currentDeadline }, 'deadline')}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="opp-btn opp-btn-secondary opp-add-calendar-btn"
                            >
                                Add deadline to calendar
                            </a>
                        )}
                    </div>

                    {isAuthenticated ? (
                        <details className="opp-detail-more-menu">
                            <summary>More actions</summary>
                            <div className="opp-detail-more-panel">
                                <button type="button" className="opp-delete-btn" onClick={handleDeleteClick}>
                                    Delete opportunity…
                                </button>
                            </div>
                        </details>
                    ) : (
                        <button type="button" className="opp-btn opp-btn-secondary" onClick={onClose}>Close</button>
                    )}
                </div>
            </div>
        </dialog>
    );
};
