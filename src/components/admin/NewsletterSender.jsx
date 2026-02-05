import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import ImageUploader from './ImageUploader';

// Helper to insert text at cursor
const insertAtCursor = (text, value) => {
    // Since we don't have direct ref access in this simple conversion without rewriting everything,
    // we'll just append for now, or users can use the visual cue.
    // For a robust implementation, we'd need a ref to the textarea.
    return text + '\n' + value + '\n';
};

export default function NewsletterSender() {
    const [subject, setSubject] = useState('');
    const [previewText, setPreviewText] = useState('');
    const [message, setMessage] = useState('');
    const [status, setStatus] = useState('idle'); // idle, sending, success, error
    const [statusMsg, setStatusMsg] = useState('');
    const [subscriberCount, setSubscriberCount] = useState(0);
    const [adminEmail, setAdminEmail] = useState('');

    // New Feature States
    const [resources, setResources] = useState([]);
    const [newSubscriber, setNewSubscriber] = useState('');
    const [addSubStatus, setAddSubStatus] = useState('');
    const [senderName, setSenderName] = useState('Abodid');
    const [senderEmail, setSenderEmail] = useState('newsletter@abodid.com');

    useEffect(() => {
        fetchSubscribers();
        fetchResources();
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

    const fetchResources = async () => {
        const { data } = await supabase
            .from('hub_resources')
            .select('*')
            .eq('status', 'approved') // Only show approved resources
            .order('created_at', { ascending: false })
            .limit(20);
        setResources(data || []);
    }

    const handleImageUpload = (files) => {
        if (!files || !files.length) return;
        const imgHtml = `<img src="${files[0].url}" style="max-width:100%; border-radius:8px; margin: 1rem 0;" />`;
        // We'll append HTML since we support HTML in the email body
        setMessage(prev => prev + '\n' + imgHtml + '\n');
    };

    const handleInsertResource = (resource) => {
        // Create a beautiful "Card" HTML
        const cardHtml = `
<div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0; background-color: #f9fafb;">
    <h3 style="margin: 0 0 8px 0; font-size: 18px;">
        <a href="${resource.url}" target="_blank" style="color: #111; text-decoration: none;">${resource.title} ↗</a>
    </h3>
    <p style="margin: 0; color: #555; font-size: 14px; line-height: 1.5;">${resource.description || 'Check out this useful resource.'}</p>
</div>`;
        setMessage(prev => prev + '\n' + cardHtml + '\n');
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
                        senderName,
                        senderEmail,
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
                    {/* Left: Resource Picker */}
                    <div className="resources-col">
                        <section className="card-section">
                            <label className="section-label">Resource Picker</label>
                            <div className="resources-list">
                                {resources.map(r => (
                                    <div key={r.id} className="resource-item" onClick={() => handleInsertResource(r)}>
                                        <div className="res-title">{r.title}</div>
                                        <div className="res-desc">{r.description?.substring(0, 50)}...</div>
                                        <div className="res-action">+ Click to Insert</div>
                                    </div>
                                ))}
                                {resources.length === 0 && <div className="empty-msg">No approved resources found.</div>}
                            </div>
                        </section>
                    </div>

                    {/* Middle Left: Compose (Existing) */}
                    <div className="compose-col">
                        <section className="card-section">
                            <label className="section-label">Compose Message</label>

                            <div className="form-group">
                                <label>Subject Line</label>
                                <input
                                    type="text"
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    placeholder="Enter subject line..."
                                    className="input-field box-input" // Unified class
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
                                <label>Message Body (HTML enabled)</label>

                                {/* Image Uploader Zone */}
                                <div style={{ marginBottom: '1rem' }}>
                                    <ImageUploader
                                        bucket="newsletter-assets"
                                        path={new Date().toISOString().split('T')[0]}
                                        label="Drag Image Here to Insert"
                                        onUpload={handleImageUpload}
                                        className="newsletter-uploader"
                                    />
                                </div>

                                <textarea
                                    className="box-input content-area"
                                    placeholder="Write your update here... Images uploaded will be appended."
                                    value={message}
                                    onChange={e => setMessage(e.target.value)}
                                    style={{ minHeight: '500px', fontFamily: 'var(--font-mono)' }}
                                />
                            </div>
                        </section>
                    </div>

                    {/* Middle Right: Preview (Existing) */}
                    <div className="preview-col">
                        <section className="card-section">
                            <label className="section-label">Live Email Preview</label>
                            <div className="email-preview-frame">
                                <div className="email-header">
                                    <h2 className="email-subject">{subject}</h2>
                                </div>
                                <div className="email-body">
                                    {/* Safe Render */}
                                    <div dangerouslySetInnerHTML={{ __html: message || '<p style="color:#999;font-style:italic">Draft your message to see a preview here...</p>' }} />
                                </div>
                                <hr className="email-divider" />
                                <div className="email-footer">
                                    You received this because you are subscribed to updates from Abodid. <br />
                                    <span style={{ textDecoration: 'underline' }}>Unsubscribe</span>
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
                            <p className="action-desc">Send a preview to <strong>{adminEmail}</strong></p>
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
                    grid-template-columns: 250px 1.5fr 1.5fr 320px; /* Adjusted columns */
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
                .field-group { margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
                .field-group label { font-size: 0.7rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 600; letter-spacing: 0.05em; }
                .form-group { margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
                .form-group label { font-size: 0.7rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 600; letter-spacing: 0.05em; }

                /* RESOURCE PICKER STYLES */
                .resources-list {
                    display: flex; flex-direction: column; gap: 10px;
                    max-height: 700px; overflow-y: auto;
                    padding-right: 5px;
                }
                .resource-item {
                    background: var(--bg-color);
                    border: 1px solid var(--border-subtle);
                    border-radius: 6px; padding: 10px;
                    cursor: pointer; transition: 0.2s;
                }
                .resource-item:hover { border-color: var(--text-primary); transform: translateX(2px); }
                .res-title { font-weight: 600; font-size: 0.9rem; margin-bottom: 4px; color: var(--text-primary); }
                .res-desc { font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 8px; }
                .res-action { font-size: 0.7rem; color: var(--accent-primary); text-transform: uppercase; letter-spacing: 0.05em; font-weight: bold; }
                .empty-msg { font-size: 0.8rem; color: var(--text-secondary); font-style: italic; }

                /* PREVIEW STYLES */
                .email-preview-frame {
                    background: #fff; /* Email is usually white */
                    color: #333;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    padding: 20px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    line-height: 1.6;
                    min-height: 600px;
                    box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
                    overflow-y: auto;
                    max-height: 80vh;
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

                @media (max-width: 1400px) {
                    .sender-grid { grid-template-columns: 1fr 1fr 1fr; } 
                    .resources-col { display: none; } /* Hide on smaller screens or make specific UI */
                }
                @media (max-width: 1200px) {
                    .sender-grid { grid-template-columns: 1fr 1fr; }
                    .action-col { grid-column: span 2; flex-direction: row; }
                }
                @media (max-width: 900px) {
                    .sender-grid { grid-template-columns: 1fr; }
                    .action-col { grid-column: auto; flex-direction: column; }
                }
            `}</style>
        </div>
    );
}
