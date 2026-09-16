import React, { useState } from 'react';
import type { Opportunity, OpportunityCategory, OpportunityStatus, OpportunityOutcome } from '../../lib/opportunities/types';

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

    const [title, setTitle] = useState(opp.title);
    const [organisation, setOrganisation] = useState(opp.organisation);
    const [category, setCategory] = useState<OpportunityCategory>(opp.category);
    const [status, setStatus] = useState<OpportunityStatus>(opp.status);
    const [outcome, setOutcome] = useState<OpportunityOutcome>(opp.outcome);
    const [deadline, setDeadline] = useState(opp.deadline_raw || (opp.deadline_at ? opp.deadline_at.slice(0, 16) : ''));
    const [timezone, setTimezone] = useState(opp.deadline_timezone || '');
    const [eventDate, setEventDate] = useState(opp.event_date ? opp.event_date.slice(0, 16) : '');
    const [location, setLocation] = useState(opp.location || '');
    const [requirements, setRequirements] = useState(opp.requirements?.join(', ') || '');
    const [nextAction, setNextAction] = useState(opp.next_action || '');
    const [applicationUrl, setApplicationUrl] = useState(opp.application_url || '');
    const [meetingUrl, setMeetingUrl] = useState(opp.meeting_url || '');
    const [feeOrFunding, setFeeOrFunding] = useState(opp.fee_or_funding || '');
    const [summary, setSummary] = useState(opp.summary || '');
    const [notes, setNotes] = useState(opp.notes || '');
    const [isSaving, setIsSaving] = useState(false);

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
                        {/* Row 1: Title & Org */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
                            <div className="opp-form-group">
                                <label className="opp-form-label">Title</label>
                                <input
                                    type="text"
                                    className="opp-form-input"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="opp-form-group">
                                <label className="opp-form-label">Organisation</label>
                                <input
                                    type="text"
                                    className="opp-form-input"
                                    value={organisation}
                                    onChange={(e) => setOrganisation(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        {/* Row 2: Category, Status & Outcome */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                            <div className="opp-form-group">
                                <label className="opp-form-label">Category</label>
                                <select
                                    className="opp-form-select"
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value as OpportunityCategory)}
                                >
                                    <option value="job">Job</option>
                                    <option value="open_call">Open Call</option>
                                    <option value="residency">Residency</option>
                                    <option value="grant">Grant</option>
                                    <option value="fellowship">Fellowship</option>
                                    <option value="conference">Conference</option>
                                    <option value="event">Event</option>
                                    <option value="other">Other</option>
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

                        {/* Row 3: Deadline, Timezone & Funding */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1fr', gap: '10px' }}>
                            <div className="opp-form-group">
                                <label className="opp-form-label">Deadline (Date or Text)</label>
                                <input
                                    type="text"
                                    className="opp-form-input"
                                    placeholder="e.g. 2026-10-15 or Rolling"
                                    value={deadline}
                                    onChange={(e) => setDeadline(e.target.value)}
                                />
                            </div>

                            <div className="opp-form-group">
                                <label className="opp-form-label">Timezone</label>
                                <input
                                    type="text"
                                    className="opp-form-input"
                                    placeholder="e.g. UTC, EST, GMT"
                                    value={timezone}
                                    onChange={(e) => setTimezone(e.target.value)}
                                />
                            </div>

                            <div className="opp-form-group">
                                <label className="opp-form-label">Fee / Funding</label>
                                <input
                                    type="text"
                                    className="opp-form-input"
                                    value={feeOrFunding}
                                    onChange={(e) => setFeeOrFunding(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Row 4: Next Action & Requirements */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '10px' }}>
                            <div className="opp-form-group">
                                <label className="opp-form-label">Next Action</label>
                                <input
                                    type="text"
                                    className="opp-form-input"
                                    value={nextAction}
                                    onChange={(e) => setNextAction(e.target.value)}
                                />
                            </div>

                            <div className="opp-form-group">
                                <label className="opp-form-label">Requirements (Comma-separated)</label>
                                <input
                                    type="text"
                                    className="opp-form-input"
                                    value={requirements}
                                    onChange={(e) => setRequirements(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Row 5: Application URL & Meeting URL */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div className="opp-form-group">
                                <label className="opp-form-label">Application URL</label>
                                <input
                                    type="url"
                                    className="opp-form-input"
                                    value={applicationUrl}
                                    onChange={(e) => setApplicationUrl(e.target.value)}
                                />
                            </div>

                            <div className="opp-form-group">
                                <label className="opp-form-label">Meeting URL</label>
                                <input
                                    type="url"
                                    className="opp-form-input"
                                    value={meetingUrl}
                                    onChange={(e) => setMeetingUrl(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Row 6: Summary & Notes */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div className="opp-form-group" style={{ marginBottom: 0 }}>
                                <label className="opp-form-label">Summary (Max 25 Words)</label>
                                <textarea
                                    className="opp-form-textarea"
                                    value={summary}
                                    onChange={(e) => setSummary(e.target.value)}
                                />
                            </div>

                            <div className="opp-form-group" style={{ marginBottom: 0 }}>
                                <label className="opp-form-label">Personal Notes</label>
                                <textarea
                                    className="opp-form-textarea"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="opp-modal-footer">
                        <button type="button" className="opp-btn opp-btn-secondary opp-btn-sm" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="opp-btn opp-btn-primary opp-btn-sm" disabled={isSaving}>
                            {isSaving ? 'Saving...' : 'Save Changes (0 AI Calls)'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
