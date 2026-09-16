import React, { useState, useRef } from 'react';
import type { OpportunityCategory, OpportunityStatus } from '../../lib/opportunities/types';
import { formatLiveDatePreview } from '../../lib/opportunities/ui-helpers';

interface ManualCreateModalProps {
    isOpen: boolean;
    initialUrl?: string;
    onClose: () => void;
    onCreate: (data: any) => Promise<void>;
}

export const ManualCreateModal: React.FC<ManualCreateModalProps> = ({
    isOpen,
    initialUrl = '',
    onClose,
    onCreate,
}) => {
    if (!isOpen) return null;

    const deadlineInputRef = useRef<HTMLInputElement>(null);

    const [title, setTitle] = useState('');
    const [organisation, setOrganisation] = useState('');
    const [category, setCategory] = useState<OpportunityCategory>('grant');
    const [sourceUrl, setSourceUrl] = useState(initialUrl);
    const [status, setStatus] = useState<OpportunityStatus>('inbox');
    const [priority, setPriority] = useState<number>(2); // 1 = low, 2 = medium, 3 = high
    const [deadline, setDeadline] = useState('');
    const [timezone, setTimezone] = useState('');
    const [eventDate, setEventDate] = useState('');
    const [location, setLocation] = useState('');
    const [requirements, setRequirements] = useState('');
    const [nextAction, setNextAction] = useState('');
    const [applicationUrl, setApplicationUrl] = useState('');
    const [feeOrFunding, setFeeOrFunding] = useState('');
    const [summary, setSummary] = useState('');
    const [notes, setNotes] = useState('');
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
            await onCreate({
                title,
                organisation,
                category,
                source_url: sourceUrl || 'https://direct.entry',
                status,
                priority,
                deadline,
                timezone,
                event_date: eventDate,
                location,
                requirements: reqsArray,
                next_action: nextAction,
                application_url: applicationUrl,
                fee_or_funding: feeOrFunding,
                summary,
                notes,
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
                    <h2 className="opp-modal-title">+ Add Opportunity</h2>
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
                                        <label className="opp-form-label">Opportunity Title *</label>
                                        <input
                                            type="text"
                                            className="opp-form-input"
                                            placeholder="e.g. Arts Council Project Grant"
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                            required
                                            autoFocus
                                        />
                                    </div>

                                    <div className="opp-form-group">
                                        <label className="opp-form-label">Organisation / Host *</label>
                                        <input
                                            type="text"
                                            className="opp-form-input"
                                            placeholder="e.g. British Council"
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

                                    <div className="opp-form-group">
                                        <label className="opp-form-label">Priority</label>
                                        <select
                                            className="opp-form-select"
                                            value={priority}
                                            onChange={(e) => setPriority(Number(e.target.value))}
                                        >
                                            <option value={1}>★ Low Priority</option>
                                            <option value={2}>★★ Medium Priority</option>
                                            <option value={3}>★★★ High Priority</option>
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
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Card 2: Timeline & Deadlines */}
                            <div className="opp-form-card">
                                <div className="opp-form-card-title">📅 Timeline & Deadlines</div>

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
                                        <label className="opp-form-label">Timezone (Optional)</label>
                                        <input
                                            type="text"
                                            className="opp-form-input"
                                            placeholder="e.g. UTC, BST, EST, IST"
                                            value={timezone}
                                            onChange={(e) => setTimezone(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Card 3: Action, Links & Notes */}
                            <div className="opp-form-card">
                                <div className="opp-form-card-title">🎯 Action & Notes</div>

                                <div className="opp-form-grid-2">
                                    <div className="opp-form-group opp-form-col-span-full">
                                        <label className="opp-form-label">Immediate Next Action</label>
                                        <input
                                            type="text"
                                            className="opp-form-input"
                                            placeholder="e.g. Draft 500-word proposal"
                                            value={nextAction}
                                            onChange={(e) => setNextAction(e.target.value)}
                                        />
                                    </div>

                                    <div className="opp-form-group">
                                        <label className="opp-form-label">Application / Source URL</label>
                                        <input
                                            type="url"
                                            className="opp-form-input"
                                            placeholder="https://..."
                                            value={sourceUrl}
                                            onChange={(e) => setSourceUrl(e.target.value)}
                                        />
                                    </div>

                                    <div className="opp-form-group">
                                        <label className="opp-form-label">Funding / Award</label>
                                        <input
                                            type="text"
                                            className="opp-form-input"
                                            placeholder="e.g. £5,000 stipend"
                                            value={feeOrFunding}
                                            onChange={(e) => setFeeOrFunding(e.target.value)}
                                        />
                                    </div>

                                    <div className="opp-form-group opp-form-col-span-full">
                                        <label className="opp-form-label">Eligibility & Needs (comma separated)</label>
                                        <input
                                            type="text"
                                            className="opp-form-input"
                                            placeholder="e.g. Age 18–35, UK residents, Portfolio PDF"
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
