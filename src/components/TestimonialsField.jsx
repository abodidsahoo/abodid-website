import React, { useRef, useEffect, useState, useMemo } from 'react';
import { motion, useMotionValue, useSpring, AnimatePresence } from 'framer-motion';
import '@fontsource/inconsolata/400.css';
import '@fontsource/inconsolata/600.css';
import '@fontsource/inconsolata/700.css';

// --- CONFIGURATION ---
// Background is transparent to show site bg
const SECTION_BG = 'transparent';

// Card Colors - DEFINITIVE UPDATE
const CARD_BG_BASE = '#F2F2F2'; // Off-white
const CARD_BG_HOVER = '#a30021'; // Menu Red
const TEXT_COLOR_BASE = '#121212';
const TEXT_COLOR_HOVER = '#FFFFFF';

const CURSOR_BG = '#11B0CB'; // Cyan

// Physics constants
const DRIFT_SPEED_DESKTOP = 0.035;
const FRICTION = 0.95;
const STOP_VELOCITY = 0.005;

// Base dimensions
const CARD_BASE_WIDTH = 350;
const CARD_HOVER_WIDTH = 450; // Expands by 100px
const CARD_HEIGHT = 450; // Taller for hierarchy

const TestimonialsField = ({ testimonials = [] }) => {
    // --- STATE & REFS ---
    const containerRef = useRef(null);
    const contentRef = useRef(null);
    const [isHoveringField, setIsHoveringField] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    // Physics state
    const physics = useRef({
        offsetX: 0,
        velocityX: 0,
        lastX: 0,
        lastTime: 0,
        isDragging: false,
        rafId: null
    });

    // Cursor Motion Values
    const cursorX = useMotionValue(0);
    const cursorY = useMotionValue(0);
    const cursorSpringX = useSpring(cursorX, { stiffness: 150, damping: 15 });
    const cursorSpringY = useSpring(cursorY, { stiffness: 150, damping: 15 });

    // --- PREPARE ITEMS & WIDTH ---
    const { items, groupWidth } = useMemo(() => {
        if (!testimonials.length) return { items: [], groupWidth: 0 };

        const generatedItems = [];
        let currentW = 0;

        testimonials.forEach((t, i) => {
            const gap = 40;

            generatedItems.push({
                ...t,
                styleProps: {
                    w: CARD_BASE_WIDTH,
                    h: CARD_HEIGHT,
                    p: 40,
                    marginRight: gap
                }
            });

            currentW += CARD_BASE_WIDTH + gap;
        });

        return { items: generatedItems, groupWidth: currentW };
    }, [testimonials]);

    // Flattened items for the loop (3 sets)
    const allLoopItems = useMemo(() => {
        if (!items.length) return [];
        return [
            ...items.map(i => ({ ...i, keyPrefix: 'set1' })),
            ...items.map(i => ({ ...i, keyPrefix: 'set2' })),
            ...items.map(i => ({ ...i, keyPrefix: 'set3' }))
        ];
    }, [items]);


    // --- ANIMATION LOOP ---
    useEffect(() => {
        let lastTimestamp = performance.now();

        const loop = (timestamp) => {
            const dt = timestamp - lastTimestamp;
            lastTimestamp = timestamp;

            const p = physics.current;

            if (!p.isDragging) {
                if (Math.abs(p.velocityX) > STOP_VELOCITY) {
                    p.velocityX *= FRICTION;
                    p.offsetX -= p.velocityX * dt;
                } else {
                    p.offsetX += DRIFT_SPEED_DESKTOP * dt; // Move right-to-left
                }
            }

            if (groupWidth > 0) {
                p.offsetX = ((p.offsetX % groupWidth) + groupWidth) % groupWidth;
            }

            if (contentRef.current) {
                contentRef.current.style.transform = `translate3d(${-p.offsetX}px, 0, 0)`;
            }

            p.rafId = requestAnimationFrame(loop);
        };

        physics.current.rafId = requestAnimationFrame(loop);

        return () => cancelAnimationFrame(physics.current.rafId);
    }, [groupWidth]);


    // --- INTERACTION HANDLERS ---
    const handlePointerDown = (e) => {
        setIsDragging(true);
        physics.current.isDragging = true;
        physics.current.lastX = e.clientX;
        physics.current.lastTime = performance.now();
        physics.current.velocityX = 0;
        containerRef.current.setPointerCapture(e.pointerId);
        containerRef.current.style.cursor = 'grabbing';
    };

    const handlePointerMove = (e) => {
        cursorX.set(e.clientX);
        cursorY.set(e.clientY);

        if (!physics.current.isDragging) return;

        const now = performance.now();
        const deltaX = e.clientX - physics.current.lastX;
        physics.current.offsetX -= deltaX;

        const dt = now - physics.current.lastTime;
        if (dt > 0) {
            physics.current.velocityX = deltaX / dt;
        }

        physics.current.lastX = e.clientX;
        physics.current.lastTime = now;
    };

    const handlePointerUp = (e) => {
        setIsDragging(false);
        physics.current.isDragging = false;
        containerRef.current.releasePointerCapture(e.pointerId);
        containerRef.current.style.cursor = 'none';
    };

    const handlePointerEnter = () => setIsHoveringField(true);
    const handlePointerLeave = () => {
        setIsHoveringField(false);
        setIsDragging(false);
        physics.current.isDragging = false;
    };


    if (!testimonials.length) return null;

    return (
        <section
            className="relative overflow-hidden w-full h-[80vh] select-none"
            style={{
                backgroundColor: SECTION_BG,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                fontFamily: '"Inconsolata", monospace',
                // Mask removed as requested
            }}
        >
            {/* Draggable Field Wrapper */}
            <div
                ref={containerRef}
                className="relative cursor-none touch-none"
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    overflow: 'hidden'
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerLeave}
                onPointerEnter={handlePointerEnter}
            >
                {/* Flex Content Track */}
                <div
                    ref={contentRef}
                    style={{
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        flexWrap: 'nowrap',
                        width: 'max-content',
                        marginLeft: 0,
                        willChange: 'transform',
                    }}
                >
                    {/* Render flattened items */}
                    {allLoopItems.map((item, idx) => (
                        <TestimonialCard
                            key={`${item.keyPrefix}-${item.id}-${idx}`}
                            data={item}
                        />
                    ))}
                </div>
            </div>

            <CustomCursor
                x={cursorSpringX}
                y={cursorSpringY}
                isVisible={isHoveringField}
                isDragging={isDragging}
            />
        </section>
    );
};

const TestimonialCard = ({ data }) => {
    const { styleProps, content, name, role, company } = data;
    const [isHovered, setIsHovered] = useState(false);

    return (
        <motion.div
            layout // Enable layout animation for smooth expansion
            className="flex-shrink-0 shadow-sm relative group"
            onHoverStart={() => setIsHovered(true)}
            onHoverEnd={() => setIsHovered(false)}
            initial={{
                backgroundColor: CARD_BG_BASE,
                color: TEXT_COLOR_BASE,
                width: styleProps.w
            }}
            animate={{
                backgroundColor: isHovered ? CARD_BG_HOVER : CARD_BG_BASE,
                color: isHovered ? TEXT_COLOR_HOVER : TEXT_COLOR_BASE,
                width: isHovered ? CARD_HOVER_WIDTH : styleProps.w,
            }}
            transition={{
                layout: { duration: 0.3, type: "spring", stiffness: 300, damping: 30 },
                backgroundColor: { duration: 0.2 }
            }}
            style={{
                height: `${styleProps.h}px`,
                padding: `${styleProps.p}px`,
                marginRight: `${styleProps.marginRight}px`,
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                fontFamily: '"Inconsolata", monospace',
                // Width handled by animate prop to avoid conflict with 'layout'
            }}
        >
            {/* Top: Testimonial Text (Clamped) */}
            <div className="flex-grow overflow-hidden relative">
                <p
                    className="leading-relaxed opacity-90"
                    style={{
                        fontSize: '16px',
                        display: '-webkit-box',
                        WebkitLineClamp: 8,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                    }}
                >
                    "{content}"
                </p>
            </div>

            {/* Bottom: Name & details (Anchored) */}
            <div
                className="mt-8 pt-6 border-t"
                style={{
                    borderColor: isHovered ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)',
                    transition: 'border-color 0.2s'
                }}
            >
                <div className="flex flex-col gap-1">
                    <motion.h3
                        layout="position"
                        className="tracking-tight truncate w-full"
                        style={{
                            fontSize: '24px',
                            fontWeight: 400, // Normal weight
                            margin: 0,
                            lineHeight: 1.2
                        }}
                    >
                        {name}
                    </motion.h3>

                    {/* Role and Company split or combined on new line */}
                    {/* Role separate line */}
                    {role && (
                        <motion.div
                            layout="position"
                            className="uppercase tracking-widest opacity-70 truncate w-full"
                            style={{
                                fontSize: '13px',
                                fontWeight: 600, // Semi-bold
                                lineHeight: 1.4,
                                marginTop: '4px'
                            }}
                        >
                            {role}
                        </motion.div>
                    )}

                    {/* Company separate line, normal weight */}
                    {company && (
                        <motion.div
                            layout="position"
                            className="uppercase tracking-widest opacity-70 truncate w-full"
                            style={{
                                fontSize: '13px',
                                fontWeight: 400, // Normal weight
                                lineHeight: 1.4
                            }}
                        >
                            {company}
                        </motion.div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

const CustomCursor = ({ x, y, isVisible, isDragging }) => {
    return (
        <motion.div
            className="fixed top-0 left-0 pointer-events-none z-50 flex items-center justify-center font-bold text-white shadow-2xl backdrop-blur-sm"
            style={{
                x, y,
                backgroundColor: CURSOR_BG,
                translateX: '-50%',
                translateY: '-50%',
            }}
            animate={{
                opacity: isVisible ? 1 : 0,
                width: isDragging ? 90 : 100,
                height: isDragging ? 90 : 100,
                borderRadius: '50%',
                scale: isDragging ? 0.9 : 1
            }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        >
            <div className="flex flex-col items-center justify-center font-mono">
                <span className="text-[14px] tracking-widest uppercase mb-1">
                    {isDragging ? 'Dragging' : 'Drag'}
                </span>
                {!isDragging && (
                    <div className="flex gap-2 text-[12px]">
                        <span>←</span><span>→</span>
                    </div>
                )}
            </div>
        </motion.div>
    );
};

export default TestimonialsField;
