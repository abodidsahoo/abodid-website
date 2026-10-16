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
import { getTrackerStatusConfig, OpportunityStatusPicker } from './OpportunityStatusPicker';
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

type DataState = 'verified' | 'missing' | 'suggested';
type MetadataEditor = 'status' | 'priority' | null;

const PRIORITY_OPTIONS = [
    { level: 1, label: 'Low' },
    { level: 2, label: 'Medium' },
    { level: 3, label: 'High' },
] as const;

const DataBadge = ({ state }: { state: DataState }) => {
    const labels: Record<DataState, string> = {
        verified: 'Verified / user entered',
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
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const dateInputRef = useRef<HTMLInputElement>(null);
    const moreMenuRef = useRef<HTMLDetailsElement>(null);
    const metadataRowRef = useRef<HTMLDivElement>(null);
    const [isReExtracting, setIsReExtracting] = useState(false);
    const [currentDeadline, setCurrentDeadline] = useState<string | null>(opp.deadline_at);
    const [completedRequirements, setCompletedRequirements] = useState<string[]>(opp.completed_requirements || []);
    const [isUpdatingDate, setIsUpdatingDate] = useState(false);
    const [dateError, setDateError] = useState('');
    const [checklistError, setChecklistError] = useState('');
    const [savingRequirement, setSavingRequirement] = useState<string | null>(null);
    const [priority, setPriority] = useState(opp.priority || 1);
    const [isUpdatingPriority, setIsUpdatingPriority] = useState(false);
    const [metadataEditor, setMetadataEditor] = useState<MetadataEditor>(null);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;

        let focusFrame: number | undefined;
        if (isOpen && !dialog.open) {
            dialog.showModal();
            focusFrame = window.requestAnimationFrame(() => {
                closeButtonRef.current?.focus({ preventScroll: true });
            });
        }
        if (!isOpen && dialog.open) dialog.close();

        return () => {
            if (focusFrame !== undefined) window.cancelAnimationFrame(focusFrame);
            if (dialog.open) dialog.close();
        };
    }, [isOpen]);

    useEffect(() => {
        setCurrentDeadline(opp.deadline_at);
        setCompletedRequirements(opp.completed_requirements || []);
        setDateError('');
        setChecklistError('');
        setPriority(opp.priority || 1);
        setMetadataEditor(null);
    }, [opp.id, opp.deadline_at, opp.completed_requirements, opp.priority]);

    useEffect(() => {
        if (!isOpen) return;

        const closeMoreMenu = () => {
            const menu = moreMenuRef.current;
            if (menu?.open) menu.open = false;
        };

        const handlePointerDown = (event: PointerEvent) => {
            const menu = moreMenuRef.current;
            if (!(event.target instanceof Node)) return;
            if (menu?.open && !menu.contains(event.target)) closeMoreMenu();
            if (metadataEditor && metadataRowRef.current && !metadataRowRef.current.contains(event.target)) {
                setMetadataEditor(null);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && moreMenuRef.current?.open) {
                event.preventDefault();
                event.stopPropagation();
                closeMoreMenu();
                moreMenuRef.current?.querySelector<HTMLElement>('summary')?.focus();
                return;
            }

            if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

            const target = event.composedPath()[0];
            if (
                target instanceof Element
                && target.matches(':read-write, select, input[type="range"], [role="slider"]')
            ) return;

            if ((event.key === 'ArrowRight' || event.key === 'ArrowDown') && onNavigateNext) {
                event.preventDefault();
                onNavigateNext();
            } else if ((event.key === 'ArrowLeft' || event.key === 'ArrowUp') && onNavigatePrev) {
                event.preventDefault();
                onNavigatePrev();
            }
        };

        document.addEventListener('pointerdown', handlePointerDown);
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, metadataEditor, onNavigateNext, onNavigatePrev]);

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
    const isAiExtracted = Boolean(opp.llm_model && opp.llm_model !== 'manual');
    const formattedDeadline = currentDeadline
        ? new Date(currentDeadline).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric',
        })
        : null;
    const formattedEventDate = opp.event_date
        ? new Date(opp.event_date).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric',
        })
        : null;
    const statusLabel = getTrackerStatusConfig(opp.status).label;
    const priorityLabel = PRIORITY_OPTIONS.find((option) => option.level === priority)?.label || 'Low';

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
            setMetadataEditor(null);
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
                <div className="opp-detail-scroll-region">
                    <div className="opp-detail-modal-header">
                        <div className="opp-detail-header-meta">
                            <div className={`opp-days-remaining ${urgency.level}`}>
                                <span className="opp-days-pulse-dot" aria-hidden="true" />
                                {urgency.label}
                            </div>
                            <span className="opp-detail-meta-divider" aria-hidden="true" />
                            <button
                                type="button"
                                className={`opp-category-text opp-detail-category-meta ${opp.category || 'other'}`}
                                onClick={() => {
                                    onSelectCategory?.(opp.category || 'other');
                                    onClose();
                                }}
                                title={`Show ${categoryLabel} opportunities`}
                            >
                                {categoryLabel}
                            </button>
                        </div>
                        <button
                            ref={closeButtonRef}
                            type="button"
                            className="opp-detail-close-button"
                            onClick={onClose}
                            aria-label={`Close ${displayTitle}`}
                        >
                            <span aria-hidden="true">×</span>
                        </button>
                    </div>

                    <div className="opp-detail-hero-row">
                        <div className="opp-detail-identity">
                            <h2 id="opp-detail-title" className="opp-detail-title">{displayTitle}</h2>
                            <p className="opp-detail-org">{opp.organisation}</p>
                        </div>
                        <div className="opp-detail-hero-actions">
                            {opp.source_url ? (
                                <a
                                    href={opp.source_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="opp-detail-source-cta"
                                >
                                    <span>View original source</span>
                                    <span aria-hidden="true">↗</span>
                                </a>
                            ) : (
                                <span className="opp-detail-source-cta is-disabled" aria-disabled="true">
                                    Source unavailable
                                </span>
                            )}
                            {opp.application_url && opp.application_url !== opp.source_url && (
                                <a
                                    href={opp.application_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="opp-detail-application-shortcut"
                                >
                                    <span>Open application</span>
                                    <span aria-hidden="true">↗</span>
                                </a>
                            )}
                        </div>
                    </div>

                    <div
                        ref={metadataRowRef}
                        className={`opp-detail-metadata-row ${isAuthenticated ? '' : 'is-public'}`}
                    >
                        <section className="opp-detail-metadata-item is-deadline" aria-labelledby="opp-deadline-heading">
                            <h3 id="opp-deadline-heading">Deadline</h3>
                            <div className="opp-detail-deadline-controls">
                                {isAuthenticated && onUpdateDeadline ? (
                                    <button
                                        type="button"
                                        className="opp-detail-metadata-value"
                                        onClick={openDatePicker}
                                        disabled={isUpdatingDate}
                                        aria-label={`Change deadline, currently ${formattedDeadline || 'not set'}`}
                                    >
                                        {isUpdatingDate ? 'Saving…' : formattedDeadline || 'Not set'}
                                    </button>
                                ) : (
                                    <span className="opp-detail-metadata-value is-static">
                                        {formattedDeadline || 'Not provided'}
                                    </span>
                                )}
                                {currentDeadline && (
                                    <a
                                        href={generateGoogleCalendarUrl({ ...opp, deadline_at: currentDeadline }, 'deadline')}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="opp-detail-calendar-link"
                                    >
                                        <span>Add to calendar</span>
                                        <span aria-hidden="true">↗</span>
                                    </a>
                                )}
                            </div>
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

                        <section className="opp-detail-metadata-item is-status" aria-labelledby="opp-status-heading">
                            <h3 id="opp-status-heading">Status</h3>
                            {isAuthenticated ? (
                                <>
                                    <button
                                        type="button"
                                        className="opp-detail-metadata-value"
                                        aria-expanded={metadataEditor === 'status'}
                                        aria-controls="opp-quick-status-editor"
                                        onClick={() => setMetadataEditor((current) => current === 'status' ? null : 'status')}
                                    >
                                        <span className="opp-detail-value-dot is-status" aria-hidden="true" />
                                        <span>{statusLabel}</span>
                                    </button>
                                    {metadataEditor === 'status' && (
                                        <div id="opp-quick-status-editor" className="opp-detail-quick-editor">
                                            <OpportunityStatusPicker
                                                status={opp.status}
                                                onChange={async (status) => {
                                                    await onUpdateStatus(opp.id, status);
                                                    setMetadataEditor(null);
                                                }}
                                                size="md"
                                                opportunityTitle={displayTitle}
                                            />
                                        </div>
                                    )}
                                </>
                            ) : (
                                <span className="opp-detail-metadata-value is-static">
                                    <span className="opp-detail-value-dot is-status" aria-hidden="true" />
                                    <span>{statusLabel}</span>
                                </span>
                            )}
                        </section>

                        <section className="opp-detail-metadata-item is-priority" aria-labelledby="opp-priority-heading">
                            <h3 id="opp-priority-heading">Priority</h3>
                            {isAuthenticated ? (
                                <>
                                    <button
                                        type="button"
                                        className="opp-detail-metadata-value"
                                        aria-expanded={metadataEditor === 'priority'}
                                        aria-controls="opp-quick-priority-editor"
                                        onClick={() => setMetadataEditor((current) => current === 'priority' ? null : 'priority')}
                                    >
                                        <span className="opp-detail-value-dot is-priority" aria-hidden="true" />
                                        <span>{priorityLabel}</span>
                                    </button>
                                    {metadataEditor === 'priority' && (
                                        <div id="opp-quick-priority-editor" className="opp-detail-quick-editor is-priority">
                                            <div className="opp-priority-options" aria-label="Set priority">
                                                {PRIORITY_OPTIONS.map(({ level, label }) => (
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
                                        </div>
                                    )}
                                </>
                            ) : (
                                <span className="opp-detail-metadata-value is-static">
                                    <span className="opp-detail-value-dot is-priority" aria-hidden="true" />
                                    <span>{priorityLabel}</span>
                                </span>
                            )}
                        </section>
                    </div>

                    <section className="opp-detail-next-action" aria-labelledby="opp-next-action-heading">
                        <div>
                            <h3 id="opp-next-action-heading">Next action</h3>
                            <p>{nextAction}</p>
                        </div>
                    </section>

                    <details className="opp-detail-more-info">
                        <summary>
                            <svg className="opp-detail-summary-mark" viewBox="0 0 20 16" aria-hidden="true">
                                <path d="M2 3h16M2 8h16M2 13h16" />
                            </svg>
                            <span>Show more details</span>
                            <svg className="opp-detail-summary-toggle" viewBox="0 0 20 20" aria-hidden="true">
                                <path d="m5 7.5 5 5 5-5" />
                            </svg>
                        </summary>
                        <div className="opp-detail-more-info-body">
                            <section className="opp-detail-editorial-section" aria-labelledby="opp-about-heading">
                                <div className="opp-detail-editorial-heading">
                                    <span aria-hidden="true">01</span>
                                    <h3 id="opp-about-heading">About</h3>
                                </div>
                                <div className="opp-detail-editorial-content">
                                    <p className="opp-detail-about-copy">
                                        {opp.summary || 'No summary was found. Review the original source for full opportunity details.'}
                                    </p>
                                    <dl className="opp-detail-about-meta">
                                        <div>
                                            <dt>Organisation</dt>
                                            <dd>{opp.organisation}</dd>
                                        </div>
                                        <div>
                                            <dt>Location</dt>
                                            <dd>{opp.location || 'No location details found.'}</dd>
                                        </div>
                                        <div>
                                            <dt>Funding / award</dt>
                                            <dd>{opp.fee_or_funding || 'No funding details found.'}</dd>
                                        </div>
                                        <div>
                                            <dt>Application fee</dt>
                                            <dd>{opp.application_fee || 'No details found.'}</dd>
                                        </div>
                                        <div>
                                            <dt>Event date</dt>
                                            <dd>{formattedEventDate || 'No event date provided.'}</dd>
                                        </div>
                                    </dl>
                                    <div className="opp-detail-eligibility-block">
                                        <h4>Eligibility</h4>
                                        {eligibilityTags.length ? (
                                            <ul className="opp-eligibility-row" role="list">
                                                {eligibilityTags.map((tag) => <li key={tag} className="opp-eligibility-tag">{tag}</li>)}
                                            </ul>
                                        ) : (
                                            <p className="opp-detail-empty-copy">Eligibility was not found. Check the source before applying.</p>
                                        )}
                                    </div>
                                </div>
                            </section>

                            <section className="opp-detail-editorial-section" aria-labelledby="opp-application-heading">
                                <div className="opp-detail-editorial-heading">
                                    <span aria-hidden="true">02</span>
                                    <h3 id="opp-application-heading">Application</h3>
                                </div>
                                <div className="opp-detail-editorial-content">
                                    {opp.application_url && (
                                        <a
                                            href={opp.application_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="opp-detail-application-link"
                                        >
                                            <span>Open application</span>
                                            <span aria-hidden="true">↗</span>
                                        </a>
                                    )}
                                    {requirements.length ? (
                                        <>
                                            <div className="opp-checklist-progress-row">
                                                <strong>{completedCount} of {requirements.length} complete</strong>
                                                <progress value={completedCount} max={requirements.length}>
                                                    {completionPercentage}%
                                                </progress>
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
                                </div>
                            </section>

                            <section className="opp-detail-editorial-section" aria-labelledby="opp-manage-heading">
                                <div className="opp-detail-editorial-heading">
                                    <span aria-hidden="true">03</span>
                                    <h3 id="opp-manage-heading">Manage</h3>
                                </div>
                                <div className="opp-detail-manage opp-detail-editorial-content">
                                    {isAuthenticated ? (
                                        <>
                                            <div className="opp-detail-workflow-controls">
                                                <OpportunityStatusPicker
                                                    status={opp.status}
                                                    onChange={(status) => onUpdateStatus(opp.id, status)}
                                                    size="md"
                                                    opportunityTitle={displayTitle}
                                                />
                                                <fieldset className="opp-detail-priority-fieldset">
                                                    <legend>Priority</legend>
                                                    <div className="opp-priority-options">
                                                        {PRIORITY_OPTIONS.map(({ level, label }) => (
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
                                            </div>
                                            {opp.notes && (
                                                <dl className="opp-detail-manage-notes">
                                                    <div>
                                                        <dt>Personal notes</dt>
                                                        <dd>{opp.notes}</dd>
                                                    </div>
                                                </dl>
                                            )}
                                            <div className="opp-detail-curator-inline-bar">
                                                <button type="button" className="opp-curator-inline-btn" onClick={() => { onClose(); onEdit(opp); }}>
                                                    Edit details
                                                </button>
                                                <button type="button" className="opp-curator-inline-btn" onClick={handleReExtractClick} disabled={isReExtracting}>
                                                    {isReExtracting ? 'Re-extracting…' : 'Re-extract with AI'}
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <p className="opp-detail-empty-copy">Sign in to update status, priority, and notes.</p>
                                    )}
                                </div>
                            </section>

                            <section className="opp-detail-editorial-section" aria-labelledby="opp-source-heading">
                                <div className="opp-detail-editorial-heading">
                                    <span aria-hidden="true">04</span>
                                    <h3 id="opp-source-heading">Source</h3>
                                </div>
                                <div className="opp-detail-source-verification opp-detail-editorial-content">
                                    <div>
                                        {opp.source_url ? (
                                            <a
                                                href={opp.source_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="opp-detail-inline-source-link"
                                            >
                                                <span>View original listing</span>
                                                <span aria-hidden="true">↗</span>
                                            </a>
                                        ) : (
                                            <p className="opp-detail-empty-copy">No source URL is available.</p>
                                        )}
                                        <p className="opp-detail-verification-copy">
                                            {isAiExtracted
                                                ? 'Please verify all requirements on the official source.'
                                                : 'These details were entered or verified by the user.'}
                                        </p>
                                    </div>
                                    <DataBadge state={opp.source_url ? 'verified' : 'missing'} />
                                </div>
                            </section>
                        </div>
                    </details>
                </div>

                <div className="opp-detail-footer">
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

                    {currentIndex && totalCount && totalCount > 1 && onNavigatePrev && onNavigateNext ? (
                        <nav className="opp-detail-navigation" aria-label="Opportunity navigation">
                            <button
                                type="button"
                                className="opp-detail-nav-button"
                                onClick={onNavigatePrev}
                                aria-label="Previous opportunity"
                                aria-keyshortcuts="ArrowLeft ArrowUp"
                            >
                                <span aria-hidden="true">←</span>
                            </button>
                            <span className="opp-nav-index-badge">
                                <span aria-hidden="true">{currentIndex} / {totalCount}</span>
                                <span className="sr-only">Opportunity {currentIndex} of {totalCount}</span>
                            </span>
                            <button
                                type="button"
                                className="opp-detail-nav-button"
                                onClick={onNavigateNext}
                                aria-label="Next opportunity"
                                aria-keyshortcuts="ArrowRight ArrowDown"
                            >
                                <span aria-hidden="true">→</span>
                            </button>
                        </nav>
                    ) : <span />}

                    {isAuthenticated ? (
                        <details ref={moreMenuRef} className="opp-detail-more-menu">
                            <summary aria-label="More actions">•••</summary>
                            <div className="opp-detail-more-panel">
                                <span className="opp-detail-more-label">Opportunity actions</span>
                                <button type="button" className="opp-delete-btn" onClick={handleDeleteClick}>
                                    Delete opportunity
                                </button>
                            </div>
                        </details>
                    ) : <span />}
                </div>
            </div>
        </dialog>
    );
};
