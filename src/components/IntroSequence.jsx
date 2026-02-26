import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// --- SUB-COMPONENTS EXTRACTED TO PREVENT RE-MOUNT ON PARENT RENDER ---
const STAGE_TWO_SEGMENTS = [
    { text: "Here's a glimpse into my ", color: 'var(--intro-text)' },
    { text: '"high on art" ', color: 'var(--intro-accent)' },
    { text: 'life in ', color: 'var(--intro-text)' },
    { text: 'London', color: 'var(--intro-text)' },
];

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

const SegmentedSequenceTypewriter = ({
    segments,
    delay = 0,
    speed = 0.04,
    className = "",
    preDeleteCursorFlickers = 3,
    cursorFlickerMs = 180,
    triggerAtDeleteRatio = 0.5,
    triggerAtRemainingChars = null,
    deleteMinSpeedFactor = 0.35,
    deleteAccelerationExponent = 1.7,
    onSequenceTrigger,
    onSequenceEnd,
}) => {
    const [visibleCharCount, setVisibleCharCount] = useState(0);
    const [showCursor, setShowCursor] = useState(false);
    const [started, setStarted] = useState(false);
    const triggerRef = useRef(false);
    const onSequenceTriggerRef = useRef(onSequenceTrigger);
    const onSequenceEndRef = useRef(onSequenceEnd);

    useEffect(() => {
        onSequenceTriggerRef.current = onSequenceTrigger;
        onSequenceEndRef.current = onSequenceEnd;
    }, [onSequenceTrigger, onSequenceEnd]);

    useEffect(() => {
        const totalLength = segments.reduce(
            (sum, segment) => sum + ((segment?.text || '').length),
            0,
        );
        const cadenceMs = Math.max(12, speed * 1000);

        let typingIntervalId;
        let deletionTimeoutId;
        let destroyed = false;
        const timeoutIds = [];

        const startDeletion = () => {
            if (destroyed) return;
            let remaining = totalLength;
            const minDeleteCadenceMs = Math.max(
                8,
                cadenceMs * Math.max(0.12, Math.min(1, deleteMinSpeedFactor)),
            );

            const scheduleDeleteTick = () => {
                if (destroyed) return;
                remaining = Math.max(0, remaining - 1);
                setVisibleCharCount(remaining);

                const deleteProgress = totalLength > 0
                    ? 1 - (remaining / totalLength)
                    : 1;
                const triggerByRemaining =
                    Number.isFinite(triggerAtRemainingChars) &&
                    triggerAtRemainingChars >= 0 &&
                    remaining <= triggerAtRemainingChars;
                const triggerByRatio = deleteProgress >= triggerAtDeleteRatio;

                if (!triggerRef.current && (triggerByRemaining || triggerByRatio)) {
                    triggerRef.current = true;
                    if (onSequenceTriggerRef.current) onSequenceTriggerRef.current();
                }

                if (remaining <= 0) {
                    setShowCursor(false);
                    if (onSequenceEndRef.current) onSequenceEndRef.current();
                    return;
                }

                const easedProgress = Math.pow(
                    Math.max(0, Math.min(1, deleteProgress)),
                    Math.max(1, deleteAccelerationExponent),
                );
                const nextDelayMs =
                    cadenceMs - ((cadenceMs - minDeleteCadenceMs) * easedProgress);
                deletionTimeoutId = setTimeout(
                    scheduleDeleteTick,
                    Math.max(minDeleteCadenceMs, nextDelayMs),
                );
            };

            deletionTimeoutId = setTimeout(scheduleDeleteTick, cadenceMs);
        };

        const startCursorFlickerThenDeletion = () => {
            if (destroyed) return;
            const flickers = Math.max(0, preDeleteCursorFlickers);
            if (flickers === 0) {
                startDeletion();
                return;
            }

            let togglesRemaining = flickers * 2;
            let cursorVisible = true;

            const flickerTick = () => {
                if (destroyed) return;
                if (togglesRemaining <= 0) {
                    setShowCursor(true);
                    startDeletion();
                    return;
                }

                cursorVisible = !cursorVisible;
                setShowCursor(cursorVisible);
                togglesRemaining -= 1;
                timeoutIds.push(setTimeout(flickerTick, cursorFlickerMs));
            };

            timeoutIds.push(setTimeout(flickerTick, cursorFlickerMs));
        };

        const startTimeoutId = setTimeout(() => {
            if (destroyed) return;

            setStarted(true);
            setShowCursor(true);
            setVisibleCharCount(0);

            if (totalLength === 0) {
                startCursorFlickerThenDeletion();
                return;
            }

            let typed = 0;
            typingIntervalId = setInterval(() => {
                typed += 1;
                if (typed >= totalLength) {
                    typed = totalLength;
                    setVisibleCharCount(typed);
                    clearInterval(typingIntervalId);
                    startCursorFlickerThenDeletion();
                    return;
                }
                setVisibleCharCount(typed);
            }, cadenceMs);
        }, delay * 1000);

        timeoutIds.push(startTimeoutId);

        return () => {
            destroyed = true;
            clearInterval(typingIntervalId);
            clearTimeout(deletionTimeoutId);
            timeoutIds.forEach(clearTimeout);
        };
    }, [
        segments,
        delay,
        speed,
        preDeleteCursorFlickers,
        cursorFlickerMs,
        triggerAtDeleteRatio,
        triggerAtRemainingChars,
        deleteMinSpeedFactor,
        deleteAccelerationExponent,
    ]);

    let startCursor = 0;

    return (
        <span className={`${className} typewriter-container`}>
            {segments.map((segment, i) => {
                const text = segment?.text || '';
                const start = startCursor;
                startCursor += text.length;
                const visibleCountForSegment = Math.max(
                    0,
                    Math.min(text.length, visibleCharCount - start),
                );
                return (
                    <span key={i} style={{ color: segment?.color || 'inherit' }}>
                        {text.slice(0, visibleCountForSegment)}
                    </span>
                );
            })}
            <span
                style={{
                    opacity: started && showCursor ? 1 : 0,
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
                            <Typewriter text="Hi, I'm Abodid." speed={0.03} />
                        </div>
                        <div className="line-headline">
                            <Typewriter text="Welcome to my digital garden." speed={0.04} delay={0.35} />
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
                                <SegmentedSequenceTypewriter
                                    segments={STAGE_TWO_SEGMENTS}
                                    speed={0.04}
                                    delay={0.2}
                                    preDeleteCursorFlickers={3}
                                    cursorFlickerMs={170}
                                    triggerAtDeleteRatio={1}
                                    triggerAtRemainingChars={0}
                                    deleteMinSpeedFactor={0.3}
                                    deleteAccelerationExponent={1.9}
                                    onSequenceEnd={() => {
                                        if (!triggerRef.current.physicsStarted) {
                                            triggerRef.current.physicsStarted = true;
                                            if (onPhysicsStart) onPhysicsStart();
                                        }
                                        if (onSequenceEnd) onSequenceEnd();
                                    }}
                                />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`
                .intro-sequence-container {
                    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                    z-index: 9999; display: flex; align-items: center; justify-content: center;
                    color: var(--intro-text); font-family: var(--font-custom-3); pointer-events: none;
                    --intro-text-size: 2rem;
                    --intro-text: #ffffff;
                    --intro-accent: #ffff00;
                }
                
                /* LIGHT MODE OVERRIDES - Using html selector as data-theme is on documentElement */
                html[data-theme="light"] .intro-sequence-container {
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
                /* Removed force-color override to allow segments to have their own colors */

                @media (max-width: 768px) {
                    .intro-sequence-container { --intro-text-size: 1.8rem; }
                }
            `}</style>
        </div>
    );
};

export default IntroSequence;
