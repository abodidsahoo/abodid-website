import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCardPhysics } from '../hooks/useCardPhysics';

const EMPTY_IMAGES = [];
const EMPTY_FILTERS = [];
const ENTRY_EASE = [0.22, 1, 0.36, 1];
const SOFT_ENTRY_CARD_COUNT = 2;
const AUTO_ENTRY_MIN_OFFSET_PX = 240;
const AUTO_ENTRY_VIEWPORT_SHARE = 0.26;
const AUTO_ENTRY_X_DRIFT_PX = 18;
const EXIT_UP_DURATION_S = 0.72;
const EXIT_DOWN_DURATION_S = 0.58;
const SOFT_EXIT_DURATION_S = 0.64;
const OVERFLOW_TRIM_DURATION_S = 0.32;
const EXIT_UP_TRAVEL_PX = 1400;
const EXIT_DOWN_TRAVEL_PX = 1600;
const SOFT_EXIT_TRAVEL_PX = 1200;

const hashStringToUnitInterval = (value) => {
    let hash = 2166136261;

    for (let i = 0; i < value.length; i += 1) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }

    return ((hash >>> 0) % 10000) / 10000;
};

const getDeterministicRangeValue = (seed, min, max) => (
    min + (hashStringToUnitInterval(seed) * (max - min))
);

const getAutoEntryOffset = (revealOrder) => {
    const viewportHeight =
        typeof window === 'undefined'
            ? 920
            : Math.max(window.innerHeight, 1);
    const baseOffset = Math.max(
        AUTO_ENTRY_MIN_OFFSET_PX,
        viewportHeight * AUTO_ENTRY_VIEWPORT_SHARE,
    );

    return revealOrder <= SOFT_ENTRY_CARD_COUNT ? baseOffset : baseOffset + 56;
};

const getCardInitialAnimation = (card, index) => {
    const baseSeed = `${card.id}-${index}`;
    const viewportHeight = typeof window === 'undefined' ? 920 : Math.max(window.innerHeight, 1);

    if (!card.initialPos) {
        // Start fully opaque, just below the visible viewport
        return {
            opacity: 1,
            scale: 0.96,
            x: card.x,
            y: card.y + viewportHeight,
            rotate: card.angle + getDeterministicRangeValue(`${baseSeed}-auto-entry-rotate`, -3.5, 3.5),
        };
    }

    // Gesture-spawned card: start off-screen at its initial position, fully opaque
    return {
        opacity: 1,
        scale: 0.92,
        x: card.initialPos.x,
        y: card.initialPos.y,
        rotate: getDeterministicRangeValue(`${baseSeed}-entry`, -12, 12),
    };
};

const buildEntryAnimation = (card) => {
    if (!card.initialPos) {
        const isLeadCard = card.revealOrder === 1;

        return {
            opacity: 1,
            scale: 1,
            y: card.y,
            x: card.x,
            rotate: card.angle,
            transition: {
                x: {
                    duration: isLeadCard ? 0.96 : 0.78,
                    ease: ENTRY_EASE,
                },
                y: {
                    type: 'spring',
                    stiffness: isLeadCard ? 138 : 154,
                    damping: isLeadCard ? 15 : 17,
                    mass: isLeadCard ? 1 : 0.92,
                },
                scale: {
                    type: 'spring',
                    stiffness: 182,
                    damping: 16,
                    mass: 0.88,
                },
                rotate: {
                    duration: isLeadCard ? 0.9 : 0.76,
                    ease: ENTRY_EASE,
                },
            },
        };
    }

    const entryDuration = card.revealOrder === 1 ? 1.02 : 0.88;

    return {
        opacity: 1,
        scale: 1,
        y: card.y,
        x: card.x,
        rotate: card.angle,
        transition: {
            x: {
                duration: entryDuration,
                ease: ENTRY_EASE,
            },
            y: {
                duration: entryDuration,
                ease: ENTRY_EASE,
            },
            scale: {
                duration: entryDuration * 0.88,
                ease: ENTRY_EASE,
            },
            rotate: {
                duration: entryDuration * 0.9,
                ease: ENTRY_EASE,
            },
        },
    };
};

const buildExitAnimation = (card, direction, soften = false) => {
    const isUp = direction === 'up';
    const travelDistance = soften
        ? (isUp ? -SOFT_EXIT_TRAVEL_PX : SOFT_EXIT_TRAVEL_PX)
        : (isUp ? -EXIT_UP_TRAVEL_PX : EXIT_DOWN_TRAVEL_PX);

    const exitDuration = soften
        ? SOFT_EXIT_DURATION_S
        : (isUp ? EXIT_UP_DURATION_S : EXIT_DOWN_DURATION_S);

    return {
        opacity: 1,
        x: card.x + (isUp ? -18 : 18),
        y: card.y + travelDistance,
        scale: 1,
        rotate: card.angle + (isUp ? -6 : 6),
        transition: {
            duration: exitDuration,
            ease: [0.32, 0, 0.67, 0], // easeInCubic for a natural exit feel
        },
    };
};

const buildOverflowTrimAnimation = (card) => ({
    opacity: 1,
    x: card.x,
    y: card.y + 1800,   // shunt it far below viewport instantly
    scale: 1,
    rotate: card.angle,
    transition: {
        duration: 0.28,
        ease: [0.32, 0, 0.67, 0],
    },
});

const CardStacker = ({
    images,
    anchorX = '65%',
    anchorY = '68%',
    cardWidth = 559,
    active = true,
    stack: propStack,
    lastAction: propLastAction,
    containerRef: propContainerRef,
    handColorControlEnabled = false,
    colorScanProgress = 0,
    colorScannerVisible = false,
}) => {
    const shouldUseLocalPhysics = !propStack || !propLastAction || !propContainerRef;
    const localPhysics = useCardPhysics({
        initialImages: shouldUseLocalPhysics ? images : EMPTY_IMAGES,
        isActive: shouldUseLocalPhysics ? active : false,
        mediaFilters: EMPTY_FILTERS,
    });

    // Choose between prop-provided stack/action or local hook
    const stack = propStack || localPhysics.stack;
    const lastAction = propLastAction || localPhysics.lastAction;
    const containerRef = propContainerRef || localPhysics.containerRef;
    const safeCardWidth = Math.max(100, Math.round(cardWidth));
    const safeCardHeight = Math.round((safeCardWidth * 9) / 16);
    const isContainerVisible = active || stack.length > 0;

    return (
        <div
            className="card-stacker-container"
            ref={containerRef}
            style={{
                visibility: isContainerVisible ? 'visible' : 'hidden',
                '--card-width': `${safeCardWidth}px`,
                '--card-height': `${safeCardHeight}px`
            }}
        >
            <div className="stack-anchor" aria-hidden="true">
                <AnimatePresence custom={lastAction}>
                    {stack.map((card, index) => {
                        const initialAnim = getCardInitialAnimation(card, index);
                        const isTopCard = index === stack.length - 1;
                        const showHandColorControl =
                            handColorControlEnabled &&
                            isTopCard &&
                            colorScannerVisible;
                        const grayscaleCoverPercent = Math.round(
                            Math.max(0, Math.min(100, colorScanProgress * 100)),
                        );
                        const scannerPositionPercent = Math.max(
                            0,
                            Math.min(100, grayscaleCoverPercent),
                        );

                        return (
                            <motion.div
                                key={card.id}
                                className={`stacked-card ${showHandColorControl ? 'with-color-scan' : ''}`}
                                custom={lastAction}
                                initial={initialAnim}
                                animate={buildEntryAnimation(card)}
                                exit={(customMode) => {
                                    if (customMode === 'overflow-trim') {
                                        return buildOverflowTrimAnimation(card);
                                    }

                                    if (customMode === 'exit-down') {
                                        return buildExitAnimation(card, 'down');
                                    }

                                    if (customMode === 'exit-up') {
                                        return buildExitAnimation(card, 'up');
                                    }

                                    if (customMode === 'exit-down-soft') {
                                        return buildExitAnimation(card, 'down', true);
                                    }

                                    if (customMode === 'exit-up-soft') {
                                        return buildExitAnimation(card, 'up', true);
                                    }

                                    return buildExitAnimation(card, 'up', true);
                                }}

                                style={{ zIndex: card.zIndex }}
                            >
                                {showHandColorControl ? (
                                    <div className="stacked-card-image-shell">
                                        <img
                                            src={card.image}
                                            alt={card.title}
                                            loading="eager"
                                            decoding="sync"
                                            className="stacked-card-image stacked-card-image-color"
                                        />
                                        <div
                                            className="stacked-card-monochrome-layer"
                                            style={{
                                                clipPath: `inset(0 ${100 - grayscaleCoverPercent}% 0 0)`,
                                            }}
                                        >
                                            <img
                                                src={card.image}
                                                alt=""
                                                aria-hidden="true"
                                                loading="eager"
                                                decoding="sync"
                                                className="stacked-card-image stacked-card-image-monochrome"
                                            />
                                        </div>
                                        <span
                                            className={`stacked-card-scan-line ${colorScannerVisible ? 'visible' : ''}`}
                                            style={{ left: `${scannerPositionPercent}%` }}
                                            aria-hidden="true"
                                        />
                                    </div>
                                ) : (
                                    <img
                                        src={card.image}
                                        alt={card.title}
                                        loading="eager"
                                        decoding="sync"
                                    />
                                )}
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

            <style>{`
                .card-stacker-container {
                    position: sticky; 
                    top: 0; right: 0;
                    width: 100%; height: 100vh;
                    pointer-events: none; z-index: 50;
                    will-change: transform, opacity;
                }
                .stack-anchor {
                    position: absolute;
                    top: ${anchorY}; 
                    left: ${anchorX}; 
                    width: 0; height: 0;
                    transition:
                        left 420ms cubic-bezier(0.22, 1, 0.36, 1),
                        top 420ms cubic-bezier(0.22, 1, 0.36, 1);
                    will-change: left, top;
                }
                .stacked-card {
                    position: absolute;
                    width: var(--card-width, 559px);
                    aspect-ratio: 16/9;
                    background-color: #fff; 
                    padding: clamp(4px, calc(var(--card-width, 559px) * 0.02), 16px);
                    border-radius: 2px; 
                    box-shadow: 0 15px 50px rgba(0,0,0,0.15);
                    top: calc(var(--card-height, 314px) * -0.5);
                    left: calc(var(--card-width, 559px) * -0.5);
                    display: flex; align-items: center; justify-content: center;
                    overflow: hidden; backface-visibility: hidden;
                    pointer-events: auto; /* Allow interactions with cards */
                }
                .stacked-card img {
                    width: 100%; height: 100%;
                    object-fit: cover; display: block;
                    border-radius: 1px; 
                }

                .stacked-card-image-shell {
                    position: relative;
                    width: 100%;
                    height: 100%;
                    overflow: hidden;
                    border-radius: 1px;
                }

                .stacked-card-image {
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .stacked-card-monochrome-layer {
                    position: absolute;
                    inset: 0;
                    overflow: hidden;
                    will-change: clip-path;
                    transition: clip-path 240ms cubic-bezier(0.22, 1, 0.36, 1);
                }

                .stacked-card-image-monochrome {
                    filter: grayscale(1) contrast(1.04) brightness(0.98);
                }

                .stacked-card-scan-line {
                    position: absolute;
                    top: 4%;
                    bottom: 4%;
                    width: 3px;
                    border-radius: 999px;
                    background:
                        linear-gradient(180deg, rgba(255, 246, 208, 0.25), rgba(255, 255, 255, 0.98), rgba(255, 214, 153, 0.35));
                    transform: translateX(-50%);
                    box-shadow:
                        0 0 0 1px rgba(255, 255, 255, 0.22),
                        0 0 10px rgba(255, 214, 153, 0.64),
                        0 0 24px rgba(255, 255, 255, 0.32);
                    opacity: 0.22;
                    transition:
                        left 240ms cubic-bezier(0.22, 1, 0.36, 1),
                        opacity 220ms ease,
                        box-shadow 220ms ease;
                    pointer-events: none;
                }

                .stacked-card-scan-line.visible {
                    opacity: 0.95;
                    box-shadow:
                        0 0 0 1px rgba(255, 255, 255, 0.34),
                        0 0 14px rgba(255, 214, 153, 0.84),
                        0 0 38px rgba(255, 255, 255, 0.42);
                }
            `}</style>
        </div>
    );
};

export default CardStacker;
