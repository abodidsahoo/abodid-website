import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const EngagementCTA = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);

    // New state for tolerance logic
    const [cooldownUntil, setCooldownUntil] = useState(0);
    const [showTime, setShowTime] = useState(0);

    useEffect(() => {
        // Check session storage for dismissal
        if (typeof window !== 'undefined' && sessionStorage.getItem('cta_dismissed') === 'true') {
            setIsDismissed(true);
            return;
        }

        const checkEngagement = () => {
            if (isDismissed) return;

            const now = Date.now();
            if (now < cooldownUntil) return; // In cooldown (temporarily hidden)

            const engagement = window.__cardEngagement;
            const scrollY = window.scrollY;

            // Condition 1: Interest shown (at least 10 reveals)
            const hasEnoughReveals = engagement && engagement.reveals >= 10;

            // Interaction Check (Active < 3s)
            const lastInteraction = engagement ? engagement.lastInteraction : 0;
            const timeSinceInteraction = now - lastInteraction;
            const isActive = timeSinceInteraction < 3000;

            // Only if user hasn't scrolled past the experience area
            // Experience area is roughly at 70vh, so scrollY < 700 is a safe bet for "not past"
            const inExperienceArea = scrollY < 700;

            if (isVisible) {
                // TOLERANCE LOGIC:
                // If it's been visible for > 8 seconds...
                // AND the user is STILL playing (active)...
                // Then hide it (they are ignored it/busy).
                if (now - showTime > 8000 && isActive) {
                    setIsVisible(false);
                    setCooldownUntil(now + 20000); // Hide for 20s before checking again
                }

                // Also hide if they scroll away
                if (!inExperienceArea) {
                    setIsVisible(false);
                }
            } else {
                // LOGIC: Show if engaged + in area.
                // We REMOVED the "isIdle" check. It can appear while playing.
                if (hasEnoughReveals && inExperienceArea) {
                    setIsVisible(true);
                    setShowTime(now);
                }
            }
        };

        const interval = setInterval(checkEngagement, 1000);
        window.addEventListener('scroll', checkEngagement);

        return () => {
            clearInterval(interval);
            window.removeEventListener('scroll', checkEngagement);
        };
    }, [isVisible, isDismissed, cooldownUntil, showTime]);

    const handleDismiss = () => {
        setIsVisible(false);
        setIsDismissed(true);
        if (typeof window !== 'undefined') {
            sessionStorage.setItem('cta_dismissed', 'true');
        }
    };

    if (isDismissed || (!isVisible && !cooldownUntil)) return null;
    // ^ Note: We keep the component mounted if it's just temporarily hidden, 
    // but returning null when invisible is fine as Interval needs to run?
    // Actually, if we return null here, the Effect cleanup will run and clear interval?
    // Wait, if !isVisible, we return NULL.
    // DOES THE EFFECT RUN if we return null? NO. 
    // The hook is inside the component. If the component renders null, does it unmount? 
    // No, React components can return null and still run hooks.
    // BUT we must be careful. 
    // Let's stick to the previous pattern: return null at the end if not visible.

    // Actually, looking at previous code:
    // if (isDismissed || !isVisible) return null;
    // THIS IS A PERF OPTIMIZATION BUT IT BREAKS THE INTERVAL IF IT UNMOUNTS?
    // Wait, <EngagementCTA /> is likely rendered in a parent.
    // If it returns null, the component instance still exists? 
    // NO. If a functional component returns null, it's still mounted.
    // The hooks still run.
    // Correct.

    // However, to be safe and clean, let's keep the return logic at the end.

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
