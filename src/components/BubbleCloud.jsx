import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

const BubbleCloud = ({ comments = [], onAskAI }) => {
    const containerRef = useRef(null);
    const [bubbles, setBubbles] = useState([]);

    useEffect(() => {
        if (!comments || comments.length === 0) return;

        // Limit to 8-12 comments for layout cleanliness
        const displayComments = comments.slice(0, 10);
        const count = displayComments.length;

        // Radius of the circle around the image
        // Assuming image is roughly 300x400, so radius needs to be enough to clear it.
        // We deal in percentages or relative units usually, but let's try pixel offsets from center.
        const radiusX = 280;
        const radiusY = 220;

        const newBubbles = displayComments.map((comment, i) => {
            // Distribute in a circle starting from top ( -90 deg or -PI/2 )
            // "starting from a half circle of sorts" -> Let's do a full circle distribution
            const angle = (i / count) * 2 * Math.PI - (Math.PI / 2); // Start top

            return {
                id: i,
                text: comment,
                // Consistent size, slight variance for natural feel
                size: 110,
                x: Math.cos(angle) * radiusX,
                y: Math.sin(angle) * radiusY,
                delay: i * 0.15, // Staggered pop
                // Cleaner, darker bubbles for contrast against the dark bg, or glass
                color: 'rgba(20, 20, 25, 0.6)'
            };
        });
        setBubbles(newBubbles);
    }, [comments]);

    return (
        <div className="bubble-cloud-container" ref={containerRef} style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            fontFamily: "'Inter', sans-serif"
        }}>

            {/* Header Label */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                style={{
                    position: 'absolute',
                    top: '15%',
                    textAlign: 'center',
                    width: '100%',
                    zIndex: 30,
                    pointerEvents: 'none'
                }}
            >
                <h3 style={{
                    color: 'rgba(255,255,255,0.6)',
                    fontSize: '14px',
                    fontWeight: 400,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    margin: 0
                }}>
                    What others felt
                </h3>
            </motion.div>

            {/* Floating Bubbles */}
            {bubbles.map((bubble) => (
                <motion.div
                    key={bubble.id}
                    className="bubble"
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{
                        opacity: 1,
                        scale: 1,
                        x: bubble.x,
                        y: bubble.y
                    }}
                    transition={{
                        duration: 0.5,
                        delay: bubble.delay,
                        type: "spring",
                        stiffness: 100,
                        damping: 12
                    }}
                    style={{
                        position: 'absolute',
                        width: `${bubble.size}px`,
                        height: `${bubble.size}px`,
                        borderRadius: '50%',
                        background: bubble.color,
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        padding: '16px',
                        textAlign: 'center',
                        // Clean Typography
                        fontSize: '13px',
                        lineHeight: 1.4,
                        fontWeight: 400,
                        color: '#e0e0e0',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                        zIndex: 20
                    }}
                >
                    {bubble.text}
                </motion.div>
            ))
            }

            {/* Action Button */}
            <div style={{ position: 'absolute', bottom: '15%', zIndex: 40 }}>
                <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: bubbles.length * 0.15 + 0.5 }} // Appear after bubbles
                    onClick={onAskAI}
                    className="hover-btn"
                    style={{
                        background: '#fff',
                        color: '#000',
                        border: 'none',
                        padding: '16px 32px',
                        fontSize: '14px',
                        fontWeight: '600',
                        borderRadius: '100px',
                        cursor: 'pointer',
                        boxShadow: '0 0 40px rgba(255,255,255,0.1)',
                        letterSpacing: '0.05em'
                    }}
                >
                    CONSULT A.I. ANALYSIS
                </motion.button>
            </div>
        </div >
    );
};

export default BubbleCloud;
