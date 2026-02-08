import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ExperienceModule = ({ src, captions = [], autoStart = false }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isStarted, setIsStarted] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);

    // Lyric Position State: 'top', 'left', 'right'
    const [lyricPosition, setLyricPosition] = useState('top');
    const [lyricStyle, setLyricStyle] = useState({}); // Fixed ReferenceError

    const audioRef = useRef(null);
    const audioContextRef = useRef(null);
    const gainNodeRef = useRef(null);
    const analyzerRef = useRef(null);
    const sourceRef = useRef(null);
    const canvasRef = useRef(null);
    const animationFrameRef = useRef(null);
    const isPlayingRef = useRef(false);
    const [scrollOpacity, setScrollOpacity] = useState(1);
    const [isMounted, setIsMounted] = useState(false);

    // Audio Ducking Refs
    const currentVolumeRef = useRef(0.5);
    const targetVolumeRef = useRef(0.5);

    useEffect(() => {
        setIsMounted(true);
        if (autoStart) {
            handleStart();
        }
    }, [autoStart]);

    useEffect(() => {
        isPlayingRef.current = isPlaying;
    }, [isPlaying]);

    // Scroll Fade Logic & Audio Ducking Logic
    useEffect(() => {
        let rafId;
        const FADE_SPEED = 0.1; // Smooth volume transition

        const handleScrollAndVolume = () => {
            const y = window.scrollY;
            const windowHeight = window.innerHeight;

            // 1. Visual Opacity (Fade out visual module)
            const opacity = Math.max(0, 1 - (y / 600));
            setScrollOpacity(opacity);

            // 2. Audio Ducking Logic
            const zone1End = windowHeight * 0.9;   // Photos area
            const zone2End = windowHeight * 1.5;   // Bio area

            let scrollBasedVolume = 1.0;

            if (y < zone1End) {
                scrollBasedVolume = 1.0;
            } else if (y < zone2End) {
                // Fade to 40%
                const progress = (y - zone1End) / (zone2End - zone1End);
                scrollBasedVolume = 1.0 - (progress * 0.6);
            } else {
                // Fade to 2%
                const fadeStart = zone2End;
                const fadeDistance = windowHeight * 0.5;
                const progress = Math.min((y - fadeStart) / fadeDistance, 1);
                scrollBasedVolume = 0.4 - (progress * 0.38);
            }

            // Check Showreel
            const showreelVideo = document.getElementById('showreel-video');
            const isShowreelPlaying = showreelVideo && !showreelVideo.paused && !showreelVideo.muted;

            targetVolumeRef.current = isShowreelPlaying ? 0 : scrollBasedVolume;

            // Apply Volume
            if (gainNodeRef.current && isPlayingRef.current) {
                const diff = targetVolumeRef.current - currentVolumeRef.current;
                if (Math.abs(diff) > 0.001) {
                    currentVolumeRef.current += diff * FADE_SPEED;
                    gainNodeRef.current.gain.setTargetAtTime(currentVolumeRef.current, audioContextRef.current.currentTime, 0.1);
                }
            }

            rafId = requestAnimationFrame(handleScrollAndVolume);
        };

        // Start loop
        rafId = requestAnimationFrame(handleScrollAndVolume);

        return () => {
            if (rafId) cancelAnimationFrame(rafId);
        };
    }, [isStarted]); // Re-bind if started/stopped? Actually safer to run always or when isStarted

    // Initialize Audio and Web Audio API
    useEffect(() => {
        if (!src) return;

        const audio = new Audio(src);
        audio.crossOrigin = "anonymous";
        audio.loop = true;
        audio.volume = 1.0; // We control actual volume via GainNode
        audioRef.current = audio;

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContextClass();
        audioContextRef.current = audioContext;

        const analyzer = audioContext.createAnalyser();
        analyzer.fftSize = 256;
        analyzer.smoothingTimeConstant = 0.92; // Less sensitive
        analyzerRef.current = analyzer;

        const source = audioContext.createMediaElementSource(audio);
        sourceRef.current = source;

        const gainNode = audioContext.createGain();
        gainNode.gain.setValueAtTime(0, audioContext.currentTime); // Start at 0 for fade in
        gainNodeRef.current = gainNode;

        source.connect(analyzer);
        analyzer.connect(gainNode);
        gainNode.connect(audioContext.destination);

        window.landingAudio = audio;
        window.landingAudioGain = gainNode;
        window.triggerAudio = () => {
            if (!isPlayingRef.current) {
                handleStart();
            }
        };

        return () => {
            delete window.triggerAudio;
            delete window.landingAudio;
            delete window.landingAudioGain;
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [src]);

    // Spectrum Drawing Logic
    useEffect(() => {
        if (!isStarted || !analyzerRef.current) return;

        const bufferLength = analyzerRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            if (!analyzerRef.current || !canvasRef.current) {
                animationFrameRef.current = requestAnimationFrame(draw);
                return;
            }
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                animationFrameRef.current = requestAnimationFrame(draw);
                return;
            }

            animationFrameRef.current = requestAnimationFrame(draw);
            analyzerRef.current.getByteFrequencyData(dataArray);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Subtle Baseline - Removed for cleaner look or kept minimal?
            // Keeping it very subtle
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.fillRect(0, canvas.height - 1, canvas.width, 1);

            // Mirrored Spectrum Refined
            const numBins = 16;
            const gap = 1; // Tighter gap (was 4)
            const availableWidth = canvas.width / 2;
            const barWidth = (availableWidth / numBins) - gap; // Ensure exact fit
            const centerX = canvas.width / 2;

            for (let i = 0; i < numBins; i++) {
                const val = dataArray[i];
                const intensity = (val / 255);

                // Damping for high frequencies (Treble)
                // As 'i' increases, we reduce the multiplier slightly
                const damping = 1 - (i / numBins) * 0.5; // Up to 50% reduction at highest bin

                // Linear height (power of 1.0) and capped at 0.8 height
                const barHeight = Math.min(canvas.height * 0.8, Math.pow(intensity, 1.0) * canvas.height * 0.9 * damping);

                if (barHeight > 0) {
                    ctx.fillStyle = '#FFFFFF'; // Solid White
                    // Sharp edges (fillRect default)
                    ctx.fillRect(centerX + (i * (barWidth + gap)) + gap / 2, canvas.height - barHeight, barWidth, barHeight);
                    ctx.fillRect(centerX - ((i + 1) * (barWidth + gap)) + gap / 2, canvas.height - barHeight, barWidth, barHeight);
                }
            }
        };

        draw();
        return () => cancelAnimationFrame(animationFrameRef.current);
    }, [isStarted]);

    // Mouse Position Tracking
    const mousePos = useRef({ x: -1, y: -1 });

    useEffect(() => {
        const handleMouseMove = (e) => {
            mousePos.current = { x: e.clientX, y: e.clientY };
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    // Lyric Tracking Logic & Spawning
    useEffect(() => {
        if (!isStarted || !audioRef.current) return;

        const interval = setInterval(() => {
            if (audioRef.current && !audioRef.current.paused) {
                const currentTime = audioRef.current.currentTime;
                const newIndex = captions.findIndex(
                    (cap) => currentTime >= cap.start && currentTime < cap.end
                );

                // Only change position if valid lyric found
                if (newIndex !== activeIndex) {
                    setActiveIndex(newIndex);

                    if (newIndex !== -1) {
                        const { x, y } = mousePos.current;
                        const w = window.innerWidth;
                        const h = window.innerHeight;
                        const hasMouse = x !== -1 && y !== -1;

                        // Fallback if no mouse detected yet
                        let targetX = hasMouse ? x : w / 2;
                        let targetY = hasMouse ? y : h / 2;

                        // --- CONTENT AVOIDANCE ZONES ---
                        // 1. Header Area: Top 150px
                        const isHeader = targetY < 150;

                        // 2. Card Stack Area: Center ~600x400 (Card is 560x315) + padding
                        const stackW = 600;
                        const stackH = 400;
                        const centerX = w / 2;
                        const centerY = h / 2;

                        // UNSAFE: Directly over the stack
                        const isStack =
                            targetX > centerX - stackW / 2 - 50 &&
                            targetX < centerX + stackW / 2 + 50 &&
                            targetY > centerY - stackH / 2 - 50 &&
                            targetY < centerY + stackH / 2 + 50;

                        // 3. Audio Spectrum/Controls: Bottom Center
                        const isControls =
                            targetY > h * 0.8 &&
                            targetX > centerX - 250 &&
                            targetX < centerX + 250;

                        const isUnsafe = !hasMouse || isHeader || isStack || isControls;

                        let newStyle = {};

                        if (!isUnsafe) {
                            // --- REFINED SAFE ZONE LOGIC (STRICT) ---
                            let textAlign = 'left';
                            let transformX = '0';
                            let offsetX = 60;

                            // 1. STACK AVOIDANCE
                            // Stack is ~600px wide. Treat as 700px for safety.
                            const safeStackWidth = 700;
                            const stackLeft = centerX - safeStackWidth / 2;
                            const stackRight = centerX + safeStackWidth / 2;

                            // Zones: Increased approach range (200px)
                            const nearStackLeft = targetX < stackLeft && targetX > stackLeft - 200;
                            const nearStackRight = targetX > stackRight && targetX < stackRight + 200;

                            // 2. RIGHT EDGE AVOIDANCE (Aggressive)
                            // "Left side of pointer with enough space" -> Shift LEFT by 300px
                            const farRightStart = w * 0.8; // 20% from right edge
                            const isFarRight = targetX > farRightStart;

                            if (nearStackLeft) {
                                // STRICT LEFT FLIP: Force text to LEFT of cursor
                                // And push it further left (-120px) to clear any rotation
                                textAlign = 'right';
                                transformX = '-100%';
                                offsetX = -120;
                            } else if (nearStackRight) {
                                // STRICT RIGHT FLIP
                                textAlign = 'left';
                                transformX = '0';
                                offsetX = 120;
                            } else if (isFarRight) {
                                // STRICT RIGHT EDGE: Force text FAR LEFT
                                // "Almost behind the right-hand side of card stacker"
                                // Use huge offset
                                textAlign = 'right';
                                transformX = '-100%';
                                offsetX = -300;
                            } else {
                                // Standard: Flip at center
                                if (targetX > w * 0.5) {
                                    textAlign = 'right';
                                    transformX = '-100%';
                                    offsetX = -60;
                                } else {
                                    textAlign = 'left';
                                    transformX = '0';
                                    offsetX = 60;
                                }
                            }

                            // Vertical Logic (Keep simple)
                            const isBottomHalf = targetY > h * 0.8;
                            const offsetY = isBottomHalf ? -50 : 40;

                            newStyle = {
                                top: `${targetY + offsetY}px`,
                                left: `${targetX + offsetX}px`,
                                transform: `translate(${transformX}, -50%)`,
                                textAlign: textAlign
                            };

                        } else {
                            // --- UNSAFE ZONE: Snap to Nearest Safe Edge ---

                            let safeX = targetX;
                            let safeY = targetY;
                            let anchorX = 'center'; // transform-x
                            let anchorY = 'center'; // transform-y
                            let align = 'center';   // text-align

                            if (isHeader) {
                                safeY = 180;
                                align = 'center';
                                anchorX = 'center';
                                anchorY = 'top';
                            } else if (isControls) {
                                safeY = h * 0.8 - 60;
                                align = 'center';
                                anchorX = 'center';
                                anchorY = 'bottom';
                            } else if (isStack) {
                                // Find nearest edge of stack
                                const distLeft = targetX - (centerX - stackW / 2 - 50);
                                const distRight = (centerX + stackW / 2 + 50) - targetX;
                                const distTop = targetY - (centerY - stackH / 2 - 50);
                                const distBottom = (centerY + stackH / 2 + 50) - targetY;

                                const min = Math.min(distLeft, distRight, distTop, distBottom);

                                if (min === distLeft) {
                                    safeX = centerX - stackW / 2 - 120; // Increased pushout
                                    align = 'right';
                                    anchorX = 'right';
                                } else if (min === distRight) {
                                    safeX = centerX + stackW / 2 + 120; // Increased pushout
                                    align = 'left';
                                    anchorX = 'left';
                                } else if (min === distTop) {
                                    safeY = centerY - stackH / 2 - 80;
                                    align = 'center';
                                    anchorY = 'bottom';
                                } else {
                                    safeY = centerY + stackH / 2 + 80;
                                    align = 'center';
                                    anchorY = 'top';
                                }
                            }

                            // Map anchors to translate values
                            const transX = anchorX === 'right' ? '-100%' : anchorX === 'center' ? '-50%' : '0';
                            const transY = anchorY === 'bottom' ? '-100%' : anchorY === 'center' ? '-50%' : '0';

                            newStyle = {
                                top: `${safeY}px`,
                                left: `${safeX}px`,
                                transform: `translate(${transX}, ${transY})`,
                                textAlign: align
                            };
                        }

                        setLyricStyle(newStyle);
                    }
                }
            }
        }, 100);

        return () => clearInterval(interval);
    }, [isStarted, captions, activeIndex]);


    const fadeAudio = (targetVolume, duration = 1.0) => {
        if (!gainNodeRef.current || !audioContextRef.current) return;
        const gainNode = gainNodeRef.current;
        const currentTime = audioContextRef.current.currentTime;

        gainNode.gain.cancelScheduledValues(currentTime);
        gainNode.gain.setValueAtTime(gainNode.gain.value, currentTime);
        gainNode.gain.linearRampToValueAtTime(targetVolume, currentTime + duration);

        return new Promise(resolve => setTimeout(resolve, duration * 1000));
    };

    const handleStart = async () => {
        if (!audioRef.current || !audioContextRef.current) return;

        if (audioContextRef.current.state === 'suspended') {
            try {
                await audioContextRef.current.resume();
            } catch (e) {
                console.error("Audio Context Resume Failed:", e);
            }
        }

        try {
            const playPromise = audioRef.current.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    setIsStarted(true);
                    setIsPlaying(true);
                    fadeAudio(1.0, 1.5).catch(err => console.error("Fade in failed:", err));
                }).catch(err => {
                    console.error("Auto-Play Blocked/Failed:", err);
                });
            }
        } catch (err) {
            console.error("Audio failed:", err);
        }
    };

    const togglePlay = async (e) => {
        if (e) e.stopPropagation();
        if (!audioRef.current) return;

        const willPlay = !isPlaying;
        setIsPlaying(willPlay);

        if (!willPlay) {
            try {
                await fadeAudio(0, 1.0);
                if (!isPlayingRef.current && audioRef.current) {
                    audioRef.current.pause();
                }
            } catch (err) {
                console.error("Fade out failed", err);
            }
        } else {
            if (audioContextRef.current.state === 'suspended') {
                await audioContextRef.current.resume();
            }
            if (audioRef.current.paused) {
                await audioRef.current.play();
            }
            fadeAudio(1.0, 1.0).catch(err => console.error("Fade in failed:", err));
        }
    };

    const currentCaption = activeIndex >= 0 ? captions[activeIndex] : null;

    if (!isMounted) return null;

    return (
        <div className="experience-module-container">
            <motion.div
                className="experience-layout-layer"
                initial={{ opacity: 0 }}
                animate={{ opacity: scrollOpacity }}
                style={{ opacity: scrollOpacity, pointerEvents: scrollOpacity < 0.1 ? 'none' : 'auto' }}
                transition={{ duration: 1 }}
            >
                {/* 1. Lyrics Container - Dynamic Position */}
                <AnimatePresence mode="wait">
                    {isStarted && currentCaption && (
                        <motion.div
                            key={activeIndex}
                            className="lyric-floating-container"
                            style={lyricStyle}
                            initial={{ opacity: 0, filter: 'blur(4px)', scale: 0.95 }}
                            animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
                            exit={{ opacity: 0, filter: 'blur(4px)', scale: 1.05 }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                        >
                            <span className="lyric-text">
                                {currentCaption.text}
                            </span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* 2. Audio Controls - Bottom Center */}
                <div className="controls-bottom-center">
                    <AnimatePresence>
                        {isStarted && (
                            <motion.button
                                className="spectrum-control-group"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.8, delay: 0.2 }}
                                onClick={togglePlay}
                                type="button"
                                aria-label={isPlaying ? "Pause Audio Experience" : "Resume Audio Experience"}
                            >
                                <canvas
                                    ref={canvasRef}
                                    width={200}
                                    height={24}
                                    className="mirrored-spectrum-mini"
                                    aria-hidden="true"
                                />
                                <span className="experience-toggle-label">
                                    {isPlaying ? "Pause Experience" : "Resume Experience"}
                                </span>
                            </motion.button>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>

            <style>{`
                .experience-module-container {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    z-index: 100; /* Behind actual stack (10005) */
                    pointer-events: none;
                }

                .experience-layout-layer {
                    position: relative;
                    width: 100%;
                    height: 100%;
                }

                /* --- Lyrics Positioning --- */
                .lyric-floating-container {
                    position: absolute;
                    pointer-events: none;
                    z-index: 110;
                    text-align: center;
                    max-width: 400px;
                    width: max-content;
                }

                .lyric-text {
                    font-family: 'Inconsolata', monospace;
                    font-size: 1.1rem;
                    color: white;
                    letter-spacing: 0.05em;
                    font-weight: 300;
                    text-shadow: 0 0 15px rgba(255, 255, 255, 0.4);
                    background: rgba(0, 0, 0, 0.3); /* Slight sweet background for readability */
                    padding: 0.5rem 1rem;
                    border-radius: 4px;
                    backdrop-filter: blur(2px);
                }

                /* Top */
                .pos-top {
                    top: 25%;
                    left: 50%;
                    transform: translateX(-50%);
                }

                /* Left */
                .pos-left {
                    top: 50%;
                    left: 15%; 
                    transform: translateY(-50%);
                    text-align: right;
                }

                /* Right */
                .pos-right {
                    top: 50%;
                    right: 15%;
                    transform: translateY(-50%);
                    text-align: left;
                }

                /* --- Audio Controls --- */
                .controls-bottom-center {
                    position: absolute;
                    bottom: 12%; 
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 120;
                    display: flex;
                    justify-content: center;
                    pointer-events: auto; /* Enable clicks */
                }

                .spectrum-control-group {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 12px;
                    cursor: pointer;
                    padding: 1rem;
                    background: transparent;
                    border: none;
                    transition: opacity 0.3s ease;
                }
                .spectrum-control-group:hover {
                    opacity: 0.8;
                }

                .mirrored-spectrum-mini {
                    display: block;
                    filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.4));
                    opacity: 0.6;
                }

                .experience-toggle-label {
                    font-family: 'Inconsolata', monospace;
                    font-size: 0.75rem; 
                    text-transform: uppercase;
                    letter-spacing: 0.15em;
                    color: rgba(255, 255, 255, 0.6);
                    transition: all 0.3s ease;
                }
                .spectrum-control-group:hover .experience-toggle-label {
                    color: rgba(255, 255, 255, 0.9);
                }

                @media (max-width: 1024px) {
                    .experience-module-container {
                        display: none !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default ExperienceModule;
