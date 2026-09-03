import React, { useEffect, useRef, useState } from 'react';

const ShareButtons = ({ title, url }) => {
    const [shareUrl, setShareUrl] = useState('');
    const [copyStatus, setCopyStatus] = useState('idle');
    const feedbackTimer = useRef(null);

    useEffect(() => {
        setShareUrl(url || window.location.href);
    }, [url]);

    useEffect(() => () => {
        if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
    }, []);

    const showCopyStatus = (status) => {
        setCopyStatus(status);
        if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
        feedbackTimer.current = window.setTimeout(() => setCopyStatus('idle'), 2400);
    };

    const copyWithFallback = (text) => {
        const field = document.createElement('textarea');
        field.value = text;
        field.setAttribute('readonly', '');
        field.style.position = 'fixed';
        field.style.opacity = '0';
        field.style.pointerEvents = 'none';
        document.body.appendChild(field);
        field.select();
        field.setSelectionRange(0, field.value.length);
        const didCopy = document.execCommand('copy');
        field.remove();
        if (!didCopy) throw new Error('Clipboard copy was not available.');
    };

    const handleCopy = async () => {
        const targetUrl = shareUrl || window.location.href;

        try {
            if (navigator.clipboard?.writeText && window.isSecureContext) {
                await navigator.clipboard.writeText(targetUrl);
            } else {
                copyWithFallback(targetUrl);
            }
            showCopyStatus('copied');
        } catch (clipboardError) {
            try {
                copyWithFallback(targetUrl);
                showCopyStatus('copied');
            } catch (fallbackError) {
                console.error('Failed to copy link:', clipboardError, fallbackError);
                showCopyStatus('error');
            }
        }
    };

    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedTitle = encodeURIComponent(title || '');

    return (
        <div className="share-component">
            <div className="share-icons">
                {/* Copy Link */}
                <button
                    type="button"
                    onClick={handleCopy}
                    className={`share-btn copy-btn ${copyStatus === 'copied' ? 'active' : ''}`}
                    title={copyStatus === 'copied' ? 'Link copied' : 'Copy link'}
                    aria-label={copyStatus === 'copied' ? 'Link copied' : 'Copy link'}
                >
                    {copyStatus !== 'idle' && (
                        <span
                            className={`tooltip ${copyStatus === 'error' ? 'is-error' : ''}`}
                            role="status"
                            aria-live="polite"
                        >
                            {copyStatus === 'copied' ? 'Link copied' : 'Could not copy'}
                        </span>
                    )}
                    <svg className="icon-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                    </svg>
                </button>

                {/* WhatsApp */}
                <a
                    href={`https://wa.me/?text=${encodedTitle}%20${encodedUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="share-btn whatsapp-btn"
                    title="Share on WhatsApp"
                >
                    <i className="fa-brands fa-whatsapp"></i>
                </a>

                {/* Facebook */}
                <a
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="share-btn facebook-btn"
                    title="Share on Facebook"
                >
                    <i className="fa-brands fa-facebook-f"></i>
                </a>

                {/* X (Twitter) */}
                <a
                    href={`https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="share-btn twitter-btn"
                    title="Share on X"
                >
                    <i className="fa-brands fa-x-twitter"></i>
                </a>
            </div>

            <style>{`
                .share-component {
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                    padding: 1.75rem 0 2rem;
                    border-top: 1px solid var(--border-subtle);
                    margin-top: 2.25rem;
                    margin-bottom: 2.5rem;
                    font-family: var(--font-sans);
                    justify-content: center; /* Centered by default */
                }

                .share-label {
                    font-size: 0.85rem;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    color: var(--text-tertiary);
                    font-weight: 500;
                }

                .share-icons {
                    display: flex;
                    gap: 1rem;
                }

                .share-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    border: 1px solid var(--border-subtle);
                    color: var(--text-secondary);
                    background: transparent;
                    transition: all 0.2s ease;
                    position: relative;
                    text-decoration: none;
                    cursor: pointer;
                    font-size: 1rem;
                }

                .share-btn:hover {
                    border-color: var(--text-primary);
                    color: var(--text-primary);
                    background: var(--bg-surface);
                    transform: translateY(-2px);
                }

                .copy-btn.active {
                    border-color: #10B981;
                    color: #10B981;
                }

                .tooltip {
                    position: absolute;
                    bottom: calc(100% + 10px);
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 20;
                    padding: 6px 9px;
                    border: 1px solid rgba(255, 248, 232, 0.35);
                    border-radius: 6px;
                    background: #15130f;
                    color: #fff8e8;
                    box-shadow: 0 5px 14px rgba(21, 19, 15, 0.2);
                    font-family: "Satoshi-Variable", "Satoshi-Regular", "Poppins", sans-serif;
                    font-size: 0.76rem;
                    font-weight: 650;
                    line-height: 1.2;
                    letter-spacing: 0;
                    white-space: nowrap;
                    pointer-events: none;
                    animation: fadeIn 0.2s ease;
                }

                .tooltip.is-error {
                    background: #8f224c;
                    color: #fff8e8;
                }

                @keyframes fadeIn {
                    from { opacity: 0; transform: translate(-50%, 5px); }
                    to { opacity: 1; transform: translate(-50%, 0); }
                }

                @media (max-width: 600px) {
                    .share-component {
                        flex-direction: column;
                        gap: 1rem;
                    }
                }
            `}</style>
        </div>
    );
};

export default ShareButtons;
