import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { OpportunityCategory, OpportunityStatus } from '../../lib/opportunities/types';
import { formatLiveDatePreview } from '../../lib/opportunities/ui-helpers';

type CreateInputMode = 'manual' | 'text' | 'file';

export interface OpportunityExtractionDraft {
    title?: string;
    organisation?: string;
    category?: OpportunityCategory;
    deadline?: string;
    timezone?: string;
    event_date?: string | null;
    location?: string;
    requirements?: string[];
    next_action?: string;
    application_url?: string;
    fee_or_funding?: string;
    application_fee?: string;
    summary?: string;
}

interface ManualCreateModalProps {
    isOpen: boolean;
    initialUrl?: string;
    onClose: () => void;
    onCreate: (data: Record<string, unknown>) => Promise<void>;
    onExtract: (input: { mode: 'text' | 'file'; text?: string; file?: File }) => Promise<OpportunityExtractionDraft>;
}

const MODE_INDEX: Record<CreateInputMode, number> = { manual: 0, text: 1, file: 2 };

const toLocalDateTimeInput = (value?: string | null) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return localDate.toISOString().slice(0, 16);
};

export const ManualCreateModal: React.FC<ManualCreateModalProps> = ({
    isOpen,
    initialUrl = '',
    onClose,
    onCreate,
    onExtract,
}) => {
    const detailsRef = useRef<HTMLDetailsElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dialogRef = useRef<HTMLDivElement>(null);
    const wasOpenRef = useRef(false);

    const [mode, setMode] = useState<CreateInputMode>('manual');
    const [title, setTitle] = useState('');
    const [organisation, setOrganisation] = useState('');
    const [category, setCategory] = useState<OpportunityCategory>('grant');
    const [sourceUrl, setSourceUrl] = useState(initialUrl);
    const [status, setStatus] = useState<OpportunityStatus>('reviewing');
    const [isHighPriority, setIsHighPriority] = useState(false);
    const [deadline, setDeadline] = useState('');
    const [timezone, setTimezone] = useState('');
    const [eventDate, setEventDate] = useState('');
    const [location, setLocation] = useState('');
    const [requirements, setRequirements] = useState('');
    const [nextAction, setNextAction] = useState('');
    const [applicationUrl, setApplicationUrl] = useState('');
    const [funding, setFunding] = useState('');
    const [applicationFee, setApplicationFee] = useState('');
    const [summary, setSummary] = useState('');
    const [notes, setNotes] = useState('');
    const [pastedText, setPastedText] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingLabel, setProcessingLabel] = useState('');
    const [formError, setFormError] = useState('');
    const [extractionNotice, setExtractionNotice] = useState('');

    const resetForm = (nextInitialUrl: string) => {
        setMode('manual');
        setTitle('');
        setOrganisation('');
        setCategory('grant');
        setSourceUrl(nextInitialUrl);
        setStatus('reviewing');
        setIsHighPriority(false);
        setDeadline('');
        setTimezone('');
        setEventDate('');
        setLocation('');
        setRequirements('');
        setNextAction('');
        setApplicationUrl('');
        setFunding('');
        setApplicationFee('');
        setSummary('');
        setNotes('');
        setPastedText('');
        setSelectedFile(null);
        setFormError('');
        setExtractionNotice('');
    };

    useEffect(() => {
        if (isOpen && !wasOpenRef.current) resetForm(initialUrl);
        wasOpenRef.current = isOpen;
    }, [initialUrl, isOpen]);

    const deadlinePreview = formatLiveDatePreview(deadline);
    const eventDatePreview = formatLiveDatePreview(eventDate);
    const isBusy = isSaving || isProcessing;

    useEffect(() => {
        if (!isOpen) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleDialogKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !isBusy) {
                event.preventDefault();
                onClose();
                return;
            }

            if (event.key !== 'Tab' || !dialogRef.current) return;
            const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
                'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [href], [tabindex]:not([tabindex="-1"])',
            )).filter((element) => element.offsetParent !== null);
            if (focusable.length === 0) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', handleDialogKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleDialogKeyDown);
        };
    }, [isBusy, isOpen, onClose]);

    const chooseMode = (nextMode: CreateInputMode) => {
        if (isBusy) return;
        setMode(nextMode);
        setFormError('');
        setExtractionNotice('');
    };

    const applyExtraction = (draft: OpportunityExtractionDraft) => {
        setTitle(draft.title || '');
        setOrganisation(draft.organisation || '');
        setCategory(draft.category || 'other');
        setDeadline(draft.deadline || '');
        setTimezone(draft.timezone || '');
        setEventDate(toLocalDateTimeInput(draft.event_date));
        setLocation(draft.location || '');
        setRequirements((draft.requirements || []).join('\n'));
        setNextAction(draft.next_action || '');
        setApplicationUrl(draft.application_url || '');
        setFunding(draft.fee_or_funding || '');
        setApplicationFee(draft.application_fee || '');
        setSummary(draft.summary || '');
        setMode('manual');
        setExtractionNotice('Details added. Please review them before saving.');
        window.requestAnimationFrame(() => {
            if (detailsRef.current) detailsRef.current.open = true;
        });
    };

    const analyzeInput = async () => {
        if (mode === 'manual') return;
        if (mode === 'text' && pastedText.trim().length < 50) {
            setFormError('Paste a little more opportunity text before analysing it.');
            return;
        }
        if (mode === 'file' && !selectedFile) {
            setFormError('Choose a PDF, image, or text file first.');
            return;
        }

        setIsProcessing(true);
        setFormError('');
        setProcessingLabel(mode === 'file' ? 'Reading the uploaded file…' : 'Reading the pasted text…');
        const stageTimer = window.setTimeout(() => setProcessingLabel('Extracting the opportunity details…'), 700);

        try {
            const draft = await onExtract({
                mode,
                text: mode === 'text' ? pastedText : undefined,
                file: mode === 'file' ? selectedFile || undefined : undefined,
            });
            applyExtraction(draft);
        } catch (error) {
            setFormError(error instanceof Error ? error.message : 'The details could not be extracted.');
        } finally {
            window.clearTimeout(stageTimer);
            setIsProcessing(false);
            setProcessingLabel('');
        }
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (mode !== 'manual') {
            await analyzeInput();
            return;
        }

        setIsSaving(true);
        setFormError('');
        try {
            const reqsArray = requirements.split(/\n|,\s*/).map((value) => value.trim()).filter(Boolean);
            await onCreate({
                title,
                organisation,
                category,
                source_url: sourceUrl || 'https://direct.entry',
                status,
                is_high_priority: isHighPriority,
                deadline,
                timezone,
                event_date: eventDate,
                location,
                requirements: reqsArray,
                next_action: nextAction,
                application_url: applicationUrl,
                fee_or_funding: funding,
                application_fee: applicationFee,
                summary,
                notes,
            });
            onClose();
        } catch (error) {
            setFormError(error instanceof Error ? error.message : 'The opportunity could not be saved.');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div
            className="opp-modal-overlay"
            role="presentation"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget && !isBusy) onClose();
            }}
        >
            <div ref={dialogRef} className="opp-modal opp-create-modal" role="dialog" aria-modal="true" aria-labelledby="opp-create-title">
                <div className="opp-modal-header opp-create-modal-header">
                    <div>
                        <span className="opp-create-kicker">Opportunity tracker</span>
                        <h2 id="opp-create-title" className="opp-modal-title">Add Opportunity</h2>
                    </div>
                    <button type="button" className="opp-create-close" onClick={onClose} disabled={isBusy} aria-label="Close add opportunity">
                        <span aria-hidden="true">×</span>
                    </button>
                </div>

                <form className="opp-create-form" onSubmit={handleSubmit}>
                    <fieldset
                        className="opp-create-mode-switch"
                        style={{ '--opp-create-mode-index': MODE_INDEX[mode] } as React.CSSProperties}
                        disabled={isBusy}
                    >
                        <legend className="sr-only">How would you like to add this opportunity?</legend>
                        {([
                            { id: 'manual', label: 'Add manually' },
                            { id: 'text', label: 'Paste text' },
                            { id: 'file', label: 'PDF / image' },
                        ] as const).map((option) => (
                            <React.Fragment key={option.id}>
                                <input className="sr-only" type="radio" id={`opp-create-mode-${option.id}`} name="create-mode" value={option.id} checked={mode === option.id} onChange={() => chooseMode(option.id)} />
                                <label htmlFor={`opp-create-mode-${option.id}`}>{option.label}</label>
                            </React.Fragment>
                        ))}
                    </fieldset>

                    <div className="opp-modal-body opp-create-modal-body">
                        {mode === 'text' && (
                            <section className="opp-create-source-panel" aria-labelledby="opp-paste-text-title">
                                <div className="opp-create-source-heading">
                                    <span>01</span>
                                    <div>
                                        <h3 id="opp-paste-text-title">Paste opportunity text</h3>
                                        <p>Copy the listing, call text, or email. The tracker will organise it into the form.</p>
                                    </div>
                                </div>
                                <label className="opp-form-label" htmlFor="opp-create-pasted-text">Opportunity text</label>
                                <textarea id="opp-create-pasted-text" name="opportunity_text" className="opp-form-textarea opp-create-paste-area" value={pastedText} onChange={(event) => { setPastedText(event.target.value); setFormError(''); }} placeholder="Paste the full opportunity description here…" autoFocus required />
                                <span className="opp-create-input-note">At least 50 characters. Nothing is saved until you review the extracted details.</span>
                            </section>
                        )}

                        {mode === 'file' && (
                            <section className="opp-create-source-panel" aria-labelledby="opp-upload-title">
                                <div className="opp-create-source-heading">
                                    <span>01</span>
                                    <div>
                                        <h3 id="opp-upload-title">Upload PDF, image, or text</h3>
                                        <p>PDF text is read from the first six pages. JPG, PNG, and WebP screenshots use AI vision.</p>
                                    </div>
                                </div>
                                <input ref={fileInputRef} id="opp-create-file" name="opportunity_file" className="sr-only" type="file" accept="application/pdf,text/plain,text/markdown,image/jpeg,image/png,image/webp,.pdf,.txt,.md,.jpg,.jpeg,.png,.webp" onChange={(event) => { setSelectedFile(event.target.files?.[0] || null); setFormError(''); }} />
                                <label className="opp-create-file-picker" htmlFor="opp-create-file">
                                    <span className="opp-create-file-mark" aria-hidden="true">↥</span>
                                    <span>
                                        <strong>{selectedFile ? selectedFile.name : 'Choose a file'}</strong>
                                        <small>{selectedFile ? `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB selected` : 'PDF, TXT, JPG, PNG or WebP · maximum 10 MB'}</small>
                                    </span>
                                </label>
                                {selectedFile && <button type="button" className="opp-create-remove-file" onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}>Remove file</button>}
                            </section>
                        )}

                        {mode === 'manual' && (
                            <div className="opp-form-sections-wrap">
                                {extractionNotice && <div className="opp-create-success" role="status"><span aria-hidden="true">✓</span>{extractionNotice}</div>}

                                <section className="opp-form-card opp-create-core" aria-labelledby="opp-core-details-title">
                                    <div className="opp-create-section-heading">
                                        <span>01</span>
                                        <div><h3 id="opp-core-details-title">Core details</h3><p>Start with the information needed to recognise and track it.</p></div>
                                    </div>
                                    <div className="opp-form-grid-2">
                                        <div className="opp-form-group opp-form-col-span-full">
                                            <label className="opp-form-label" htmlFor="opp-create-opportunity-title">Opportunity title *</label>
                                            <input id="opp-create-opportunity-title" name="title" type="text" className="opp-form-input" placeholder="e.g. Arts Council Project Grant" value={title} onChange={(event) => setTitle(event.target.value)} required autoFocus />
                                        </div>
                                        <div className="opp-form-group">
                                            <label className="opp-form-label" htmlFor="opp-create-organisation">Organisation / host *</label>
                                            <input id="opp-create-organisation" name="organisation" type="text" className="opp-form-input" placeholder="e.g. British Council" value={organisation} onChange={(event) => setOrganisation(event.target.value)} required />
                                        </div>
                                        <div className="opp-form-group">
                                            <label className="opp-form-label" htmlFor="opp-create-category">Category</label>
                                            <select id="opp-create-category" name="category" className="opp-form-select" value={category} onChange={(event) => setCategory(event.target.value as OpportunityCategory)}>
                                                <option value="grant">Grant</option><option value="residency">Residency</option><option value="fellowship">Fellowship</option><option value="open_call">Open Call</option><option value="job">Job</option><option value="conference">Conference</option><option value="event">Event</option><option value="other">Other</option>
                                            </select>
                                        </div>
                                        <div className="opp-form-group opp-form-col-span-full">
                                            <label className="opp-form-label" htmlFor="opp-create-deadline">Deadline date</label>
                                            <input id="opp-create-deadline" name="deadline" type="date" className="opp-form-input" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
                                            {deadlinePreview && <span className="opp-date-live-preview">{deadlinePreview}</span>}
                                        </div>
                                    </div>
                                </section>

                                <details ref={detailsRef} className="opp-create-details">
                                    <summary>
                                        <span className="opp-create-details-icon" aria-hidden="true">+</span>
                                        <span><strong>More details</strong><small>Dates, location, funding, links, requirements and notes</small></span>
                                    </summary>
                                    <div className="opp-create-details-content">
                                        <section className="opp-create-detail-section" aria-labelledby="opp-schedule-title">
                                            <div className="opp-create-section-heading"><span>02</span><h3 id="opp-schedule-title">Schedule &amp; place</h3></div>
                                            <div className="opp-form-grid-2">
                                                <div className="opp-form-group"><label className="opp-form-label" htmlFor="opp-create-timezone">Time zone</label><input id="opp-create-timezone" name="timezone" type="text" className="opp-form-input" placeholder="e.g. Europe/London" value={timezone} onChange={(event) => setTimezone(event.target.value)} /></div>
                                                <div className="opp-form-group"><label className="opp-form-label" htmlFor="opp-create-location">Location</label><input id="opp-create-location" name="location" type="text" className="opp-form-input" placeholder="e.g. Online or Cambridge, UK" value={location} onChange={(event) => setLocation(event.target.value)} /></div>
                                                <div className="opp-form-group opp-form-col-span-full"><label className="opp-form-label" htmlFor="opp-create-event-date">Event date &amp; time</label><input id="opp-create-event-date" name="event_date" type="datetime-local" className="opp-form-input" value={eventDate} onChange={(event) => setEventDate(event.target.value)} />{eventDatePreview && <span className="opp-date-live-preview">{eventDatePreview}</span>}</div>
                                            </div>
                                        </section>

                                        <section className="opp-create-detail-section" aria-labelledby="opp-financial-title">
                                            <div className="opp-create-section-heading"><span>03</span><h3 id="opp-financial-title">Funding &amp; fees</h3></div>
                                            <div className="opp-create-financial-grid">
                                                <div className="opp-form-group"><label className="opp-form-label" htmlFor="opp-create-funding">Funding / award</label><input id="opp-create-funding" name="fee_or_funding" type="text" className="opp-form-input" placeholder="e.g. £5,000 award" value={funding} onChange={(event) => setFunding(event.target.value)} /></div>
                                                <div className="opp-form-group"><label className="opp-form-label" htmlFor="opp-create-fee">Application fee</label><input id="opp-create-fee" name="application_fee" type="text" className="opp-form-input" placeholder="e.g. £15 / No fee" value={applicationFee} onChange={(event) => setApplicationFee(event.target.value)} /></div>
                                            </div>
                                        </section>

                                        <section className="opp-create-detail-section" aria-labelledby="opp-source-title">
                                            <div className="opp-create-section-heading"><span>04</span><h3 id="opp-source-title">Application source</h3></div>
                                            <div className="opp-form-grid-2">
                                                <div className="opp-form-group"><label className="opp-form-label" htmlFor="opp-create-source-url">Official source URL</label><input id="opp-create-source-url" name="source_url" type="url" inputMode="url" className="opp-form-input" placeholder="https://…" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} autoCapitalize="off" autoCorrect="off" spellCheck={false} /></div>
                                                <div className="opp-form-group"><label className="opp-form-label" htmlFor="opp-create-application-url">Application URL</label><input id="opp-create-application-url" name="application_url" type="url" inputMode="url" className="opp-form-input" placeholder="https://…" value={applicationUrl} onChange={(event) => setApplicationUrl(event.target.value)} autoCapitalize="off" autoCorrect="off" spellCheck={false} /></div>
                                            </div>
                                        </section>

                                        <section className="opp-create-detail-section" aria-labelledby="opp-planning-title">
                                            <div className="opp-create-section-heading"><span>05</span><h3 id="opp-planning-title">Planning notes</h3></div>
                                            <div className="opp-form-grid-2">
                                                <div className="opp-form-group opp-form-col-span-full"><label className="opp-form-label" htmlFor="opp-create-next-action">Immediate next action</label><input id="opp-create-next-action" name="next_action" type="text" className="opp-form-input" placeholder="e.g. Draft 500-word proposal" value={nextAction} onChange={(event) => setNextAction(event.target.value)} /></div>
                                                <div className="opp-form-group opp-form-col-span-full"><label className="opp-form-label" htmlFor="opp-create-requirements">Requirements</label><textarea id="opp-create-requirements" name="requirements" className="opp-form-textarea" placeholder="One requirement per line" value={requirements} onChange={(event) => setRequirements(event.target.value)} /></div>
                                                <div className="opp-form-group"><label className="opp-form-label" htmlFor="opp-create-summary">Summary</label><textarea id="opp-create-summary" name="summary" className="opp-form-textarea" placeholder="Short description of the opportunity…" value={summary} onChange={(event) => setSummary(event.target.value)} /></div>
                                                <div className="opp-form-group"><label className="opp-form-label" htmlFor="opp-create-notes">Personal notes</label><textarea id="opp-create-notes" name="notes" className="opp-form-textarea" placeholder="Ideas, pitch angles, collaborators…" value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
                                                <div className="opp-form-group"><label className="opp-form-label" htmlFor="opp-create-status">Status</label><select id="opp-create-status" name="status" className="opp-form-select" value={status} onChange={(event) => setStatus(event.target.value as OpportunityStatus)}><option value="reviewing">Reviewing</option><option value="applied">Applied</option></select></div>
                                                <div className="opp-form-group"><span className="opp-form-label">Priority</span><label className="opp-popover-checkbox"><input type="checkbox" checked={isHighPriority} onChange={(event) => setIsHighPriority(event.target.checked)} /><span>High priority</span></label></div>
                                            </div>
                                        </section>
                                    </div>
                                </details>
                            </div>
                        )}

                        {isProcessing && <div className="opp-create-processing" role="status" aria-live="polite"><span className="opp-create-processing-mark" aria-hidden="true" /><div><strong>It’s processing now.</strong><span>{processingLabel}</span></div></div>}
                        {formError && <p className="opp-create-error" role="alert">{formError}</p>}
                    </div>

                    <div className="opp-modal-footer opp-create-modal-footer">
                        <button type="button" className="opp-btn opp-btn-secondary" onClick={onClose} disabled={isBusy}>Cancel</button>
                        <button type="submit" className="opp-btn opp-btn-save" disabled={isBusy}>{isProcessing ? 'Processing…' : isSaving ? 'Saving…' : 'Save Opportunity'}</button>
                    </div>
                </form>
            </div>
        </div>,
        document.body,
    );
};
