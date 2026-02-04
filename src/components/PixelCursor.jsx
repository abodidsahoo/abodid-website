import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';

const PixelCursor = () => {
    const [position, setPosition] = useState({ x: -100, y: -100 });
    const [trails, setTrails] = useState([]);
    const requestRef = useRef();

    // Trail Configuration
    const TRAIL_LENGTH = 12;
    const FADE_DURATION = 500; // ms

    useEffect(() => {
        // Hide default cursor globally on this page
        document.body.style.cursor = 'none';

        // Add specific style to ensure everything inherits
        const style = document.createElement('style');
        style.innerHTML = `
      * { cursor: none !important; }
      .pixel-cursor-container { pointer-events: none; position: fixed; top: 0; left: 0; z-index: 99999; width: 100vw; height: 100vh; overflow: hidden; }
    `;
        document.head.appendChild(style);

        const onMouseMove = (e) => {
            setPosition({ x: e.clientX, y: e.clientY });

            // Add trail point
            const newTrail = {
                x: e.clientX,
                y: e.clientY,
                id: Date.now() + Math.random(),
                timestamp: Date.now()
            };

            setTrails(prev => [...prev.slice(-TRAIL_LENGTH), newTrail]);
        };

        window.addEventListener('mousemove', onMouseMove);

        // Cleanup Loop for fading trails
        const animateTrails = () => {
            const now = Date.now();
            setTrails(prev => prev.filter(t => now - t.timestamp < FADE_DURATION));
            requestRef.current = requestAnimationFrame(animateTrails);
        };
        requestRef.current = requestAnimationFrame(animateTrails);

        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            document.body.style.cursor = 'auto'; // Restore cursor
            if (document.head.contains(style)) document.head.removeChild(style);
            cancelAnimationFrame(requestRef.current);
        };
    }, []);

    // Use Portal to ensure it floats above everything
    // But wait until body exists
    if (typeof document === 'undefined') return null;

    return createPortal(
        <div className="pixel-cursor-container">
            {/* TRAIL RENDERING */}
            {trails.map((trail, i) => {
                const age = Date.now() - trail.timestamp;
                const opacity = Math.max(0, 1 - age / FADE_DURATION);

                // Trail Colors: Cyan, Blue, White mix for "Glassy" feel
                const colors = ['#00e5ff', '#ffffff', '#2979ff'];
                const color = colors[i % 3];

                return (
                    <div
                        key={trail.id}
                        style={{
                            position: 'absolute',
                            left: trail.x,
                            top: trail.y,
                            width: '6px',
                            height: '6px',
                            backgroundColor: color,
                            opacity: opacity * 0.6, // Semi-transparent trails
                            boxShadow: `0 0 4px ${color}`, /* Slight glow for trail */
                            imageRendering: 'pixelated',
                            transform: 'translate(-50%, -50%)', // Center on mouse
                        }}
                    />
                );
            })}

            {/* 3D GLASSY CURSOR IMAGE */}
            <div
                style={{
                    position: 'absolute',
                    left: position.x,
                    top: position.y,
                    transform: 'translate(-10%, -10%)', // Adjust alignment if needed (tip usually top-left)
                    pointerEvents: 'none',
                    zIndex: 100000,
                }}
            >
                <img
                    src="/assets/cursor-3d.png"
                    alt="Cursor"
                    style={{
                        width: '64px', // Large size as requested
                        height: 'auto',
                        imageRendering: 'pixelated', // Keep voxel edges sharp
                        mixBlendMode: 'screen', // Hide black background of the generated asset
                        filter: 'drop-shadow(0 0 10px rgba(0, 229, 255, 0.5))' // Extra cyan glow
                    }}
                />
            </div>
        </div>,
        document.body
    );
};

export default PixelCursor;
