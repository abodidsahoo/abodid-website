import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const EngagementCTA = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);

    useEffect(() => {
        // Check session storage for dismissal
        if (typeof window !== 'undefined' && sessionStorage.getItem('cta_dismissed') === 'true') {
            setIsDismissed(true);
            return;
        }

        const checkEngagement = () => {
            if (isDismissed) return;

            const engagement = window.__cardEngagement;
            const scrollY = window.scrollY;

            // Condition (a): 15 cards revealed
            // Condition (b): 15 seconds since first interaction
            const hasEnoughReveals = engagement && engagement.reveals >= 15;
            const hasEnoughTime = engagement && engagement.firstInteraction && (Date.now() - engagement.firstInteraction > 15000);

            // Only if user hasn't scrolled past the experience area
            // Experience area is roughly at 70vh, so scrollY < 700 is a safe bet for "not past"
            const inExperienceArea = scrollY < 700;

            if (hasEnoughReveals && hasEnoughTime && inExperienceArea) {
                if (!isVisible) setIsVisible(true);
            } else if (isVisible && !inExperienceArea) {
                // Dimiss permanently if they scroll away while it's active
                handleDismiss();
            }
        };

        const interval = setInterval(checkEngagement, 1000);
        window.addEventListener('scroll', checkEngagement);

        return () => {
            clearInterval(interval);
            window.removeEventListener('scroll', checkEngagement);
        };
    }, [isVisible, isDismissed]);

    const handleDismiss = () => {
        setIsVisible(false);
        setIsDismissed(true);
        if (typeof window !== 'undefined') {
            sessionStorage.setItem('cta_dismissed', 'true');
        }
    };

    if (isDismissed || !isVisible) return null;

    return (
        <div className="engagement-cta-container">
            <AnimatePresence>
                {isVisible && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="engagement-cta-box"
                    >
                        <p className="cta-text">Love the photos?</p>
                        <a href="/contact" className="cta-link" onClick={handleDismiss}>Let's work together.</a>
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`
                .engagement-cta-container {
                    position: fixed;
                    top: 45vh; /* Parallel to the card stack */
                    right: 48px;
                    z-index: 10005; /* Above everything */
                    pointer-events: none;
                }

                .engagement-cta-box {
                    pointer-events: auto;
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    gap: 0.4rem;
                    text-align: right;
                    max-width: 320px;
                }

                .cta-text {
                    font-family: 'Inconsolata', monospace;
                    font-size: 0.75rem;
                    color: rgba(255, 255, 255, 0.5);
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    margin: 0;
                }

                .cta-link {
                    font-family: 'Space Mono', monospace;
                    font-size: 0.8rem;
                    color: white;
                    letter-spacing: 0.05em;
                    text-decoration: none;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.4);
                    padding-bottom: 1px;
                    transition: all 0.3s ease;
                }

                .cta-link:hover {
                    color: rgba(255, 255, 255, 1);
                    border-bottom-color: rgba(255, 255, 255, 0.8);
                }

                @media (max-width: 768px) {
                    .engagement-cta-container {
                        display: none;
                    }
                }
            `}</style>
        </div>
    );
};

export default EngagementCTA;
