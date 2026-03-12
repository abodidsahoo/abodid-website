import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useHandTracking } from '../../hooks/useHandTracking';
import { useAudioTrigger } from '../../hooks/useAudioTrigger';
import { buildCardSensitivityProfile } from '../../lib/cardSensitivity';
import ExperienceModule from '../ExperienceModule';
import { LANDING_AUDIO_CAPTIONS } from '../../lib/landingAudioCaptions';

const INITIAL_STACK_COUNT = 4;
const MAX_STACK_SIZE = 6;
const SPAWN_DISTANCE_PX = 1200;
const DEFAULT_CARD_WIDTH = 760;
const DEFAULT_CARD_BOUNDS = { min: 220, max: 760 };
const CONTROL_SELECTOR = '[data-stack-control="true"]';
const SENSITIVITY_PROFILE = buildCardSensitivityProfile(0.55);
const PINCH_RESIZE_DELTA_GAIN = 2.05;
const PINCH_RESIZE_DX_DEADBAND = 0.45;
const RESIZE_SPRING_STIFFNESS = 0.16;
const RESIZE_SPRING_DAMPING = 0.72;
const MAX_RESIZE_VELOCITY = 46;

const shuffle = (items) => {
    const out = [...items];
    for (let index = out.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [out[index], out[swapIndex]] = [out[swapIndex], out[index]];
    }

    return out;
};

const normalizePool = (images) => {
    const seen = new Set();

    return (images || [])
        .map((item, index) => {
            const image = typeof item?.image === 'string'
                ? item.image.trim()
                : typeof item?.cover_image === 'string'
                    ? item.cover_image.trim()
                    : '';

            if (!image || seen.has(image)) return null;
            seen.add(image);

            return {
                image,
                title: item?.title || `Image ${index + 1}`,
            };
        })
        .filter(Boolean);
};

const buildCard = (item, zIndex, initialPos = null) => ({
        id: `card-${Date.now()}-${Math.random()}`,
        image: item.image,
        title: item.title,
        angle: Math.random() * 8 - 4,
        x: Math.random() * 60 - 30,
        y: Math.random() * 60 - 30,
        zIndex,
        initialPos,
});

const getStatusMessage = (state) => {
    switch (state) {
        case 'requesting_camera':
            return 'Requesting camera access.';
        case 'waiting_for_hand':
            return 'Show one hand to the camera.';
        case 'loading_model':
            return 'Loading TensorFlow hand model.';
        case 'calibrating':
            return 'Hold still for a moment while the hand calibrates.';
        case 'ready':
            return 'Flick your hand to add the next card.';
        case 'hand_lost_temporarily':
            return 'Hand lost. Bring it back into frame.';
        case 'error':
            return 'Camera access was unavailable.';
        default:
            return 'Hand control is off.';
    }
};

const getAudioStatusMessage = (state, errorMessage) => {
    switch (state) {
        case 'requesting_microphone':
            return 'Requesting microphone access.';
        case 'listening':
            return 'Speak or clap to add the next card.';
        case 'sound_detected':
            return 'Voice pulse detected.';
        case 'error':
            return errorMessage || 'Microphone access was unavailable.';
        case 'idle':
        default:
            return 'Voice trigger is off.';
    }
};

const isControlTarget = (target) => (
    target instanceof Element && !!target.closest(CONTROL_SELECTOR)
);

const ViewportGestureCardStack = ({
    images = [],
    backLinkHref = '',
    backLinkLabel = '',
    secondaryLinkHref = '',
    secondaryLinkLabel = '',
    kicker = 'Interactive Prototype',
    title = 'Gesture Photo Stack',
    description = 'Photographs emerge through cursor movement, hand tracking, deliberate pinch-based resizing, and optional voice input.',
    handTrackingEngine = 'mediapipe',
    handTrackingModelType = 'full',
    className = '',
    style = undefined,
    viewportHeightCss = '100vh',
}) => {
    const rootRef = useRef(null);
    const pool = useMemo(() => normalizePool(images), [images]);

    const [stack, setStack] = useState([]);
    const [lastAction, setLastAction] = useState('unstack');
    const [cardWidth, setCardWidth] = useState(DEFAULT_CARD_WIDTH);
    const [cardBounds, setCardBounds] = useState(DEFAULT_CARD_BOUNDS);
    const [isSizeSliderDragging, setIsSizeSliderDragging] = useState(false);
    const [isSizeSliderHovered, setIsSizeSliderHovered] = useState(false);
    const [handControlEnabled, setHandControlEnabled] = useState(false);
    const [voiceTriggerEnabled, setVoiceTriggerEnabled] = useState(false);
    const [isControlPanelOpen, setIsControlPanelOpen] = useState(false);
    const [isPinchResizing, setIsPinchResizing] = useState(false);
    const [hasHydrated, setHasHydrated] = useState(false);
    const [isMusicControlsOpen, setIsMusicControlsOpen] = useState(false);
    const [showVisualizer, setShowVisualizer] = useState(true);
    const [showLyrics, setShowLyrics] = useState(true);
    const [isMusicPlaying, setIsMusicPlaying] = useState(false);
    const [musicStarted, setMusicStarted] = useState(false);

    const queueRef = useRef([]);
    const stackRef = useRef([]);
    const lastSpawnTimeRef = useRef(0);
    const lastMousePosRef = useRef({ x: 0, y: 0 });
    const scrollAccumulatorRef = useRef(0);
    const lastActionTimeRef = useRef(0);
    const zIndexCounterRef = useRef(100);
    const sizeSliderHitAreaRef = useRef(null);
    const sizeControlRef = useRef(null);
    const cardWidthRef = useRef(DEFAULT_CARD_WIDTH);
    const cardBoundsRef = useRef(DEFAULT_CARD_BOUNDS);
    const handPointerAnchorRef = useRef(null);
    const isPinchResizingRef = useRef(false);
    const cardWidthTargetRef = useRef(DEFAULT_CARD_WIDTH);
    const cardWidthAnimatedRef = useRef(DEFAULT_CARD_WIDTH);
    const cardWidthVelocityRef = useRef(0);
    const resizeAnimationFrameRef = useRef(null);

    useEffect(() => {
        stackRef.current = stack;
    }, [stack]);

    useEffect(() => {
        cardWidthRef.current = cardWidth;
    }, [cardWidth]);

    useEffect(() => {
        cardBoundsRef.current = cardBounds;
    }, [cardBounds]);

    useEffect(() => {
        isPinchResizingRef.current = isPinchResizing;
    }, [isPinchResizing]);

    useEffect(() => {
        setHasHydrated(true);
    }, []);

    useEffect(() => () => {
        if (resizeAnimationFrameRef.current !== null) {
            window.cancelAnimationFrame(resizeAnimationFrameRef.current);
            resizeAnimationFrameRef.current = null;
        }
    }, []);

    const clampCardWidth = (value, bounds = cardBoundsRef.current) => (
        Math.min(bounds.max, Math.max(bounds.min, value))
    );

    const syncCardWidthImmediate = (nextWidth, bounds = cardBoundsRef.current) => {
        const clamped = clampCardWidth(nextWidth, bounds);

        if (resizeAnimationFrameRef.current !== null) {
            window.cancelAnimationFrame(resizeAnimationFrameRef.current);
            resizeAnimationFrameRef.current = null;
        }

        cardWidthTargetRef.current = clamped;
        cardWidthAnimatedRef.current = clamped;
        cardWidthVelocityRef.current = 0;
        setCardWidth(Math.round(clamped));
    };

    const animateCardWidthToTarget = () => {
        if (resizeAnimationFrameRef.current !== null) return;

        const step = () => {
            const bounds = cardBoundsRef.current;
            const current = cardWidthAnimatedRef.current;
            const target = clampCardWidth(cardWidthTargetRef.current, bounds);
            const delta = target - current;
            let nextVelocity =
                (cardWidthVelocityRef.current * RESIZE_SPRING_DAMPING) +
                (delta * RESIZE_SPRING_STIFFNESS);

            nextVelocity = Math.max(
                -MAX_RESIZE_VELOCITY,
                Math.min(MAX_RESIZE_VELOCITY, nextVelocity),
            );

            let nextWidth = clampCardWidth(current + nextVelocity, bounds);
            if (nextWidth === bounds.min || nextWidth === bounds.max) {
                nextVelocity = 0;
            }

            cardWidthVelocityRef.current = nextVelocity;
            cardWidthAnimatedRef.current = nextWidth;

            const nextRoundedWidth = Math.round(nextWidth);
            if (nextRoundedWidth !== cardWidthRef.current) {
                setCardWidth(nextRoundedWidth);
            }

            if (Math.abs(target - nextWidth) < 0.35 && Math.abs(nextVelocity) < 0.2) {
                cardWidthTargetRef.current = target;
                cardWidthAnimatedRef.current = target;
                cardWidthVelocityRef.current = 0;
                resizeAnimationFrameRef.current = null;
                if (Math.round(target) !== cardWidthRef.current) {
                    setCardWidth(Math.round(target));
                }
                return;
            }

            resizeAnimationFrameRef.current = window.requestAnimationFrame(step);
        };

        resizeAnimationFrameRef.current = window.requestAnimationFrame(step);
    };

    const setCardWidthTarget = (nextWidth) => {
        cardWidthTargetRef.current = clampCardWidth(nextWidth);
        animateCardWidthToTarget();
    };

    useEffect(() => {
        const syncBounds = () => {
            const min = window.innerWidth < 768 ? 180 : 220;
            const maxByWidth = Math.round(window.innerWidth * 0.7);
            const maxByHeight = Math.round(window.innerHeight * 0.7 * (16 / 9));
            const max = Math.max(min + 48, Math.min(maxByWidth, maxByHeight));
            const nextBounds = { min, max };

            setCardBounds(nextBounds);
            syncCardWidthImmediate(cardWidthTargetRef.current, nextBounds);
        };

        syncBounds();
        window.addEventListener('resize', syncBounds);
        return () => window.removeEventListener('resize', syncBounds);
    }, []);

    useEffect(() => {
        queueRef.current = shuffle(pool);
        stackRef.current = [];
        setStack([]);
        setLastAction('unstack');
        lastSpawnTimeRef.current = 0;
        lastMousePosRef.current = { x: 0, y: 0 };
        handPointerAnchorRef.current = null;
        scrollAccumulatorRef.current = 0;
        lastActionTimeRef.current = 0;
        zIndexCounterRef.current = 100;
    }, [pool]);
    
    const toggleMusic = () => {
        if (!musicStarted) {
            setMusicStarted(true);
            setIsMusicPlaying(true);
        } else {
            if (window.toggleLandingAudio) {
                window.toggleLandingAudio();
            }
        }
    };

    useEffect(() => {
        if (!handControlEnabled) {
            handPointerAnchorRef.current = null;
            isPinchResizingRef.current = false;
            setIsPinchResizing(false);
        }
    }, [handControlEnabled]);

    const takeNextImage = () => {
        if (queueRef.current.length === 0) {
            queueRef.current = shuffle(pool);
        }

        if (queueRef.current.length === 0) return null;

        return queueRef.current.shift();
    };

    const attemptSpawn = (force = false, initialOverride = null, action = 'add') => {
        const now = Date.now();
        if (!force && now - lastSpawnTimeRef.current < SENSITIVITY_PROFILE.spawnCooldownMs) {
            return false;
        }

        const nextItem = takeNextImage();
        if (!nextItem) return false;

        lastSpawnTimeRef.current = now;
        zIndexCounterRef.current += 1;
        setLastAction(action);

        const card = buildCard(nextItem, zIndexCounterRef.current, initialOverride);

        const newStack = [...stackRef.current, card];
        if (newStack.length > MAX_STACK_SIZE) {
            newStack.splice(0, newStack.length - MAX_STACK_SIZE);
        }

        stackRef.current = newStack;
        setStack(newStack);
        return true;
    };

    const removeTopCard = () => {
        if (stackRef.current.length === 0) return false;

        setLastAction('unstack');
        lastActionTimeRef.current = Date.now();

        const newStack = stackRef.current.slice(0, -1);
        stackRef.current = newStack;
        setStack(newStack);
        return true;
    };

    const spawnFromAngle = (angle, force = true, action = 'add') => {
        const initialPos = {
            x: -Math.cos(angle) * SPAWN_DISTANCE_PX,
            y: -Math.sin(angle) * SPAWN_DISTANCE_PX,
        };

        attemptSpawn(force, initialPos, action);
    };

    useEffect(() => {
        let misses = 0;

        const kickstart = window.setInterval(() => {
            if (stackRef.current.length < INITIAL_STACK_COUNT) {
                const spawned = attemptSpawn(true, null, 'add');
                if (!spawned) {
                    misses += 1;
                    if (misses > 120) {
                        window.clearInterval(kickstart);
                    }
                }
                return;
            }

            window.clearInterval(kickstart);
        }, 200);

        return () => window.clearInterval(kickstart);
    }, [pool]);

    const handlePointerMove = (event) => {
        if (isControlTarget(event.target)) return;

        const dx = event.clientX - lastMousePosRef.current.x;
        const dy = event.clientY - lastMousePosRef.current.y;
        const distance = Math.sqrt((dx * dx) + (dy * dy));

        if (distance > SENSITIVITY_PROFILE.mouseThreshold) {
            const angle = Math.atan2(dy, dx);
            spawnFromAngle(angle, false, 'add');
            lastMousePosRef.current = {
                x: event.clientX,
                y: event.clientY,
            };
        }
    };

    const handleWheel = (event) => {
        if (isControlTarget(event.target)) return;

        if (event.deltaY > 0 && stackRef.current.length > 0) {
            event.preventDefault();
        }

        if (
            (event.deltaY > 0 && scrollAccumulatorRef.current < 0) ||
            (event.deltaY < 0 && scrollAccumulatorRef.current > 0)
        ) {
            scrollAccumulatorRef.current = 0;
        }

        scrollAccumulatorRef.current += event.deltaY;

        if (event.deltaY > 0) {
            setLastAction('unstack');
        } else if (event.deltaY < 0) {
            setLastAction('restack');
        }

        if (scrollAccumulatorRef.current > SENSITIVITY_PROFILE.unstackThreshold) {
            const now = Date.now();

            if (now - lastActionTimeRef.current < SENSITIVITY_PROFILE.wheelCooldownMs) {
                const isDiscreteClick = event.deltaY > 30;

                if (!isDiscreteClick) {
                    scrollAccumulatorRef.current = Math.min(
                        scrollAccumulatorRef.current,
                        SENSITIVITY_PROFILE.unstackThreshold * 1.1,
                    );
                }
            } else {
                const potential = Math.floor(
                    scrollAccumulatorRef.current / SENSITIVITY_PROFILE.unstackThreshold,
                );

                if (potential > 0) {
                    if (removeTopCard()) {
                        scrollAccumulatorRef.current -= SENSITIVITY_PROFILE.unstackThreshold;
                    } else {
                        scrollAccumulatorRef.current = 0;
                    }
                }
            }
        } else if (scrollAccumulatorRef.current < -SENSITIVITY_PROFILE.restackThreshold) {
            const potential = Math.floor(
                Math.abs(scrollAccumulatorRef.current) / SENSITIVITY_PROFILE.restackThreshold,
            );

            if (potential > 0) {
                attemptSpawn(true, null, 'restack');
                scrollAccumulatorRef.current += SENSITIVITY_PROFILE.restackThreshold;
            }
        }
    };

    const {
        videoRef,
        canvasRef,
        onboardingState,
        isTracking,
    } = useHandTracking({
        onHandMove: (metrics) => {
            if (isPinchResizingRef.current) return;

            if (rootRef.current) {
                const bounds = rootRef.current.getBoundingClientRect();
                rootRef.current.style.setProperty('--mouse-x', `${metrics.x - bounds.left}px`);
                rootRef.current.style.setProperty('--mouse-y', `${metrics.y - bounds.top}px`);
            }

            if (!handControlEnabled || onboardingState !== 'ready' || !isTracking) {
                handPointerAnchorRef.current = { x: metrics.x, y: metrics.y };
                return;
            }

            const anchor = handPointerAnchorRef.current;
            if (!anchor) {
                handPointerAnchorRef.current = { x: metrics.x, y: metrics.y };
                return;
            }

            const dx = metrics.x - anchor.x;
            const dy = metrics.y - anchor.y;
            const distance = Math.sqrt((dx * dx) + (dy * dy));

            if (distance > SENSITIVITY_PROFILE.mouseThreshold) {
                spawnFromAngle(Math.atan2(dy, dx), false, 'add');
                handPointerAnchorRef.current = { x: metrics.x, y: metrics.y };
            }
        },
        onPinchChange: (metrics) => {
            if (metrics.phase === 'start') {
                syncCardWidthImmediate(cardWidthRef.current);
                handPointerAnchorRef.current = null;
                isPinchResizingRef.current = true;
                setIsPinchResizing(true);
                return;
            }

            if (metrics.phase === 'move') {
                const relativeDeltaX = metrics.dx ?? 0;
                if (Math.abs(relativeDeltaX) > PINCH_RESIZE_DX_DEADBAND) {
                    setCardWidthTarget(
                        cardWidthTargetRef.current + (relativeDeltaX * PINCH_RESIZE_DELTA_GAIN),
                    );
                }
                handPointerAnchorRef.current = null;
                isPinchResizingRef.current = true;
                setIsPinchResizing(true);
                return;
            }

            handPointerAnchorRef.current = null;
            isPinchResizingRef.current = false;
            setIsPinchResizing(false);
        },
        threshold: SENSITIVITY_PROFILE.gestureThreshold,
        gestureCooldownMs: SENSITIVITY_PROFILE.gestureCooldownMs,
        isActive: handControlEnabled,
        motionSource: 'index',
        gestureMotionSource: 'index',
        pinchMode: 'single-hand-horizontal',
        pinchHorizontalTravelPx: 72,
        pinchEngageThreshold: 0.2,
        pinchReleaseThreshold: 0.36,
        pinchIntentHoldMs: 110,
        previewMode: 'dot-matrix',
        engine: handTrackingEngine,
        tensorflowModelType: handTrackingModelType,
    });

    const {
        audioState,
        inputLevel,
        errorMessage,
    } = useAudioTrigger({
        onTrigger: () => {
            attemptSpawn(true, { x: 0, y: SPAWN_DISTANCE_PX }, 'add');
        },
        threshold: 0.12,
        cooldownMs: Math.max(200, SENSITIVITY_PROFILE.spawnCooldownMs * 4),
        isActive: voiceTriggerEnabled,
    });

    const voiceMeterWidth = `${Math.max(4, Math.round(inputLevel * 100))}%`;
    const sliderPercent = cardBounds.max > cardBounds.min
        ? Math.max(0, Math.min(100, ((cardWidth - cardBounds.min) / (cardBounds.max - cardBounds.min)) * 100))
        : 0;

    const updateGlowPosition = (clientX, clientY) => {
        if (!rootRef.current) return;

        const bounds = rootRef.current.getBoundingClientRect();
        rootRef.current.style.setProperty('--mouse-x', `${clientX - bounds.left}px`);
        rootRef.current.style.setProperty('--mouse-y', `${clientY - bounds.top}px`);
    };

    const updateCardWidthFromPointer = (clientX) => {
        const scrubZone = sizeControlRef.current || sizeSliderHitAreaRef.current;
        if (!scrubZone) return;

        const rect = scrubZone.getBoundingClientRect();
        if (rect.width <= 0) return;

        const rawRatio = (clientX - rect.left) / rect.width;
        const ratio = Math.min(1, Math.max(0, rawRatio));
        const nextWidth = Math.round(
            cardBounds.min + ratio * (cardBounds.max - cardBounds.min),
        );
        syncCardWidthImmediate(nextWidth);
    };

    const handleSizeSliderPointerDown = (event) => {
        if (typeof event.button === 'number' && event.button !== 0) return;

        event.preventDefault();
        setIsSizeSliderDragging(true);
        updateCardWidthFromPointer(event.clientX);

        const handleMove = (moveEvent) => {
            updateCardWidthFromPointer(moveEvent.clientX);
        };

        const stopTracking = () => {
            setIsSizeSliderDragging(false);
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', stopTracking);
            window.removeEventListener('pointercancel', stopTracking);
        };

        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', stopTracking, { once: true });
        window.addEventListener('pointercancel', stopTracking, { once: true });
    };

    return (
        <div
            ref={rootRef}
            className={`viewport-gesture-card-stack ${className}`.trim()}
            style={{
                '--viewport-height': viewportHeightCss,
                '--card-width': `${cardWidth}px`,
                '--mouse-x': '-500px',
                '--mouse-y': '-500px',
                ...style,
            }}
            onPointerMove={(event) => {
                updateGlowPosition(event.clientX, event.clientY);
                handlePointerMove(event);
            }}
            onPointerLeave={() => {
                if (rootRef.current) {
                    rootRef.current.style.setProperty('--mouse-x', '-500px');
                    rootRef.current.style.setProperty('--mouse-y', '-500px');
                }
                lastMousePosRef.current = { x: 0, y: 0 };
            }}
            onWheel={handleWheel}
        >
            <div className="stage-grid stage-grid-base" aria-hidden="true" />
            <div className="stage-grid stage-grid-glow" aria-hidden="true" />

            <div className="experiment-copy" data-stack-control="true">
                <div className="experiment-kicker">{kicker}</div>
                <h1>{title}</h1>
                {description ? <p className="lead">{description}</p> : null}
                {backLinkHref && backLinkLabel && (
                    <a href={backLinkHref} className="experiment-nav-button">
                        {backLinkLabel}
                    </a>
                )}
                {secondaryLinkHref && secondaryLinkLabel && (
                    <a href={secondaryLinkHref} className="experiment-nav-button secondary-nav-link">
                        {secondaryLinkLabel}
                    </a>
                )}
            </div>

            <div className="card-stage" aria-hidden="true">
                <div className="stack-anchor">
                    <AnimatePresence custom={lastAction}>
                        {stack.map((card) => {
                            const initialAnim = card.initialPos
                                ? {
                                    opacity: 0,
                                    scale: 0.9,
                                    x: card.initialPos.x,
                                    y: card.initialPos.y,
                                    rotate: (Math.random() - 0.5) * 30,
                                }
                                : {
                                    opacity: 0,
                                    scale: 0.9,
                                    x: 0,
                                    y: -1200,
                                    rotate: (Math.random() - 0.5) * 15,
                                };

                            return (
                                <motion.div
                                    key={card.id}
                                    className="stack-card"
                                    custom={lastAction}
                                    initial={initialAnim}
                                    animate={{
                                        opacity: 1,
                                        scale: 1,
                                        y: card.y,
                                        x: card.x,
                                        rotate: card.angle,
                                        transition: { duration: 0.6, ease: 'backOut' },
                                    }}
                                    exit={(mode) => {
                                        if (mode === 'unstack') {
                                            return {
                                                opacity: 0,
                                                y: -1200,
                                                scale: 1.1,
                                                rotate: card.angle * 4,
                                                transition: { duration: 0.6, ease: [0.32, 0, 0.67, 0] },
                                            };
                                        }

                                        return {
                                            opacity: 0,
                                            scale: 0.8,
                                            y: 50,
                                            transition: { duration: 0.3 },
                                        };
                                    }}
                                    style={{ zIndex: card.zIndex }}
                                >
                                    <img
                                        src={card.image}
                                        alt={card.title}
                                        loading="eager"
                                        decoding="sync"
                                    />
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            </div>

            <div className="control-dock" data-stack-control="true">
                <button
                    type="button"
                    className={`control-toggle ${isControlPanelOpen ? 'open' : ''}`}
                    onClick={() => setIsControlPanelOpen((previous) => !previous)}
                    aria-expanded={isControlPanelOpen}
                    aria-controls="gesture-card-stack-controls"
                >
                    {isControlPanelOpen ? 'Hide Control Panel' : 'Show Control Panel'}
                </button>

                <AnimatePresence initial={false}>
                    {isControlPanelOpen && (
                        <motion.aside
                            id="gesture-card-stack-controls"
                            className="control-panel"
                            initial={{ opacity: 0, y: -18 }}
                            animate={{
                                opacity: 1,
                                y: 0,
                                transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
                            }}
                            exit={{
                                opacity: 0,
                                y: -16,
                                transition: { duration: 0.24, ease: [0.4, 0, 0.2, 1] },
                            }}
                        >
                            <div className="panel-label">Control Panel</div>

                            <button
                                type="button"
                                className={`panel-button ${handControlEnabled ? 'active' : ''}`}
                                onClick={() => setHandControlEnabled((previous) => !previous)}
                            >
                                {handControlEnabled ? 'Disable hand control' : 'Enable hand control'}
                            </button>
                            <p className="status-copy">{getStatusMessage(onboardingState)}</p>

                            {handControlEnabled && (
                                <div className="panel-section" aria-live="polite">
                                    <div className={`hand-status ${isTracking ? 'ready' : ''}`}>
                                        {getStatusMessage(onboardingState)}
                                    </div>
                                    <p className="status-copy">
                                        Move your index finger through the viewport to pull new photos, just like the pointer.
                                    </p>
                                    <p className={`status-copy ${isPinchResizing ? 'status-copy-accent' : ''}`}>
                                        {isPinchResizing
                                            ? 'Pinch thumb and index together, then move left or right. Release to keep this size.'
                                            : 'Pinch thumb and index together, then move left or right to resize the cards.'}
                                    </p>
                                    <div className="hand-preview">
                                        <video ref={videoRef} autoPlay playsInline muted style={{ display: 'none' }} />
                                        <canvas ref={canvasRef} className="preview-canvas" />
                                    </div>
                                </div>
                            )}

                            <button
                                type="button"
                                className={`panel-button ${voiceTriggerEnabled ? 'active' : ''}`}
                                onClick={() => setVoiceTriggerEnabled((previous) => !previous)}
                            >
                                {voiceTriggerEnabled ? 'Disable voice trigger' : 'Enable voice trigger'}
                            </button>
                            <p className="status-copy">{getAudioStatusMessage(audioState, errorMessage)}</p>

                            <div className="voice-meter" aria-hidden="true">
                                <span
                                    className={`voice-meter-fill ${audioState === 'sound_detected' ? 'detected' : ''}`}
                                    style={{ width: voiceMeterWidth }}
                                />
                            </div>

                            <div
                                className={`size-control ${isSizeSliderDragging ? 'dragging' : ''}`}
                                ref={sizeControlRef}
                                onPointerDown={handleSizeSliderPointerDown}
                            >
                                <div className="size-control-header">
                                    <span className="size-control-label">Image Size</span>
                                    <span className="size-control-value">{cardWidth}px</span>
                                </div>
                                <div
                                    className={`size-slider-hit-area ${isSizeSliderDragging ? 'dragging' : ''} ${(isSizeSliderHovered || isSizeSliderDragging) ? 'expanded' : ''}`}
                                    ref={sizeSliderHitAreaRef}
                                    onPointerEnter={() => setIsSizeSliderHovered(true)}
                                    onPointerLeave={() => setIsSizeSliderHovered(false)}
                                    style={{ '--slider-percent': `${sliderPercent}%` }}
                                >
                                    <div className="size-slider-visual" aria-hidden="true">
                                        <span className="size-slider-segment left"></span>
                                        <span className="size-slider-segment right"></span>
                                        <span className="size-slider-knob">
                                            <span className="size-slider-knob-label">SLIDE</span>
                                        </span>
                                    </div>
                                    <input
                                        className="size-slider"
                                        type="range"
                                        min={cardBounds.min}
                                        max={cardBounds.max}
                                        step="1"
                                        value={cardWidth}
                                        onInput={(event) => syncCardWidthImmediate(Number(event.currentTarget.value))}
                                        onChange={(event) => syncCardWidthImmediate(Number(event.target.value))}
                                        aria-label="Adjust card image size"
                                    />
                                </div>
                                <div className="size-control-scale">
                                    <span>{cardBounds.min}px</span>
                                    <span>{cardBounds.max}px</span>
                                </div>
                            </div>

                            <button
                                type="button"
                                className={`panel-button secondary ${isMusicControlsOpen ? 'active' : ''}`}
                                onClick={() => setIsMusicControlsOpen(prev => !prev)}
                                style={{ marginTop: '8px' }}
                            >
                                {isMusicControlsOpen ? 'Hide Music & Visuals' : 'Music & Visuals'}
                            </button>

                            <AnimatePresence>
                                {isMusicControlsOpen && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="music-controls-expansion"
                                    >
                                        <button
                                            type="button"
                                            className={`panel-button ${isMusicPlaying ? 'active' : ''}`}
                                            onClick={toggleMusic}
                                            style={{ marginBottom: '8px' }}
                                        >
                                            {isMusicPlaying ? 'Pause Music' : musicStarted ? 'Resume Music' : 'Play Music'}
                                        </button>

                                        {musicStarted && (
                                            <div className="music-sub-toggles">
                                                <button
                                                    type="button"
                                                    className={`sub-toggle-btn ${showVisualizer ? 'active' : ''}`}
                                                    onClick={() => setShowVisualizer(prev => !prev)}
                                                >
                                                    {showVisualizer ? 'Hide Visualizer' : 'Show Visualizer'}
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`sub-toggle-btn ${showLyrics ? 'active' : ''}`}
                                                    onClick={() => setShowLyrics(prev => !prev)}
                                                >
                                                    {showLyrics ? 'Hide Lyrics' : 'Show Lyrics'}
                                                </button>
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.aside>
                    )}
                </AnimatePresence>
            </div>

            <div className="interaction-hint" data-stack-control="true">
                Move the pointer across the viewport to pull new photos.
            </div>

            {hasHydrated && pool.length > 0 && stack.length === 0 && (
                <div className="stage-status" data-stack-control="true">
                    Loading image stack...
                </div>
            )}

            <style suppressHydrationWarning>{`
                .viewport-gesture-card-stack {
                    position: relative;
                    width: 100%;
                    height: var(--viewport-height, 100vh);
                    min-height: var(--viewport-height, 100vh);
                    overflow: hidden;
                    background: #040404;
                    color: #f8fafc;
                    font-family: var(--font-ui);
                }

                .viewport-gesture-card-stack::before {
                    content: "";
                    position: absolute;
                    inset: 0;
                    z-index: 1;
                    pointer-events: none;
                    background:
                        radial-gradient(circle at 50% 42%, rgba(255, 255, 255, 0.05), transparent 34%),
                        linear-gradient(180deg, rgba(2, 2, 2, 0.18), rgba(2, 2, 2, 0.55));
                }

                .stage-grid {
                    position: absolute;
                    inset: 0;
                    z-index: 0;
                    pointer-events: none;
                    background-position: center top;
                }

                .stage-grid-base {
                    background-image:
                        linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
                    background-size: 60px 60px;
                    -webkit-mask-image: radial-gradient(ellipse at center, black 30%, transparent 80%);
                    mask-image: radial-gradient(ellipse at center, black 30%, transparent 80%);
                }

                .stage-grid-glow {
                    opacity: 0.9;
                    background-image:
                        linear-gradient(to right, rgba(255, 255, 255, 0.08) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(255, 255, 255, 0.08) 1px, transparent 1px);
                    background-size: 60px 60px;
                    -webkit-mask-image:
                        radial-gradient(
                            circle 300px at var(--mouse-x, -500px) var(--mouse-y, -500px),
                            black,
                            transparent
                        ),
                        radial-gradient(ellipse at center, black 30%, transparent 80%);
                    mask-image:
                        radial-gradient(
                            circle 300px at var(--mouse-x, -500px) var(--mouse-y, -500px),
                            black,
                            transparent
                        ),
                        radial-gradient(ellipse at center, black 30%, transparent 80%);
                    -webkit-mask-composite: source-in;
                    mask-composite: intersect;
                }

                .experiment-copy,
                .control-dock,
                .interaction-hint,
                .stage-status {
                    position: absolute;
                    z-index: 20;
                }

                .experiment-copy {
                    top: 24px;
                    left: 24px;
                    width: min(420px, calc(100% - 48px));
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 0.95rem;
                }

                .experiment-kicker {
                    background: var(--color-brand-red, #a30021);
                    color: #ffffff;
                    padding: 0.08em 0.24em;
                    border-radius: 2px;
                    font-size: 0.82rem;
                    font-weight: 600;
                    line-height: 1.2;
                    letter-spacing: 0.04em;
                    text-transform: uppercase;
                    box-decoration-break: clone;
                    -webkit-box-decoration-break: clone;
                }

                .experiment-copy h1 {
                    margin: 0;
                    font-family: var(--font-display);
                    font-size: clamp(2rem, 4vw, 3.1rem);
                    line-height: 0.98;
                    letter-spacing: -0.04em;
                }

                .lead {
                    margin: 0.8rem 0 0;
                    color: rgba(255, 255, 255, 0.78);
                    font-size: 0.98rem;
                    line-height: 1.55;
                }

                .experiment-nav-button {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    border: 1px solid rgba(255, 255, 255, 0.65);
                    border-radius: 10px;
                    background: rgba(0, 0, 0, 0.25);
                    color: rgba(255, 255, 255, 0.96);
                    padding: 0.72rem 1rem;
                    text-decoration: none;
                    font-family: var(--feature-stack-primary-btn-font, var(--font-ui));
                    font-size: 0.82rem;
                    font-weight: 600;
                    line-height: 1;
                    letter-spacing: 0.05em;
                    text-transform: uppercase;
                    transition: all 0.3s ease;
                }

                .experiment-nav-button:hover {
                    border-color: rgba(255, 255, 255, 0.9);
                    background: rgba(255, 255, 255, 0.08);
                    box-shadow: 0 0 15px rgba(255, 255, 255, 0.1);
                }

                .secondary-nav-link {
                    margin-top: 0.65rem;
                    border-color: rgba(255, 255, 255, 0.34);
                    color: rgba(255, 255, 255, 0.78);
                }

                .card-stage {
                    position: absolute;
                    inset: 0;
                    z-index: 10;
                    pointer-events: none;
                }

                .stack-anchor {
                    position: absolute;
                    top: 56%;
                    left: 50%;
                    width: 0;
                    height: 0;
                }

                .stack-card {
                    position: absolute;
                    width: var(--card-width, 420px);
                    aspect-ratio: 16 / 9;
                    background-color: #ffffff;
                    padding: clamp(4px, calc(var(--card-width, 420px) * 0.02), 16px);
                    border-radius: 2px;
                    box-shadow: 0 15px 50px rgba(0, 0, 0, 0.15);
                    top: calc((var(--card-width, 420px) * 9 / 16) * -0.5);
                    left: calc(var(--card-width, 420px) * -0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                    backface-visibility: hidden;
                }

                .stack-card img {
                    display: block;
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    border-radius: 1px;
                }

                .control-dock {
                    top: 24px;
                    right: 24px;
                    width: min(284px, calc(100% - 48px));
                    display: flex;
                    flex-direction: column;
                    align-items: stretch;
                    gap: 10px;
                }

                .control-toggle {
                    width: 100%;
                    border: 1px solid rgba(255, 255, 255, 0.45);
                    border-radius: 10px;
                    background: rgba(0, 0, 0, 0.22);
                    backdrop-filter: blur(4px);
                    color: rgba(255, 255, 255, 0.92);
                    cursor: pointer;
                    padding: 0.78rem 1rem;
                    text-align: center;
                    font-family: var(--feature-stack-primary-btn-font, var(--font-ui));
                    font-size: 0.78rem;
                    font-weight: 600;
                    line-height: 1;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    transition:
                        border-color 220ms ease,
                        background-color 220ms ease,
                        box-shadow 220ms ease,
                        transform 220ms ease;
                }

                .control-toggle:hover {
                    border-color: rgba(255, 255, 255, 0.78);
                    background: rgba(255, 255, 255, 0.08);
                    box-shadow: 0 0 18px rgba(255, 255, 255, 0.08);
                }

                .control-toggle.open {
                    border-color: rgba(255, 255, 255, 0.7);
                    background: rgba(0, 0, 0, 0.34);
                }

                .control-panel {
                    width: 100%;
                    padding: 10px;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    border-radius: 10px;
                    background: rgba(0, 0, 0, 0.35);
                    backdrop-filter: blur(4px);
                    box-shadow: 0 24px 54px rgba(0, 0, 0, 0.28);
                    display: flex;
                    flex-direction: column;
                    gap: 9px;
                    max-height: calc(100dvh - 72px);
                    overflow-y: auto;
                }

                .panel-label {
                    color: rgba(255, 255, 255, 0.95);
                    font-family: var(--font-ui);
                    font-size: 0.66rem;
                    font-weight: 600;
                    letter-spacing: 0.04em;
                    text-transform: uppercase;
                }

                .panel-button {
                    width: 100%;
                    border: 1px solid rgba(255, 255, 255, 0.65);
                    border-radius: 10px;
                    background: rgba(0, 0, 0, 0.25);
                    color: rgba(255, 255, 255, 0.96);
                    padding: 0.68rem 1.05rem;
                    font-family: var(--feature-stack-primary-btn-font, var(--font-ui));
                    font-size: 0.9rem;
                    font-weight: 600;
                    line-height: 1;
                    letter-spacing: 0.05em;
                    text-align: center;
                    text-transform: uppercase;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }

                .panel-button:hover {
                    border-color: rgba(255, 255, 255, 0.9);
                    background: rgba(255, 255, 255, 0.08);
                    box-shadow: 0 0 15px rgba(255, 255, 255, 0.1);
                }

                .panel-button.active {
                    border-color: rgba(76, 175, 80, 0.6);
                    background: rgba(76, 175, 80, 0.05);
                    color: #ffffff;
                }

                .status-copy {
                    margin: 0;
                    color: rgba(255, 255, 255, 0.82);
                    font-family: var(--font-ui);
                    font-size: 0.72rem;
                    line-height: 1.45;
                }

                .status-copy-accent {
                    color: rgba(198, 255, 225, 0.96);
                }

                .panel-section {
                    display: flex;
                    flex-direction: column;
                    gap: 9px;
                }

                .voice-meter {
                    height: 10px;
                    border-radius: 999px;
                    background: rgba(255, 255, 255, 0.1);
                    overflow: hidden;
                }

                .voice-meter-fill {
                    display: block;
                    height: 100%;
                    border-radius: inherit;
                    background: linear-gradient(90deg, #b22020, #ef8a54);
                    transition: width 80ms linear, filter 140ms ease;
                }

                .voice-meter-fill.detected {
                    filter: saturate(1.2) brightness(1.05);
                }

                .size-control {
                    width: 100%;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    border-radius: 10px;
                    background: rgba(0, 0, 0, 0.32);
                    backdrop-filter: blur(4px);
                    padding: 10px 12px;
                    cursor: ew-resize;
                    touch-action: none;
                    transition: padding-bottom 260ms cubic-bezier(0.22, 1, 0.36, 1);
                }

                .size-control.dragging {
                    border-color: rgba(255, 255, 255, 0.55);
                }

                .size-control-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 6px;
                    color: rgba(255, 255, 255, 0.95);
                    font-family: var(--font-ui);
                    font-size: 0.62rem;
                    font-weight: 600;
                    letter-spacing: 0.04em;
                    text-transform: uppercase;
                }

                .size-control-value {
                    color: #ffffff;
                }

                .size-slider {
                    -webkit-appearance: none;
                    appearance: none;
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                    opacity: 0;
                    outline: none;
                    margin: 0;
                    cursor: pointer;
                    z-index: 3;
                }

                .size-slider-hit-area {
                    position: relative;
                    height: 34px;
                    display: flex;
                    align-items: center;
                    cursor: ew-resize;
                    touch-action: none;
                }

                .size-slider-visual {
                    position: absolute;
                    inset: 0;
                    pointer-events: none;
                    z-index: 1;
                }

                .size-slider-segment {
                    position: absolute;
                    top: 50%;
                    height: 4px;
                    border-radius: 999px;
                    background: rgba(255, 255, 255, 0.28);
                    transform: translateY(-50%);
                    transition: width 140ms cubic-bezier(0.22, 1, 0.36, 1);
                }

                .size-slider-hit-area.dragging .size-slider-segment {
                    transition-duration: 0ms;
                }

                .size-slider-segment.left {
                    left: 0;
                    width: clamp(0px, calc(var(--slider-percent) - 8px), 100%);
                }

                .size-slider-segment.right {
                    right: 0;
                    width: clamp(0px, calc(100% - var(--slider-percent) - 8px), 100%);
                }

                .size-slider-hit-area.expanded .size-slider-segment.left,
                .size-slider-hit-area.dragging .size-slider-segment.left {
                    width: clamp(0px, calc(var(--slider-percent) - 26px), 100%);
                }

                .size-slider-hit-area.expanded .size-slider-segment.right,
                .size-slider-hit-area.dragging .size-slider-segment.right {
                    width: clamp(0px, calc(100% - var(--slider-percent) - 26px), 100%);
                }

                .size-slider-knob {
                    position: absolute;
                    left: var(--slider-percent);
                    top: 50%;
                    width: 12px;
                    height: 12px;
                    border-radius: 999px;
                    border: 1px solid rgba(255, 255, 255, 0.95);
                    background: #ffffff;
                    color: rgba(15, 15, 15, 0.95);
                    transform: translate(-50%, -50%);
                    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.18);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition:
                        width 220ms cubic-bezier(0.22, 1, 0.36, 1),
                        height 220ms cubic-bezier(0.22, 1, 0.36, 1),
                        border-radius 220ms cubic-bezier(0.22, 1, 0.36, 1),
                        box-shadow 220ms cubic-bezier(0.22, 1, 0.36, 1),
                        background-color 220ms cubic-bezier(0.22, 1, 0.36, 1);
                }

                .size-slider-knob-label {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 100%;
                    height: 100%;
                    opacity: 0;
                    font-family: var(--font-ui);
                    font-size: 0.43rem;
                    font-weight: 700;
                    letter-spacing: 0.08em;
                    line-height: 1;
                    text-align: center;
                    transform: scale(0.96);
                    transition: opacity 160ms ease, transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
                    white-space: nowrap;
                }

                .size-slider-hit-area.expanded .size-slider-knob,
                .size-slider-hit-area.dragging .size-slider-knob {
                    width: 46px;
                    height: 18px;
                    border-radius: 999px;
                    box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.18);
                }

                .size-slider-hit-area.expanded .size-slider-knob-label,
                .size-slider-hit-area.dragging .size-slider-knob-label {
                    opacity: 1;
                    transform: scale(1);
                }

                .size-control-scale {
                    margin-top: 6px;
                    display: flex;
                    justify-content: space-between;
                    font-family: var(--font-ui);
                    font-size: 0.56rem;
                    letter-spacing: 0.03em;
                    color: rgba(255, 255, 255, 0.65);
                }

                .hand-status {
                    margin: 0;
                    color: rgba(255, 255, 255, 0.82);
                    font-family: var(--font-mono);
                    font-size: 0.72rem;
                    line-height: 1.45;
                }

                .hand-status.ready {
                    color: rgba(198, 255, 225, 0.96);
                }

                .hand-preview {
                    width: 100%;
                    aspect-ratio: 4 / 3;
                    overflow: hidden;
                    border-radius: 7px;
                    background:
                        radial-gradient(circle at top, rgba(255, 106, 31, 0.12), rgba(3, 3, 3, 0.96) 58%),
                        #030303;
                    border: 1px solid rgba(255, 255, 255, 0.18);
                    box-shadow:
                        inset 0 0 0 1px rgba(255, 255, 255, 0.04),
                        0 0 0 1px rgba(255, 106, 31, 0.08);
                }

                .preview-canvas {
                    width: 100%;
                    height: 100%;
                    display: block;
                    object-fit: cover;
                    background: #030303;
                }

                .interaction-hint,
                .stage-status {
                    left: 50%;
                    bottom: 26px;
                    transform: translateX(-50%);
                    max-width: min(720px, calc(100% - 48px));
                    padding: 0.95rem 1.2rem;
                    border: 1px solid rgba(255, 255, 255, 0.75);
                    border-radius: 16px;
                    background: rgba(8, 8, 10, 0.42);
                    backdrop-filter: blur(10px);
                    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.34);
                    font-size: 0.92rem;
                    line-height: 1.4;
                    text-align: left;
                    color: rgba(255, 255, 255, 0.95);
                }

                .interaction-hint {
                    bottom: calc(26px + 3vh);
                }

                .stage-status {
                    bottom: 76px;
                }

                .music-controls-expansion {
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    padding-top: 4px;
                }

                .music-sub-toggles {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 8px;
                }

                .sub-toggle-btn {
                    padding: 0.5rem;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    border-radius: 8px;
                    background: rgba(255, 255, 255, 0.05);
                    color: rgba(255, 255, 255, 0.8);
                    font-size: 0.68rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.03em;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .sub-toggle-btn:hover {
                    background: rgba(255, 255, 255, 0.1);
                    border-color: rgba(255, 255, 255, 0.5);
                }

                .sub-toggle-btn.active {
                    background: rgba(255, 255, 255, 0.15);
                    border-color: rgba(255, 255, 255, 0.8);
                    color: #fff;
                }

                .panel-button.secondary {
                    border-color: rgba(255, 255, 255, 0.35);
                    font-size: 0.78rem;
                    background: rgba(255, 255, 255, 0.02);
                }

                @media (max-width: 900px) {
                    .experiment-copy {
                        top: 16px;
                        left: 16px;
                        width: min(360px, calc(100% - 332px));
                    }

                    .control-dock {
                        top: 16px;
                        right: 16px;
                        width: 284px;
                    }

                    .interaction-hint,
                    .stage-status {
                        left: 16px;
                        right: 316px;
                        bottom: 16px;
                        transform: none;
                        max-width: none;
                        border-radius: 18px;
                    }

                    .interaction-hint {
                        bottom: calc(16px + 3vh);
                    }

                    .stage-status {
                        bottom: 82px;
                    }
                }

                @media (max-width: 760px) {
                    .experiment-copy {
                        width: calc(100% - 32px);
                    }

                    .control-dock {
                        top: auto;
                        left: 16px;
                        right: 16px;
                        bottom: 16px;
                        width: auto;
                    }

                    .interaction-hint {
                        display: none;
                    }

                    .stage-status {
                        left: 16px;
                        right: 16px;
                        bottom: 86px;
                        transform: none;
                        max-width: none;
                    }
                }

                @media (max-width: 640px) {
                    .experiment-copy h1 {
                        font-size: 1.85rem;
                    }

                    .lead {
                        font-size: 0.9rem;
                    }

                    .control-dock {
                        left: 16px;
                        right: 16px;
                    }

                    .stage-status {
                        font-size: 0.78rem;
                    }

                    .stage-status {
                        bottom: 82px;
                    }
                }
            `}</style>
            {/* AUDIO EXPERIENCE */}
            <ExperienceModule 
                src="/audio/landing-page-audio.mp3"
                captions={LANDING_AUDIO_CAPTIONS}
                autoStart={musicStarted}
                showVisualizer={showVisualizer}
                showLyrics={showLyrics}
                onPlaybackChange={setIsMusicPlaying}
            />
        </div>
    );
};

export default ViewportGestureCardStack;
