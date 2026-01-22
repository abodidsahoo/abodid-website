import React, { useState, useEffect } from 'react';

const VibeCheckWidget = () => {
    // State driven by events
    const [uniqueCount, setUniqueCount] = useState(0);
    const [totalTags, setTotalTags] = useState(50); // Default until event
    const [isUnlocked, setIsUnlocked] = useState(false);

    const UNLOCK_THRESHOLD = 50;

    useEffect(() => {
        const handleProgress = (e) => {
            // Cap the displayed count at 50
            const cappedCount = Math.min(e.detail.count, UNLOCK_THRESHOLD);
            setUniqueCount(cappedCount);

            if (e.detail.total) setTotalTags(e.detail.total);
            if (e.detail.unlocked) {
                setIsUnlocked(true); // Trigger unlock if not already
            }
        };

        const handleUnlock = () => {
            setIsUnlocked(true);
        };

        window.addEventListener('game-progress', handleProgress);
        window.addEventListener('game-unlock', handleUnlock);

        return () => {
            window.removeEventListener('game-progress', handleProgress);
            window.removeEventListener('game-unlock', handleUnlock);
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
        <div
            className={`vibe-check-widget ${isUnlocked ? 'unlocked' : ''}`}
            style={{
                '--theme-accent': THEME.accent,
                '--theme-glow': THEME.glow,
                '--theme-bg-light': THEME.bgLight,
                '--theme-bg-dark': THEME.bgDark,
                '--theme-text-light': THEME.textLight,
                '--theme-text-dark': THEME.textDark,
                '--theme-particle': THEME.particle,
            }}
        >
            <div className="widget-header">
                <span className="widget-title">The Secret Lab Vibe Check</span>
                <span className="widget-counter">
                    <span className="count-val">{uniqueCount}</span>
                    <span className="count-sep">/</span>
                    <span className="count-total">{UNLOCK_THRESHOLD}</span>
                </span>
            </div>

            <div className="progress-track">
                <div
                    className={`progress-fill ${isUnlocked ? 'glowing' : ''}`}
                    style={{ width: `${Math.min(100, (uniqueCount / UNLOCK_THRESHOLD) * 100)}%` }}
                ></div>
            </div>

            {isUnlocked ? (
                <div className="unlock-message">
                    <span className="message-subtext">Vibe Check Passed</span>
                    {/* Message removed as requested */}
                    <div className="welcome-text">WELCOME TO THE SECRET LAB</div>
                    <a href="/secret-lab" className="lab-link">ENTER THE LAB</a>
                </div>
            ) : null}

            <div className="particles-container">
                <div className="particle p1"></div>
                <div className="particle p2"></div>
                <div className="particle p3"></div>
            </div>

            <style jsx>{`
                .vibe-check-widget {
                    margin-top: 1.5rem;
                    padding: 16px 20px;
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 6px;
                    background: var(--theme-bg-light);
                    font-family: 'Space Mono', 'Courier New', monospace;
                    transition: all 0.3s ease;
                    max-width: 320px;
                    position: relative;
                    overflow: hidden;
                    box-shadow: 0 10px 30px rgba(198, 40, 40, 0.3);
                    user-select: none;
                }

                :global(.dark) .vibe-check-widget {
                    background: var(--theme-bg-dark);
                    border-color: #333;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
                }

                .vibe-check-widget.unlocked {
                    border-color: var(--theme-accent);
                    box-shadow: 0 0 20px var(--theme-glow);
                }

                .widget-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 12px;
                    position: relative;
                    z-index: 2;
                }

                .widget-title {
                    font-size: 0.7rem;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    font-weight: 700;
                    color: rgba(255, 255, 255, 0.9);
                }

                /* Updated Counter Styles */
                .widget-counter {
                    font-size: 1rem; /* Bolder and slightly larger */
                    font-weight: 800; /* Extra bold */
                    color: #fff;
                    font-variant-numeric: tabular-nums;
                    background: rgba(0,0,0,0.3);
                    padding: 4px 8px;
                    border-radius: 4px;
                    letter-spacing: -0.5px;
                    display: flex;
                    align-items: baseline;
                }

                .count-val { color: #fff; }

                .count-total { 
                    opacity: 1; /* Fully visible */
                    font-size: 1em; /* Same size as numerator */
                    color: #fff; 
                    margin-left: 2px;
                }
                
                .count-sep {
                    margin: 0 2px;
                    opacity: 0.6;
                    font-weight: 400;
                }

                /* STELLAR PROGRESS BAR - WHITE GLOW */
                .progress-track {
                    width: 100%;
                    height: 8px; /* Slightly thicker */
                    background: rgba(0,0,0,0.3);
                    border-radius: 4px;
                    overflow: visible; 
                    position: relative;
                    margin: 12px 0 16px 0; 
                    border: 1px solid rgba(255,255,255,0.1);
                }

                :global(.dark) .progress-track {
                    background: rgba(0,0,0,0.5);
                }

                .progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, rgba(255,255,255,0.5), #fff); /* Clean White Gradient */
                    width: 0%;
                    transition: width 0.3s cubic-bezier(0.22, 1, 0.36, 1);
                    border-radius: 4px;
                    position: relative;
                    box-shadow: 0 0 15px rgba(255, 255, 255, 0.6); /* White Glow */
                }

                /* Head of the beam - White Glowing Blob */
                .progress-fill::after {
                    content: '';
                    position: absolute;
                    right: -6px;
                    top: 50%;
                    transform: translateY(-50%);
                    width: 14px;
                    height: 14px;
                    background: #fff;
                    border-radius: 50%;
                    box-shadow: 0 0 20px 5px rgba(255, 255, 255, 0.8); /* Strong White Glow */
                    filter: blur(0.5px);
                    z-index: 3;
                }

                .progress-fill.glowing {
                    animation: beam-pulse 2s infinite;
                }

                @keyframes beam-pulse {
                    0%, 100% { box-shadow: 0 0 15px rgba(255, 255, 255, 0.6); }
                    50% { box-shadow: 0 0 25px rgba(255, 255, 255, 0.9); }
                }

                .unlock-message {
                    margin-top: 14px;
                    text-align: left;
                    animation: fadeIn 0.5s ease;
                    border-top: 1px dotted rgba(255,255,255,0.3);
                    padding-top: 10px;
                    position: relative;
                    z-index: 2;
                }

                .message-subtext {
                    display: block;
                    font-size: 0.6rem;
                    color: rgba(255,255,255,0.8);
                    margin-bottom: 4px;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .message-text {
                    display: block;
                    font-size: 0.85rem;
                    color: #fff;
                    font-weight: bold;
                    margin-bottom: 8px;
                    line-height: 1.4;
                    text-shadow: 0 0 5px rgba(0,0,0,0.2);
                }

                /* NEW WELCOME TEXT STYLE */
                .welcome-text {
                    font-size: 0.85rem;
                    font-weight: 900;
                    color: var(--theme-accent);
                    margin: 10px 0;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    text-shadow: 0 0 10px var(--theme-glow);
                }

                .lab-link {
                    font-size: 0.75rem;
                    color: #fff;
                    text-decoration: none;
                    font-weight: 700;
                    border-bottom: 1px solid rgba(255,255,255,0.5);
                    transition: all 0.2s;
                    display: inline-block;
                }
                
                .lab-link:hover {
                    color: var(--theme-accent);
                    border-color: var(--theme-accent);
                    text-shadow: 0 0 5px var(--theme-glow);
                }

                /* PARTICLES (Simple CSS implementation) */
                .particles-container {
                    position: absolute;
                    top: 0; left: 0; width: 100%; height: 100%;
                    pointer-events: none;
                    z-index: 1;
                    opacity: 0.4;
                }

                .particle {
                    position: absolute;
                    background: var(--theme-particle);
                    border-radius: 50%;
                    opacity: 0;
                }

                .p1 { width: 2px; height: 2px; top: 40%; left: 20%; animation: particle-float 4s infinite; }
                .p2 { width: 1px; height: 1px; top: 60%; left: 80%; animation: particle-float 5s infinite 1s; }
                .p3 { width: 3px; height: 3px; top: 20%; left: 50%; animation: particle-float 6s infinite 0.5s; }

                @keyframes particle-float {
                    0% { transform: translateY(0); opacity: 0; }
                    50% { opacity: 0.6; }
                    100% { transform: translateY(-20px); opacity: 0; }
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
