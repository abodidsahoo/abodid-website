import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const LiquidCursor = () => {
    const cursorRef = useRef(null);
    const cursorInnerRef = useRef(null);
    // Track if we are hovering over an interactive element
    const isHovering = useRef(false);

    // State for Physics
    const mouse = useRef({ x: -100, y: -100 });
    const pos = useRef({ x: -100, y: -100 });
    const velocity = useRef({ x: 0, y: 0 }); // Smoothed Velocity
    const rafId = useRef(null);

    // Physics Constants
    const POS_LERP = 0.9; // 0.9 = Almost instant but filtering Micro-Jitter
    const VEL_LERP = 0.15; // 0.15 = Smooths out the deformation changes
    const STRETCH_FACTOR = 0.8; // How much it stretches
    const MAX_STRETCH = 1.6; // Max Scale X

    useEffect(() => {
        // Init
        document.body.style.cursor = 'none';

        // Inject Global Cursor Styles
        const style = document.createElement('style');
        style.innerHTML = `
            * { cursor: none !important; }
            .liquid-cursor-container { 
                pointer-events: none; 
                position: fixed; 
                top: 0; left: 0; 
                z-index: 99999; 
                width: 100vw; height: 100vh; 
                overflow: hidden; 
            }
        `;
        document.head.appendChild(style);

        const onMouseMove = (e) => {
            mouse.current = { x: e.clientX, y: e.clientY };
            // Instant init
            if (pos.current.x === -100) pos.current = { x: e.clientX, y: e.clientY };

            // Hover Detection (Links, Buttons, Inputs)
            const target = e.target;
            const interactive = target.closest('a, button, input, [role="button"], .clickable');
            isHovering.current = !!interactive;
        };

        window.addEventListener('mousemove', onMouseMove);

        const loop = () => {
            if (!cursorRef.current || !cursorInnerRef.current) {
                rafId.current = requestAnimationFrame(loop);
                return;
            }

            // 1. Position Physics (Micro-Lerp for buttery smooth movement)
            pos.current.x += (mouse.current.x - pos.current.x) * POS_LERP;
            pos.current.y += (mouse.current.y - pos.current.y) * POS_LERP;

            // 2. Velocity Calculation (For Deformation)
            const rawDx = (mouse.current.x - pos.current.x);
            const rawDy = (mouse.current.y - pos.current.y);
            velocity.current.x += (rawDx - velocity.current.x) * VEL_LERP;
            velocity.current.y += (rawDy - velocity.current.y) * VEL_LERP;

            const speed = Math.sqrt(velocity.current.x ** 2 + velocity.current.y ** 2);

            // 3. Rotation (Angle)
            let angle = 0;
            if (speed > 0.1) { // Very sensitive update
                angle = Math.atan2(velocity.current.y, velocity.current.x) * 180 / Math.PI;
                cursorInnerRef.current.dataset.lastAngle = angle;
            } else {
                angle = parseFloat(cursorInnerRef.current.dataset.lastAngle || 0);
            }

            // 4. One-Way Stretch
            // Calculate stretch
            let scaleX = 1 + Math.min(speed * 0.2 * STRETCH_FACTOR, MAX_STRETCH);
            let scaleY = 1 - Math.min(speed * 0.1 * STRETCH_FACTOR, 0.4);

            // HOVER STATE OVERRIDE:
            // If hovering, we want a perfect circle (no stretch) and maybe scaled up slightly
            if (isHovering.current) {
                scaleX = 1.0;
                scaleY = 1.0;
            }

            // --- CRITICAL FIX: Update OUTER Cursor Position ---
            cursorRef.current.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y}px, 0)`;

            // Apply Position Transform
            cursorRef.current.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y}px, 0)`;

            // HOVER DETECTION (Spatial / "Any portion of circle")
            // Instead of just the pixel under mouse, we check a small radius
            // effectively making the cursor "fatter" for interaction
            // We can scan 4 points around the cursor or use elementsFromPoint
            let hovered = false;

            // Check center
            const centerEl = document.elementFromPoint(mouse.current.x, mouse.current.y);
            if (centerEl && centerEl.closest('a, button, input, [role="button"], .clickable')) {
                hovered = true;
            } else {
                // Check edge points (Radius 20px)
                // This simulates "any portion of the circle"
                const offsets = [
                    { x: 15, y: 0 }, { x: -15, y: 0 },
                    { x: 0, y: 15 }, { x: 0, y: -15 }
                ];
                for (let o of offsets) {
                    const el = document.elementFromPoint(mouse.current.x + o.x, mouse.current.y + o.y);
                    if (el && el.closest('a, button, input, [role="button"], .clickable')) {
                        hovered = true;
                        break;
                    }
                }
            }
            isHovering.current = hovered;

            // Determine Transform Origin
            // STABILITY FIX: Always 50% 50% (Center pinned)
            // This prevents the "jumping" caused by offsetting pivots during rotation
            const origin = '50% 50%';

            cursorInnerRef.current.style.transformOrigin = origin;
            cursorInnerRef.current.style.transform = `
                rotate(${isHovering.current ? 0 : angle}deg)
                scale(${isHovering.current ? 1.2 : scaleX}, ${isHovering.current ? 1.2 : scaleY})
            `;

            // 5. Visuals & Colors
            const visualContainer = cursorInnerRef.current;
            if (visualContainer) {
                if (isHovering.current) {
                    // HOVER STATE: Green Glow
                    visualContainer.style.background = 'rgba(57, 255, 20, 0.1)'; // Transparent Green
                    visualContainer.style.border = '2px solid #39FF14'; // Neon Green Border
                    visualContainer.style.boxShadow = '0 0 15px #39FF14, inset 0 0 15px #39FF14'; // Inner + Outer Glow
                    visualContainer.style.transition = 'all 0.15s ease-out'; // Faster reaction
                } else {
                    // NORMAL STATE: Linear Gradient (Blue <-> Lilac)
                    let intensity = Math.min(speed * 2.0, 1);
                    visualContainer.style.setProperty('--move-intensity', intensity.toFixed(2));

                    // Linear Gradient
                    visualContainer.style.backgroundImage = `linear-gradient(to right, 
                        rgba(200, 162, 200, ${intensity}), 
                        rgba(65, 105, 225, ${intensity})
                    )`;

                    // Reset to white base
                    visualContainer.style.backgroundColor = 'white';
                    visualContainer.style.border = 'none';
                    visualContainer.style.boxShadow = 'inset 0 0 2px 1px rgba(255,255,255,0.9)';
                    visualContainer.style.transition = 'background 0.1s linear, transform 0.1s linear, border 0.1s linear';
                }
            }

            rafId.current = requestAnimationFrame(loop);
        };

        loop();

        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            document.body.style.cursor = 'auto'; // Restore sys cursor
            if (document.head.contains(style)) document.head.removeChild(style);
            if (rafId.current) cancelAnimationFrame(rafId.current);
        };
    }, []);

    if (typeof document === 'undefined') return null;

    return createPortal(
        <div className="liquid-cursor-container">
            <div
                ref={cursorRef}
                style={{
                    position: 'absolute', top: 0, left: 0,
                    width: '0px', height: '0px',
                    pointerEvents: 'none',
                    willChange: 'transform' // Hardware accel
                }}
            >
                {/* Visual Circle */}
                <div
                    ref={cursorInnerRef}
                    style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        backgroundColor: 'white',

                        // Centering via relative positioning
                        position: 'absolute',
                        left: '-18px',
                        top: '-18px',

                        willChange: 'transform',
                        // Origin dynamic (set in loop)
                        transformOrigin: '0% 50%',

                        // Initial sharp shadow
                        boxShadow: 'inset 0 0 2px 1px rgba(255,255,255,0.9)',
                    }}
                />
            </div>
        </div>,
        document.body
    );
};

export default LiquidCursor;
