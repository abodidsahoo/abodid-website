import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Config ───────────────────────────────────────────────────────────────────
const CARD_COUNT       = 10;   // how many cards to show in the stack
const CARD_ASPECT      = 16/9;
const STACK_SECTION_H  = '420vh'; // total scroll height of the pinned section
// Scroll phases as fractions of (sectionHeight - viewportHeight):
//   0 → STACK_END   : cards fly in one-by-one from bottom (stacking phase)
//   STACK_END → EXIT_START : idle - all cards visible, scroll locked here a bit
//   EXIT_START → 1  : cards flick upward one-by-one (exit phase)
const STACK_END        = 0.40;  // 40 % of total scroll = stacking done
const EXIT_START       = 0.58;  // 58 % = start flicking cards off
const CARD_INTERVAL_MS = 90;    // delay between sequential card dismissals

// Deterministic lightweight hash → small float in [0,1)
const hashF = (s) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 10000) / 10000;
};
const lerp = (a, b, t) => a + (b - a) * t;

// Per-card deterministic layout jitter
const cardStyle = (index) => ({
    rotate: lerp(-4, 4, hashF(`r${index}`)),
    x:      lerp(-20, 20, hashF(`x${index}`)),
    y:      lerp(-14, 14, hashF(`y${index}`)),
});

// ─── FlowCardStack ────────────────────────────────────────────────────────────
const FlowCardStack = ({ images = [] }) => {
    const sectionRef    = useRef(null);
    const rafRef        = useRef(0);
    const lastScrollRef = useRef(0);

    // How many cards are currently "stacked" (visible in center)
    const [stackedCount, setStackedCount]   = useState(0);
    // Which phase we are tracking (for exit direction)
    const [exitDirection, setExitDirection] = useState('up'); // 'up' | 'down'
    // Indices of cards that have been flicked off (exited)
    const [exitedCards, setExitedCards]     = useState(new Set());
    // Show/hide the entire sticky layer
    const [isVisible, setIsVisible]         = useState(false);
    // Internal progress [0,1] across the pinned section
    const progressRef = useRef(0);
    // Prevent rapid re-triggers
    const pendingExitRef = useRef(null);

    // Derive an array of image urls (cap at CARD_COUNT)
    const pool = React.useMemo(() => {
        const urls = (images || [])
            .map(img => img?.image || img?.cover_image || img?.url || '')
            .filter(Boolean);
        // Cycle if fewer images than CARD_COUNT
        const result = [];
        for (let i = 0; i < CARD_COUNT; i++) result.push(urls[i % Math.max(urls.length, 1)] || '');
        return result;
    }, [images]);

    // ── Scroll-driven logic ──────────────────────────────────────────────────
    const syncToScroll = useCallback(() => {
        rafRef.current = 0;
        const section = sectionRef.current;
        if (!section) return;

        const rect       = section.getBoundingClientRect();
        const viewportH  = window.innerHeight;
        const scrollable = Math.max(rect.height - viewportH, 1);
        // rect.top goes from +viewportH (section not yet reached) to -(rect.height - viewportH)
        const scrolled   = Math.max(0, -rect.top);
        const progress   = Math.min(1, scrolled / scrollable);
        const prevProg   = progressRef.current;
        progressRef.current = progress;

        const visible = rect.top < viewportH && rect.bottom > 0;
        setIsVisible(visible);

        if (!visible) return;

        const dir = progress > prevProg ? 'down' : 'up';

        // ── STACKING PHASE (0 → STACK_END) ──────────────────────────────────
        // Each card appears as progress crosses its threshold
        if (progress <= STACK_END) {
            const desiredCount = Math.round((progress / STACK_END) * CARD_COUNT);
            setStackedCount(Math.min(desiredCount, CARD_COUNT));
            setExitedCards(new Set());
            setExitDirection('up');
        }
        // ── IDLE ZONE (STACK_END → EXIT_START) ──────────────────────────────
        else if (progress < EXIT_START) {
            setStackedCount(CARD_COUNT);
            setExitedCards(new Set());
        }
        // ── EXIT PHASE (EXIT_START → 1) ──────────────────────────────────────
        // Cards flick off one by one (from top of stack = highest index)
        else {
            const exitProgress = (progress - EXIT_START) / (1 - EXIT_START);
            const cardsToDismiss = Math.round(exitProgress * CARD_COUNT);
            setStackedCount(CARD_COUNT);
            setExitDirection(dir === 'up' ? 'down' : 'up');
            // Build a set of card indices that should be gone
            // Cards exit from top (highest index first)
            const exited = new Set();
            for (let i = CARD_COUNT - 1; i >= CARD_COUNT - cardsToDismiss; i--) {
                exited.add(i);
            }
            setExitedCards(exited);
        }
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const onScroll = () => {
            if (rafRef.current) return;
            rafRef.current = requestAnimationFrame(syncToScroll);
        };
        syncToScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll, { passive: true });
        return () => {
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onScroll);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [syncToScroll]);

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <section
            ref={sectionRef}
            className="fcs-section"
            aria-label="Photography stack"
        >
            {/* Sticky viewport that holds everything */}
            <div className="fcs-sticky">
                <AnimatePresence>
                    {isVisible && pool.map((src, i) => {
                        const inStack  = i < stackedCount;
                        const exited   = exitedCards.has(i);
                        const jitter   = cardStyle(i);
                        const isTop    = i === stackedCount - 1 && !exited;

                        // Card is only rendered while inStack; exiting cards animate out
                        return (
                            <AnimCard
                                key={`card-${i}`}
                                src={src}
                                index={i}
                                stackedCount={stackedCount}
                                inStack={inStack}
                                exited={exited}
                                exitDirection={exitDirection}
                                jitter={jitter}
                                isTop={isTop}
                            />
                        );
                    })}
                </AnimatePresence>
            </div>

            <style>{`
                .fcs-section {
                    position: relative;
                    height: ${STACK_SECTION_H};
                    z-index: 10;
                    /* Small gap below narrative section */
                    margin-top: 4vh;
                    margin-bottom: 0;
                }

                .fcs-sticky {
                    position: sticky;
                    top: 0;
                    height: 100vh;
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    pointer-events: none;
                    overflow: hidden;
                }

                /* card shell is positioned absolutely at center */
                .fcs-card-wrap {
                    position: absolute;
                    /* centered by translate in motion */
                    pointer-events: none;
                    will-change: transform, opacity;
                }

                .fcs-card {
                    background: #fff;
                    border-radius: 3px;
                    overflow: hidden;
                    box-shadow:
                        0 20px 60px rgba(0,0,0,0.35),
                        0 4px 16px rgba(0,0,0,0.18);
                    width: min(520px, 72vw);
                    aspect-ratio: 16 / 9;
                    padding: 6px;
                }

                .fcs-card img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    display: block;
                    border-radius: 2px;
                }

                @media (max-width: 768px) {
                    .fcs-section {
                        display: none;
                    }
                }
            `}</style>
        </section>
    );
};

// ─── AnimCard ─────────────────────────────────────────────────────────────────
// A single card with enter/exit animation driven by props
const AnimCard = React.memo(({ src, index, stackedCount, inStack, exited, exitDirection, jitter, isTop }) => {
    const VIEWPORT_H = typeof window !== 'undefined' ? window.innerHeight : 900;

    // Base resting position (centered, with jitter)
    const restX = jitter.x;
    const restY = jitter.y;

    // Entry: from below (or from above when scrolling back up)
    const entryY = VIEWPORT_H + 200;
    const entryYUp = -(VIEWPORT_H + 200);

    // Exit travels: cards flick upward (scrolling down) or downward (scrolling up)
    const exitY = exitDirection === 'up' ? -(VIEWPORT_H + 600) : VIEWPORT_H + 600;
    const exitX = exitDirection === 'up'
        ? jitter.x + (index % 2 === 0 ? -20 : 20)
        : jitter.x + (index % 2 === 0 ? 20 : -20);
    const exitRotate = jitter.rotate + (exitDirection === 'up' ? -8 : 8);

    // Determine which animation state to show:
    // "hidden"  — card not yet stacked, sits below viewport
    // "visible" — card is in the rest/stack position
    // "exited"  — card has been flicked off
    let animState;
    if (exited) {
        animState = 'exited';
    } else if (inStack) {
        animState = 'visible';
    } else {
        animState = 'hidden';
    }

    const variants = {
        hidden: {
            x: restX,
            y: entryY,
            rotate: jitter.rotate + (Math.random() > 0.5 ? 6 : -6),
            scale: 0.95,
            opacity: 1,
        },
        visible: {
            x: restX,
            y: restY,
            rotate: jitter.rotate,
            scale: 1,
            opacity: 1,
            transition: {
                type: 'spring',
                stiffness: 140,
                damping: 18,
                mass: 0.9,
                delay: 0, // staggered externally via stackedCount change timing
            },
        },
        exited: {
            x: exitX,
            y: exitY,
            rotate: exitRotate,
            scale: 0.96,
            opacity: 1,
            transition: {
                duration: 0.64,
                ease: [0.32, 0, 0.67, 0],
            },
        },
    };

    if (!inStack && !exited) return null;

    return (
        <motion.div
            className="fcs-card-wrap"
            style={{ zIndex: 10 + index }}
            initial="hidden"
            animate={animState}
            exit="exited"
            variants={variants}
        >
            <div className="fcs-card">
                {src ? (
                    <img src={src} alt="" loading="eager" decoding="async" />
                ) : (
                    <div style={{ width: '100%', height: '100%', background: '#1a1a2e' }} />
                )}
            </div>
        </motion.div>
    );
});

AnimCard.displayName = 'AnimCard';

export default FlowCardStack;
