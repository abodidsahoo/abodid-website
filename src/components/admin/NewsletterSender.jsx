import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { personalizeNewsletterMessage } from '../../lib/newsletter/personalization.js';
import ImageUploader from './ImageUploader';
import './newsletter-sender.css';

export default function NewsletterSender() {
    const [subject, setSubject] = useState('');
    const [previewText, setPreviewText] = useState('');
    const [message, setMessage] = useState('');
    const [htmlFooter, setHtmlFooter] = useState('');
    const [status, setStatus] = useState('idle');
    const [statusMsg, setStatusMsg] = useState('');
    const [subscriberCount, setSubscriberCount] = useState(0);
    const [subscribers, setSubscribers] = useState([]);
    const [subscribersLoading, setSubscribersLoading] = useState(true);
    const [subscriberError, setSubscriberError] = useState('');
    const [subscriberSearch, setSubscriberSearch] = useState('');
    const [audienceMode, setAudienceMode] = useState('all');
    const [selectedSubscriberIds, setSelectedSubscriberIds] = useState([]);
    const [adminEmail, setAdminEmail] = useState('');
    const [previewMode, setPreviewMode] = useState('desktop');
    const [newSubscriber, setNewSubscriber] = useState('');
    const [addSubStatus, setAddSubStatus] = useState('');
    const [senderName, setSenderName] = useState('Abodid');
    const [senderEmail, setSenderEmail] = useState('newsletter@abodid.com');
    const [savedSenderEmails, setSavedSenderEmails] = useState(['newsletter@abodid.com']);
    const [isAddingEmail, setIsAddingEmail] = useState(false);
    const [tempNewEmail, setTempNewEmail] = useState('');
    const [savedFooters, setSavedFooters] = useState([]);
    const [footerName, setFooterName] = useState('');
    const messageEditorRef = useRef(null);

    useEffect(() => {
        fetchSubscribers();
        loadSavedFooters();
    }, []);

    const fetchSubscribers = async () => {
        setSubscribersLoading(true);
        setSubscriberError('');

        const { data, error } = await supabase
            .from('subscribers')
            .select('id, email, name, source, subscribed_at')
            .eq('status', 'active')
            .order('email', { ascending: true });

        if (error) {
            setSubscribers([]);
            setSubscriberCount(0);
            setSubscriberError('Could not load subscribers. Please refresh and try again.');
        } else {
            const activeSubscribers = data || [];
            const activeIds = new Set(activeSubscribers.map((subscriber) => subscriber.id));
            setSubscribers(activeSubscribers);
            setSubscriberCount(activeSubscribers.length);
            setSelectedSubscriberIds((currentIds) => currentIds.filter((id) => activeIds.has(id)));
        }
        setSubscribersLoading(false);

        const { data: { user } } = await supabase.auth.getUser();
        if (user) setAdminEmail(user.email);
    };

    const loadSavedFooters = () => {
        try {
            const saved = localStorage.getItem('newsletter_footer_templates');
            if (saved) setSavedFooters(JSON.parse(saved));
        } catch {
            setSavedFooters([]);
        }
    };

    const saveFooterTemplate = () => {
        if (!htmlFooter.trim()) {
            alert('Please add footer HTML first');
            return;
        }
        const name = footerName.trim() || `Footer ${savedFooters.length + 1}`;
        const updated = [...savedFooters, { name, html: htmlFooter, id: Date.now() }];
        setSavedFooters(updated);
        localStorage.setItem('newsletter_footer_templates', JSON.stringify(updated));
        setFooterName('');
    };

    const deleteFooterTemplate = (footerId) => {
        if (!confirm('Delete this footer template?')) return;
        const updated = savedFooters.filter((footer) => footer.id !== footerId);
        setSavedFooters(updated);
        localStorage.setItem('newsletter_footer_templates', JSON.stringify(updated));
    };

    const handleImageUpload = async (files) => {
        if (!files?.length) return;
        const imgHtml = `<img src="${files[0].url}" style="max-width:100%; border-radius:8px; margin: 1rem 0;" />`;
        setMessage((currentMessage) => `${currentMessage}\n${imgHtml}\n`);
    };

    const insertRecipientName = () => {
        const token = '{{first_name}}';
        const editor = messageEditorRef.current;
        const selectionStart = editor?.selectionStart ?? message.length;
        const selectionEnd = editor?.selectionEnd ?? selectionStart;

        setMessage((currentMessage) => (
            `${currentMessage.slice(0, selectionStart)}${token}${currentMessage.slice(selectionEnd)}`
        ));

        requestAnimationFrame(() => {
            if (!editor) return;
            const nextCursorPosition = selectionStart + token.length;
            editor.focus();
            editor.setSelectionRange(nextCursorPosition, nextCursorPosition);
        });
    };

    const handleAddSubscriber = async () => {
        if (!newSubscriber || !newSubscriber.includes('@')) {
            setAddSubStatus('Enter a valid email address.');
            return;
        }

        setAddSubStatus('Adding…');
        const { error } = await supabase
            .from('subscribers')
            .insert({ email: newSubscriber, source: 'admin_manual', status: 'active' });

        if (error) {
            setAddSubStatus(`Error: ${error.message}`);
        } else {
            setAddSubStatus('Added!');
            setNewSubscriber('');
            fetchSubscribers();
            setTimeout(() => setAddSubStatus(''), 3000);
        }
    };

    const handleSend = async (isTest = false) => {
        if (!subject.trim() || !message.trim()) {
            setStatus('error');
            setStatusMsg('Add a subject line and message before sending.');
            return;
        }

        if (!senderEmail.endsWith('@abodid.com')) {
            setStatus('error');
            setStatusMsg('Sender email must end in @abodid.com.');
            return;
        }

        const targetEmail = isTest ? (adminEmail || 'abodid@abodid.com') : null;
        const count = isTest
            ? 1
            : audienceMode === 'selected'
                ? selectedSubscriberIds.length
                : subscriberCount;

        if (!isTest && audienceMode === 'selected' && count === 0) {
            setStatus('error');
            setStatusMsg('Select at least one subscriber before sending.');
            return;
        }

        const audienceDescription = audienceMode === 'selected'
            ? `${count} selected subscriber${count === 1 ? '' : 's'}`
            : `all ${count} active subscribers`;

        if (!isTest && !window.confirm(`Are you sure you want to send this to ${audienceDescription}?`)) {
            return;
        }

        setStatus('sending');
        setStatusMsg(isTest ? 'Sending test email…' : `Sending to ${audienceDescription}…`);

        try {
            const performSend = async (token) => {
                const response = await fetch('/api/admin/broadcast', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        subject,
                        previewText,
                        message,
                        htmlFooter,
                        senderName,
                        senderEmail,
                        testEmail: targetEmail,
                        isTest,
                        audienceMode,
                        recipientIds: audienceMode === 'selected' ? selectedSubscriberIds : undefined,
                    }),
                });

                if (response.status === 401) throw new Error('Unauthorized');
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Failed to send');
                return result;
            };

            const sessionData = await supabase.auth.getSession();
            let token = sessionData.data.session?.access_token;
            let result;

            try {
                result = await performSend(token);
            } catch (firstError) {
                if (firstError.message !== 'Unauthorized') throw firstError;
                const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
                if (refreshError || !refreshData.session) {
                    throw new Error('Session expired. Please refresh the page and log in again.');
                }
                token = refreshData.session.access_token;
                result = await performSend(token);
            }

            setStatus('success');
            let nextMessage = isTest
                ? `Test sent to ${targetEmail}.`
                : audienceMode === 'selected'
                    ? `Campaign sent to ${result.count} selected subscribers.`
                    : `Campaign sent to ${result.count} subscribers.`;

            if (result.failures > 0) {
                setStatus('error');
                nextMessage += ` ${result.failures} failed to send.`;
                if (result.errors?.length) nextMessage += ` Errors: ${result.errors.join(', ')}`;
            }
            setStatusMsg(nextMessage);
        } catch (error) {
            setStatus('error');
            setStatusMsg(error.message);
        }
    };

    const handleAddSenderEmail = () => {
        if (tempNewEmail && tempNewEmail.endsWith('@abodid.com') && !savedSenderEmails.includes(tempNewEmail)) {
            setSavedSenderEmails([...savedSenderEmails, tempNewEmail]);
            setSenderEmail(tempNewEmail);
            setIsAddingEmail(false);
            setTempNewEmail('');
        } else if (!tempNewEmail.endsWith('@abodid.com')) {
            alert('Email must end with @abodid.com');
        }
    };

    const toggleSubscriberSelection = (subscriberId) => {
        setAudienceMode('selected');
        setSelectedSubscriberIds((currentIds) => currentIds.includes(subscriberId)
            ? currentIds.filter((id) => id !== subscriberId)
            : [...currentIds, subscriberId]);
    };

    const normalizedSubscriberSearch = subscriberSearch.trim().toLowerCase();
    const filteredSubscribers = subscribers.filter((subscriber) => {
        if (!normalizedSubscriberSearch) return true;
        return [subscriber.email, subscriber.name, subscriber.source]
            .filter(Boolean)
            .some((value) => value.toLowerCase().includes(normalizedSubscriberSearch));
    });
    const selectedSubscriberIdSet = new Set(selectedSubscriberIds);
    const allVisibleSubscribersSelected = audienceMode === 'selected'
        && filteredSubscribers.length > 0
        && filteredSubscribers.every((subscriber) => selectedSubscriberIdSet.has(subscriber.id));

    const toggleVisibleSubscribers = () => {
        setAudienceMode('selected');
        setSelectedSubscriberIds((currentIds) => {
            const nextIds = new Set(currentIds);
            filteredSubscribers.forEach((subscriber) => {
                if (allVisibleSubscribersSelected) nextIds.delete(subscriber.id);
                else nextIds.add(subscriber.id);
            });
            return [...nextIds];
        });
    };

    const formatSubscriberDate = (dateValue) => {
        if (!dateValue) return '—';
        const date = new Date(dateValue);
        if (Number.isNaN(date.getTime())) return '—';
        return new Intl.DateTimeFormat('en', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        }).format(date);
    };

    const deliveryRecipientCount = audienceMode === 'selected'
        ? selectedSubscriberIds.length
        : subscriberCount;
    const campaignReady = Boolean(subject.trim() && message.trim() && deliveryRecipientCount > 0);
    const isSendingTest = status === 'sending' && statusMsg.toLowerCase().includes('test');
    const previewMessage = message
        ? personalizeNewsletterMessage(message, 'Abodid')
        : '<p style="color:#888;font-style:italic">Start writing to see your newsletter here.</p>';

    return (
        <div className="newsletter-sender">
            <header className="newsletter-header">
                <div>
                    <span className="newsletter-eyebrow">Newsletter studio</span>
                    <h2 className="section-title">Create a campaign</h2>
                    <p>Draft, review, choose your audience, then send when everything is ready.</p>
                </div>
                <div className="header-audience-count" aria-label={`${subscriberCount} active subscribers`}>
                    <strong>{subscriberCount}</strong>
                    <span>active subscribers</span>
                </div>
            </header>

            <div className="creation-grid">
                <section className="studio-panel preview-panel" aria-labelledby="live-preview-title">
                    <div className="panel-heading preview-header">
                        <div>
                            <span className="step-label">Preview</span>
                            <h3 id="live-preview-title">Live email preview</h3>
                        </div>
                        <div className="preview-toggle" aria-label="Preview size">
                            <button
                                type="button"
                                className={`toggle-btn ${previewMode === 'desktop' ? 'active' : ''}`}
                                onClick={() => setPreviewMode('desktop')}
                                aria-pressed={previewMode === 'desktop'}
                            >
                                Desktop
                            </button>
                            <button
                                type="button"
                                className={`toggle-btn ${previewMode === 'phone' ? 'active' : ''}`}
                                onClick={() => setPreviewMode('phone')}
                                aria-pressed={previewMode === 'phone'}
                            >
                                Mobile
                            </button>
                        </div>
                    </div>

                    <div className="inbox-preview" aria-label="Gmail inbox appearance preview">
                        <div className="inbox-preview-heading">
                            <span className="inbox-preview-label">Inbox appearance</span>
                            <span className="inbox-preview-note">Gmail desktop preview</span>
                        </div>
                        <div className="gmail-preview">
                            <div className="gmail-topbar" aria-hidden="true">
                                <span className="gmail-menu-icon">☰</span>
                                <span className="gmail-wordmark">
                                    <img src="/images/admin/gmail-logo.png" alt="" width="18" height="18" />
                                    Gmail
                                </span>
                                <span className="gmail-search"><span>⌕</span> Search mail</span>
                                <span className="gmail-topbar-icon">?</span>
                                <span className="gmail-topbar-icon">⚙</span>
                                <span className="gmail-avatar">A</span>
                            </div>
                            <div className="gmail-toolbar" aria-hidden="true">
                                <span className="gmail-checkbox" />
                                <span>⌄</span>
                                <span>↻</span>
                                <span>⋮</span>
                                <span className="gmail-toolbar-count">1–1 of 1</span>
                                <span>‹</span>
                                <span>›</span>
                            </div>
                            <div className="gmail-message-row">
                                <span className="gmail-checkbox" aria-hidden="true" />
                                <span className="gmail-star" aria-hidden="true">☆</span>
                                <span className="inbox-preview-sender">{senderName || 'Abodid'}</span>
                                <span className="gmail-message-content">
                                    <span className={`inbox-preview-subject ${subject ? '' : 'placeholder'}`}>
                                        {subject || 'Your subject line'}
                                    </span>
                                    <span className="inbox-preview-separator" aria-hidden="true"> — </span>
                                    <span className={`inbox-preview-text ${previewText ? '' : 'placeholder'}`}>
                                        {previewText || 'Your preview text will appear here'}
                                    </span>
                                </span>
                                <span className="gmail-message-time">Now</span>
                            </div>
                        </div>
                    </div>

                    <div className="preview-stage">
                        <div className={`email-preview-frame ${previewMode}`}>
                            <div className="email-header">
                                <h2 className="email-subject">{subject || 'Your subject line'}</h2>
                            </div>
                            <div className="email-body">
                                <div dangerouslySetInnerHTML={{ __html: previewMessage }} />
                            </div>
                            <hr className="email-divider" />
                            <div className="email-footer">
                                {htmlFooter ? (
                                    <div dangerouslySetInnerHTML={{ __html: htmlFooter }} />
                                ) : (
                                    <>
                                        You received this because you are subscribed to updates from Abodid. <br />
                                        <span style={{ textDecoration: 'underline' }}>Unsubscribe</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </section>

                <section className="studio-panel compose-panel" aria-labelledby="draft-title">
                    <div className="panel-heading">
                        <div>
                            <span className="step-label">Draft</span>
                            <h3 id="draft-title">Write your newsletter</h3>
                        </div>
                    </div>

                    <div className="field-group">
                        <label htmlFor="newsletter-subject">Subject line</label>
                        <input
                            id="newsletter-subject"
                            type="text"
                            value={subject}
                            onChange={(event) => setSubject(event.target.value)}
                            placeholder="What will make someone want to open this?"
                            className="box-input"
                        />
                    </div>

                    <div className="field-group preview-text-field">
                        <div className="field-label-row">
                            <label htmlFor="newsletter-preview-text">Preview text</label>
                            <span className={previewText.length > 90 ? 'character-count warning' : 'character-count'}>
                                {previewText.length}/90
                            </span>
                        </div>
                        <input
                            id="newsletter-preview-text"
                            type="text"
                            className="box-input"
                            placeholder="A useful reason to open the email"
                            value={previewText}
                            onChange={(event) => setPreviewText(event.target.value)}
                        />
                    </div>

                    <div className="field-group message-field">
                        <div className="field-label-row">
                            <label htmlFor="newsletter-message">Message</label>
                            <div className="message-tools">
                                <span className="field-format">HTML or plain text</span>
                                <button
                                    type="button"
                                    className="merge-tag-button"
                                    onClick={insertRecipientName}
                                    title="Insert the recipient's first name at the cursor"
                                >
                                    + Add name
                                </button>
                            </div>
                        </div>
                        <p className="field-help merge-tag-help" id="recipient-name-help">
                            Inserts the recipient&apos;s first name at your cursor. Preview: “Abodid”; missing names: “there”.
                        </p>
                        <div className="asset-uploader">
                            <ImageUploader
                                bucket="newsletter-assets"
                                path={new Date().toISOString().split('T')[0]}
                                label="Add an image"
                                onUpload={handleImageUpload}
                                className="newsletter-uploader"
                            />
                        </div>
                        <textarea
                            id="newsletter-message"
                            ref={messageEditorRef}
                            value={message}
                            onChange={(event) => setMessage(event.target.value)}
                            placeholder="Write your newsletter here…"
                            className="box-input markdown-editor"
                            aria-describedby="recipient-name-help"
                            rows={16}
                        />
                    </div>

                    <details className="footer-editor">
                        <summary>
                            <span>Custom footer and templates</span>
                            <small>Optional</small>
                        </summary>
                        <div className="footer-editor-content">
                            <div className="field-group">
                                <label htmlFor="newsletter-footer">Footer HTML</label>
                                <textarea
                                    id="newsletter-footer"
                                    value={htmlFooter}
                                    onChange={(event) => setHtmlFooter(event.target.value)}
                                    placeholder="<p>Custom footer HTML…</p>"
                                    className="box-input"
                                    rows={4}
                                />
                            </div>

                            <div className="footer-templates">
                                {savedFooters.map((footer) => (
                                    <div key={footer.id} className="footer-template-card">
                                        <div className="footer-template-info">
                                            <strong>{footer.name}</strong>
                                            <span>{footer.html.substring(0, 60)}{footer.html.length > 60 ? '…' : ''}</span>
                                        </div>
                                        <div className="footer-template-actions">
                                            <button type="button" className="text-button" onClick={() => setHtmlFooter(footer.html)}>Use</button>
                                            <button type="button" className="icon-button danger" onClick={() => deleteFooterTemplate(footer.id)} aria-label={`Delete ${footer.name}`}>×</button>
                                        </div>
                                    </div>
                                ))}
                                {savedFooters.length === 0 && <p className="empty-note">No footer templates saved yet.</p>}
                            </div>

                            <div className="save-footer-template">
                                <input
                                    type="text"
                                    value={footerName}
                                    onChange={(event) => setFooterName(event.target.value)}
                                    placeholder="Template name"
                                    className="box-input"
                                />
                                <button type="button" className="btn sec" onClick={saveFooterTemplate}>Save footer</button>
                            </div>
                        </div>
                    </details>
                </section>
            </div>

            <section className="campaign-management" aria-labelledby="campaign-setup-title">
                <div className="management-heading">
                    <div>
                        <span className="newsletter-eyebrow">Campaign setup</span>
                        <h3 id="campaign-setup-title">Choose recipients and delivery options</h3>
                        <p>Review the audience and sender details here before you send.</p>
                    </div>
                    <div className={`readiness-badge ${campaignReady ? 'ready' : ''}`}>
                        <span aria-hidden="true">{campaignReady ? '✓' : '!'}</span>
                        {campaignReady ? 'Ready to send' : 'Needs attention'}
                    </div>
                </div>

                <div className="management-grid">
                    <section className="management-panel audience-panel" aria-labelledby="audience-title">
                        <div className="management-panel-heading">
                            <div>
                                <span className="panel-number">1</span>
                                <div>
                                    <h4 id="audience-title">Audience</h4>
                                    <p>Choose everyone or a specific group of subscribers.</p>
                                </div>
                            </div>
                            <strong>{deliveryRecipientCount} recipient{deliveryRecipientCount === 1 ? '' : 's'}</strong>
                        </div>

                        <div className="audience-choice-grid" role="group" aria-label="Audience type">
                            <button
                                type="button"
                                className={`audience-choice ${audienceMode === 'all' ? 'active' : ''}`}
                                onClick={() => setAudienceMode('all')}
                                aria-pressed={audienceMode === 'all'}
                            >
                                <span className="choice-indicator" aria-hidden="true" />
                                <span>
                                    <strong>All active subscribers</strong>
                                    <small>Send to the complete active list ({subscriberCount})</small>
                                </span>
                            </button>
                            <button
                                type="button"
                                className={`audience-choice ${audienceMode === 'selected' ? 'active' : ''}`}
                                onClick={() => setAudienceMode('selected')}
                                aria-pressed={audienceMode === 'selected'}
                            >
                                <span className="choice-indicator" aria-hidden="true" />
                                <span>
                                    <strong>Selected subscribers</strong>
                                    <small>Send only to contacts checked below ({selectedSubscriberIds.length})</small>
                                </span>
                            </button>
                        </div>

                        <div className="subscriber-toolbar">
                            <div className="search-field">
                                <span aria-hidden="true">⌕</span>
                                <input
                                    type="search"
                                    value={subscriberSearch}
                                    onChange={(event) => setSubscriberSearch(event.target.value)}
                                    placeholder="Search email, name or source"
                                    aria-label="Search subscribers"
                                />
                            </div>
                            <details className="add-subscriber">
                                <summary>+ Add subscriber</summary>
                                <div className="add-subscriber-popover">
                                    <label htmlFor="new-subscriber-email">Email address</label>
                                    <div>
                                        <input
                                            id="new-subscriber-email"
                                            type="email"
                                            placeholder="name@example.com"
                                            className="box-input"
                                            value={newSubscriber}
                                            onChange={(event) => setNewSubscriber(event.target.value)}
                                        />
                                        <button type="button" className="btn pri" onClick={handleAddSubscriber}>Add</button>
                                    </div>
                                    {addSubStatus && (
                                        <p className={addSubStatus === 'Added!' ? 'inline-status success' : 'inline-status error'}>{addSubStatus}</p>
                                    )}
                                </div>
                            </details>
                        </div>

                        {audienceMode === 'selected' && (
                            <div className="selection-bar">
                                <strong>{selectedSubscriberIds.length} selected</strong>
                                <span>{filteredSubscribers.length} contact{filteredSubscribers.length === 1 ? '' : 's'} visible</span>
                                <div>
                                    <button type="button" onClick={toggleVisibleSubscribers} disabled={filteredSubscribers.length === 0}>
                                        {allVisibleSubscribersSelected ? 'Deselect visible' : 'Select visible'}
                                    </button>
                                    <button type="button" onClick={() => setSelectedSubscriberIds([])} disabled={selectedSubscriberIds.length === 0}>Clear selection</button>
                                </div>
                            </div>
                        )}

                        <div className="subscriber-table-wrap">
                            <table className="subscriber-table">
                                <thead>
                                    <tr>
                                        <th className="checkbox-cell">
                                            <input
                                                type="checkbox"
                                                checked={allVisibleSubscribersSelected}
                                                onChange={toggleVisibleSubscribers}
                                                disabled={filteredSubscribers.length === 0}
                                                aria-label="Select all visible subscribers"
                                            />
                                        </th>
                                        <th>Email address</th>
                                        <th>Name</th>
                                        <th>Source</th>
                                        <th>Subscribed</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {subscriberError ? (
                                        <tr><td colSpan="5" className="table-message error">{subscriberError}</td></tr>
                                    ) : subscribersLoading ? (
                                        <tr><td colSpan="5" className="table-message">Loading subscribers…</td></tr>
                                    ) : filteredSubscribers.length === 0 ? (
                                        <tr><td colSpan="5" className="table-message">No subscribers match your search.</td></tr>
                                    ) : filteredSubscribers.map((subscriber) => {
                                        const isSelected = audienceMode === 'selected' && selectedSubscriberIdSet.has(subscriber.id);
                                        return (
                                            <tr key={subscriber.id} className={isSelected ? 'selected' : ''}>
                                                <td className="checkbox-cell">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleSubscriberSelection(subscriber.id)}
                                                        aria-label={`Select ${subscriber.email}`}
                                                    />
                                                </td>
                                                <td className="email-cell">{subscriber.email}</td>
                                                <td>{subscriber.name || <span className="muted">—</span>}</td>
                                                <td><span className="source-pill">{(subscriber.source || 'unknown').replaceAll('_', ' ')}</span></td>
                                                <td className="date-cell">{formatSubscriberDate(subscriber.subscribed_at)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <aside className="management-panel delivery-panel" aria-labelledby="delivery-title">
                        <div className="management-panel-heading compact">
                            <div>
                                <span className="panel-number">2</span>
                                <div>
                                    <h4 id="delivery-title">Delivery</h4>
                                    <p>Confirm sender identity and run a test.</p>
                                </div>
                            </div>
                        </div>

                        <div className="delivery-section">
                            <h5>Sender identity</h5>
                            <div className="field-group">
                                <label htmlFor="sender-name">From name</label>
                                <input
                                    id="sender-name"
                                    type="text"
                                    value={senderName}
                                    onChange={(event) => setSenderName(event.target.value)}
                                    placeholder="e.g. Abodid"
                                    className="box-input"
                                />
                            </div>
                            <div className="field-group">
                                <label htmlFor="sender-email">From email</label>
                                {!isAddingEmail ? (
                                    <select
                                        id="sender-email"
                                        className="box-input"
                                        value={senderEmail}
                                        onChange={(event) => event.target.value === 'ADD_NEW' ? setIsAddingEmail(true) : setSenderEmail(event.target.value)}
                                    >
                                        {savedSenderEmails.map((email) => <option key={email} value={email}>{email}</option>)}
                                        <option value="ADD_NEW">+ Add another sender</option>
                                    </select>
                                ) : (
                                    <div className="inline-input-actions">
                                        <input
                                            id="sender-email"
                                            type="email"
                                            className="box-input"
                                            placeholder="news@abodid.com"
                                            value={tempNewEmail}
                                            onChange={(event) => setTempNewEmail(event.target.value)}
                                            autoFocus
                                        />
                                        <button type="button" className="btn sec" onClick={() => setIsAddingEmail(false)}>Cancel</button>
                                        <button type="button" className="btn pri" onClick={handleAddSenderEmail}>Save</button>
                                    </div>
                                )}
                                <p className="field-help">Sender addresses must use @abodid.com.</p>
                            </div>
                        </div>

                        <div className="delivery-section test-section">
                            <div>
                                <h5>Send a test first</h5>
                                <p>Check links, spacing and mobile layout in your inbox.</p>
                            </div>
                            <div className="test-recipient">
                                <span>Test recipient</span>
                                <strong>{adminEmail || 'abodid@abodid.com'}</strong>
                            </div>
                            <button
                                type="button"
                                className="btn sec full-width"
                                onClick={() => handleSend(true)}
                                disabled={status === 'sending' || !subject.trim() || !message.trim()}
                            >
                                {isSendingTest ? 'Sending test…' : 'Send test email'}
                            </button>
                        </div>

                        <div className="send-review">
                            <h5>Pre-send review</h5>
                            <dl>
                                <div>
                                    <dt>Audience</dt>
                                    <dd>{deliveryRecipientCount} recipient{deliveryRecipientCount === 1 ? '' : 's'}</dd>
                                </div>
                                <div>
                                    <dt>Subject</dt>
                                    <dd className={subject.trim() ? 'complete' : 'missing'}>{subject.trim() ? 'Ready' : 'Missing'}</dd>
                                </div>
                                <div>
                                    <dt>Message</dt>
                                    <dd className={message.trim() ? 'complete' : 'missing'}>{message.trim() ? 'Ready' : 'Missing'}</dd>
                                </div>
                                <div>
                                    <dt>From</dt>
                                    <dd>{senderEmail}</dd>
                                </div>
                            </dl>
                            <button
                                type="button"
                                className="btn pri send-button"
                                onClick={() => handleSend(false)}
                                disabled={status === 'sending' || !campaignReady}
                            >
                                {status === 'sending' && !isSendingTest
                                    ? 'Sending campaign…'
                                    : audienceMode === 'selected'
                                        ? `Send to ${selectedSubscriberIds.length} selected`
                                        : `Send to all ${subscriberCount}`}
                            </button>
                            <p className="send-note">You will be asked to confirm before the campaign is sent.</p>
                        </div>

                        {status !== 'idle' && (
                            <div className={`status-alert ${status}`} role="status" aria-live="polite">
                                {statusMsg}
                            </div>
                        )}
                    </aside>
                </div>
            </section>
        </div>
    );
}
