import React, { useState, useEffect } from 'react';

const VibeCheckWidget = () => {
    // State driven by events
    const [uniqueCount, setUniqueCount] = useState(0);
    const [totalTags, setTotalTags] = useState(50); // Default until event

    const UNLOCK_THRESHOLD = 50;

    useEffect(() => {
        const handleProgress = (e) => {
            // Cap the displayed count at 50
            const cappedCount = Math.min(e.detail.count, UNLOCK_THRESHOLD);
            setUniqueCount(cappedCount);

            if (e.detail.total) setTotalTags(e.detail.total);
        };

        window.addEventListener('game-progress', handleProgress);

        return () => {
            window.removeEventListener('game-progress', handleProgress);
        };
    }, []);

    // --- THEME CONSTANTS ---
    // Deep European Green Aesthetics (Desaturated, Classy)
    const THEME = {
        bgLight: '#2F4F3F', // Deep Desaturated Green
        bgDark: '#1A2B22',  // Darker Forest Green
        textLight: '#FFFFFF',
        textDark: '#FFFFFF',
        accent: '#A3D9B5',  // Soft Pastel Green Accent (replacing Neon)
        glow: 'rgba(163, 217, 181, 0.4)', // Soft glow
        particle: '#A3D9B5'
    };

    return (
        <div className="vibe-check-widget">
            <div className="widget-header">
                <span className="widget-title">The Vibe Check</span>
                <span className="widget-counter">
                    <span className="count-val">{uniqueCount}</span>
                    <span className="count-sep">/</span>
                    <span className="count-total">{UNLOCK_THRESHOLD}</span>
                </span>
            </div>

            {/* Progress bar removed as requested for a cleaner look */}

            <style>{`
                .vibe-check-widget {
                    margin-top: 0; /* Removed top margin */
                    padding: 0;    /* Removed padding */
                    border: none;  /* Removed border */
                    background: transparent; /* Transparent background */
                    font-family: var(--font-ui);
                    transition: all 0.3s ease;
                    max-width: none; /* No max width */
                    position: relative;
                    user-select: none;
                    text-align: right; /* Right align everything */
                }

                .widget-header {
                    display: flex;
                    flex-direction: column; /* Stack vertically for right alignment */
                    align-items: flex-end;    /* Align to right */
                    margin-bottom: 0;
                    position: relative;
                    z-index: 2;
                }

                .widget-title {
                    font-size: 0.7rem;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    font-weight: 700;
                    color: rgba(0, 0, 0, 0.4); /* Subtle text color, adaptable to light/dark via CSS vars if needed */
                    margin-bottom: 4px;
                }

                :global(.dark) .widget-title {
                    color: rgba(255, 255, 255, 0.5);
                }

                /* Updated Counter Styles */
                .widget-counter {
                    font-size: 1.5rem; /* Large and bold */
                    font-weight: 800; /* Extra bold */
                    color: var(--text-primary); /* Use global text color */
                    font-variant-numeric: tabular-nums;
                    padding: 0;
                    letter-spacing: -1px;
                    display: inline-flex;
                    align-items: baseline;
                    line-height: 1;
                }

                :global(.dark) .widget-counter {
                    color: #fff;
                }

                .count-val { }

                .count-total { 
                    opacity: 0.4; 
                    font-size: 1em; 
                    margin-left: 2px;
                }
                
                .count-sep {
                    margin: 0 2px;
                    opacity: 0.3;
                    font-weight: 400;
                }

                .unlock-message {
                    margin-top: 10px;
                    text-align: right; /* Right align */
                    animation: fadeIn 0.5s ease;
                }

                /* NEW WELCOME TEXT STYLE */
                .welcome-text {
                    font-size: 0.75rem;
                    font-weight: 900;
                    color: var(--accent);
                    margin: 4px 0;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                :global(.dark) .welcome-text {
                     color: #A3D9B5; /* Use the green accent for dark mode */
                }

                .lab-link {
                    font-size: 0.75rem;
                    color: var(--text-primary);
                    text-decoration: none;
                    font-weight: 700;
                    border-bottom: 1px solid currentColor;
                    transition: all 0.2s;
                    display: inline-block;
                }

                :global(.dark) .lab-link {
                    color: #fff;
                }
                
                .lab-link:hover {
                    color: var(--text-secondary);
                    border-color: transparent;
                }

                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(5px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default VibeCheckWidget;
