import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CardStacker from './CardStacker';
import IntroSequence from './IntroSequence';
import ExperienceModule from './ExperienceModule';

const LandingOrchestrator = ({ images, anchorX, anchorY, audioSrc, captions }) => {
    // 1. Intro Logic
    // Starts immediately on mount
    const [introComplete, setIntroComplete] = useState(false); // Controls Physics & Button Appearance
    const [introVisible, setIntroVisible] = useState(true);   // Controls Intro Overlay Visibility

    // 2. Audio Experience Logic
    // We mount EngagementCTA immediately so 'window.triggerAudio' is available,
    // but we use 'visualStarted' to control the overlay visibility if needed, 
    // or we just trust EngagementCTA to be hidden until active.
    // Actually EngagementCTA renders ExperienceModule which is usually hidden until started.
    const [experienceStarted, setExperienceStarted] = useState(false);

    // 3. Scroll Lock Logic
    useEffect(() => {
        // Lock scroll initially
        if (!introComplete) {
            document.body.style.overflow = 'hidden';
            document.body.style.height = '100vh'; // Force lock
        } else {
            // Unlock when cards drop (introComplete)
            document.body.style.overflow = '';
            document.body.style.height = '';
        }

        return () => {
            // Cleanup if component unmounts
            document.body.style.overflow = '';
            document.body.style.height = '';
        };
    }, [introComplete]);

    // 4. Scroll Logic (Hint & Button Visibility)
    const [isScrolled, setIsScrolled] = useState(false); // Toggle for button
    const [hintDismissed, setHintDismissed] = useState(false); // One-way latch for hint

    useEffect(() => {
        if (!introComplete) return;

        const handleScroll = () => {
            const scrolled = window.scrollY > 100; // Threshold for hiding button
            setIsScrolled(scrolled);
            if (window.scrollY > 50) setHintDismissed(true);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [introComplete]);

    const handleActivate = () => {
        // CRITICAL: Call this inside the user click handler to unlock Audio Context
        if (window.triggerAudio) {
            window.triggerAudio();
        }
        setExperienceStarted(true);
    };

    return (
        <>
            {/* ACTIVATE BUTTON (Visible when at top & intro complete) */}
            <AnimatePresence>
                {introComplete && !experienceStarted && !isScrolled && (
                    <motion.div
                        className="start-overlay"
                        initial={{ y: -100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -50, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.5 }}
                    >
                        <button className="start-btn" onClick={handleActivate}>
                            <div className="start-label-small">Activate audio visual</div>
                            <div className="start-label-large">Experience</div>
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`
                .start-overlay {
                    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                    z-index: 10000;
                    display: flex; justify-content: flex-end; align-items: flex-start;
                    padding: 120px 4vw 0 0; /* Below header, right aligned */
                    pointer-events: none; /* Pass through clicks when not on button */
                }
                .start-btn {
                    background: transparent;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    padding: 1.5rem 3rem;
                    color: white;
                    cursor: pointer;
                    text-align: center;
                    font-family: 'Space Mono', monospace;
                    transition: all 0.3s ease;
                    position: relative;
                    overflow: hidden;
                    pointer-events: auto; /* Enable clicks on button */
                    background: transparent; /* Clean transparent */
                    backdrop-filter: none;
                }
                .start-btn:hover {
                    border-color: rgba(255, 255, 255, 0.8);
                    box-shadow: 0 0 25px rgba(255, 255, 255, 0.15), inset 0 0 15px rgba(255, 255, 255, 0.1);
                    text-shadow: 0 0 8px rgba(255,255,255,0.5);
                }
                .start-label-small {
                    font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.1em;
                    opacity: 0.7; margin-bottom: 0.5rem;
                }
                .start-label-large {
                    font-size: 1.5rem; text-transform: uppercase; letter-spacing: 0.2em;
                    font-weight: 700;
                }

                /* Scroll Hint Styles */
                .scroll-hint {
                    position: fixed; 
                    bottom: 5vh; 
                    left: 50%;
                    transform: translateX(-50%);
                    font-family: "Space Mono", monospace;
                    font-size: 0.9rem;
                    color: rgba(255, 255, 255, 0.6);
                    animation: bounce 2s infinite;
                    z-index: 50; 
                    pointer-events: none;
                }
                @keyframes bounce {
                    0%, 20%, 50%, 80%, 100% { transform: translateX(-50%) translateY(0); }
                    40% { transform: translateX(-50%) translateY(-10px); }
                    60% { transform: translateX(-50%) translateY(-5px); }
                }
            `}</style>


            {/* INTRO SEQUENCE */}
            {introVisible && (
                <IntroSequence
                    onPhysicsStart={() => {
                        setIntroComplete(true);
                    }}
                    onSequenceEnd={() => {
                        setIntroVisible(false);
                    }}
                />
            )}

            {/* CARD STACKER */}
            <CardStacker
                images={images}
                anchorX={anchorX}
                anchorY={anchorY}
                active={introComplete}
            />

            {/* SCROLL HINT */}
            <AnimatePresence>
                {introComplete && !hintDismissed && (
                    <motion.div
                        className="scroll-hint"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1, transition: { delay: 1.0, duration: 1.0 } }}
                        exit={{ opacity: 0 }}
                    >
                        SCROLL DOWN
                    </motion.div>
                )}
            </AnimatePresence>

            {/* POST-INTRO CTA (Experience Module) 
                ALWAYS MOUNTED (to register window.triggerAudio) 
                but visual state controlled by experienceStarted
            */}
            <ExperienceModule
                autoStart={experienceStarted}
                src={audioSrc}
                captions={captions}
            />
        </>
    );
};

export default LandingOrchestrator;
