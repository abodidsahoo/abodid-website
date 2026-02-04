import React, { useEffect, useState } from 'react';

const ReaderModeToggle = () => {
    const [isReaderMode, setIsReaderMode] = useState(false);

    useEffect(() => {
        // Check initial state
        const storedMode = localStorage.getItem('reader-mode');
        if (storedMode === 'true') {
            setIsReaderMode(true);
            document.documentElement.setAttribute('data-reader-mode', 'true');
        }
    }, []);

    const toggleReaderMode = () => {
        const newMode = !isReaderMode;
        setIsReaderMode(newMode);

        if (newMode) {
            document.documentElement.setAttribute('data-reader-mode', 'true');
            localStorage.setItem('reader-mode', 'true');
        } else {
            document.documentElement.removeAttribute('data-reader-mode');
            localStorage.removeItem('reader-mode');
        }
    };

    return (
        <button
            onClick={toggleReaderMode}
            className={`reader-mode-btn ${isReaderMode ? 'active' : ''}`}
            aria-label={isReaderMode ? "Exit Reader Mode" : "Enter Reader Mode"}
            title={isReaderMode ? "Exit Reader Mode" : "Reader Mode (Light)"}
        >
            {isReaderMode ? (
                // Sun/Light Icon (Filled/Active)
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5"></circle>
                    <line x1="12" y1="1" x2="12" y2="3"></line>
                    <line x1="12" y1="21" x2="12" y2="23"></line>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                    <line x1="1" y1="12" x2="3" y2="12"></line>
                    <line x1="21" y1="12" x2="23" y2="12"></line>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
            ) : (
                // Book/Reader Icon
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                </svg>
            )}
            <span className="btn-label">{isReaderMode ? "Exit Reader Mode" : "Reader Mode"}</span>

            <style>{`
                .reader-mode-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 12px;
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 20px;
                    color: var(--text-secondary);
                    cursor: pointer;
                    font-family: var(--font-mono);
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    transition: all 0.3s ease;
                    margin-bottom: 2rem; /* Spacing below the button */
                }

                .reader-mode-btn:hover {
                    background: rgba(255, 255, 255, 0.2);
                    color: var(--text-primary);
                }

                .reader-mode-btn.active {
                    background: #fff;
                    color: #000;
                    border-color: #fff;
                    font-weight: 600;
                }

                /* Mobile: maybe icon only? */
                @media (max-width: 600px) {
                    .btn-label {
                        display: none;
                    }
                    .reader-mode-btn {
                        padding: 8px;
                        border-radius: 50%;
                    }
                }
            `}</style>
        </button>
    );
};

export default ReaderModeToggle;
