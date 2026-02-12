// ISOLATED COPY of CardStacker for hand tracking testing
// Receives stack from parent instead of creating its own
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const HandTrackingCardStacker = ({
    images,
    anchorX = '50%',
    anchorY = '50%',
    active = true,
    stack = [],  // Receive stack from parent
    lastAction = 'add',  // Receive lastAction from parent
}) => {
    const containerRef = React.useRef(null);

    console.log('🎴 HandTrackingCardStacker rendering with', stack.length, 'cards');

    return (
        <div
            className="card-stacker-container"
            ref={containerRef}
            style={{
                opacity: active ? 1 : 0,
                transition: 'opacity 1.5s ease-in-out'
            }}
        >
            <div className="stack-anchor" aria-hidden="true">
                <AnimatePresence custom={lastAction}>
                    {stack.map(card => {
                        const initialAnim = card.initialPos ? {
                            opacity: 0,
                            scale: 0.9,
                            x: card.initialPos.x,
                            y: card.initialPos.y,
                            rotate: (Math.random() - 0.5) * 30
                        } : {
                            opacity: 0,
                            scale: 0.9,
                            x: 0,
                            y: -1200,
                            rotate: (Math.random() - 0.5) * 15
                        };

                        return (
                            <motion.div
                                key={card.id}
                                className="stacked-card"
                                custom={lastAction}

                                initial={initialAnim}

                                animate={{
                                    opacity: 1,
                                    scale: 1,
                                    y: card.y,
                                    x: card.x,
                                    rotate: card.angle,
                                    transition: { duration: 0.6, ease: "backOut" }
                                }}

                                exit={(customMode) => {
                                    if (customMode === 'unstack') {
                                        return {
                                            opacity: 0,
                                            y: -1200,
                                            scale: 1.1,
                                            rotate: card.angle * 4,
                                            transition: { duration: 0.6, ease: [0.32, 0, 0.67, 0] }
                                        };
                                    } else {
                                        return {
                                            opacity: 0,
                                            scale: 0.8,
                                            y: 50,
                                            transition: { duration: 0.3 }
                                        };
                                    }
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

            <style>{`
                .card-stacker-container {
                    position: fixed; 
                    top: 0; 
                    left: 0;
                    width: calc(100vw - 320px);
                    height: 100vh;
                    pointer-events: none; 
                    z-index: 150;
                    will-change: transform, opacity;
                }
                .stack-anchor {
                    position: absolute;
                    top: ${anchorY}; 
                    left: ${anchorX}; 
                    width: 0; height: 0;
                }
                .stacked-card {
                    position: absolute;
                    width: 559px;
                    aspect-ratio: 16/9;
                    background-color: #fff; 
                    padding: 16px; 
                    border-radius: 2px; 
                    box-shadow: 0 15px 50px rgba(0,0,0,0.15);
                    top: -157px; left: -279px;
                    display: flex; align-items: center; justify-content: center;
                    overflow: hidden; backface-visibility: hidden;
                    pointer-events: auto;
                }
                .stacked-card img {
                    width: 100%; height: 100%;
                    object-fit: cover; display: block;
                    border-radius: 1px; 
                }
            `}</style>
        </div>
    );
};

export default HandTrackingCardStacker;
