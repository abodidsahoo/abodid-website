import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import ImageUploader from './ImageUploader';

export default function NewsletterSender() {
    const [subject, setSubject] = useState('');
    const [previewText, setPreviewText] = useState('');
    const [message, setMessage] = useState('');
    const [htmlFooter, setHtmlFooter] = useState('');
    const [status, setStatus] = useState('idle'); // idle, sending, success, error
    const [statusMsg, setStatusMsg] = useState('');
    const [subscriberCount, setSubscriberCount] = useState(0);
    const [adminEmail, setAdminEmail] = useState('');
    const [previewMode, setPreviewMode] = useState('desktop'); // desktop or phone

    // New Feature States
    const [newSubscriber, setNewSubscriber] = useState('');
    const [addSubStatus, setAddSubStatus] = useState('');
    const [senderName, setSenderName] = useState('Abodid');
    const [senderEmail, setSenderEmail] = useState('newsletter@abodid.com');

    // Footer Template Management
    const [savedFooters, setSavedFooters] = useState([]);
    const [footerName, setFooterName] = useState('');

    useEffect(() => {
        fetchSubscribers();
        loadSavedFooters();
    }, []);

    const fetchSubscribers = async () => {
        const { count } = await supabase
            .from('subscribers')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'active');
        setSubscriberCount(count || 0);

        // Get current admin email for test
        const { data: { user } } = await supabase.auth.getUser();
        if (user) setAdminEmail(user.email);
    };

    // Footer Template Functions
    const loadSavedFooters = () => {
        const saved = localStorage.getItem('newsletter_footer_templates');
        if (saved) {
            setSavedFooters(JSON.parse(saved));
        }
    };

    const saveFooterTemplate = () => {
        if (!htmlFooter.trim()) {
            alert('Please add footer HTML first');
            return;
        }
        const name = footerName.trim() || `Footer ${savedFooters.length + 1}`;
        const newFooter = { name, html: htmlFooter, id: Date.now() };
        const updated = [...savedFooters, newFooter];
        setSavedFooters(updated);
        localStorage.setItem('newsletter_footer_templates', JSON.stringify(updated));
        setFooterName('');
        alert(`Footer template "${name}" saved!`);
    };

    const loadFooterTemplate = (footer) => {
        setHtmlFooter(footer.html);
    };

    const deleteFooterTemplate = (footerId) => {
        if (!confirm('Delete this footer template?')) return;
        const updated = savedFooters.filter(f => f.id !== footerId);
        setSavedFooters(updated);
        localStorage.setItem('newsletter_footer_templates', JSON.stringify(updated));
    };

    const handleImageUpload = async (files) => {
        if (!files || !files.length) return;
        const imgHtml = `<img src="${files[0].url}" style="max-width:100%; border-radius:8px; margin: 1rem 0;" />`;
        // Append image HTML to message content
        setMessage(prev => prev + '\n' + imgHtml + '\n');
    };

    const handleBlockInsert = (blockHtml) => {
        // Insert block HTML into message
        setMessage(prev => prev + '\n' + blockHtml + '\n');
    };

    const handleAddSubscriber = async () => {
        if (!newSubscriber || !newSubscriber.includes('@')) {
            setAddSubStatus('Invalid email');
            return;
        }
        setAddSubStatus('Adding...');
        const { error } = await supabase
            .from('subscribers')
            .insert({ email: newSubscriber, source: 'admin_manual', status: 'active' });

        if (error) {
            setAddSubStatus('Error: ' + error.message);
        } else {
            setAddSubStatus('Added!');
            setNewSubscriber('');
            fetchSubscribers(); // Refresh count
            setTimeout(() => setAddSubStatus(''), 3000);
        }
    };

    const handleSend = async (isTest = false) => {
        if (!subject || !message) {
            setStatus('error');
            setStatusMsg('Please fill in subject and message.');
            return;
        }

        // Validate sender email domain
        if (!senderEmail.endsWith('@abodid.com')) {
            setStatus('error');
            setStatusMsg('Sender email must end in @abodid.com');
            return;
        }

        const targetEmail = isTest ? (adminEmail || 'abodid@abodid.com') : null;
        const count = isTest ? 1 : (subscriberCount || 0);

        if (!isTest && !window.confirm(`Are you sure you want to broadcast this to ${count} people?`)) {
            return;
        }

        setStatus('sending');
        setStatusMsg(isTest ? 'Sending test email...' : `Broadcasting to ${count} subscribers...`);

        try {
            // Helper to perform the fetch
            const performSend = async (token) => {
                const response = await fetch('/api/admin/broadcast', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        subject,
                        previewText,
                        message,
                        htmlFooter,
                        senderName,
                        senderEmail,
                        testEmail: targetEmail,
                        isTest
                    })
                });

                if (response.status === 401) {
                    throw new Error('Unauthorized');
                }

                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Failed to send');
                return result;
            };

            let sessionData = await supabase.auth.getSession();
            let token = sessionData.data.session?.access_token;

            let result;
            try {
                result = await performSend(token);
            } catch (firstError) {
                if (firstError.message === 'Unauthorized') {
                    // Token likely expired. Refresh and retry.
                    console.log('Token expired. Refreshing session...');
                    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

                    if (refreshError || !refreshData.session) {
                        throw new Error('Session expired. Please refresh the page and log in again.');
                    }

                    token = refreshData.session.access_token;
                    result = await performSend(token);
                } else {
                    throw firstError;
                }
            }

            setStatus('success');
            let msg = isTest
                ? `Test sent to ${adminEmail}`
                : `Broadcast complete! Sent to ${result.count} subscribers.`;

            if (result.failures > 0) {
                setStatus('error'); // Use partial error state or keep success but warn? Error is safer to grab attention.
                msg += ` WARNING: ${result.failures} failed to send.`;
                if (result.errors && result.errors.length) {
                    msg += ` Errors: ${result.errors.join(', ')}`;
                }
            }
            setStatusMsg(msg);

        } catch (e) {
            setStatus('error');
            setStatusMsg(e.message);
        }
    };

    // Helper to add new sender email
    const [savedSenderEmails, setSavedSenderEmails] = useState(['newsletter@abodid.com']);
    const [isAddingEmail, setIsAddingEmail] = useState(false);
    const [tempNewEmail, setTempNewEmail] = useState('');

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

    return (
        <div className="newsletter-sender">
            <header className="content-header" style={{ marginBottom: '2rem' }}>
                <h2 className="section-title">Newsletter Broadcast</h2>
            </header>

            <div className="sender-card">
                <div className="sender-grid">
                    {/* Left: Compose */}
                    <div className="compose-col">
                        <section className="card-section">
                            <div className="form-group">
                                <label>Subject Line</label>
                                <input
                                    type="text"
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    placeholder="Enter subject line..."
                                    className="input-field box-input"
                                />
                            </div>
                            <div className="field-group">
                                <label>Preview Text (Preheader)</label>
                                <input
                                    type="text"
                                    className="box-input"
                                    placeholder="Text shown in inbox preview..."
                                    value={previewText}
                                    onChange={e => setPreviewText(e.target.value)}
                                />
                            </div>

                            <div className="field-group full-height">
                                <label>Message Body (Markdown)</label>

                                {/* Image Uploader */}
                                <div style={{ marginBottom: '1rem' }}>
                                    <ImageUploader
                                        bucket="newsletter-assets"
                                        path={new Date().toISOString().split('T')[0]}
                                        label="Drag Image Here to Insert"
                                        onUpload={handleImageUpload}
                                        className="newsletter-uploader"
                                    />
                                </div>

                                {/* Simple Textarea for Markdown */}
                                <textarea
                                    value={message}
                                    onChange={e => setMessage(e.target.value)}
                                    placeholder="Write your newsletter in markdown or HTML..."
                                    className="box-input markdown-editor"
                                    rows={15}
                                />
                            </div>

                            {/* Footer Templates */}
                            <div className="field-group">
                                <label>Footer Templates</label>
                                <div className="footer-templates">
                                    {savedFooters.map((footer) => (
                                        <div key={footer.id} className="footer-template-card">
                                            <div className="footer-template-info">
                                                <span className="footer-template-name">{footer.name}</span>
                                                <span className="footer-template-preview">
                                                    {footer.html.substring(0, 60)}...
                                                </span>
                                            </div>
                                            <div className="footer-template-actions">
                                                <button
                                                    className="btn-small btn-primary"
                                                    onClick={() => loadFooterTemplate(footer)}
                                                    title="Insert this footer"
                                                >
                                                    Insert
                                                </button>
                                                <button
                                                    className="btn-small btn-danger"
                                                    onClick={() => deleteFooterTemplate(footer.id)}
                                                    title="Delete this template"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {savedFooters.length === 0 && (
                                        <p className="no-templates">No footer templates saved yet. Create one below!</p>
                                    )}
                                </div>
                                <div className="save-footer-template">
                                    <input
                                        type="text"
                                        value={footerName}
                                        onChange={e => setFooterName(e.target.value)}
                                        placeholder="Template name (optional)"
                                        className="box-input footer-name-input"
                                    />
                                    <button
                                        className="btn-save-template"
                                        onClick={saveFooterTemplate}
                                        title="Save current footer as template"
                                    >
                                        + Save Current Footer
                                    </button>
                                </div>
                            </div>

                            <div className="field-group">
                                <label>HTML Footer (Optional)</label>
                                <textarea
                                    value={htmlFooter}
                                    onChange={e => setHtmlFooter(e.target.value)}
                                    placeholder="<p>Custom footer HTML...</p>"
                                    className="box-input"
                                    rows={3}
                                />
                            </div>
                        </section>
                    </div>

                    {/* Middle: Preview */}
                    <div className="preview-col">
                        <section className="card-section">
                            <div className="preview-header">
                                <label className="section-label">Live Email Preview</label>
                                <div className="preview-toggle">
                                    <button
                                        className={`toggle-btn ${previewMode === 'desktop' ? 'active' : ''}`}
                                        onClick={() => setPreviewMode('desktop')}
                                    >
                                        🖥️ Desktop
                                    </button>
                                    <button
                                        className={`toggle-btn ${previewMode === 'phone' ? 'active' : ''}`}
                                        onClick={() => setPreviewMode('phone')}
                                    >
                                        📱 Phone
                                    </button>
                                </div>
                            </div>
                            <div className={`email-preview-frame ${previewMode}`}>
                                <div className="email-header">
                                    <h2 className="email-subject">{subject}</h2>
                                </div>
                                <div className="email-body">
                                    {/* Safe Render */}
                                    <div dangerouslySetInnerHTML={{ __html: message || '<p style="color:#999;font-style:italic">Draft your message to see a preview here...</p>' }} />
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
                        </section>
                    </div>

                    {/* Right: Actions & Stats */}
                    <div className="action-col">
                        <div className="stat-box">
                            <span className="stat-label">Active Subscribers</span>
                            <span className="stat-val">{subscriberCount}</span>
                        </div>

                        {/* Manual Add Subscriber */}
                        <div className="action-box">
                            <h4 className="action-title">Add Subscriber </h4>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    type="email"
                                    placeholder="email@example.com"
                                    className="box-input"
                                    style={{ fontSize: '0.8rem', padding: '0.5rem' }}
                                    value={newSubscriber}
                                    onChange={e => setNewSubscriber(e.target.value)}
                                />
                                <button className="btn sec" onClick={handleAddSubscriber} style={{ padding: '0.5rem' }}>
                                    +
                                </button>
                            </div>
                            {addSubStatus && <div style={{ fontSize: '0.8rem', marginTop: '4px', color: addSubStatus.includes('Error') ? 'red' : 'green' }}>{addSubStatus}</div>}
                        </div>

                        <div className="action-box">
                            <h4 className="action-title">Test First</h4>
                            <p className="action-desc">Send a preview to <strong>abodidsahoo@gmail.com</strong></p>
                            <button
                                className="btn sec full-width"
                                onClick={() => handleSend(true)}
                                disabled={status === 'sending'}
                            >
                                Send Test Email
                            </button>
                        </div>

                        {/* Broadcast Section with Sender Config */}
                        <div className="action-box danger-zone" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div>
                                <h4 className="action-title" style={{ marginBottom: '1rem' }}>Broadcast Configuration</h4>

                                <div className="field-group" style={{ marginBottom: '1rem' }}>
                                    <label>Sender Name</label>
                                    <input
                                        type="text"
                                        value={senderName}
                                        onChange={(e) => setSenderName(e.target.value)}
                                        placeholder="e.g. Abodid"
                                        className="box-input"
                                    />
                                </div>

                                <div className="field-group" style={{ marginBottom: '0.5rem' }}>
                                    <label>Sender Email</label>
                                    {!isAddingEmail ? (
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <select
                                                className="box-input"
                                                value={senderEmail}
                                                onChange={(e) => e.target.value === 'ADD_NEW' ? setIsAddingEmail(true) : setSenderEmail(e.target.value)}
                                            >
                                                {savedSenderEmails.map(email => (
                                                    <option key={email} value={email}>{email}</option>
                                                ))}
                                                <option value="ADD_NEW">+ Add New Email</option>
                                            </select>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <input
                                                type="email"
                                                className="box-input"
                                                placeholder="news@abodid.com"
                                                value={tempNewEmail}
                                                onChange={(e) => setTempNewEmail(e.target.value)}
                                                autoFocus
                                            />
                                            <button className="btn sec" onClick={() => setIsAddingEmail(false)}>✕</button>
                                            <button className="btn pri" onClick={handleAddSenderEmail}>✓</button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <button
                                className="btn pri full-width"
                                onClick={() => handleSend(false)}
                                disabled={status === 'sending' || subscriberCount === 0}
                                style={{ padding: '1rem', fontSize: '1rem' }}
                            >
                                {status === 'sending' && !statusMsg.includes('Test') ? 'Sending...' : 'Send to All'}
                            </button>
                        </div>

                        {status !== 'idle' && (
                            <div className={`status-alert ${status}`}>
                                {statusMsg}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                .newsletter-sender { padding-bottom: 4rem; }
                .sender-card {
                    background: var(--bg-surface);
                    border: 1px solid var(--border-subtle);
                    border-radius: 12px;
                    padding: 2rem;
                }
                .sender-grid {
                    display: grid;
                    grid-template-columns: 2fr 1.5fr 300px; /* Compose, Preview, Actions */
                    gap: 2rem;
                    align-items: start;
                }
                .section-header { margin-bottom: 2rem; }
                
                .box-input {
                    background: var(--bg-color);
                    border: 1px solid var(--border-subtle);
                    border-radius: 6px; padding: 0.8rem 1rem;
                    color: var(--text-primary); width: 100%;
                    font-size: 0.95rem; font-family: var(--font-sans);
                    transition: 0.2s;
                    resize: vertical;
                }
                .box-input:focus { border-color: var(--text-primary); outline: none; }
                
                .markdown-editor {
                    font-family: 'Monaco', 'Menlo', monospace;
                    font-size: 0.9rem;
                    line-height: 1.6;
                    min-height: 400px;
                }
                
                .field-group { margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
                .field-group label { font-size: 0.7rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 600; letter-spacing: 0.05em; }
                .form-group { margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
                .form-group label { font-size: 0.7rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 600; letter-spacing: 0.05em; }

                /* PREVIEW HEADER AND TOGGLE */
                .preview-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }
                .preview-toggle {
                    display: flex;
                    gap: 0.5rem;
                }
                .toggle-btn {
                    padding: 0.5rem 1rem;
                    border: 1px solid var(--border-subtle);
                    background: transparent;
                    color: var(--text-secondary);
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 0.85rem;
                    transition: 0.2s;
                }
                .toggle-btn.active {
                    background: var(--text-primary);
                    color: var(--bg-color);
                    border-color: var(--text-primary);
                }
                .toggle-btn:hover:not(.active) {
                    background: var(--bg-surface-hover);
                }

                /* PREVIEW STYLES */
                .email-preview-frame {
                    background: #fff; /* Email is usually white */
                    color: #333;
                    border: none;
                    border-radius: 8px;
                    padding: 20px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    line-height: 1.6;
                    min-height: 600px;
                    box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
                    overflow-y: auto;
                    max-height: 80vh;
                    transition: max-width 0.3s ease;
                }
                .email-preview-frame.phone {
                    max-width: 375px;
                    margin: 0 auto;
                }
                .email-subject { color: #111; margin: 0 0 1rem 0; font-size: 1.5rem; font-weight: 700; line-height: 1.2; min-height: 1.2em; }
                .email-body { white-space: pre-wrap; font-size: 16px; }
                .email-divider { margin: 30px 0; border: none; border-top: 1px solid #eee; }
                .email-footer { font-size: 12px; color: #888; text-align: center; }

                .action-col { display: flex; flex-direction: column; gap: 1.5rem; }
                
                .stat-box { 
                    background: var(--bg-surface-hover); padding: 1.5rem; border-radius: 8px; 
                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                    border: 1px solid var(--border-subtle);
                }
                .stat-label { font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }
                .stat-val { font-size: 2.5rem; font-weight: 700; color: var(--text-primary); line-height: 1; }

                .action-box { 
                    padding: 1.5rem; border: 1px solid var(--border-subtle); border-radius: 8px;
                    background: var(--bg-surface);
                }
                .action-box.danger-zone { border-color: rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.02); }
                .action-title { margin: 0 0 0.5rem 0; font-size: 1rem; font-weight: 600; }
                .action-desc { margin: 0 0 1rem 0; font-size: 0.85rem; color: var(--text-secondary); }

                .btn { padding: 0.8rem 1rem; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.9rem; transition: 0.2s; border: none; }
                .btn.sec { background: transparent; border: 1px solid var(--border-strong); color: var(--text-primary); }
                .btn.sec:hover { background: var(--bg-surface-hover); }
                .btn.pri { background: var(--text-primary); color: var(--text-inverse); }
                .btn.pri:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
                .btn:disabled { opacity: 0.5; cursor: not-allowed; }
                .full-width { width: 100%; }

                .status-alert { padding: 1rem; border-radius: 6px; font-size: 0.9rem; margin-top: 1rem; }
                .status-alert.success { background: rgba(16, 185, 129, 0.1); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.2); }
                .status-alert.error { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); }
                .status-alert.sending { background: rgba(59, 130, 246, 0.1); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.2); }

                /* FOOTER TEMPLATES */
                .footer-templates {
                    display: flex;
                    flex-direction: column;
                    gap: 0.8rem;
                    margin-bottom: 1rem;
                }
                .footer-template-card {
                    background: var(--bg-surface-hover);
                    border: 1px solid var(--border-subtle);
                    border-radius: 8px;
                    padding: 0.8rem 1rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 1rem;
                }
                .footer-template-info {
                    display: flex;
                    flex-direction: column;
                    gap: 0.2rem;
                    overflow: hidden;
                }
                .footer-template-name {
                    font-weight: 600;
                    font-size: 0.9rem;
                    color: var(--text-primary);
                }
                .footer-template-preview {
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .footer-template-actions {
                    display: flex;
                    gap: 0.5rem;
                    flex-shrink: 0;
                }
                .btn-small {
                    padding: 0.4rem 0.8rem;
                    font-size: 0.8rem;
                    border-radius: 4px;
                }
                .btn-danger {
                    background: rgba(239, 68, 68, 0.1);
                    color: #ef4444;
                    border: 1px solid rgba(239, 68, 68, 0.2);
                }
                .btn-danger:hover {
                    background: #ef4444;
                    color: #fff;
                }
                .save-footer-template {
                    display: flex;
                    gap: 0.8rem;
                    align-items: center;
                    margin-top: 0.5rem;
                }
                .footer-name-input {
                    flex: 1;
                }
                .btn-save-template {
                    white-space: nowrap;
                    padding: 0.8rem 1.2rem;
                    background: var(--bg-surface-hover);
                    border: 1px dashed var(--border-strong);
                    color: var(--text-primary);
                    border-radius: 6px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: 0.2s;
                }
                .btn-save-template:hover {
                    background: var(--bg-surface);
                    border-style: solid;
                }
                .no-templates {
                    font-size: 0.85rem;
                    color: var(--text-secondary);
                    font-style: italic;
                    text-align: center;
                    padding: 1rem;
                    border: 1px dashed var(--border-subtle);
                    border-radius: 8px;
                }

                @media (max-width: 1400px) {
                    .sender-grid { grid-template-columns: 1fr 1fr; } 
                    .action-col { grid-column: span 2; flex-direction: row; flex-wrap: wrap; }
                }
                @media (max-width: 900px) {
                    .sender-grid { grid-template-columns: 1fr; }
                    .action-col { grid-column: auto; flex-direction: column; }
                }
            `}</style>
        </div>
    );
}
