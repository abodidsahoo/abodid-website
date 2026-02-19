import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// --- SUB-COMPONENTS EXTRACTED TO PREVENT RE-MOUNT ON PARENT RENDER ---

const Typewriter = ({ text, delay = 0, speed = 0.04, className = "" }) => {
    const [displayedText, setDisplayedText] = useState('');
    const [started, setStarted] = useState(false);
    const [isComplete, setIsComplete] = useState(false);

    useEffect(() => {
        let intervalId;
        const startTimeout = setTimeout(() => {
            setStarted(true);
            let index = 0;
            setDisplayedText('');

            intervalId = setInterval(() => {
                if (index >= text.length) {
                    clearInterval(intervalId);
                    setIsComplete(true);
                    return;
                }
                const char = text.charAt(index);
                setDisplayedText(prev => prev + char);
                index++;
            }, speed * 1000);

        }, delay * 1000);

        return () => {
            clearTimeout(startTimeout);
            if (intervalId) clearInterval(intervalId);
        };
    }, [text, speed, delay]);

    const showCursor = started && !isComplete;

    return (
        <span className={`${className} typewriter-container`}>
            {displayedText}
            <span
                style={{
                    opacity: showCursor ? 1 : 0,
                    display: 'inline-block',
                    marginLeft: '1px',
                    fontWeight: 200,
                    width: '10px'
                }}
            >
                _
            </span>
        </span>
    );
};

const SegmentedTypewriter = ({ segments, delay = 0, speed = 0.04, className = "" }) => {
    const [visibleSegments, setVisibleSegments] = useState([]);
    const [started, setStarted] = useState(false);
    const [isComplete, setIsComplete] = useState(false);

    useEffect(() => {
        let intervalId;
        const startTimeout = setTimeout(() => {
            setStarted(true);
            let segIdx = 0;
            let charIdx = 0;
            setVisibleSegments([{ ...segments[0], text: '' }]);

            intervalId = setInterval(() => {
                if (segIdx >= segments.length) {
                    clearInterval(intervalId);
                    setIsComplete(true);
                    return;
                }

                const targetSegment = segments[segIdx];
                if (charIdx < targetSegment.text.length) {
                    const char = targetSegment.text.charAt(charIdx);
                    setVisibleSegments(prev => {
                        const newSegs = [...prev];
                        newSegs[segIdx] = { ...newSegs[segIdx], text: newSegs[segIdx].text + char };
                        return newSegs;
                    });
                    charIdx++;
                } else {
                    segIdx++;
                    charIdx = 0;
                    if (segIdx < segments.length) {
                        setVisibleSegments(prev => [...prev, { ...segments[segIdx], text: '' }]);
                    }
                }
            }, speed * 1000);

        }, delay * 1000);

        return () => {
            clearTimeout(startTimeout);
            if (intervalId) clearInterval(intervalId);
        };
    }, [segments, delay, speed]);

    const showCursor = started && !isComplete;

    return (
        <span className={`${className} typewriter-container`}>
            {visibleSegments.map((seg, i) => (
                <span key={i} style={{ color: seg.color || 'inherit' }}>
                    {seg.text}
                </span>
            ))}
            <span
                style={{
                    opacity: showCursor ? 1 : 0,
                    display: 'inline-block',
                    marginLeft: '1px',
                    fontWeight: 200,
                    width: '10px'
                }}
            >
                _
            </span>
        </span>
    );
};

// 3. Sequence Typewriter (Deletes itself)
const SequenceTypewriter = ({ text, delay = 0, speed = 0.05, onTypingComplete, onSequenceTrigger, onSequenceEnd }) => {
    const [display, setDisplay] = useState('');
    const [showCursor, setShowCursor] = useState(false);
    const completionTriggered = useRef(false);
    const triggerRef = useRef(false); // Local ref to prevent double firing
    const pauseBeforeDeleteMs = 650;
    const endBufferMs = 50;

    useEffect(() => {
        let timeout;
        let interval;
        let delInterval;

        timeout = setTimeout(() => {
            setShowCursor(true);
            let idx = 0;

            interval = setInterval(() => {
                if (idx >= text.length) {
                    clearInterval(interval);

                    // Brief hold before deleting
                    if (!completionTriggered.current) {
                        completionTriggered.current = true;

                        setTimeout(() => {
                            startDeletion();
                        }, pauseBeforeDeleteMs);
                    }
                    return;
                }
                setDisplay(text.substring(0, idx + 1));
                idx++;
            }, speed * 1000);
        }, delay * 1000);

        const startDeletion = () => {
            let idx = text.length;
            const halfLength = Math.floor(text.length / 2);
            const deleteIntervalMs = speed * 1000;

            delInterval = setInterval(() => {
                setDisplay(text.substring(0, idx - 1));
                idx--;

                // TRIGGER PHYSICS: When text is deleted halfway
                // "By the time it gets deleted halfway, the card drops."
                if (idx <= halfLength) {
                    if (!triggerRef.current) {
                        triggerRef.current = true;
                        if (onSequenceTrigger) onSequenceTrigger();
                    }
                }

                // Cleanup when text is fully GONE
                if (idx <= 0) {
                    clearInterval(delInterval);

                    // Small buffer before unmounting self
                    setTimeout(() => {
                        if (onSequenceEnd) onSequenceEnd();
                    }, endBufferMs);
                }
            }, deleteIntervalMs); // Match typewriter reveal cadence
        };

        return () => {
            clearTimeout(timeout);
            clearInterval(interval);
            clearInterval(delInterval);
        };
    }, [text, delay, speed, pauseBeforeDeleteMs, endBufferMs]);

    return (
        <span className="typewriter-container">
            {display}
            <span style={{ opacity: showCursor ? 1 : 0, display: 'inline-block', marginLeft: '1px', fontWeight: 200 }}>_</span>
        </span>
    );
};

// --- MAIN COMPONENT ---

const IntroSequence = ({ onPhysicsStart, onSequenceEnd }) => {
    // Stage logic control
    const [stage, setStage] = useState(0);

    // Prevent duplicate triggers GLOBAL to this component instance
    const triggerRef = useRef({
        physicsStarted: false
    });

    useEffect(() => {
        const timeline = [
            { delay: 300, action: () => setStage(1) },
            { delay: 2500, action: () => setStage(2) },
            { delay: 7000, action: () => setStage(3) }
        ];

        let timeouts = [];
        timeline.forEach(item => {
            timeouts.push(setTimeout(item.action, item.delay));
        });
        return () => timeouts.forEach(clearTimeout);
    }, []);

    return (
        <div className="intro-sequence-container">
            <AnimatePresence mode="wait">
                {stage === 1 && (
                    <motion.div
                        key="stage1"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, transition: { duration: 0.3 } }}
                        className="intro-content"
                    >
                        <div className="line-welcome">
                            <Typewriter text="Hi I'm Abodid" speed={0.03} />
                        </div>
                        <div className="line-headline">
                            <Typewriter text="Welcome to my Digital Garden" speed={0.04} delay={0.35} />
                        </div>
                    </motion.div>
                )}

                {stage === 2 && (
                    <motion.div
                        key="stage2"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, transition: { duration: 0.3 } }}
                        className="intro-content"
                    >
                        <div className="line-narrative">
                            <div className="narrative-large">
                                <SegmentedTypewriter
                                    segments={[
                                        {
                                            text: "Here's a glimpse into three years of my ", color: 'var(--intro-text)'
                                        },
                                        { text: '"high on art" ', color: 'var(--intro-accent)' },
                                        {
                                            text: 'life in ', color: 'var(--intro-text)'
                                        },
                                        { text: 'London', color: 'var(--intro-text)' }

                                    ]}
                                    speed={0.04}
                                    delay={0.2}
                                />
                            </div>
                        </div>
                    </motion.div>
                )}

                {stage === 3 && (
                    <motion.div
                        key="stage3"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="intro-content center-focus"
                    >
                        <div className="line-instruction-large">
                            {/* USE KEY TO FORCE REMOUNT IF NEEDED, BUT HERE PREVENTING DOUBLE RENDER */}
                            <SequenceTypewriter
                                key="intro-sequence-typewriter"
                                text="keep hovering"
                                speed={0.04}
                                onSequenceTrigger={() => {
                                    // Guard against double firing
                                    if (triggerRef.current.physicsStarted) return;
                                    triggerRef.current.physicsStarted = true;
                                    if (onPhysicsStart) onPhysicsStart();
                                }}
                                onSequenceEnd={onSequenceEnd}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`
                .intro-sequence-container {
                    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                    z-index: 9999; display: flex; align-items: center; justify-content: center;
                    color: var(--intro-text); font-family: "VT323", monospace; pointer-events: none;
                    --intro-text-size: 2rem;
                    --intro-text: #ffffff;
                    --intro-accent: #37f147ff;
                }
                
                /* LIGHT MODE OVERRIDES */
                :global([data-theme="light"]) .intro-sequence-container {
                    --intro-text: #000000 !important;
                    --intro-accent: #0000ff; /* Blue accent for light mode */
                    background: rgba(255, 255, 255, 0.98);
                    color: #000000 !important;
                }

                .intro-content {
                    position: relative; width: 100%; max-width: 1200px;
                    display: flex; flex-direction: column; align-items: center;
                    justify-content: center; text-align: center; padding: 2rem;
                    color: var(--intro-text); /* Ensure inheritance */
                }
                .line-welcome {
                    font-size: var(--intro-text-size);
                    margin-bottom: 0.25rem;
                    font-weight: 400;
                    letter-spacing: -0.02em;
                    line-height: 1.1;
                    opacity: 0.9;
                    color: var(--intro-text); /* Force color */
                }
                .line-headline {
                    font-size: var(--intro-text-size);
                    font-weight: 400;
                    letter-spacing: -0.02em;
                    line-height: 1.1;
                    margin-bottom: 0;
                    opacity: 0.9;
                    color: var(--intro-text); /* Force color */
                }
                .line-narrative {
                    display: flex; flex-direction: column; align-items: center;
                    gap: 0px; max-width: 1200px; 
                }
                .narrative-large {
                    font-size: var(--intro-text-size);
                    line-height: 1.0; font-weight: 400; 
                    display: flex; 
                    flex-direction: row;
                    align-items: baseline;
                    justify-content: center;
                    white-space: nowrap; 
                    flex-wrap: nowrap;
                    width: auto;
                    max-width: 100vw;
                    color: var(--intro-text); /* Force color */
                }
                .line-instruction-large {
                    font-size: var(--intro-text-size);
                    font-weight: 400;
                    letter-spacing: -0.02em;
                    color: var(--intro-text); /* Force color */
                }
                .typewriter-container { 
                    display: inline-block; 
                    white-space: pre-wrap;
                    color: var(--intro-text) !important; /* FORCE INHERITANCE */
                }
                .typewriter-container span {
                    color: var(--intro-text) !important;
                }

                @media (max-width: 768px) {
                    .intro-sequence-container { --intro-text-size: 1.8rem; }
                }
            `}</style>
        </div>
    );
};

export default IntroSequence;
