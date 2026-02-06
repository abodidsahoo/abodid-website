import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ExperienceModule = ({ src, captions = [] }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isStarted, setIsStarted] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);

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

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        isPlayingRef.current = isPlaying;
    }, [isPlaying]);

    // Scroll Fade Logic
    useEffect(() => {
        const handleScroll = () => {
            const y = window.scrollY;
            // Fade out between 100px and 600px
            const opacity = Math.max(0, 1 - (y / 600));
            setScrollOpacity(opacity);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Initialize Audio and Web Audio API
    useEffect(() => {
        if (!src) return;

        const audio = new Audio(src);
        audio.crossOrigin = "anonymous";
        audio.loop = true;
        audio.volume = 1.0;
        audioRef.current = audio;

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContextClass();
        audioContextRef.current = audioContext;

        const analyzer = audioContext.createAnalyser();
        analyzer.fftSize = 256;
        analyzer.smoothingTimeConstant = 0.85;
        analyzerRef.current = analyzer;

        const source = audioContext.createMediaElementSource(audio);
        sourceRef.current = source;

        const gainNode = audioContext.createGain();
        gainNode.gain.setValueAtTime(0, audioContext.currentTime); // Start at 0 for fade in
        gainNodeRef.current = gainNode;

        // Graph: Audio -> Source -> Analyzer -> Gain -> Destination
        source.connect(analyzer);
        analyzer.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Global exposing for other components (backwards compatibility)
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

            // Subtle Baseline - Always visible when started
            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.fillRect(0, canvas.height - 1, canvas.width, 1);

            // Mirrored Spectrum: Thinner, whiter, more numerous bars
            const numBins = 24;
            const gap = 2;
            const barWidth = (canvas.width / 2) / numBins;
            const centerX = canvas.width / 2;

            for (let i = 0; i < numBins; i++) {
                const val = dataArray[i];
                const intensity = (val / 255);
                // Calmer sensitivity - prevent "peaking at the ceiling"
                const barHeight = Math.min(canvas.height * 0.8, Math.pow(intensity, 1.3) * canvas.height * 0.9);

                if (barHeight > 0) {
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'; // Brighter/whiter

                    // Mirror Right
                    ctx.fillRect(centerX + (i * barWidth) + gap / 2, canvas.height - barHeight, barWidth - gap, barHeight);
                    // Mirror Left
                    ctx.fillRect(centerX - ((i + 1) * barWidth) + gap / 2, canvas.height - barHeight, barWidth - gap, barHeight);
                }
            }
        };

        draw();
        return () => cancelAnimationFrame(animationFrameRef.current);
    }, [isStarted]);

    // Lyric Tracking Logic
    useEffect(() => {
        if (!isStarted || !audioRef.current) return;

        const interval = setInterval(() => {
            if (audioRef.current && !audioRef.current.paused) {
                const currentTime = audioRef.current.currentTime;
                const newIndex = captions.findIndex(
                    (cap) => currentTime >= cap.start && currentTime < cap.end
                );
                if (newIndex !== activeIndex) {
                    setActiveIndex(newIndex);
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
            await audioContextRef.current.resume();
        }

        try {
            await audioRef.current.play();
            setIsStarted(true);
            setIsPlaying(true);
            fadeAudio(1.0, 1.5).catch(err => console.error("Fade in failed:", err));
        } catch (err) {
            console.error("Audio failed:", err);
        }
    };

    const togglePlay = async (e) => {
        if (e) e.stopPropagation();
        if (!audioRef.current) return;

        if (isPlaying) {
            // Fade out then pause
            await fadeAudio(0, 1.0);
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            if (audioContextRef.current.state === 'suspended') {
                await audioContextRef.current.resume();
            }
            // Ensure volume is at 0 before playing if we're resuming
            if (gainNodeRef.current) {
                gainNodeRef.current.gain.setValueAtTime(0, audioContextRef.current.currentTime);
            }
            await audioRef.current.play();
            setIsPlaying(true);
            fadeAudio(1.0, 1.0).catch(err => console.error("Fade in failed:", err));
        }
    };

    const currentCaption = activeIndex >= 0 ? captions[activeIndex] : null;

    if (!isMounted) return null;

    return (
        <div className="experience-module-container">
            <motion.div
                className="experience-orbiting-grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: scrollOpacity }}
                style={{ opacity: scrollOpacity, pointerEvents: scrollOpacity < 0.1 ? 'none' : 'auto' }}
                transition={{ duration: 1 }}
            >
                {/* Column 1: Lyrics (Left) */}
                <div className="experience-col experience-col-left">
                    <AnimatePresence mode="wait">
                        {isStarted && currentCaption && (
                            <motion.div
                                key={activeIndex}
                                className="lyric-line"
                                initial={{ opacity: 0, filter: 'blur(4px)', y: 5 }}
                                animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
                                exit={{ opacity: 0, filter: 'blur(4px)', y: -5 }}
                                transition={{ duration: 0.3, ease: "easeOut" }}
                            >
                                {currentCaption.text}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Column 2: Anchor (Center) - Holds CTA before start, then spacer for Stack */}
                <div className="experience-col experience-col-middle">
                    <AnimatePresence>
                        {!isStarted && (
                            <motion.button
                                key="cta"
                                className="experience-cta-floating"
                                onClick={handleStart}
                                initial={{ opacity: 0, scale: 0.9, y: 250 }}
                                animate={{ opacity: 1, scale: 1, y: 250 }}
                                exit={{ opacity: 0, scale: 0.95, y: 260 }}
                                transition={{ duration: 0.5, ease: "easeOut" }}
                            >
                                <span className="cta-title">Audio-Visual Experience</span>
                                <span className="cta-sub">Click to begin</span>
                            </motion.button>
                        )}
                    </AnimatePresence>
                    {/* The imaginary card stack lives here in the DOM order of the page, 
                        but we provide the layout gap to ensure no overlap */}
                </div>

                {/* Column 3: Control & Spectrum (Right) */}
                <div className="experience-col experience-col-right">
                    <AnimatePresence>
                        {isStarted && (
                            <motion.div
                                className="spectrum-control-group"
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.5 }}
                            >
                                <canvas
                                    ref={canvasRef}
                                    width={200}
                                    height={20}
                                    className="mirrored-spectrum-mini"
                                />
                                <button className="experience-toggle-right" onClick={togglePlay}>
                                    {isPlaying ? "Pause Experience" : "Resume Experience"}
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>

            <style>{`
                .experience-module-container {
                    position: fixed;
                    top: 50%;
                    left: 0;
                    right: 0;
                    transform: translateY(-50%);
                    z-index: 100; /* Behind actual stack which is 10005, but enough for visibility */
                    display: flex;
                    justify-content: center;
                    width: 100%;
                    pointer-events: none;
                }

                .experience-orbiting-grid {
                    width: 100%;
                    max-width: 1600px;
                    display: grid;
                    grid-template-columns: 1fr 600px 1fr; /* 600px centered gap for card stack */
                    align-items: center;
                    padding: 0 2vw;
                }

                .experience-col {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 200px;
                }

                .experience-col-left {
                    text-align: right;
                    align-items: flex-end;
                    padding-right: 2rem;
                }

                .experience-col-right {
                    text-align: left;
                    align-items: flex-start;
                    padding-left: 2rem;
                }

                .experience-cta-floating {
                    pointer-events: auto;
                    background: none;
                    border: none;
                    cursor: pointer;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.5rem;
                    text-align: center;
                    /* Initial position handled by motion y: 140 */
                }

                .cta-title {
                    display: block;
                    font-family: 'Space Mono', monospace;
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    letter-spacing: 0.2em;
                    color: white;
                    opacity: 0.8;
                }

                .cta-sub {
                    display: block;
                    font-family: 'Inconsolata', monospace;
                    font-size: 0.65rem;
                    color: rgba(255, 255, 255, 0.4);
                    letter-spacing: 0.1em;
                    text-transform: uppercase;
                }

                .spectrum-control-group {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 12px;
                    pointer-events: auto;
                }

                .experience-toggle-right {
                    background: none;
                    border: none;
                    font-family: 'Inconsolata', monospace;
                    font-size: 0.75rem; 
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    color: rgba(255, 255, 255, 0.5);
                    cursor: pointer;
                    padding: 0;
                    transition: all 0.3s ease;
                }

                .experience-toggle-right:hover {
                    color: rgba(255, 255, 255, 0.8);
                }

                .lyric-line {
                    font-family: 'Inconsolata', monospace;
                    font-size: 0.95rem;
                    color: white;
                    letter-spacing: 0.05em;
                    font-weight: 300;
                    text-shadow: 0 0 15px rgba(255, 255, 255, 0.3);
                    white-space: nowrap; /* Prevent line breaks */
                }

                .mirrored-spectrum-mini {
                    display: block;
                    filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.4));
                    opacity: 0.5;
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

