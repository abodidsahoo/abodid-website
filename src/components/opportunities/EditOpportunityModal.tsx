import React, { useState, useRef } from 'react';
import type { Opportunity, OpportunityCategory, OpportunityStatus, OpportunityOutcome } from '../../lib/opportunities/types';
import { formatLiveDatePreview } from '../../lib/opportunities/ui-helpers';

interface EditOpportunityModalProps {
    opportunity: Opportunity;
    isOpen: boolean;
    onClose: () => void;
    onSave: (id: string, updates: Partial<Opportunity>) => Promise<void>;
}

export const EditOpportunityModal: React.FC<EditOpportunityModalProps> = ({
    opportunity: opp,
    isOpen,
    onClose,
    onSave,
}) => {
    if (!isOpen) return null;

    const deadlineInputRef = useRef<HTMLInputElement>(null);

    const [title, setTitle] = useState(opp.title);
    const [organisation, setOrganisation] = useState(opp.organisation);
    const [category, setCategory] = useState<OpportunityCategory>(opp.category);
    const [status, setStatus] = useState<OpportunityStatus>(opp.status);
    const [priority, setPriority] = useState<number>(opp.priority || 1);
    const [outcome, setOutcome] = useState<OpportunityOutcome>(opp.outcome);
    const [deadline, setDeadline] = useState(
        opp.deadline_at ? new Date(opp.deadline_at).toISOString().slice(0, 10) : (opp.deadline_raw || '')
    );
    const [timezone, setTimezone] = useState(opp.deadline_timezone || '');
    const [eventDate, setEventDate] = useState(
        opp.event_date ? new Date(opp.event_date).toISOString().slice(0, 16) : ''
    );
    const [location, setLocation] = useState(opp.location || '');
    const [requirements, setRequirements] = useState(opp.requirements?.join(', ') || '');
    const [nextAction, setNextAction] = useState(opp.next_action || '');
    const [applicationUrl, setApplicationUrl] = useState(opp.application_url || '');
    const [meetingUrl, setMeetingUrl] = useState(opp.meeting_url || '');
    const [feeOrFunding, setFeeOrFunding] = useState(opp.fee_or_funding || '');
    const [summary, setSummary] = useState(opp.summary || '');
    const [notes, setNotes] = useState(opp.notes || '');
    const [isSaving, setIsSaving] = useState(false);

    const deadlinePreview = formatLiveDatePreview(deadline);
    const eventDatePreview = formatLiveDatePreview(eventDate);

    const openDatePicker = () => {
        if (deadlineInputRef.current) {
            if ('showPicker' in HTMLInputElement.prototype) {
                try {
                    deadlineInputRef.current.showPicker();
                    return;
                } catch {}
            }
            deadlineInputRef.current.focus();
            deadlineInputRef.current.click();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const reqsArray = requirements.split(',').map(s => s.trim()).filter(Boolean);
            await onSave(opp.id, {
                title,
                organisation,
                category,
                status,
                priority,
                outcome,
                deadline_raw: deadline,
                deadline_timezone: timezone || null,
                deadline_at: deadline ? new Date(deadline).toISOString() : null,
                event_date: eventDate ? new Date(eventDate).toISOString() : null,
                location: location || null,
                requirements: reqsArray,
                next_action: nextAction || null,
                application_url: applicationUrl || null,
                meeting_url: meetingUrl || null,
                fee_or_funding: feeOrFunding || null,
                summary: summary || null,
                notes: notes || null,
            });
            onClose();
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="opp-modal-overlay" onClick={onClose}>
            <div className="opp-modal" onClick={(e) => e.stopPropagation()}>
                <div className="opp-modal-header">
                    <h2 className="opp-modal-title">Edit Opportunity</h2>
                    <button type="button" className="opp-btn opp-btn-secondary opp-btn-sm" onClick={onClose}>
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                    <div className="opp-modal-body">
                        <div className="opp-form-sections-wrap">
                            {/* Card 1: Core Details */}
                            <div className="opp-form-card">
                                <div className="opp-form-card-title">📌 Core Details</div>
                                
                                <div className="opp-form-grid-2">
                                    <div className="opp-form-group opp-form-col-span-full">
                                        <label className="opp-form-label">Title *</label>
                                        <input
                                            type="text"
                                            className="opp-form-input"
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                            required
                                        />
                                    </div>

                                    <div className="opp-form-group">
                                        <label className="opp-form-label">Organisation *</label>
                                        <input
                                            type="text"
                                            className="opp-form-input"
                                            value={organisation}
                                            onChange={(e) => setOrganisation(e.target.value)}
                                            required
                                        />
                                    </div>

                                    <div className="opp-form-group">
                                        <label className="opp-form-label">Category</label>
                                        <select
                                            className="opp-form-select"
                                            value={category}
                                            onChange={(e) => setCategory(e.target.value as OpportunityCategory)}
                                        >
                                            <option value="grant">Grant</option>
                                            <option value="residency">Residency</option>
                                            <option value="fellowship">Fellowship</option>
                                            <option value="open_call">Open Call</option>
                                            <option value="job">Job</option>
                                            <option value="conference">Conference</option>
                                            <option value="event">Event</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="opp-form-grid-3">
                                    <div className="opp-form-group">
                                        <label className="opp-form-label">Priority</label>
                                        <select
                                            className="opp-form-select"
                                            value={priority}
                                            onChange={(e) => setPriority(Number(e.target.value))}
                                        >
                                            <option value={1}>★ Low</option>
                                            <option value={2}>★★ Medium</option>
                                            <option value={3}>★★★ High</option>
                                        </select>
                                    </div>

                                    <div className="opp-form-group">
                                        <label className="opp-form-label">Workflow Status</label>
                                        <select
                                            className="opp-form-select"
                                            value={status}
                                            onChange={(e) => setStatus(e.target.value as OpportunityStatus)}
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
                                    </div>

                                    <div className="opp-form-group">
                                        <label className="opp-form-label">Outcome (Optional)</label>
                                        <select
                                            className="opp-form-select"
                                            value={outcome || ''}
                                            onChange={(e) => setOutcome(e.target.value as OpportunityOutcome)}
                                        >
                                            <option value="">(None)</option>
                                            <option value="accepted">Accepted</option>
                                            <option value="rejected">Rejected</option>
                                            <option value="attended">Attended</option>
                                            <option value="withdrawn">Withdrawn</option>
                                            <option value="expired">Expired</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Card 2: Timeline & Location */}
                            <div className="opp-form-card">
                                <div className="opp-form-card-title">📅 Timeline & Location</div>

                                <div className="opp-form-grid-2">
                                    <div className="opp-form-group">
                                        <label className="opp-form-label">Deadline Date</label>
                                        <div className="opp-form-date-row">
                                            <button
                                                type="button"
                                                className="opp-form-date-trigger-btn"
                                                onClick={openDatePicker}
                                                title="Click to pick or set deadline date"
                                            >
                                                <span className="opp-form-date-trigger-icon">📅</span>
                                                <span className="opp-form-date-trigger-val">
                                                    {deadline ? (
                                                        new Date(deadline + 'T12:00:00Z').toLocaleDateString('en-GB', {
                                                            weekday: 'short',
                                                            day: 'numeric',
                                                            month: 'short',
                                                            year: 'numeric',
                                                        })
                                                    ) : (
                                                        <span className="opp-date-empty-hint">Click to set date...</span>
                                                    )}
                                                </span>
                                                <span className="opp-form-date-trigger-action">Pick Date ✎</span>
                                            </button>

                                            <input
                                                ref={deadlineInputRef}
                                                type="date"
                                                className="opp-form-hidden-date-input"
                                                value={deadline}
                                                onChange={(e) => setDeadline(e.target.value)}
                                                tabIndex={-1}
                                                aria-hidden="true"
                                            />

                                            {deadline && (
                                                <button
                                                    type="button"
                                                    className="opp-form-date-clear-btn"
                                                    onClick={() => setDeadline('')}
                                                    title="Clear deadline date"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>

                                        {deadlinePreview && (
                                            <div className="opp-date-live-preview">
                                                ✨ {deadlinePreview}
                                            </div>
                                        )}
                                    </div>

                                    <div className="opp-form-group">
                                        <label className="opp-form-label">Timezone</label>
                                        <input
                                            type="text"
                                            className="opp-form-input"
                                            placeholder="e.g. UTC, BST, EST, IST"
                                            value={timezone}
                                            onChange={(e) => setTimezone(e.target.value)}
                                        />
                                    </div>

                                    <div className="opp-form-group">
                                        <label className="opp-form-label">Event Date (if applicable)</label>
                                        <input
                                            type="date"
                                            className="opp-form-input"
                                            value={eventDate}
                                            onChange={(e) => setEventDate(e.target.value)}
                                        />
                                        {eventDatePreview && (
                                            <div className="opp-date-live-preview">
                                                ✨ {eventDatePreview}
                                            </div>
                                        )}
                                    </div>

                                    <div className="opp-form-group">
                                        <label className="opp-form-label">Location / Region</label>
                                        <input
                                            type="text"
                                            className="opp-form-input"
                                            placeholder="e.g. London, UK / Online"
                                            value={location}
                                            onChange={(e) => setLocation(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Card 3: Action, Links & Requirements */}
                            <div className="opp-form-card">
                                <div className="opp-form-card-title">🎯 Action & Requirements</div>

                                <div className="opp-form-grid-2">
                                    <div className="opp-form-group opp-form-col-span-full">
                                        <label className="opp-form-label">Immediate Next Action</label>
                                        <input
                                            type="text"
                                            className="opp-form-input"
                                            placeholder="e.g. Submit artist statement"
                                            value={nextAction}
                                            onChange={(e) => setNextAction(e.target.value)}
                                        />
                                    </div>

                                    <div className="opp-form-group">
                                        <label className="opp-form-label">Application URL</label>
                                        <input
                                            type="url"
                                            className="opp-form-input"
                                            placeholder="https://..."
                                            value={applicationUrl}
                                            onChange={(e) => setApplicationUrl(e.target.value)}
                                        />
                                    </div>

                                    <div className="opp-form-group">
                                        <label className="opp-form-label">Fee / Funding</label>
                                        <input
                                            type="text"
                                            className="opp-form-input"
                                            placeholder="e.g. £10,000 / Free"
                                            value={feeOrFunding}
                                            onChange={(e) => setFeeOrFunding(e.target.value)}
                                        />
                                    </div>

                                    <div className="opp-form-group opp-form-col-span-full">
                                        <label className="opp-form-label">Requirements / Eligibility</label>
                                        <input
                                            type="text"
                                            className="opp-form-input"
                                            placeholder="Age 18–35, UK residents, Portfolio"
                                            value={requirements}
                                            onChange={(e) => setRequirements(e.target.value)}
                                        />
                                    </div>

                                    <div className="opp-form-group opp-form-col-span-full">
                                        <label className="opp-form-label">Personal Notes</label>
                                        <textarea
                                            className="opp-form-textarea"
                                            placeholder="Thoughts, pitch angles, collaborators..."
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="opp-modal-footer">
                        <button type="button" className="opp-btn opp-btn-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="opp-btn opp-btn-save" disabled={isSaving}>
                            {isSaving ? 'Saving...' : 'Save Opportunity'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
