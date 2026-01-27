import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

// Renders image as a grid of chunks with proximity-based vanishing and random pixel deletion
const ImageGrid = ({ src, width, height, mousePos, containerRect, hasRecentlyVanished }) => {
    const BLOCK_SIZE = 25;
    const columns = Math.ceil(width / BLOCK_SIZE);
    const rows = Math.ceil(height / BLOCK_SIZE);

    const blocks = Array.from({ length: columns * rows }, (_, i) => ({
        index: i,
        col: i % columns,
        row: Math.floor(i / columns)
    }));

    const [randomlyDeletedBlocks, setRandomlyDeletedBlocks] = useState(new Set());

    // Random pixel deletion that happens continuously
    useEffect(() => {
        const interval = setInterval(() => {
            const totalBlocks = blocks.length;
            const numToDelete = Math.floor(Math.random() * 12) + 3; // Delete 3-15 random blocks
            const newDeleted = new Set();

            for (let i = 0; i < numToDelete; i++) {
                const randomIndex = Math.floor(Math.random() * totalBlocks);
                newDeleted.add(randomIndex);
            }

            setRandomlyDeletedBlocks(newDeleted);

            // Restore after delay
            setTimeout(() => {
                setRandomlyDeletedBlocks(new Set());
            }, 600 + Math.random() * 600); // Vanish for 0.6-1.2s

        }, 1500 + Math.random() * 2000); // Every 1.5-3.5 seconds

        return () => clearInterval(interval);
    }, [blocks.length]);

    return (
        <>
            {blocks.map(({ index, col, row }) => {
                const blockCenterX = containerRect.left + (col * BLOCK_SIZE) + (BLOCK_SIZE / 2);
                const blockCenterY = containerRect.top + (row * BLOCK_SIZE) + (BLOCK_SIZE / 2);

                const distToBlock = Math.hypot(mousePos.x - blockCenterX, mousePos.y - blockCenterY);

                const VANISH_RADIUS = Math.max(width, height) * 0.5;

                let opacity = 1;

                if (randomlyDeletedBlocks.has(index)) {
                    opacity = 0; // Complete transparency
                } else if (distToBlock < VANISH_RADIUS) {
                    const fadeRatio = distToBlock / VANISH_RADIUS;
                    opacity = Math.pow(fadeRatio, 2);
                }

                const shouldDelay = hasRecentlyVanished && opacity >= 0.9;

                const clipLeft = col * BLOCK_SIZE;
                const clipTop = row * BLOCK_SIZE;

                return (
                    <motion.div
                        key={index}
                        animate={{ opacity }}
                        transition={{
                            duration: opacity < 0.1 ? 0.05 : 3.5,
                            delay: shouldDelay ? 2 + (Math.random() * 1.5) : 0,
                            ease: opacity < 0.1 ? "easeIn" : "easeOut"
                        }}
                        style={{
                            position: 'absolute',
                            left: clipLeft,
                            top: clipTop,
                            width: BLOCK_SIZE,
                            height: BLOCK_SIZE,
                            overflow: 'hidden'
                        }}
                    >
                        <img
                            src={src}
                            alt=""
                            style={{
                                position: 'absolute',
                                left: -clipLeft,
                                top: -clipTop,
                                width: width,
                                height: height,
                                objectFit: 'cover',
                                pointerEvents: 'none',
                                userSelect: 'none'
                            }}
                        />
                    </motion.div>
                );
            })}
        </>
    );
};

const PixelFormation = ({ src, width, height }) => {
    const BLOCK_SIZE = 15;
    const columns = Math.ceil(width / BLOCK_SIZE);
    const rows = Math.ceil(height / BLOCK_SIZE);

    const [blocks] = useState(() =>
        Array.from({ length: columns * rows }, (_, i) => ({
            index: i,
            col: i % columns,
            row: Math.floor(i / columns),
            delay: Math.random() * 1.5
        })).sort(() => Math.random() - 0.5)
    );

    return (
        <>
            {blocks.map(({ index, col, row, delay }) => {
                const clipLeft = col * BLOCK_SIZE;
                const clipTop = row * BLOCK_SIZE;

                return (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{
                            duration: 0.6,
                            delay: delay,
                            ease: "easeOut"
                        }}
                        style={{
                            position: 'absolute',
                            left: clipLeft,
                            top: clipTop,
                            width: BLOCK_SIZE,
                            height: BLOCK_SIZE,
                            overflow: 'hidden'
                        }}
                    >
                        <img
                            src={src}
                            alt=""
                            style={{
                                position: 'absolute',
                                left: -clipLeft,
                                top: -clipTop,
                                width: width,
                                height: height,
                                objectFit: 'cover',
                                pointerEvents: 'none',
                                userSelect: 'none'
                            }}
                        />
                    </motion.div>
                );
            })}
        </>
    );
};

const DecryptingImage = ({ src, width, height, position, delay = 0, mousePos }) => {
    const [isRevealed, setIsRevealed] = useState(false);
    const [hasRecentlyVanished, setHasRecentlyVanished] = useState(false);
    const containerRef = useRef(null);
    const [containerRect, setContainerRect] = useState({ left: 0, top: 0, width: 0, height: 0 });
    const vanishTimerRef = useRef(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsRevealed(true);
        }, (delay * 1000 + 500));
        return () => clearTimeout(timer);
    }, [delay]);

    useEffect(() => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setContainerRect(rect);
        }
    }, [mousePos]);

    useEffect(() => {
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dist = Math.hypot(mousePos.x - centerX, mousePos.y - centerY);
        const VANISH_RADIUS = Math.max(width, height) * 0.5;

        if (dist < VANISH_RADIUS) {
            setHasRecentlyVanished(true);
            if (vanishTimerRef.current) {
                clearTimeout(vanishTimerRef.current);
            }
        } else if (hasRecentlyVanished) {
            vanishTimerRef.current = setTimeout(() => {
                setHasRecentlyVanished(false);
            }, 3500);
        }

        return () => {
            if (vanishTimerRef.current) {
                clearTimeout(vanishTimerRef.current);
            }
        };
    }, [mousePos, width, height, hasRecentlyVanished]);

    return (
        <div
            ref={containerRef}
            style={{
                position: 'absolute',
                ...position,
                width: width,
                height: height,
                pointerEvents: 'none',
                zIndex: 5,
                opacity: 0.95
            }}
        >
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    position: 'relative',
                    overflow: 'hidden',
                    borderRadius: '2px'
                }}
            >
                {!isRevealed && (
                    <PixelFormation src={src} width={width} height={height} />
                )}

                {isRevealed && (
                    <ImageGrid
                        src={src}
                        width={width}
                        height={height}
                        mousePos={mousePos}
                        containerRect={containerRect}
                        hasRecentlyVanished={hasRecentlyVanished}
                    />
                )}
            </div>
        </div>
    );
};

export default function SciFiImageReveal({ images }) {
    const [selectedImage, setSelectedImage] = useState(null);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });

    // Select random image when images prop changes
    useEffect(() => {
        if (images && images.length > 0) {
            const randomIndex = Math.floor(Math.random() * images.length);
            const img = images[randomIndex];
            const imageUrl = typeof img === 'string' ? img : img.url;

            // Preload image before setting
            const preloadImg = new Image();
            preloadImg.onload = () => {
                setSelectedImage(imageUrl);
                setImageLoaded(true);
            };
            preloadImg.onerror = () => {
                // If image fails to load, skip it
                setImageLoaded(false);
            };
            preloadImg.src = imageUrl;
        }
    }, [images]);

    useEffect(() => {
        const handleMouseMove = (e) => {
            setMousePos({ x: e.clientX, y: e.clientY });
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    if (!selectedImage || !imageLoaded) return null;

    const POSITION = { width: 280, height: 200, pos: { top: '55%', right: '8%' }, delay: 0 };

    return (
        <div className="sci-fi-hud-layer" style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 1,
            overflow: 'visible',
        }}>
            <DecryptingImage
                src={selectedImage}
                width={POSITION.width}
                height={POSITION.height}
                position={POSITION.pos}
                delay={POSITION.delay}
                mousePos={mousePos}
            />
        </div>
    );
}
