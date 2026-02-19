import React, { useState, useEffect } from 'react';

const ShareButtons = ({ title, url }) => {
    const [shareUrl, setShareUrl] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        setShareUrl(url || window.location.href);
    }, [url]);

    const handleCopy = async () => {
        if (navigator.clipboard) {
            try {
                await navigator.clipboard.writeText(shareUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } catch (err) {
                console.error('Failed to copy text: ', err);
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
                    onClick={handleCopy}
                    className={`share-btn copy-btn ${copied ? 'active' : ''}`}
                    title="Copy Link"
                >
                    {copied && <span className="tooltip">Copied!</span>}
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
                    padding: 2rem 0;
                    border-top: 1px solid var(--border-subtle);
                    margin-top: 3rem;
                    margin-bottom: 3rem;
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
                    top: -30px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: var(--text-primary);
                    color: var(--bg-color);
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 0.75rem;
                    white-space: nowrap;
                    pointer-events: none;
                    animation: fadeIn 0.2s ease;
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
