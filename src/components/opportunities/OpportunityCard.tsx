import React, { useState } from 'react';
import type { Opportunity, OpportunityStatus } from '../../lib/opportunities/types';
import { generateGoogleCalendarUrl } from '../../lib/opportunities/calendar';

interface OpportunityCardProps {
    opportunity: Opportunity;
    onUpdateStatus: (id: string, status: OpportunityStatus) => Promise<void>;
    onEdit: (opp: Opportunity) => void;
    onReExtract: (id: string) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
}

export function formatUrgency(opp: Opportunity): { label: string; level: 'critical' | 'warning' | 'rolling' | 'expired' | 'neutral' } {
    if (opp.deadline_confidence === 'rolling') {
        return { label: 'Rolling', level: 'rolling' };
    }

    if (!opp.deadline_at) {
        if (opp.deadline_confidence === 'needs_verification') {
            return { label: opp.deadline_raw || 'Deadline needs verification', level: 'warning' };
        }
        return { label: 'Deadline unknown', level: 'neutral' };
    }

    const now = Date.now();
    const deadlineTime = new Date(opp.deadline_at).getTime();
    const diffMs = deadlineTime - now;

    if (diffMs < 0) {
        return { label: 'Expired', level: 'expired' };
    }

    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours <= 3) {
        const mins = Math.max(1, Math.floor(diffMs / (1000 * 60)));
        return { label: `${mins}m left`, level: 'critical' };
    }
    if (diffHours <= 24) {
        return { label: 'Today', level: 'critical' };
    }
    if (diffDays === 1) {
        return { label: 'Tomorrow', level: 'critical' };
    }
    if (diffDays <= 3) {
        return { label: `${diffDays} days`, level: 'critical' };
    }
    if (diffDays <= 7) {
        return { label: `${diffDays} days`, level: 'warning' };
    }
    if (diffDays <= 30) {
        return { label: `${diffDays} days`, level: 'neutral' };
    }

    return { label: `${diffDays} days`, level: 'neutral' };
}

export const OpportunityCard: React.FC<OpportunityCardProps> = ({
    opportunity: opp,
    onUpdateStatus,
    onEdit,
    onReExtract,
    onDelete,
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isReExtracting, setIsReExtracting] = useState(false);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

    const urgency = formatUrgency(opp);
    const categoryClass = opp.category || 'other';

    const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newStatus = e.target.value as OpportunityStatus;
        setIsUpdatingStatus(true);
        try {
            await onUpdateStatus(opp.id, newStatus);
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const handleReExtractClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm(`Re-extract "${opp.title}" using OpenRouter? This makes 1 AI request.`)) {
            return;
        }
        setIsReExtracting(true);
        try {
            await onReExtract(opp.id);
        } finally {
            setIsReExtracting(false);
        }
    };

    const handleDeleteClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm(`Are you sure you want to delete "${opp.title}"?`)) {
            await onDelete(opp.id);
        }
    };

    const needsText = opp.requirements && opp.requirements.length > 0
        ? opp.requirements.join(' · ')
        : 'None specified';

    return (
        <div
            className={`opp-card ${urgency.level === 'critical' ? 'urgent' : ''}`}
            onClick={() => setIsExpanded(!isExpanded)}
            style={{ cursor: 'pointer' }}
        >
            {/* Top Bar: Category and Urgency */}
            <div className="opp-card-header">
                <span className={`opp-category-badge ${categoryClass}`}>
                    {opp.category.replace('_', ' ')}
                </span>
                <span className={`opp-deadline-pill ${urgency.level}`}>
                    {urgency.label}
                </span>
            </div>

            {/* Title & Organisation */}
            <div>
                <h3 className="opp-card-title">{opp.title}</h3>
                <div className="opp-card-org">{opp.organisation}</div>
            </div>

            {/* Next Action */}
            {opp.next_action && (
                <div className="opp-next-action-box" onClick={(e) => e.stopPropagation()}>
                    <div className="opp-next-action-label">Next Action</div>
                    <div className="opp-next-action-text">{opp.next_action}</div>
                </div>
            )}

            {/* Needs / Requirements line */}
            <div className="opp-needs-line">
                <span className="opp-needs-label">Needs:</span>
                {needsText}
            </div>

            {/* Collapsed Footer: Status & Primary Links */}
            <div className="opp-card-footer" onClick={(e) => e.stopPropagation()}>
                <select
                    className="opp-status-select"
                    value={opp.status}
                    disabled={isUpdatingStatus}
                    onChange={handleStatusChange}
                >
                    <option value="inbox">Inbox</option>
                    <option value="interested">Interested</option>
                    <option value="preparing">Preparing</option>
                    <option value="submitted">Submitted</option>
                    <option value="registered">Registered</option>
                    <option value="attending">Attending</option>
                    <option value="done">Done</option>
                    <option value="dismissed">Dismissed</option>
                </select>

                <div className="opp-card-links">
                    {opp.application_url && (
                        <a
                            href={opp.application_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="opp-card-link"
                            style={{ fontWeight: 800, color: 'var(--opp-purple)' }}
                        >
                            Application →
                        </a>
                    )}
                    <a
                        href={opp.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="opp-card-link"
                    >
                        Source →
                    </a>
                </div>
            </div>

            {/* Progressive Disclosure: Expanded Drawer */}
            {isExpanded && (
                <div className="opp-expanded-details" onClick={(e) => e.stopPropagation()}>
                    {/* Requirements Checklist */}
                    {opp.requirements && opp.requirements.length > 0 && (
                        <div className="opp-meta-row">
                            <span className="opp-meta-label">Full Requirements</span>
                            <ul className="opp-req-list">
                                {opp.requirements.map((req, i) => (
                                    <li key={i}>{req}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Deadline Details */}
                    <div className="opp-meta-row">
                        <span className="opp-meta-label">Exact Deadline & Timezone</span>
                        <div className="opp-meta-val">
                            {opp.deadline_at ? new Date(opp.deadline_at).toUTCString() : (opp.deadline_raw || 'Not specified')}
                            {opp.deadline_timezone ? ` (${opp.deadline_timezone})` : ''}
                        </div>
                    </div>

                    {/* Event / Meeting Info */}
                    {opp.event_date && (
                        <div className="opp-meta-row">
                            <span className="opp-meta-label">Event Date</span>
                            <div className="opp-meta-val">{new Date(opp.event_date).toUTCString()}</div>
                        </div>
                    )}

                    {opp.meeting_url && (
                        <div className="opp-meta-row">
                            <span className="opp-meta-label">Meeting URL</span>
                            <a href={opp.meeting_url} target="_blank" rel="noopener noreferrer" className="opp-card-link">
                                {opp.meeting_url}
                            </a>
                        </div>
                    )}

                    {/* Fee / Funding */}
                    {opp.fee_or_funding && (
                        <div className="opp-meta-row">
                            <span className="opp-meta-label">Fee / Funding</span>
                            <div className="opp-meta-val">{opp.fee_or_funding}</div>
                        </div>
                    )}

                    {/* Location */}
                    {opp.location && (
                        <div className="opp-meta-row">
                            <span className="opp-meta-label">Location</span>
                            <div className="opp-meta-val">{opp.location}</div>
                        </div>
                    )}

                    {/* Summary */}
                    {opp.summary && (
                        <div className="opp-meta-row">
                            <span className="opp-meta-label">Summary (Max 25 Words)</span>
                            <div className="opp-meta-val" style={{ fontStyle: 'italic', color: '#444' }}>
                                "{opp.summary}"
                            </div>
                        </div>
                    )}

                    {/* Notes */}
                    {opp.notes && (
                        <div className="opp-meta-row">
                            <span className="opp-meta-label">My Notes</span>
                            <div className="opp-meta-val">{opp.notes}</div>
                        </div>
                    )}

                    {/* Extraction Metadata */}
                    <div className="opp-meta-row" style={{ borderTop: '1px dashed var(--opp-line)', paddingTop: '8px' }}>
                        <span className="opp-meta-label">Extraction Metadata</span>
                        <div style={{ fontSize: '0.75rem', fontFamily: 'var(--opp-mono)', color: 'var(--opp-muted)' }}>
                            Model: {opp.llm_model || 'None'} · Calls: {opp.llm_extraction_count} · Extracted: {new Date(opp.extracted_at).toLocaleDateString()}
                        </div>
                    </div>

                    {/* Admin Action Buttons */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                        <button
                            type="button"
                            className="opp-btn opp-btn-secondary opp-btn-sm"
                            onClick={() => onEdit(opp)}
                        >
                            ✏️ Edit Details
                        </button>

                        <button
                            type="button"
                            className="opp-btn opp-btn-secondary opp-btn-sm"
                            onClick={handleReExtractClick}
                            disabled={isReExtracting}
                        >
                            {isReExtracting ? '⏳ Extracting...' : '🔄 Re-extract (AI)'}
                        </button>

                        {opp.deadline_at && (
                            <>
                                <a
                                    href={`/api/opportunities/${opp.id}/calendar?mode=deadline`}
                                    className="opp-btn opp-btn-secondary opp-btn-sm"
                                    download
                                >
                                    📅 .ICS Deadline
                                </a>
                                <a
                                    href={generateGoogleCalendarUrl(opp, 'deadline')}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="opp-btn opp-btn-secondary opp-btn-sm"
                                >
                                    + Google Cal
                                </a>
                            </>
                        )}

                        {opp.event_date && (
                            <a
                                href={`/api/opportunities/${opp.id}/calendar?mode=event`}
                                className="opp-btn opp-btn-secondary opp-btn-sm"
                                download
                            >
                                📅 .ICS Event
                            </a>
                        )}

                        <button
                            type="button"
                            className="opp-btn opp-btn-pink opp-btn-sm"
                            style={{ marginLeft: 'auto' }}
                            onClick={handleDeleteClick}
                        >
                            🗑️ Delete
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
