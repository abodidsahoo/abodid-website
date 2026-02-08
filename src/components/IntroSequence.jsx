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

                    // Wait 1.5s before deleting
                    if (!completionTriggered.current) {
                        completionTriggered.current = true;

                        setTimeout(() => {
                            startDeletion();
                        }, 1500);
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
                    }, 100);
                }
            }, 30); // Fast deletion
        };

        return () => {
            clearTimeout(timeout);
            clearInterval(interval);
            clearInterval(delInterval);
        };
    }, [text, delay, speed]);

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
                            <Typewriter text="Hi, I am Abodid" speed={0.03} />
                        </div>
                        <div className="line-headline">
                            <Typewriter text="Welcome to my Digital Garden" speed={0.04} delay={0.5} />
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
                                            text: 'here is a glimpse into my ', color: 'white'
                                        },
                                        { text: '"high on art" ', color: '#37f147ff' },
                                        {
                                            text: 'life in ', color: 'white'
                                        },
                                        { text: 'London.', color: 'white' }

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
                                text="Keep hovering"
                                speed={0.05}
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
                    color: #fff; font-family: "Pixelify Sans", sans-serif; pointer-events: none;
                }
                .intro-content {
                    position: relative; width: 100%; max-width: 1200px;
                    display: flex; flex-direction: column; align-items: center;
                    justify-content: center; text-align: center; padding: 2rem;
                }
                .line-welcome {
                    font-size: 1.5rem; text-transform: uppercase; letter-spacing: 0.2rem;
                    margin-bottom: 0.5rem; font-weight: 300; opacity: 0.8;
                }
                .line-headline {
                    font-size: 3rem; font-weight: 400; letter-spacing: -0.04em;
                    line-height: 1.1; margin-bottom: 2rem;
                    text-shadow: 0 0 15px rgba(255, 255, 255, 0.2);
                }
                .line-narrative {
                    display: flex; flex-direction: column; align-items: center;
                    gap: 0px; max-width: 1200px; 
                }
                .narrative-large {
                    font-size: 2rem;
                    line-height: 1.0; font-weight: 400; 
                    display: flex; 
                    flex-direction: row;
                    align-items: baseline;
                    justify-content: center;
                    white-space: nowrap; 
                    flex-wrap: nowrap;
                    width: auto;
                    max-width: 100vw;
                }
                .line-instruction-large {
                    font-size: 2rem; text-transform: uppercase; font-weight: 400; letter-spacing: 0.05em;
                }
                .typewriter-container { display: inline-block; white-space: pre-wrap; }

                @media (max-width: 1024px) {
                    .narrative-large { 
                        font-size: 3.5rem; 
                     }
                }
                @media (max-width: 768px) {
                    .line-headline { font-size: 2.5rem; }
                    .narrative-large { font-size: 2.0rem; }
                    .line-instruction-large { font-size: 2.5rem; }
                    .line-welcome { font-size: 1rem; margin-bottom: 1rem; }
                }
            `}</style>
        </div>
    );
};

export default IntroSequence;
