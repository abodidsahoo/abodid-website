import React, { useState } from 'react';
import type { OpportunityCategory, OpportunityStatus } from '../../lib/opportunities/types';

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

    const [title, setTitle] = useState('');
    const [organisation, setOrganisation] = useState('');
    const [category, setCategory] = useState<OpportunityCategory>('job');
    const [sourceUrl, setSourceUrl] = useState(initialUrl);
    const [status, setStatus] = useState<OpportunityStatus>('inbox');
    const [deadline, setDeadline] = useState('');
    const [timezone, setTimezone] = useState('');
    const [nextAction, setNextAction] = useState('');
    const [requirements, setRequirements] = useState('');
    const [applicationUrl, setApplicationUrl] = useState('');
    const [meetingUrl, setMeetingUrl] = useState('');
    const [feeOrFunding, setFeeOrFunding] = useState('');
    const [summary, setSummary] = useState('');
    const [notes, setNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const reqsArray = requirements.split(',').map(s => s.trim()).filter(Boolean);
            await onCreate({
                title,
                organisation,
                category,
                source_url: sourceUrl,
                status,
                deadline,
                timezone,
                requirements: reqsArray,
                next_action: nextAction,
                application_url: applicationUrl,
                meeting_url: meetingUrl,
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
                    <h2 className="opp-modal-title">+ Add Opportunity (Manual Entry)</h2>
                    <button type="button" className="opp-btn opp-btn-secondary opp-btn-sm" onClick={onClose}>
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                    <div className="opp-modal-body">
                        {/* Row 1: Title & Org */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
                            <div className="opp-form-group">
                                <label className="opp-form-label">Opportunity Title *</label>
                                <input
                                    type="text"
                                    className="opp-form-input"
                                    placeholder="e.g. Senior Creative Technologist"
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
                                    placeholder="e.g. Studio Drift"
                                    value={organisation}
                                    onChange={(e) => setOrganisation(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        {/* Row 2: Source URL, Category & Status */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: '10px' }}>
                            <div className="opp-form-group">
                                <label className="opp-form-label">Source URL *</label>
                                <input
                                    type="url"
                                    className="opp-form-input"
                                    placeholder="https://..."
                                    value={sourceUrl}
                                    onChange={(e) => setSourceUrl(e.target.value)}
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
                                <label className="opp-form-label">Initial Status</label>
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
                                    placeholder="YYYY-MM-DD or Rolling"
                                    value={deadline}
                                    onChange={(e) => setDeadline(e.target.value)}
                                />
                            </div>

                            <div className="opp-form-group">
                                <label className="opp-form-label">Timezone</label>
                                <input
                                    type="text"
                                    className="opp-form-input"
                                    placeholder="UTC / EST / GMT"
                                    value={timezone}
                                    onChange={(e) => setTimezone(e.target.value)}
                                />
                            </div>

                            <div className="opp-form-group">
                                <label className="opp-form-label">Fee / Funding</label>
                                <input
                                    type="text"
                                    className="opp-form-input"
                                    placeholder="e.g. £5,000 stipend"
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
                                    placeholder="e.g. Prepare portfolio PDF"
                                    value={nextAction}
                                    onChange={(e) => setNextAction(e.target.value)}
                                />
                            </div>

                            <div className="opp-form-group">
                                <label className="opp-form-label">Requirements (Comma-separated)</label>
                                <input
                                    type="text"
                                    className="opp-form-input"
                                    placeholder="CV, 10 Images, 300-word proposal"
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
                                    placeholder="https://..."
                                    value={applicationUrl}
                                    onChange={(e) => setApplicationUrl(e.target.value)}
                                />
                            </div>

                            <div className="opp-form-group">
                                <label className="opp-form-label">Meeting URL</label>
                                <input
                                    type="url"
                                    className="opp-form-input"
                                    placeholder="Zoom / Teams / Meet URL"
                                    value={meetingUrl}
                                    onChange={(e) => setMeetingUrl(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Row 6: Summary */}
                        <div className="opp-form-group" style={{ marginBottom: 0 }}>
                            <label className="opp-form-label">Summary</label>
                            <textarea
                                className="opp-form-textarea"
                                placeholder="Short overview..."
                                value={summary}
                                onChange={(e) => setSummary(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="opp-modal-footer">
                        <button type="button" className="opp-btn opp-btn-secondary opp-btn-sm" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="opp-btn opp-btn-primary opp-btn-sm" disabled={isSaving}>
                            {isSaving ? 'Creating...' : '+ Create Opportunity (0 AI Calls)'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
