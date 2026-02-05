import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCardPhysics } from '../hooks/useCardPhysics';

const CardStacker = ({ images, anchorX = '65%', anchorY = '68%' }) => {
    // Legacy support: hook expects 'initialImages', component receives 'images'
    const { stack, lastAction, containerRef } = useCardPhysics({ initialImages: images });

    return (
        <div
            className="card-stacker-container"
            ref={containerRef}
        >
            <div className="stack-anchor">
                <AnimatePresence custom={lastAction}>
                    {stack.map(card => {
                        // Determine initial state
                        // If card has explicit initialPos (Mouse spawn), use it.
                        // Else use default Fall from Top (Scroll/System spawn).
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
                            y: -1200, // Default Fall
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
                }
                .stacked-card {
                    position: absolute;
                    width: 420px; 
                    aspect-ratio: 16/9;
                    background-color: #fff; 
                    padding: 16px; 
                    border-radius: 2px; 
                    box-shadow: 0 15px 50px rgba(0,0,0,0.15);
                    top: -118px; left: -210px;
                    display: flex; align-items: center; justify-content: center;
                    overflow: hidden; backface-visibility: hidden;
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

export default CardStacker;
