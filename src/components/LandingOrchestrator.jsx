import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CardStacker from './CardStacker';
import IntroSequence from './IntroSequence';
import ExperienceModule from './ExperienceModule';
import { useCardPhysics } from '../hooks/useCardPhysics';
import { useHandTracking } from '../hooks/useHandTracking';

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

    // 3. Hand Tracking State
    const [handControlEnabled, setHandControlEnabled] = useState(false);
    const [calibrationProgress, setCalibrationProgress] = useState(0);

    // 4. Unified Physics
    const { stack, lastAction, containerRef, spawnCardFromGesture } = useCardPhysics({
        initialImages: images,
        isActive: introComplete
    });

    // Create ref for gesture callback
    const spawnRef = useRef(spawnCardFromGesture);
    useEffect(() => {
        spawnRef.current = spawnCardFromGesture;
    }, [spawnCardFromGesture]);

    // 5. Hand Tracking Hook
    const {
        videoRef,
        canvasRef,
        onboardingState,
        isTracking
    } = useHandTracking({
        onGesture: (dx, dy, angle) => {
            console.log('👋 Landing Hand gesture!', { dx, dy, angle });
            spawnRef.current(dx, dy, angle);
        },
        threshold: 150,
        isActive: handControlEnabled
    });

    // Calibration Progress Tracker
    useEffect(() => {
        let interval;
        if (onboardingState === 'calibrating') {
            let progress = 0;
            interval = setInterval(() => {
                progress += 10;
                setCalibrationProgress(progress);
                if (progress >= 100) clearInterval(interval);
            }, 100);
        } else {
            setCalibrationProgress(0);
        }
        return () => clearInterval(interval);
    }, [onboardingState]);

    const toggleHandControl = () => {
        setHandControlEnabled(!handControlEnabled);
    };

    const getStatusMessage = () => {
        switch (onboardingState) {
            case 'requesting_camera': return 'Requesting camera...';
            case 'waiting_for_hand': return 'Show your hand';
            case 'calibrating': return 'Calibrating...';
            case 'ready': return 'Gesture Control Active!';
            case 'hand_lost_temporarily': return 'Hand lost';
            default: return '';
        }
    };
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
            {/* ACTIVATE BUTTONS */}
            <AnimatePresence>
                {introComplete && !isScrolled && (
                    <motion.div
                        className="start-overlay"
                        initial={{ y: -100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -50, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.5 }}
                    >
                        <div className="activation-stack">
                            {/* Original Experience Button */}
                            {!experienceStarted && (
                                <button className="start-btn" onClick={handleActivate}>
                                    <div className="start-label-large">Click here</div>
                                    <div className="start-label-small">FOR AN AUDIOVISUAL EXPERIENCE</div>
                                </button>
                            )}

                            {/* New Hand Control Button */}
                            <button
                                className={`start-btn gesture-btn ${handControlEnabled ? 'active' : ''}`}
                                onClick={toggleHandControl}
                            >
                                <div className="start-label-large">
                                    {handControlEnabled ? '👋 Hand Control ON' : '✋ Activate Hand Control'}
                                </div>
                                {handControlEnabled && onboardingState === 'ready' && (
                                    <div className="start-label-small status-success">✓ Gesture Control Active!</div>
                                )}
                                {handControlEnabled && onboardingState !== 'ready' && (
                                    <div className="start-label-small">{getStatusMessage()}</div>
                                )}
                                {!handControlEnabled && (
                                    <div className="start-label-small">USE YOUR HANDS TO BROWSE</div>
                                )}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Camera Preview Window */}
            {handControlEnabled && (
                <div className="camera-preview-landing">
                    <video ref={videoRef} autoPlay playsInline muted style={{ display: 'none' }} />
                    <canvas ref={canvasRef} className="preview-canvas" />
                    <div className="preview-status">
                        <div className="status-dot pulsing"></div>
                        <span>{getStatusMessage()}</span>
                        {onboardingState === 'calibrating' && (
                            <div className="calibration-bar">
                                <div className="calibration-fill" style={{ width: `${calibrationProgress}%` }} />
                            </div>
                        )}
                    </div>
                </div>
            )}

            <style>{`
                .start-overlay {
                    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                    z-index: 10000;
                    display: flex; justify-content: flex-end; align-items: flex-start;
                    padding: 100px 4vw 0 0; /* Tighter top padding */
                    pointer-events: none; /* Pass through clicks when not on button */
                }
                .activation-stack {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    align-items: flex-end;
                    pointer-events: auto;
                }
                .start-btn {
                    background: transparent;
                    border: 1px solid rgba(255, 255, 255, 0.4);
                    padding: 0.8rem 1.5rem;
                    color: white;
                    cursor: pointer;
                    text-align: center;
                    font-family: 'Space Mono', monospace;
                    transition: all 0.3s ease;
                    background: transparent;
                    backdrop-filter: blur(4px);
                    border-radius: 10px;
                    display: flex; 
                    flex-direction: column;
                    align-items: center;
                    gap: 0.6rem;
                    min-width: 280px;
                }
                .start-btn.gesture-btn.active {
                    border-color: rgba(76, 175, 80, 0.6);
                    background: rgba(76, 175, 80, 0.05);
                }
                .status-success {
                    color: #4CAF50;
                    font-weight: 600;
                }
                .start-btn:hover {
                    border-color: rgba(255, 255, 255, 0.9);
                    background: rgba(255, 255, 255, 0.05);
                    box-shadow: 0 0 15px rgba(255, 255, 255, 0.1);
                }
                .start-label-large {
                    font-size: 1rem; 
                    text-transform: uppercase; 
                    letter-spacing: 0.1em;
                    font-weight: 300;
                    line-height: 1;
                }
                .start-label-small {
                    font-size: 0.57rem; 
                    text-transform: uppercase; 
                    letter-spacing: 0.1em; /* Spacing to likely match width of Activate */
                    opacity: 1; 
                    line-height: 1;
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

                .camera-preview-landing {
                    position: fixed;
                    bottom: 32px;
                    right: 32px;
                    width: 240px;
                    height: 180px;
                    z-index: 10000;
                    background: rgba(0, 0, 0, 0.9);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
                    backdrop-filter: blur(10px);
                    pointer-events: none;
                }
                .preview-canvas {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                .preview-status {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    padding: 8px 12px;
                    background: linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent);
                    color: white;
                    font-family: 'Space Mono', monospace;
                    font-size: 0.7rem;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .status-dot {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: #4CAF50;
                }
                .status-dot.pulsing {
                    animation: pulse 2s infinite;
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.6; transform: scale(1.2); }
                }
                .calibration-bar {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    height: 2px;
                    background: rgba(255, 255, 255, 0.2);
                }
                .calibration-fill {
                    height: 100%;
                    background: #4CAF50;
                    transition: width 0.1s linear;
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
                stack={stack}
                lastAction={lastAction}
                containerRef={containerRef}
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
