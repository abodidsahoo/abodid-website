import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const DEFAULT_PLAYBACK_VOLUME = 1;
const MIN_PLAYBACK_VOLUME = 0.12;

const parseAnchorToPixels = (anchor, viewport, fallbackRatio) => {
    if (typeof anchor === 'number' && Number.isFinite(anchor)) {
        return anchor;
    }

    if (typeof anchor === 'string') {
        const trimmed = anchor.trim();
        if (trimmed.endsWith('%')) {
            const pct = Number(trimmed.slice(0, -1));
            if (Number.isFinite(pct)) return (pct / 100) * viewport;
        }
        if (trimmed.endsWith('px')) {
            const px = Number(trimmed.slice(0, -2));
            if (Number.isFinite(px)) return px;
        }
        const raw = Number(trimmed);
        if (Number.isFinite(raw)) return raw;
    }

    return viewport * fallbackRatio;
};

const rectsOverlap = (a, b) => (
    a.left < b.right &&
    a.right > b.left &&
    a.top < b.bottom &&
    a.bottom > b.top
);

const buildAnchoredPlacement = ({
    x,
    y,
    width,
    height,
    viewportWidth,
    viewportHeight,
    anchorX = 'left',
    anchorY = 'center',
    textAlign = 'left',
}) => {
    const minX = anchorX === 'center'
        ? (width / 2) + 24
        : anchorX === 'right'
            ? width + 24
            : 24;
    const maxX = anchorX === 'center'
        ? viewportWidth - (width / 2) - 24
        : anchorX === 'right'
            ? viewportWidth - 24
            : viewportWidth - width - 24;
    const clampedX = clamp(x, minX, maxX);

    const minY = anchorY === 'center'
        ? (height / 2) + 132
        : 136;
    const maxY = anchorY === 'center'
        ? viewportHeight - (height / 2) - 36
        : viewportHeight - height - 36;
    const clampedY = clamp(y, minY, maxY);

    const left = anchorX === 'center'
        ? clampedX - (width / 2)
        : anchorX === 'right'
            ? clampedX - width
            : clampedX;
    const top = anchorY === 'center'
        ? clampedY - (height / 2)
        : clampedY;

    const transformX = anchorX === 'center'
        ? '-50%'
        : anchorX === 'right'
            ? '-100%'
            : '0';
    const transformY = anchorY === 'center' ? '-50%' : '0';

    return {
        rect: {
            left,
            right: left + width,
            top,
            bottom: top + height,
        },
        style: {
            left: `${anchorX === 'center' ? clampedX : anchorX === 'right' ? clampedX : left}px`,
            top: `${anchorY === 'center' ? clampedY : top}px`,
            transform: `translate(${transformX}, ${transformY})`,
            textAlign,
            width: `${width}px`,
            maxWidth: `${width}px`,
        },
    };
};

const ExperienceModule = ({
    src,
    captions = [],
    autoStart = false,
    onPlaybackChange,
    layout = 'default',
    stackAnchorX = '50%',
    stackAnchorY = '53%',
    stackCardWidth = 559,
    controlPanelOpen = false,
    controlPanelMetrics = null,
    visible = true,
    showVisualizer = true,
    showLyrics = true,
}) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isStarted, setIsStarted] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [lyricStyle, setLyricStyle] = useState({});
    const [scrollOpacity, setScrollOpacity] = useState(1);
    const [isMounted, setIsMounted] = useState(false);
    const [viewportSize, setViewportSize] = useState(() => ({
        width: typeof window === 'undefined' ? 1440 : window.innerWidth,
        height: typeof window === 'undefined' ? 900 : window.innerHeight,
    }));

    const audioRef = useRef(null);
    const audioContextRef = useRef(null);
    const gainNodeRef = useRef(null);
    const analyzerRef = useRef(null);
    const sourceRef = useRef(null);
    const canvasRef = useRef(null);
    const animationFrameRef = useRef(null);
    const isPlayingRef = useRef(false);
    const isStartedRef = useRef(false);
    const currentVolumeRef = useRef(DEFAULT_PLAYBACK_VOLUME);
    const targetVolumeRef = useRef(DEFAULT_PLAYBACK_VOLUME);
    const mousePos = useRef({ x: -1, y: -1 });

    const isStackLayout = layout === 'stack-left';
    const visualOpacity = isStackLayout ? (visible ? 1 : 0) : scrollOpacity;

    const stackLayoutMetrics = useMemo(() => {
        if (!isStackLayout) return null;

        const viewportWidth = viewportSize.width;
        const viewportHeight = viewportSize.height;
        const stackCenterX = parseAnchorToPixels(stackAnchorX, viewportWidth, 0.5);
        const stackCenterY = parseAnchorToPixels(stackAnchorY, viewportHeight, 0.53);
        const stackCardHeight = Math.round((stackCardWidth * 9) / 16);
        const captionWidth = clamp(Math.round(viewportWidth * 0.24), 250, 360);
        const captionHeight = 118;
        const spectrumWidth = clamp(Math.round(stackCardWidth * 0.44), 220, 300);

        const stackRect = {
            left: stackCenterX - (stackCardWidth / 2) - 56,
            right: stackCenterX + (stackCardWidth / 2) + 56,
            top: stackCenterY - (stackCardHeight / 2) - 52,
            bottom: stackCenterY + (stackCardHeight / 2) + 60,
        };

        const controlsTop = clamp(
            Math.round(stackRect.bottom + 36),
            Math.round(stackRect.bottom + 28),
            viewportHeight - 168,
        );
        const controlsWidth = clamp(Math.round(stackCardWidth * 0.56), 270, 360);
        const controlsHeight = 132;
        const controlsRect = {
            left: stackCenterX - (controlsWidth / 2),
            right: stackCenterX + (controlsWidth / 2),
            top: controlsTop,
            bottom: controlsTop + controlsHeight,
        };

        const panelRect = controlPanelOpen && controlPanelMetrics
            ? {
                left: Math.max(0, controlPanelMetrics.left - 18),
                right: viewportWidth - 12,
                top: Math.max(136, controlPanelMetrics.top - 18),
                bottom: viewportHeight - 32,
            }
            : null;

        const safeRightAnchor = panelRect
            ? panelRect.left - 28
            : viewportWidth - 28;
        const leftAnchor = 28;
        const candidatePlacements = [
            buildAnchoredPlacement({
                x: leftAnchor,
                y: Math.max(166, stackRect.top - 18),
                width: captionWidth,
                height: captionHeight,
                viewportWidth,
                viewportHeight,
                anchorX: 'left',
                anchorY: 'top',
                textAlign: 'left',
            }),
            buildAnchoredPlacement({
                x: leftAnchor,
                y: stackCenterY - 36,
                width: captionWidth,
                height: captionHeight,
                viewportWidth,
                viewportHeight,
                anchorX: 'left',
                anchorY: 'center',
                textAlign: 'left',
            }),
            buildAnchoredPlacement({
                x: leftAnchor + 22,
                y: Math.min(viewportHeight - 212, controlsTop - 34),
                width: captionWidth,
                height: captionHeight,
                viewportWidth,
                viewportHeight,
                anchorX: 'left',
                anchorY: 'top',
                textAlign: 'left',
            }),
            buildAnchoredPlacement({
                x: stackCenterX,
                y: 150,
                width: captionWidth,
                height: captionHeight,
                viewportWidth,
                viewportHeight,
                anchorX: 'center',
                anchorY: 'top',
                textAlign: 'center',
            }),
            buildAnchoredPlacement({
                x: safeRightAnchor,
                y: Math.max(172, stackRect.top + 12),
                width: captionWidth,
                height: captionHeight,
                viewportWidth,
                viewportHeight,
                anchorX: 'right',
                anchorY: 'top',
                textAlign: 'right',
            }),
            buildAnchoredPlacement({
                x: safeRightAnchor,
                y: stackCenterY - 18,
                width: captionWidth,
                height: captionHeight,
                viewportWidth,
                viewportHeight,
                anchorX: 'right',
                anchorY: 'center',
                textAlign: 'right',
            }),
            buildAnchoredPlacement({
                x: safeRightAnchor,
                y: Math.min(viewportHeight - 214, controlsTop - 28),
                width: captionWidth,
                height: captionHeight,
                viewportWidth,
                viewportHeight,
                anchorX: 'right',
                anchorY: 'top',
                textAlign: 'right',
            }),
            buildAnchoredPlacement({
                x: viewportWidth * 0.2,
                y: viewportHeight * 0.72,
                width: captionWidth,
                height: captionHeight,
                viewportWidth,
                viewportHeight,
                anchorX: 'left',
                anchorY: 'center',
                textAlign: 'left',
            }),
        ];

        const captionPlacements = candidatePlacements
            .filter(({ rect }) => {
                if (rectsOverlap(rect, stackRect)) return false;
                if (rectsOverlap(rect, controlsRect)) return false;
                if (panelRect && rectsOverlap(rect, panelRect)) return false;
                return true;
            })
            .map((placement) => placement.style);

        const fallbackPlacement = buildAnchoredPlacement({
            x: stackCenterX,
            y: 152,
            width: captionWidth,
            height: captionHeight,
            viewportWidth,
            viewportHeight,
            anchorX: 'center',
            anchorY: 'top',
            textAlign: 'center',
        }).style;

        return {
            captionPlacements: captionPlacements.length > 0 ? captionPlacements : [fallbackPlacement],
            controlsStyle: {
                left: `${stackCenterX}px`,
                top: `${controlsTop}px`,
                transform: 'translate(-50%, 0)',
            },
            controlsCanvasWidth: spectrumWidth,
        };
    }, [
        controlPanelMetrics,
        controlPanelOpen,
        isStackLayout,
        stackAnchorX,
        stackAnchorY,
        stackCardWidth,
        viewportSize,
    ]);

    useEffect(() => {
        setIsMounted(true);
    }, []);


    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const updateViewport = () => {
            setViewportSize({
                width: window.innerWidth,
                height: window.innerHeight,
            });
        };

        updateViewport();
        window.addEventListener('resize', updateViewport);
        return () => window.removeEventListener('resize', updateViewport);
    }, []);

    useEffect(() => {
        isPlayingRef.current = isPlaying;
    }, [isPlaying]);

    useEffect(() => {
        isStartedRef.current = isStarted;
    }, [isStarted]);

    useEffect(() => {
        onPlaybackChange?.(isPlaying);
    }, [isPlaying, onPlaybackChange]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        let rafId;
        const fadeSpeed = 0.1;

        const handleScrollAndVolume = () => {
            const y = window.scrollY;
            const windowHeight = window.innerHeight;

            setScrollOpacity(Math.max(0, 1 - (y / 600)));

            const zone1End = windowHeight * 0.9;
            const zone2End = windowHeight * 1.5;
            let scrollBasedVolume = DEFAULT_PLAYBACK_VOLUME;

            if (y < zone1End) {
                scrollBasedVolume = DEFAULT_PLAYBACK_VOLUME;
            } else if (y < zone2End) {
                const progress = (y - zone1End) / Math.max(zone2End - zone1End, 1);
                scrollBasedVolume = DEFAULT_PLAYBACK_VOLUME - (progress * 0.46);
            } else {
                const fadeDistance = windowHeight * 0.5;
                const progress = Math.min((y - zone2End) / Math.max(fadeDistance, 1), 1);
                scrollBasedVolume = 0.4 - (progress * 0.28);
            }

            const showreelVideo = document.getElementById('showreel-video');
            const isShowreelPlaying = showreelVideo && !showreelVideo.paused && !showreelVideo.muted;
            targetVolumeRef.current = isShowreelPlaying
                ? 0
                : clamp(scrollBasedVolume, MIN_PLAYBACK_VOLUME, DEFAULT_PLAYBACK_VOLUME);

            if (gainNodeRef.current && isPlayingRef.current && audioContextRef.current) {
                const diff = targetVolumeRef.current - currentVolumeRef.current;
                if (Math.abs(diff) > 0.001) {
                    currentVolumeRef.current += diff * fadeSpeed;
                    gainNodeRef.current.gain.setTargetAtTime(
                        currentVolumeRef.current,
                        audioContextRef.current.currentTime,
                        0.1,
                    );
                }
            }

            rafId = window.requestAnimationFrame(handleScrollAndVolume);
        };

        rafId = window.requestAnimationFrame(handleScrollAndVolume);

        return () => {
            if (rafId) window.cancelAnimationFrame(rafId);
        };
    }, []);

    useEffect(() => {
        if (!isStarted || !analyzerRef.current) return undefined;

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
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.fillRect(0, canvas.height - 1, canvas.width, 1);

            const numBins = 16;
            const gap = 1;
            const availableWidth = canvas.width / 2;
            const barWidth = (availableWidth / numBins) - gap;
            const centerX = canvas.width / 2;
            const isLightMode = document.documentElement.getAttribute('data-theme') === 'light';
            const barColor = isLightMode ? '#2a2a2a' : '#FFFFFF';

            for (let i = 0; i < numBins; i += 1) {
                const intensity = dataArray[i] / 255;
                const damping = 1 - ((i / numBins) * 0.5);
                const barHeight = Math.min(
                    canvas.height * 0.8,
                    Math.pow(intensity, 1) * canvas.height * 0.9 * damping,
                );

                if (barHeight <= 0) continue;

                ctx.fillStyle = barColor;
                ctx.fillRect(
                    centerX + (i * (barWidth + gap)) + (gap / 2),
                    canvas.height - barHeight,
                    barWidth,
                    barHeight,
                );
                ctx.fillRect(
                    centerX - ((i + 1) * (barWidth + gap)) + (gap / 2),
                    canvas.height - barHeight,
                    barWidth,
                    barHeight,
                );
            }
        };

        draw();
        return () => cancelAnimationFrame(animationFrameRef.current);
    }, [isStarted]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const handleMouseMove = (event) => {
            mousePos.current = { x: event.clientX, y: event.clientY };
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    useEffect(() => {
        if (!isStarted || !audioRef.current) return undefined;

        const interval = window.setInterval(() => {
            if (!audioRef.current || audioRef.current.paused) return;

            const currentTime = audioRef.current.currentTime;
            const newIndex = captions.findIndex(
                (caption) => currentTime >= caption.start && currentTime < caption.end,
            );

            if (newIndex === activeIndex) return;

            setActiveIndex(newIndex);

            if (newIndex === -1) return;

            if (isStackLayout && stackLayoutMetrics) {
                const nextPlacement = stackLayoutMetrics.captionPlacements[
                    newIndex % stackLayoutMetrics.captionPlacements.length
                ];
                setLyricStyle(nextPlacement);
                return;
            }

            const hasMouse = mousePos.current.x >= 0 && mousePos.current.y >= 0;
            const fallbackWidth = clamp(Math.round(viewportSize.width * 0.22), 240, 340);
            const fallbackHeight = 110;
            const fallbackPlacement = buildAnchoredPlacement({
                x: hasMouse ? mousePos.current.x : viewportSize.width * 0.5,
                y: hasMouse ? mousePos.current.y - 48 : viewportSize.height * 0.32,
                width: fallbackWidth,
                height: fallbackHeight,
                viewportWidth: viewportSize.width,
                viewportHeight: viewportSize.height,
                anchorX: 'center',
                anchorY: 'center',
                textAlign: 'center',
            });
            setLyricStyle(fallbackPlacement.style);
        }, 100);

        return () => window.clearInterval(interval);
    }, [activeIndex, captions, isStackLayout, isStarted, stackLayoutMetrics, viewportSize]);

    const setGainValue = useCallback((nextVolume) => {
        const clampedVolume = clamp(nextVolume, 0, DEFAULT_PLAYBACK_VOLUME);

        if (gainNodeRef.current && audioContextRef.current) {
            gainNodeRef.current.gain.cancelScheduledValues(audioContextRef.current.currentTime);
            gainNodeRef.current.gain.setValueAtTime(
                clampedVolume,
                audioContextRef.current.currentTime,
            );
        }

        currentVolumeRef.current = clampedVolume;
    }, []);

    const fadeAudio = useCallback((targetVolume, duration = 1) => {
        if (!gainNodeRef.current || !audioContextRef.current) return Promise.resolve();

        const gainNode = gainNodeRef.current;
        const currentTime = audioContextRef.current.currentTime;
        const currentVolume = clamp(currentVolumeRef.current, 0, DEFAULT_PLAYBACK_VOLUME);
        const clampedTarget = clamp(targetVolume, 0, DEFAULT_PLAYBACK_VOLUME);
        gainNode.gain.cancelScheduledValues(currentTime);
        gainNode.gain.setValueAtTime(currentVolume, currentTime);
        gainNode.gain.linearRampToValueAtTime(clampedTarget, currentTime + duration);

        return new Promise((resolve) => {
            window.setTimeout(() => {
                currentVolumeRef.current = clampedTarget;
                resolve();
            }, duration * 1000);
        });
    }, []);

    const handleStart = useCallback(async () => {
        if (!audioRef.current || !audioContextRef.current) return;

        if (audioContextRef.current.state === 'suspended') {
            try {
                await audioContextRef.current.resume();
            } catch (error) {
                console.error('Audio context resume failed:', error);
            }
        }

        try {
            const playPromise = audioRef.current.play();
            if (playPromise !== undefined) {
                await playPromise;
            }

            setIsStarted(true);
            setIsPlaying(true);
            setGainValue(0);
            await fadeAudio(targetVolumeRef.current, 0.9);
        } catch (error) {
            console.error('Audio playback failed:', error);
        }
    }, [fadeAudio, setGainValue]);

    useEffect(() => {
        if (autoStart && !isStartedRef.current) {
            void handleStart();
        }
    }, [autoStart, handleStart]);

    const handlePlaybackToggle = useCallback(async () => {
        if (!audioRef.current || !audioContextRef.current) return;

        if (!isStartedRef.current) {
            await handleStart();
            return;
        }

        if (isPlayingRef.current) {
            try {
                await fadeAudio(0, 0.35);
            } catch (error) {
                console.warn('Fade out before pause failed:', error);
            }
            audioRef.current.pause();
            setIsPlaying(false);
            setGainValue(0);
            return;
        }

        try {
            if (audioContextRef.current.state === 'suspended') {
                await audioContextRef.current.resume();
            }

            const playPromise = audioRef.current.play();
            if (playPromise !== undefined) {
                await playPromise;
            }

            setIsPlaying(true);
            setGainValue(0);
            await fadeAudio(targetVolumeRef.current, 0.45);
        } catch (error) {
            console.error('Resume playback failed:', error);
        }
    }, [fadeAudio, handleStart, setGainValue]);

    const handleRestart = useCallback(async () => {
        if (!audioRef.current || !audioContextRef.current) return;

        try {
            if (audioContextRef.current.state === 'suspended') {
                await audioContextRef.current.resume();
            }

            audioRef.current.currentTime = 0;

            if (!isStartedRef.current || !isPlayingRef.current) {
                const playPromise = audioRef.current.play();
                if (playPromise !== undefined) {
                    await playPromise;
                }

                setIsStarted(true);
                setIsPlaying(true);
                setGainValue(0);
                await fadeAudio(targetVolumeRef.current, 0.45);
                return;
            }

            setGainValue(targetVolumeRef.current);
        } catch (error) {
            console.error('Restart playback failed:', error);
        }
    }, [fadeAudio, setGainValue]);

    useEffect(() => {
        if (typeof window === 'undefined' || !src) return undefined;

        const audio = new Audio(src);
        audio.crossOrigin = 'anonymous';
        audio.loop = true;
        audio.volume = 1;
        audioRef.current = audio;

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContextClass();
        audioContextRef.current = audioContext;

        const analyzer = audioContext.createAnalyser();
        analyzer.fftSize = 256;
        analyzer.smoothingTimeConstant = 0.92;
        analyzerRef.current = analyzer;

        const source = audioContext.createMediaElementSource(audio);
        sourceRef.current = source;

        const gainNode = audioContext.createGain();
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNodeRef.current = gainNode;

        source.connect(analyzer);
        analyzer.connect(gainNode);
        gainNode.connect(audioContext.destination);

        window.landingAudio = audio;
        window.landingAudioGain = gainNode;
        window.triggerAudio = () => {
            if (!isPlayingRef.current) {
                void handleStart();
            }
        };
        window.toggleLandingAudio = () => {
            void handlePlaybackToggle();
        };
        window.restartLandingAudio = () => {
            void handleRestart();
        };

        return () => {
            delete window.triggerAudio;
            delete window.toggleLandingAudio;
            delete window.restartLandingAudio;
            delete window.landingAudio;
            delete window.landingAudioGain;
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            if (audioContextRef.current) {
                void audioContextRef.current.close();
            }
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [handlePlaybackToggle, handleRestart, handleStart, src]);

    const currentCaption = activeIndex >= 0 ? captions[activeIndex] : null;

    if (!isMounted) return null;

    return (
        <div className="experience-module-container">
            <motion.div
                className="experience-layout-layer"
                initial={{ opacity: 0 }}
                animate={{ opacity: visualOpacity }}
                style={{ opacity: visualOpacity, pointerEvents: 'none' }}
                transition={{ duration: 1 }}
            >
                <AnimatePresence mode="wait">
                    {isStarted && isPlaying && showLyrics && currentCaption && (
                        <motion.div
                            key={activeIndex}
                            className={`lyric-floating-container ${isStackLayout ? 'stack-layout' : ''}`}
                            style={lyricStyle}
                            initial={{ opacity: 0, filter: 'blur(4px)', scale: 0.96 }}
                            animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
                            exit={{ opacity: 0, filter: 'blur(4px)', scale: 1.04 }}
                            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                        >
                            <span className="lyric-text">
                                {currentCaption.text}
                            </span>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div
                    className={`controls-bottom-center ${isStackLayout ? 'stack-layout' : ''}`}
                    style={isStackLayout ? stackLayoutMetrics?.controlsStyle : undefined}
                >
                    <AnimatePresence>
                        {isStarted && isPlaying && showVisualizer && (
                            <motion.div
                                className={`spectrum-display-group ${isStackLayout ? 'stack-layout' : ''}`}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 14 }}
                                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                            >
                                <canvas
                                    ref={canvasRef}
                                    width={isStackLayout ? stackLayoutMetrics?.controlsCanvasWidth || 240 : 200}
                                    height={isStackLayout ? 34 : 24}
                                    className="mirrored-spectrum-mini"
                                    aria-hidden="true"
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>

            <style suppressHydrationWarning>{`
                .experience-module-container {
                    position: fixed;
                    inset: 0;
                    width: 100vw;
                    height: 100vh;
                    z-index: 100;
                    pointer-events: none;
                }

                .experience-layout-layer {
                    position: relative;
                    width: 100%;
                    height: 100%;
                }

                .lyric-floating-container {
                    position: absolute;
                    pointer-events: none;
                    z-index: 110;
                    text-align: center;
                    max-width: 400px;
                    width: max-content;
                }

                .lyric-floating-container.stack-layout {
                    z-index: 136;
                }

                .lyric-text {
                    display: inline-block;
                    font-family: var(--font-mono);
                    font-size: 1rem;
                    line-height: 1.5;
                    letter-spacing: 0.03em;
                    font-weight: 400;
                    color: rgba(255, 255, 255, 0.98);
                    text-shadow: 0 0 14px rgba(255, 255, 255, 0.24);
                    background: rgba(8, 10, 16, 0.58);
                    padding: 0.72rem 0.96rem;
                    border-radius: 14px;
                    border: 1px solid rgba(255, 255, 255, 0.14);
                    backdrop-filter: blur(10px);
                    box-shadow: 0 18px 40px rgba(0, 0, 0, 0.24);
                }

                .controls-bottom-center {
                    position: absolute;
                    left: 50%;
                    bottom: 12%;
                    transform: translateX(-50%);
                    z-index: 120;
                    display: flex;
                    justify-content: center;
                    pointer-events: none;
                }

                .controls-bottom-center.stack-layout {
                    bottom: auto;
                    z-index: 134;
                }

                .spectrum-display-group {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0;
                    pointer-events: auto;
                }

                .spectrum-display-group.stack-layout {
                    min-width: 280px;
                    padding: 0.96rem 1.08rem 1.04rem;
                    border-radius: 20px;
                    border: 1px solid rgba(255, 255, 255, 0.14);
                    background: linear-gradient(180deg, rgba(11, 14, 20, 0.88), rgba(8, 9, 14, 0.8));
                    box-shadow: 0 18px 38px rgba(0, 0, 0, 0.26);
                    backdrop-filter: blur(14px);
                }

                .mirrored-spectrum-mini {
                    display: block;
                    filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.4));
                    opacity: 0.92;
                }

                [data-theme="light"] .mirrored-spectrum-mini {
                    filter: none !important;
                    opacity: 0.85;
                }

                [data-theme="light"] .lyric-text {
                    color: rgba(0, 0, 0, 0.88);
                    text-shadow: 0 0 15px rgba(255, 255, 255, 0.72);
                    background: rgba(255, 255, 255, 0.76);
                    border-color: rgba(0, 0, 0, 0.08);
                    box-shadow: 0 18px 40px rgba(0, 0, 0, 0.1);
                }

                [data-theme="light"] .spectrum-display-group.stack-layout {
                    background: rgba(255, 255, 255, 0.88);
                    border-color: rgba(0, 0, 0, 0.1);
                    box-shadow: 0 18px 38px rgba(0, 0, 0, 0.1);
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
