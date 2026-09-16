import React, { useState, useEffect, useRef } from 'react';
import type { Opportunity, OpportunityStatus } from '../../lib/opportunities/types';
import { generateGoogleCalendarUrl } from '../../lib/opportunities/calendar';
import {
    formatDaysRemaining,
    formatCategoryTitle,
    formatOpportunityTitle,
    extractEligibility,
} from '../../lib/opportunities/ui-helpers';

interface OpportunityDetailModalProps {
    opportunity: Opportunity;
    isOpen: boolean;
    isAuthenticated?: boolean;
    onClose: () => void;
    onUpdateStatus: (id: string, status: OpportunityStatus) => Promise<void>;
    onUpdatePriority?: (id: string, priority: number) => Promise<void>;
    onSelectCategory?: (category: string) => void;
    onEdit: (opp: Opportunity) => void;
    onReExtract: (id: string) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    onNavigateNext?: () => void;
    onNavigatePrev?: () => void;
    currentIndex?: number;
    totalCount?: number;
}

export const OpportunityDetailModal: React.FC<OpportunityDetailModalProps> = ({
    opportunity: opp,
    isOpen,
    isAuthenticated = false,
    onClose,
    onUpdateStatus,
    onUpdatePriority,
    onSelectCategory,
    onEdit,
    onReExtract,
    onDelete,
    onNavigateNext,
    onNavigatePrev,
    currentIndex,
    totalCount,
}) => {
    if (!isOpen) return null;

    const [isReExtracting, setIsReExtracting] = useState(false);
    const [currentDeadline, setCurrentDeadline] = useState<string | null | undefined>(opp.deadline_at);
    const [isUpdatingDate, setIsUpdatingDate] = useState(false);
    const dateInputRef = useRef<HTMLInputElement>(null);

    // Sync state when navigating between opportunities
    useEffect(() => {
        setCurrentDeadline(opp.deadline_at);
    }, [opp.id, opp.deadline_at]);

    // Keyboard Arrow Navigation (Cycles through opportunities with Left/Right or Up/Down arrows)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement ||
                e.target instanceof HTMLSelectElement
            ) {
                return;
            }

            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                if (onNavigateNext) onNavigateNext();
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                if (onNavigatePrev) onNavigatePrev();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onNavigateNext, onNavigatePrev, onClose]);

    const urgency = formatDaysRemaining(currentDeadline, opp.deadline_confidence);
    const eligibilityTags = extractEligibility(opp);
    const categoryLabel = formatCategoryTitle(opp.category);
    const displayTitle = formatOpportunityTitle(opp.title);

    const handleDateSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value; // YYYY-MM-DD
        if (!val) return;
        setIsUpdatingDate(true);
        try {
            const iso = new Date(val).toISOString();
            setCurrentDeadline(iso);
            await fetch(`/api/opportunities/${opp.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deadline_at: iso, deadline: val }),
            });
        } catch (err) {
            console.error('Failed to update deadline date:', err);
        } finally {
            setIsUpdatingDate(false);
        }
    };

    const openDatePicker = () => {
        if (dateInputRef.current) {
            if ('showPicker' in HTMLInputElement.prototype) {
                try {
                    dateInputRef.current.showPicker();
                    return;
                } catch {
                    // fallback below
                }
            }
            dateInputRef.current.focus();
            dateInputRef.current.click();
        }
    };

    const handleReExtractClick = async () => {
        if (!confirm(`Re-extract "${displayTitle}" using OpenRouter AI? This will re-scrape the original page.`)) {
            return;
        }
        setIsReExtracting(true);
        try {
            await onReExtract(opp.id);
        } finally {
            setIsReExtracting(false);
        }
    };

    const handleDeleteClick = async () => {
        if (confirm(`Are you sure you want to permanently delete "${displayTitle}"?`)) {
            onClose();
            await onDelete(opp.id);
        }
    };

    // Extract domain from source URL for cleaner display
    let sourceDomain = '';
    try {
        if (opp.source_url) {
            const urlObj = new URL(opp.source_url);
            sourceDomain = urlObj.hostname.replace(/^www\./, '');
        }
    } catch {
        sourceDomain = 'Original Source';
    }

    return (
        <div className="opp-modal-overlay" onClick={onClose}>
            <div className="opp-modal opp-detail-modal" onClick={(e) => e.stopPropagation()}>
                {/* Modal Header: Urgency Pill on Left, Close on Right */}
                <div className="opp-detail-modal-header">
                    <div className="opp-detail-header-meta">
                        <div className={`opp-days-remaining ${urgency.level}`}>
                            <span className="opp-days-pulse-dot" />
                            {urgency.label}
                        </div>
                    </div>

                    <div className="opp-detail-header-actions">
                        <button
                            type="button"
                            className="opp-btn opp-btn-secondary opp-btn-sm opp-modal-close-btn"
                            onClick={onClose}
                            aria-label="Close modal"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Modal Title, Organization & Category */}
                <div className="opp-detail-identity">
                    <h2 className="opp-detail-title">{displayTitle}</h2>
                    <div className="opp-detail-org">{opp.organisation}</div>
                    <button
                        type="button"
                        className={`opp-category-text ${opp.category || 'other'}`}
                        style={{ width: 'fit-content' }}
                        onClick={() => {
                            if (onSelectCategory) {
                                onSelectCategory(opp.category || 'other');
                            }
                            onClose();
                        }}
                        title={`Show all ${categoryLabel} listings`}
                    >
                        {categoryLabel}
                    </button>
                </div>

                {/* Scrollable Content Body */}
                <div className="opp-detail-body">
                    {/* Prominent Exact Deadline Banner (Single Clean Interactive Card) */}
                    <div className="opp-detail-deadline-section">
                        <div
                            className="opp-detail-deadline-card"
                            onClick={isAuthenticated ? openDatePicker : undefined}
                            role={isAuthenticated ? "button" : undefined}
                            tabIndex={isAuthenticated ? 0 : undefined}
                            onKeyDown={isAuthenticated ? (e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    openDatePicker();
                                }
                            } : undefined}
                            title={isAuthenticated ? "Click anywhere to change deadline date" : undefined}
                            style={{ cursor: isAuthenticated ? 'pointer' : 'default' }}
                        >
                            <div className="opp-detail-deadline-header">
                                <span className="opp-detail-deadline-label">APPLICATION DEADLINE</span>
                                {isAuthenticated && (
                                    <span className="opp-deadline-edit-tag">
                                        {isUpdatingDate ? 'Saving...' : 'Change Date ✎'}
                                    </span>
                                )}
                            </div>

                            <div className="opp-detail-deadline-main">
                                <span className="opp-deadline-calendar-icon">📅</span>
                                <span className="opp-detail-deadline-value">
                                    {currentDeadline ? (
                                        new Date(currentDeadline).toLocaleDateString('en-GB', {
                                            weekday: 'short',
                                            day: 'numeric',
                                            month: 'short',
                                            year: 'numeric',
                                        })
                                    ) : (
                                        <span className="opp-deadline-empty-prompt">No date set · Click to add date ➕</span>
                                    )}
                                </span>
                            </div>

                            {/* Hidden native date input */}
                            <input
                                ref={dateInputRef}
                                type="date"
                                className="opp-hidden-date-input"
                                value={currentDeadline ? new Date(currentDeadline).toISOString().slice(0, 10) : ''}
                                onChange={handleDateSelect}
                                tabIndex={-1}
                                aria-hidden="true"
                            />
                        </div>
                    </div>

                    {/* Next Action Strip (Clean & Focused) */}
                    {opp.next_action && opp.next_action.trim().length > 0 && (
                        <div className="opp-detail-next-action-card">
                            <span className="opp-next-action-icon">🎯</span>
                            <div className="opp-next-action-body">
                                <span className="opp-next-action-label">NEXT ACTION</span>
                                <span className="opp-next-action-text">{opp.next_action.trim()}</span>
                            </div>
                        </div>
                    )}

                    {/* Secondary Info Grid (Event Date, Location, Fee/Funding) */}
                    {(opp.event_date || opp.fee_or_funding || opp.location) && (
                        <div className="opp-detail-meta-grid">
                            {opp.event_date && (
                                <div className="opp-detail-meta-cell">
                                    <span className="opp-meta-label">Event Date</span>
                                    <div className="opp-meta-val">
                                        {new Date(opp.event_date).toLocaleDateString('en-GB', {
                                            day: 'numeric',
                                            month: 'short',
                                            year: 'numeric',
                                        })}
                                    </div>
                                </div>
                            )}

                            {opp.fee_or_funding && (
                                <div className="opp-detail-meta-cell">
                                    <span className="opp-meta-label">Fee / Funding</span>
                                    <div className="opp-meta-val">{opp.fee_or_funding}</div>
                                </div>
                            )}

                            {opp.location && (
                                <div className="opp-detail-meta-cell">
                                    <span className="opp-meta-label">Location</span>
                                    <div className="opp-meta-val">{opp.location}</div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Eligibility Tags */}
                    {eligibilityTags.length > 0 && (
                        <div className="opp-meta-block">
                            <span className="opp-meta-label">Verified Eligibility</span>
                            <div className="opp-eligibility-row">
                                {eligibilityTags.map((tag, idx) => (
                                    <span key={idx} className="opp-eligibility-tag">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Requirements */}
                    {opp.requirements && opp.requirements.length > 0 && (
                        <div className="opp-meta-block">
                            <span className="opp-meta-label">Requirements Checklist</span>
                            <ul className="opp-req-list">
                                {opp.requirements.map((req, i) => (
                                    <li key={i}>{req}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Summary */}
                    {opp.summary && (
                        <div className="opp-meta-block">
                            <span className="opp-meta-label">AI Summary</span>
                            <div className="opp-detail-summary-text">
                                "{opp.summary}"
                            </div>
                        </div>
                    )}

                    {/* Inline Curator Management Strip: Edit Details & Re-extract below summary */}
                    {isAuthenticated && (
                        <div className="opp-detail-curator-inline-bar">
                            <button
                                type="button"
                                className="opp-curator-inline-btn"
                                onClick={() => {
                                    onClose();
                                    onEdit(opp);
                                }}
                            >
                                ✏️ Edit Details
                            </button>

                            <button
                                type="button"
                                className="opp-curator-inline-btn"
                                onClick={handleReExtractClick}
                                disabled={isReExtracting}
                            >
                                {isReExtracting ? '⏳ Re-extracting...' : '🔄 Re-extract (AI)'}
                            </button>
                        </div>
                    )}

                    {/* Notes */}
                    {opp.notes && (
                        <div className="opp-meta-block">
                            <span className="opp-meta-label">Personal Notes</span>
                            <div className="opp-meta-val" style={{ background: '#fff', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--opp-line)' }}>
                                {opp.notes}
                            </div>
                        </div>
                    )}
                </div>

                {/* Modal Footer Actions: Source Link + Add to Calendar on left, Delete Opportunity on right */}
                <div className="opp-detail-footer">
                    <div className="opp-detail-tools-row">
                        <div className="opp-detail-tools-left">
                            {(opp.source_url || opp.application_url) && (
                                <a
                                    href={opp.source_url || opp.application_url || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="opp-btn opp-btn-primary opp-btn-sm opp-source-link-btn"
                                    title="Open original opportunity page"
                                >
                                    🔗 Source Link ↗
                                </a>
                            )}

                            {opp.application_url && opp.application_url !== opp.source_url && (
                                <a
                                    href={opp.application_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="opp-btn opp-btn-secondary opp-btn-sm"
                                    title="Open direct application page"
                                >
                                    Apply ↗
                                </a>
                            )}

                            {currentDeadline && (
                                <a
                                    href={generateGoogleCalendarUrl({ ...opp, deadline_at: currentDeadline }, 'deadline')}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="opp-btn opp-btn-secondary opp-btn-sm opp-add-calendar-btn"
                                    title="Add deadline directly to Google Calendar"
                                >
                                    📅 Add to Calendar
                                </a>
                            )}
                        </div>

                        {isAuthenticated ? (
                            <button
                                type="button"
                                className="opp-delete-btn"
                                onClick={handleDeleteClick}
                                title="Delete this opportunity"
                            >
                                🗑️ Delete Opportunity
                            </button>
                        ) : (
                            <button
                                type="button"
                                className="opp-btn opp-btn-secondary opp-btn-sm"
                                onClick={onClose}
                            >
                                Close
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
