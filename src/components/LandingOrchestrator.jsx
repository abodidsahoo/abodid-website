import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CardStacker from './CardStacker';
import IntroSequence from './IntroSequence';
import ExperienceModule from './ExperienceModule';
import { useCardPhysics } from '../hooks/useCardPhysics';
import { useHandTracking } from '../hooks/useHandTracking';
import { supabase } from '../lib/supabaseClient';
import { buildCardSensitivityProfile } from '../lib/cardSensitivity';

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

const DEFAULT_CATEGORY_FILTERS = ['art'];
const INITIAL_CARD_SIZE_BOUNDS = { min: 120, max: 560 };
const DEFAULT_CARD_SIZE_SCALE = 1.1;
const DEFAULT_CARD_SENSITIVITY = 45;
const getDefaultCardWidth = (minSize, maxSize) => {
    const midpoint = (minSize + maxSize) / 2;
    return Math.round(
        Math.max(minSize, Math.min(maxSize, midpoint * DEFAULT_CARD_SIZE_SCALE)),
    );
};
const DEFAULT_CARD_WIDTH = getDefaultCardWidth(
    INITIAL_CARD_SIZE_BOUNDS.min,
    INITIAL_CARD_SIZE_BOUNDS.max,
);
const SIDE_PANEL_WIDTH_PX = 284;
const HAND_FEEDBACK_TOP_PX = 120;
const HAND_FEEDBACK_ESTIMATED_HEIGHT_PX = 294;
const STORY_GAP_BELOW_FEEDBACK_PX = 16;
const STORY_BASE_OFFSET_PX = 156;
const HAND_GUIDANCE_MESSAGES = [
    'Move your index finger slowly in any direction.',
    'Use a gentle flick to drop a new card.',
    'Keep your hand inside the frame for stable tracking.',
    'Pause briefly between flicks for better control.',
];

const LandingOrchestrator = ({ images, anchorX, anchorY, audioSrc, captions }) => {
    // 1. Intro Logic
    // Starts immediately on mount
    const [introComplete, setIntroComplete] = useState(false); // Controls Physics & Button Appearance
    const [introVisible, setIntroVisible] = useState(true);   // Controls Intro Overlay Visibility

    // 2. Audio Experience Logic
    // We mount EngagementCTA immediately so 'window.triggerAudio' is available,
    // but we use 'visualStarted' to control the overlay visibility if needed, 
    // or we just trust EngagementCTA to be hidden until active.
    // Actually EngagementCTA renders ExperienceModule which is usually hidden until started.
    const [experienceStarted, setExperienceStarted] = useState(false);

    // 3. Hand Tracking State
    const [handControlEnabled, setHandControlEnabled] = useState(false);
    const [cardSizeBounds, setCardSizeBounds] = useState(INITIAL_CARD_SIZE_BOUNDS);
    const [cardWidth, setCardWidth] = useState(DEFAULT_CARD_WIDTH);
    const [isSizeSliderDragging, setIsSizeSliderDragging] = useState(false);
    const [isSizeSliderHovered, setIsSizeSliderHovered] = useState(false);
    const [cardSensitivity, setCardSensitivity] = useState(DEFAULT_CARD_SENSITIVITY);
    const [isSensitivitySliderDragging, setIsSensitivitySliderDragging] = useState(false);
    const [isSensitivitySliderHovered, setIsSensitivitySliderHovered] = useState(false);
    const [showSensitivityHint, setShowSensitivityHint] = useState(false);
    const [storyByPhotoUrl, setStoryByPhotoUrl] = useState({});
    const [loadingStoryUrls, setLoadingStoryUrls] = useState({});
    const [feedMode, setFeedMode] = useState('shuffle');
    const [mediaFilters, setMediaFilters] = useState(DEFAULT_CATEGORY_FILTERS);
    const [queueResetKey, setQueueResetKey] = useState(0);
    const [queueAnchorImage, setQueueAnchorImage] = useState(null);
    const [showStoryPanel, setShowStoryPanel] = useState(false);
    const [leftStoryPanelTop, setLeftStoryPanelTop] = useState(140);
    const [handGuidanceIndex, setHandGuidanceIndex] = useState(0);
    const [showHandGuidanceMessage, setShowHandGuidanceMessage] = useState(true);
    const sensitivityProfile = useMemo(
        () => buildCardSensitivityProfile(cardSensitivity / 100),
        [cardSensitivity],
    );

    // 4. Unified Physics
    const { stack, lastAction, containerRef, spawnCardFromGesture } = useCardPhysics({
        initialImages: images,
        isActive: introComplete,
        feedMode,
        mediaFilters,
        queueResetKey,
        queueAnchorImage,
        cardSensitivity: sensitivityProfile.normalized,
    });
    const [showStabilityNotice, setShowStabilityNotice] = useState(false);
    const anomalyStreakRef = useRef(0);
    const healthyStreakRef = useRef(0);
    const sawCardsRef = useRef(false);
    const sizeSliderHitAreaRef = useRef(null);
    const sizeControlRef = useRef(null);
    const sensitivitySliderHitAreaRef = useRef(null);
    const sensitivityControlRef = useRef(null);
    const sensitivityHintHideTimeoutRef = useRef(null);
    const hasInitializedCardWidthRef = useRef(false);
    const inFlightStoryUrlsRef = useRef(new Set());
    const handGuidanceSwapTimeoutRef = useRef(null);

    // Create ref for gesture callback
    const spawnRef = useRef(spawnCardFromGesture);
    useEffect(() => {
        spawnRef.current = spawnCardFromGesture;
    }, [spawnCardFromGesture]);

    // 5. Hand Tracking Hook
    const {
        videoRef,
        canvasRef,
        onboardingState,
        isTracking
    } = useHandTracking({
        onGesture: (dx, dy, angle) => {
            console.log('👋 Landing Hand gesture!', { dx, dy, angle });
            spawnRef.current(dx, dy, angle);
        },
        threshold: sensitivityProfile.gestureThreshold,
        gestureCooldownMs: sensitivityProfile.gestureCooldownMs,
        isActive: handControlEnabled
    });

    const toggleHandControl = () => {
        setHandControlEnabled(!handControlEnabled);
    };

    const getCurrentTopImage = () =>
        (stack.length > 0 ? stack[stack.length - 1]?.image || null : null);

    const forceReshuffle = (anchorImage = null) => {
        setQueueAnchorImage(anchorImage);
        setQueueResetKey((prev) => prev + 1);
    };

    const handleFeedModeChange = (nextMode) => {
        const anchorImage = nextMode === feedMode ? getCurrentTopImage() : null;
        setFeedMode(nextMode);
        forceReshuffle(anchorImage);
    };

    const handleCategoryToggle = (targetFilter) => {
        const anchorImage = getCurrentTopImage();
        setMediaFilters((prev) => {
            if (prev.includes(targetFilter)) {
                return prev.filter((item) => item !== targetFilter);
            }
            return [...prev, targetFilter];
        });
        forceReshuffle(anchorImage);
    };

    const handleRefreshLoading = () => {
        setShowStabilityNotice(false);
        setFeedMode('shuffle');
        setMediaFilters(DEFAULT_CATEGORY_FILTERS);
        setCardWidth(getDefaultCardWidth(cardSizeBounds.min, cardSizeBounds.max));
        setCardSensitivity(DEFAULT_CARD_SENSITIVITY);
        setStoryByPhotoUrl({});
        setLoadingStoryUrls({});
        setShowStoryPanel(false);
        forceReshuffle(null);
    };

    useEffect(() => {
        const shouldRotate =
            handControlEnabled &&
            onboardingState === 'ready' &&
            isTracking;

        if (!shouldRotate) {
            if (handGuidanceSwapTimeoutRef.current) {
                window.clearTimeout(handGuidanceSwapTimeoutRef.current);
                handGuidanceSwapTimeoutRef.current = null;
            }
            setHandGuidanceIndex(0);
            setShowHandGuidanceMessage(true);
            return;
        }

        const rotateInterval = window.setInterval(() => {
            setShowHandGuidanceMessage(false);
            handGuidanceSwapTimeoutRef.current = window.setTimeout(() => {
                setHandGuidanceIndex((prev) => (prev + 1) % HAND_GUIDANCE_MESSAGES.length);
                setShowHandGuidanceMessage(true);
                handGuidanceSwapTimeoutRef.current = null;
            }, 260);
        }, 4200);

        return () => {
            window.clearInterval(rotateInterval);
            if (handGuidanceSwapTimeoutRef.current) {
                window.clearTimeout(handGuidanceSwapTimeoutRef.current);
                handGuidanceSwapTimeoutRef.current = null;
            }
        };
    }, [handControlEnabled, onboardingState, isTracking]);

    useEffect(() => {
        const computeSizeBounds = () => {
            const minSize = INITIAL_CARD_SIZE_BOUNDS.min;
            const maxByWidth = Math.round(window.innerWidth * 0.7);
            const maxByHeight = Math.round(window.innerHeight * 0.7 * (16 / 9));
            const maxSize = Math.max(minSize + 40, Math.min(maxByWidth, maxByHeight));

            setCardSizeBounds({ min: minSize, max: maxSize });
            setCardWidth((prev) => {
                if (!hasInitializedCardWidthRef.current) {
                    hasInitializedCardWidthRef.current = true;
                    return getDefaultCardWidth(minSize, maxSize);
                }
                return Math.max(minSize, Math.min(maxSize, prev));
            });
        };

        computeSizeBounds();
        window.addEventListener('resize', computeSizeBounds);
        return () => window.removeEventListener('resize', computeSizeBounds);
    }, []);
    useEffect(() => {
        // Lock scroll initially ONLY ON DESKTOP
        const isMobile = window.innerWidth <= 768;

        if (!introComplete && !isMobile) {
            document.body.style.overflow = 'hidden';
            document.body.style.height = '100vh'; // Force lock
        } else {
            // Unlock when cards drop (introComplete) or if on mobile
            document.body.style.overflow = '';
            document.body.style.height = '';
        }

        return () => {
            // Cleanup if component unmounts
            document.body.style.overflow = '';
            document.body.style.height = '';
        };
    }, [introComplete]);

    useEffect(() => {
        if (stack.length > 0) {
            sawCardsRef.current = true;
        }
    }, [stack.length]);

    // Lightweight health monitor: detect disappearing/glitchy stack and prompt refresh.
    useEffect(() => {
        if (!introComplete) return;

        const interval = setInterval(() => {
            if (window.scrollY > 180) {
                anomalyStreakRef.current = 0;
                healthyStreakRef.current += 1;
                if (healthyStreakRef.current >= 2) setShowStabilityNotice(false);
                return;
            }

            const container = containerRef.current;
            let isAnomaly = false;

            if (!container) {
                isAnomaly = true;
            } else {
                const rect = container.getBoundingClientRect();
                const styles = window.getComputedStyle(container);
                const hiddenContainer =
                    styles.display === 'none' ||
                    styles.visibility === 'hidden' ||
                    parseFloat(styles.opacity || '1') < 0.05 ||
                    rect.width < 20 ||
                    rect.height < 20;

                const domCardCount = container.querySelectorAll('.stacked-card').length;
                const missingRenderedCards = stack.length > 0 && domCardCount === 0;
                const unexpectedEmptyWhileGesturing =
                    handControlEnabled &&
                    isTracking &&
                    sawCardsRef.current &&
                    stack.length === 0;

                if (hiddenContainer || missingRenderedCards || unexpectedEmptyWhileGesturing) {
                    isAnomaly = true;
                }
            }

            if (isAnomaly) {
                anomalyStreakRef.current += 1;
                healthyStreakRef.current = 0;
            } else {
                healthyStreakRef.current += 1;
                anomalyStreakRef.current = 0;
            }

            if (anomalyStreakRef.current >= 2) {
                setShowStabilityNotice(true);
            }
            if (healthyStreakRef.current >= 2) {
                setShowStabilityNotice(false);
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [introComplete, containerRef, stack.length, handControlEnabled, isTracking]);

    // 4. Scroll Logic (Hint & Button Visibility)
    const [isScrolled, setIsScrolled] = useState(false); // Toggle for button
    const [hintDismissed, setHintDismissed] = useState(false); // One-way latch for hint

    useEffect(() => {
        if (!introComplete) return;

        const handleScroll = () => {
            const scrolled = window.scrollY > 100; // Threshold for hiding button
            setIsScrolled(scrolled);
            if (window.scrollY > 50) setHintDismissed(true);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [introComplete]);

    const handleActivate = () => {
        // CRITICAL: Call this inside the user click handler to unlock Audio Context
        if (window.triggerAudio) {
            window.triggerAudio();
        }
        setExperienceStarted(true);
    };

    const updateCardWidthFromPointer = (clientX) => {
        const scrubZone = sizeControlRef.current || sizeSliderHitAreaRef.current;
        if (!scrubZone) return;

        const rect = scrubZone.getBoundingClientRect();
        if (rect.width <= 0) return;

        const rawRatio = (clientX - rect.left) / rect.width;
        const ratio = Math.min(1, Math.max(0, rawRatio));
        const nextWidth = Math.round(
            cardSizeBounds.min + ratio * (cardSizeBounds.max - cardSizeBounds.min),
        );
        setCardWidth(nextWidth);
    };

    const updateCardSensitivityFromPointer = (clientX) => {
        const scrubZone = sensitivityControlRef.current || sensitivitySliderHitAreaRef.current;
        if (!scrubZone) return;

        const rect = scrubZone.getBoundingClientRect();
        if (rect.width <= 0) return;

        const rawRatio = (clientX - rect.left) / rect.width;
        const ratio = Math.min(1, Math.max(0, rawRatio));
        setCardSensitivity(Math.round(ratio * 100));
    };

    const showSensitivityHintTemporarily = () => {
        if (sensitivityHintHideTimeoutRef.current) {
            window.clearTimeout(sensitivityHintHideTimeoutRef.current);
            sensitivityHintHideTimeoutRef.current = null;
        }
        setShowSensitivityHint(true);
    };

    const hideSensitivityHintWithDelay = (delayMs = 1000) => {
        if (sensitivityHintHideTimeoutRef.current) {
            window.clearTimeout(sensitivityHintHideTimeoutRef.current);
        }
        sensitivityHintHideTimeoutRef.current = window.setTimeout(() => {
            setShowSensitivityHint(false);
            sensitivityHintHideTimeoutRef.current = null;
        }, delayMs);
    };

    const handleSizeSliderPointerDown = (e) => {
        if (typeof e.button === 'number' && e.button !== 0) return;

        e.preventDefault();
        setIsSizeSliderDragging(true);
        updateCardWidthFromPointer(e.clientX);

        const handleMove = (moveEvent) => {
            updateCardWidthFromPointer(moveEvent.clientX);
        };

        const stopTracking = () => {
            setIsSizeSliderDragging(false);
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', stopTracking);
            window.removeEventListener('pointercancel', stopTracking);
        };

        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', stopTracking, { once: true });
        window.addEventListener('pointercancel', stopTracking, { once: true });
    };

    const handleSensitivitySliderPointerDown = (e) => {
        if (typeof e.button === 'number' && e.button !== 0) return;

        e.preventDefault();
        setIsSensitivitySliderDragging(true);
        showSensitivityHintTemporarily();
        updateCardSensitivityFromPointer(e.clientX);

        const handleMove = (moveEvent) => {
            updateCardSensitivityFromPointer(moveEvent.clientX);
        };

        const stopTracking = () => {
            setIsSensitivitySliderDragging(false);
            hideSensitivityHintWithDelay(1000);
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', stopTracking);
            window.removeEventListener('pointercancel', stopTracking);
        };

        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', stopTracking, { once: true });
        window.addEventListener('pointercancel', stopTracking, { once: true });
    };

    useEffect(() => {
        return () => {
            if (sensitivityHintHideTimeoutRef.current) {
                window.clearTimeout(sensitivityHintHideTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        const computeLeftStoryPanelTop = () => {
            const viewportH = window.innerHeight;
            const anchorYPx = parseAnchorToPixels(anchorY, viewportH, 0.68);
            const handFeedbackVisible = handControlEnabled && introComplete && !isScrolled;
            const handFeedbackBottom =
                HAND_FEEDBACK_TOP_PX +
                HAND_FEEDBACK_ESTIMATED_HEIGHT_PX +
                STORY_GAP_BELOW_FEEDBACK_PX;
            const targetTop = handFeedbackVisible
                ? handFeedbackBottom
                : Math.floor(anchorYPx - STORY_BASE_OFFSET_PX);
            const minTop = handFeedbackVisible ? handFeedbackBottom : 102;
            const maxTop = Math.max(minTop, viewportH - 340);
            const boundedTop = Math.max(minTop, Math.min(maxTop, targetTop));
            setLeftStoryPanelTop(boundedTop);
        };

        computeLeftStoryPanelTop();
        window.addEventListener('resize', computeLeftStoryPanelTop);
        return () => window.removeEventListener('resize', computeLeftStoryPanelTop);
    }, [anchorY, handControlEnabled, introComplete, isScrolled]);

    const sliderPercent = cardSizeBounds.max > cardSizeBounds.min
        ? Math.max(0, Math.min(100, ((cardWidth - cardSizeBounds.min) / (cardSizeBounds.max - cardSizeBounds.min)) * 100))
        : 0;
    const sensitivitySliderPercent = Math.max(0, Math.min(100, cardSensitivity));
    const sensitivityLabel = cardSensitivity <= 33
        ? 'Slow'
        : cardSensitivity >= 67
            ? 'Fast'
            : 'Balanced';
    const sensitivityHint = cardSensitivity <= 33
        ? 'Needs a longer, stronger flick before a new card appears.'
        : cardSensitivity >= 67
            ? 'Responds to shorter flicks, so cards appear more often.'
            : 'Balanced response between control and quick spawning.';
    const activeTopCard = stack.length > 0 ? stack[stack.length - 1] : null;
    const activePhotoUrl = activeTopCard?.image || '';
    const activeStoryTitle = (activeTopCard?.title || '').trim() || 'Untitled Story';
    const hasLoadedCurrentStory = activePhotoUrl
        ? Object.prototype.hasOwnProperty.call(storyByPhotoUrl, activePhotoUrl)
        : false;
    const currentPhotoStory = activePhotoUrl && hasLoadedCurrentStory
        ? storyByPhotoUrl[activePhotoUrl]
        : '';
    const isCurrentStoryLoading = Boolean(activePhotoUrl) &&
        !hasLoadedCurrentStory &&
        Boolean(loadingStoryUrls[activePhotoUrl]);
    const hasManualStory = (currentPhotoStory || '').trim().length > 0;
    const storyDisplayText = !activePhotoUrl
        ? 'No photo selected yet.'
        : isCurrentStoryLoading
            ? 'Loading story...'
            : hasManualStory
                ? currentPhotoStory
                : 'No story added yet.';
    const isHandFeedbackVisible = handControlEnabled && introComplete && !isScrolled;
    const showLeftStoryPanel = introComplete && !isScrolled && showStoryPanel;
    const shouldRotateHandGuidance =
        handControlEnabled &&
        onboardingState === 'ready' &&
        isTracking;
    const handFeedbackMessage = onboardingState === 'ready'
        ? HAND_GUIDANCE_MESSAGES[handGuidanceIndex]
        : onboardingState === 'hand_lost_temporarily'
            ? 'Hand lost. Reframe your hand.'
            : onboardingState === 'waiting_for_hand'
                ? 'Show your hand to start tracking.'
                : onboardingState === 'requesting_camera'
                    ? 'Requesting camera access...'
                    : onboardingState === 'calibrating'
                        ? 'Calibrating tracking...'
                        : 'Initializing hand controls...';

    useEffect(() => {
        if (!activePhotoUrl) return;
        if (Object.prototype.hasOwnProperty.call(storyByPhotoUrl, activePhotoUrl)) return;
        if (inFlightStoryUrlsRef.current.has(activePhotoUrl)) return;

        let cancelled = false;
        inFlightStoryUrlsRef.current.add(activePhotoUrl);
        setLoadingStoryUrls((prev) => ({
            ...prev,
            [activePhotoUrl]: true,
        }));

        const fetchStory = async () => {
            try {
                const { data, error } = await supabase
                    .from('photo_stories')
                    .select('story_markdown, sample_story_markdown')
                    .eq('photo_url', activePhotoUrl)
                    .maybeSingle();

                if (error) throw error;

                if (!cancelled) {
                    setStoryByPhotoUrl((prev) => ({
                        ...prev,
                        [activePhotoUrl]: data?.story_markdown || data?.sample_story_markdown || '',
                    }));
                }
            } catch (error) {
                console.warn('Story fetch failed for photo:', activePhotoUrl, error);
                if (!cancelled) {
                    setStoryByPhotoUrl((prev) => ({
                        ...prev,
                        [activePhotoUrl]: '',
                    }));
                }
            } finally {
                inFlightStoryUrlsRef.current.delete(activePhotoUrl);
                if (!cancelled) {
                    setLoadingStoryUrls((prev) => {
                        const next = { ...prev };
                        delete next[activePhotoUrl];
                        return next;
                    });
                }
            }
        };

        fetchStory();

        return () => {
            cancelled = true;
        };
    }, [activePhotoUrl, storyByPhotoUrl]);

    return (
        <>
            {/* ACTIVATE BUTTONS */}
            <AnimatePresence>
                {introComplete && !isScrolled && (
                    <motion.div
                        className="start-overlay"
                        initial={{ y: -100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -50, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.5 }}
                    >
                        <div className="activation-stack">
                            {!experienceStarted && (
                                <button className="start-btn" onClick={handleActivate}>
                                    <div className="start-label-large">Play soundtrack</div>
                                </button>
                            )}

                            {/* New Hand Control Button */}
                            <button
                                className={`start-btn gesture-btn ${handControlEnabled ? 'active' : ''}`}
                                onClick={toggleHandControl}
                            >
                                <div className="start-label-large">
                                    {handControlEnabled ? 'Disable Hand Controls' : 'Activate Hand Control'}
                                </div>
                                {handControlEnabled && (
                                    <div className="start-label-small status-success">Gesture Control is active now.</div>
                                )}
                            </button>

                            <div
                                className={`size-control ${isSizeSliderDragging ? 'dragging' : ''}`}
                                ref={sizeControlRef}
                                onPointerDown={handleSizeSliderPointerDown}
                            >
                                <div className="size-control-header">
                                    <span className="size-control-label">Image Size</span>
                                    <span className="size-control-value">{cardWidth}px</span>
                                </div>
                                <div
                                    className={`size-slider-hit-area ${isSizeSliderDragging ? 'dragging' : ''} ${(isSizeSliderHovered || isSizeSliderDragging) ? 'expanded' : ''}`}
                                    ref={sizeSliderHitAreaRef}
                                    onPointerEnter={() => setIsSizeSliderHovered(true)}
                                    onPointerLeave={() => setIsSizeSliderHovered(false)}
                                    style={{ '--slider-percent': `${sliderPercent}%` }}
                                >
                                    <div className="size-slider-visual" aria-hidden="true">
                                        <span className="size-slider-segment left"></span>
                                        <span className="size-slider-segment right"></span>
                                        <span className="size-slider-knob">
                                            <span className="size-slider-knob-label">SLIDE</span>
                                        </span>
                                    </div>
                                    <input
                                        className="size-slider"
                                        type="range"
                                        min={cardSizeBounds.min}
                                        max={cardSizeBounds.max}
                                        step="1"
                                        value={cardWidth}
                                        onInput={(e) => setCardWidth(Number(e.currentTarget.value))}
                                        onChange={(e) => setCardWidth(Number(e.target.value))}
                                        aria-label="Adjust card image size"
                                    />
                                </div>
                                <div className="size-control-scale">
                                    <span>{cardSizeBounds.min}px</span>
                                    <span>{cardSizeBounds.max}px</span>
                                </div>
                            </div>
                            <div
                                className={`size-control sensitivity-control ${isSensitivitySliderDragging ? 'dragging' : ''} ${showSensitivityHint ? 'hint-visible' : ''}`}
                                ref={sensitivityControlRef}
                                onPointerDown={handleSensitivitySliderPointerDown}
                            >
                                <div className="size-control-header">
                                    <span className="size-control-label">Card Drop Speed</span>
                                    <span className="size-control-value">{sensitivityLabel}</span>
                                </div>
                                <div
                                    className={`size-slider-hit-area ${isSensitivitySliderDragging ? 'dragging' : ''} ${(isSensitivitySliderHovered || isSensitivitySliderDragging) ? 'expanded' : ''}`}
                                    ref={sensitivitySliderHitAreaRef}
                                    onPointerEnter={() => setIsSensitivitySliderHovered(true)}
                                    onPointerLeave={() => setIsSensitivitySliderHovered(false)}
                                    style={{ '--slider-percent': `${sensitivitySliderPercent}%` }}
                                >
                                    <div className="size-slider-visual" aria-hidden="true">
                                        <span className="size-slider-segment left"></span>
                                        <span className="size-slider-segment right"></span>
                                        <span className="size-slider-knob">
                                            <span className="size-slider-knob-label">SLIDE</span>
                                        </span>
                                    </div>
                                    <input
                                        className="size-slider"
                                        type="range"
                                        min="0"
                                        max="100"
                                        step="1"
                                        value={cardSensitivity}
                                        onInput={(e) => {
                                            showSensitivityHintTemporarily();
                                            setCardSensitivity(Number(e.currentTarget.value));
                                        }}
                                        onChange={(e) => {
                                            setCardSensitivity(Number(e.target.value));
                                            hideSensitivityHintWithDelay(1000);
                                        }}
                                        aria-label="Adjust card drop speed"
                                    />
                                </div>
                                <div className="size-control-scale">
                                    <span>Slow</span>
                                    <span>Fast</span>
                                </div>
                                <div className={`sensitivity-note-wrap ${showSensitivityHint ? 'visible' : ''}`}>
                                    <div className="sensitivity-note">{sensitivityHint}</div>
                                </div>
                            </div>

                            <div className="feed-control-panel">
                                <div className="photo-story-live-header">Images appear</div>
                                <div className="mode-toggle-row">
                                    <button
                                        className={`mode-btn ${feedMode === 'story' ? 'active' : ''}`}
                                        onClick={() => handleFeedModeChange('story')}
                                    >
                                        Story-wise
                                    </button>
                                    <button
                                        className={`mode-btn ${feedMode === 'shuffle' ? 'active' : ''}`}
                                        onClick={() => handleFeedModeChange('shuffle')}
                                    >
                                        Random
                                    </button>
                                </div>
                            </div>

                            <div className="filter-control-panel">
                                <div className="photo-story-live-header">Category</div>
                                <div className="category-grid">
                                    <button
                                        className={`mode-btn category-btn art ${mediaFilters.includes('art') ? 'active' : ''}`}
                                        onClick={() => handleCategoryToggle('art')}
                                    >
                                        Art
                                    </button>
                                    <button
                                        className={`mode-btn category-btn commercial ${mediaFilters.includes('commercial') ? 'active' : ''}`}
                                        onClick={() => handleCategoryToggle('commercial')}
                                    >
                                        Commercial
                                    </button>
                                </div>
                            </div>

                            <button className="refresh-stack-btn" onClick={handleRefreshLoading}>
                                Refresh Loading
                            </button>

                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {handControlEnabled && introComplete && !isScrolled && (
                <div className="hand-feedback-panel hand-feedback-floating" aria-live="polite">
                    <div className="photo-story-live-header">Hand Feedback</div>
                    <div
                        className={`hand-feedback-status ${onboardingState === 'hand_lost_temporarily' ? 'lost' : ''} ${shouldRotateHandGuidance && !showHandGuidanceMessage ? 'fading' : ''}`}
                    >
                        {handFeedbackMessage}
                    </div>
                    <div className="hand-feedback-crop">
                        <video ref={videoRef} autoPlay playsInline muted style={{ display: 'none' }} />
                        <canvas ref={canvasRef} className="preview-canvas" />
                    </div>
                </div>
            )}

            {showLeftStoryPanel && (
                <aside
                    className={`left-story-panel ${isHandFeedbackVisible ? 'shifted-by-hand-feedback' : ''}`}
                    style={{ top: `${leftStoryPanelTop}px` }}
                    aria-live="polite"
                >
                    <div className="left-story-shell">
                        <div className="left-story-title-row">{activePhotoUrl ? activeStoryTitle : 'No active story'}</div>
                        <div className="left-story-body-row">
                            <div className="left-story-body-label">Story of the Photo</div>
                            <div className="left-story-copy">
                                {storyDisplayText}
                            </div>
                        </div>
                    </div>
                </aside>
            )}

            {showStabilityNotice && (
                <div className="stability-notice" role="status" aria-live="polite">
                    <p>Something looks off. Kindly refresh the page for a finetuned experience.</p>
                </div>
            )}

            <style>{`
                .start-overlay {
                    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                    z-index: 10000;
                    display: flex; justify-content: flex-end; align-items: flex-start;
                    padding: 120px 4vw 0 0; /* Clear fixed header and keep visible below it */
                    pointer-events: none; /* Pass through clicks when not on button */
                }
                .activation-stack {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    align-items: flex-end;
                    pointer-events: auto;
                }
                .start-btn {
                    background: transparent;
                    border: 1px solid rgba(255, 255, 255, 0.65);
                    padding: 0.68rem 1.05rem;
                    color: var(--feature-stack-primary-btn-color, white);
                    cursor: pointer;
                    text-align: center;
                    font-family: var(--feature-stack-primary-btn-font, var(--font-ui));
                    transition: all 0.3s ease;
                    background: rgba(0, 0, 0, 0.25);
                    backdrop-filter: blur(4px);
                    border-radius: 10px;
                    display: flex; 
                    flex-direction: column;
                    align-items: center;
                    gap: 0.48rem;
                    min-width: 284px;
                }
                .size-control {
                    width: 284px;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    border-radius: 10px;
                    background: rgba(0, 0, 0, 0.32);
                    backdrop-filter: blur(4px);
                    padding: 10px 12px;
                    cursor: ew-resize;
                    touch-action: none;
                    transition: padding-bottom 260ms cubic-bezier(0.22, 1, 0.36, 1);
                }
                .size-control.dragging {
                    border-color: rgba(255, 255, 255, 0.55);
                }
                .size-control-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 6px;
                    color: rgba(255, 255, 255, 0.95);
                    font-family: var(--font-ui);
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    font-size: 0.62rem;
                }
                .size-control-value {
                    color: #ffffff;
                }
                .size-slider {
                    -webkit-appearance: none;
                    appearance: none;
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                    opacity: 0;
                    outline: none;
                    margin: 0;
                    cursor: pointer;
                    z-index: 3;
                }
                .size-slider-hit-area {
                    position: relative;
                    height: 34px;
                    display: flex;
                    align-items: center;
                    cursor: ew-resize;
                    touch-action: none;
                }
                .size-slider-visual {
                    position: absolute;
                    inset: 0;
                    pointer-events: none;
                    z-index: 1;
                }
                .size-slider-segment {
                    position: absolute;
                    top: 50%;
                    height: 4px;
                    border-radius: 999px;
                    background: rgba(255, 255, 255, 0.28);
                    transform: translateY(-50%);
                    transition: width 140ms cubic-bezier(0.22, 1, 0.36, 1);
                }
                .size-slider-hit-area.dragging .size-slider-segment {
                    transition-duration: 0ms;
                }
                .size-slider-segment.left {
                    left: 0;
                    width: clamp(0px, calc(var(--slider-percent) - 8px), 100%);
                }
                .size-slider-segment.right {
                    right: 0;
                    width: clamp(0px, calc(100% - var(--slider-percent) - 8px), 100%);
                }
                .size-slider-hit-area.expanded .size-slider-segment.left,
                .size-slider-hit-area.dragging .size-slider-segment.left {
                    width: clamp(0px, calc(var(--slider-percent) - 26px), 100%);
                }
                .size-slider-hit-area.expanded .size-slider-segment.right,
                .size-slider-hit-area.dragging .size-slider-segment.right {
                    width: clamp(0px, calc(100% - var(--slider-percent) - 26px), 100%);
                }
                .size-slider-knob {
                    position: absolute;
                    left: var(--slider-percent);
                    top: 50%;
                    width: 12px;
                    height: 12px;
                    border-radius: 999px;
                    border: 1px solid rgba(255, 255, 255, 0.95);
                    background: #ffffff;
                    color: rgba(15, 15, 15, 0.95);
                    transform: translate(-50%, -50%);
                    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.18);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition:
                        width 220ms cubic-bezier(0.22, 1, 0.36, 1),
                        height 220ms cubic-bezier(0.22, 1, 0.36, 1),
                        border-radius 220ms cubic-bezier(0.22, 1, 0.36, 1),
                        box-shadow 220ms cubic-bezier(0.22, 1, 0.36, 1),
                        background-color 220ms cubic-bezier(0.22, 1, 0.36, 1);
                }
                .size-slider-knob-label {
                    opacity: 0;
                    font-family: var(--font-ui);
                    font-size: 0.43rem;
                    letter-spacing: 0.08em;
                    line-height: 1;
                    transform: scale(0.96);
                    transition: opacity 160ms ease, transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
                    white-space: nowrap;
                }
                .size-slider-hit-area.expanded .size-slider-knob,
                .size-slider-hit-area.dragging .size-slider-knob {
                    width: 46px;
                    height: 18px;
                    border-radius: 999px;
                    box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.18);
                }
                .size-slider-hit-area.expanded .size-slider-knob-label,
                .size-slider-hit-area.dragging .size-slider-knob-label {
                    opacity: 1;
                    transform: scale(1);
                }
                .size-control-scale {
                    margin-top: 6px;
                    display: flex;
                    justify-content: space-between;
                    font-family: var(--font-ui);
                    font-size: 0.56rem;
                    letter-spacing: 0.03em;
                    color: rgba(255, 255, 255, 0.65);
                }
                .sensitivity-note {
                    color: rgba(255, 255, 255, 0.82);
                    font-family: var(--font-ui);
                    font-size: 0.62rem;
                    line-height: 1.35;
                    letter-spacing: 0.02em;
                    text-transform: none;
                }
                .sensitivity-control.hint-visible {
                    padding-bottom: 14px;
                }
                .sensitivity-note-wrap {
                    max-height: 0;
                    opacity: 0;
                    overflow: hidden;
                    transform: translateY(-8px);
                    transition:
                        max-height 300ms cubic-bezier(0.22, 1, 0.36, 1),
                        opacity 220ms ease,
                        transform 300ms cubic-bezier(0.22, 1, 0.36, 1);
                }
                .sensitivity-note-wrap.visible {
                    max-height: 60px;
                    opacity: 1;
                    transform: translateY(0);
                    margin-top: 6px;
                }
                .refresh-stack-btn {
                    width: 284px;
                    border: 1px solid rgba(255, 255, 255, 0.34);
                    border-radius: 10px;
                    background: rgba(0, 0, 0, 0.34);
                    color: var(--feature-stack-peel-btn-color, rgba(255, 255, 255, 0.9));
                    font-family: var(--feature-stack-peel-btn-font, var(--font-ui));
                    font-size: var(--feature-stack-peel-btn-size, 0.72rem);
                    font-weight: var(--feature-stack-peel-btn-weight, 500);
                    line-height: var(--feature-stack-peel-btn-line-height, 1.2);
                    letter-spacing: var(--feature-stack-peel-btn-letter-spacing, 0.05em);
                    text-transform: uppercase;
                    padding: 0.58rem 0.72rem;
                    cursor: pointer;
                }
                .refresh-stack-btn:hover {
                    border-color: rgba(56, 189, 248, 0.75);
                    background: rgba(56, 189, 248, 0.14);
                    color: #ffffff;
                }
                .photo-story-live-header {
                    color: rgba(255, 255, 255, 0.95);
                    font-family: var(--font-ui);
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    font-size: 0.66rem;
                    line-height: 1.2;
                }
                .left-story-panel {
                    position: fixed;
                    left: 4vw;
                    z-index: 9800;
                    pointer-events: auto;
                    width: ${SIDE_PANEL_WIDTH_PX}px;
                    transform-origin: top left;
                    transition: top 420ms cubic-bezier(0.22, 1, 0.36, 1);
                }
                .left-story-shell {
                    display: flex;
                    flex-direction: column;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    border-radius: 12px;
                    background: rgba(0, 0, 0, 0.5);
                    backdrop-filter: blur(8px);
                    overflow: hidden;
                    transition:
                        box-shadow 360ms ease,
                        border-color 320ms ease;
                    border-color: rgba(56, 189, 248, 0.45);
                    box-shadow: 0 24px 54px rgba(0, 0, 0, 0.34);
                }
                .left-story-title-row {
                    padding: 0.6rem 0.86rem 0.56rem;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.22);
                    color: var(--feature-stack-main-text-color, rgba(255, 255, 255, 0.96));
                    font-family: var(--feature-stack-main-text-font, var(--font-mono));
                    font-size: 1rem;
                    line-height: 1.34;
                    white-space: normal;
                    overflow-wrap: anywhere;
                }
                .left-story-body-row {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    padding: 0.72rem 0.86rem 0.84rem;
                }
                .left-story-body-label {
                    color: rgba(255, 255, 255, 0.95);
                    font-family: var(--font-ui);
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                    font-size: 0.62rem;
                    line-height: 1.2;
                }
                .left-story-copy {
                    color: var(--feature-stack-main-text-color, rgba(255, 255, 255, 0.9));
                    font-family: var(--feature-stack-main-text-font, var(--font-mono));
                    white-space: pre-wrap;
                    overflow-wrap: anywhere;
                    font-size: var(--feature-stack-main-text-size, 0.95rem);
                    font-weight: var(--feature-stack-main-text-weight, 500);
                    line-height: var(--feature-stack-main-text-line-height, 1.62);
                    letter-spacing: var(--feature-stack-main-text-letter-spacing, 0em);
                    opacity: 1;
                }
                .feed-control-panel,
                .filter-control-panel {
                    width: 284px;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    border-radius: 10px;
                    background: rgba(0, 0, 0, 0.35);
                    backdrop-filter: blur(4px);
                    padding: 10px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .mode-toggle-row {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 8px;
                }
                .mode-btn {
                    border: 1px solid rgba(255, 255, 255, 0.32);
                    background: rgba(255, 255, 255, 0.04);
                    color: var(--feature-stack-secondary-btn-color, rgba(255, 255, 255, 0.8));
                    border-radius: 8px;
                    padding: 0.46rem 0.62rem;
                    font-size: var(--feature-stack-secondary-btn-size, 0.69rem);
                    font-weight: var(--feature-stack-secondary-btn-weight, 500);
                    line-height: var(--feature-stack-secondary-btn-line-height, 1.2);
                    text-transform: none;
                    letter-spacing: var(--feature-stack-secondary-btn-letter-spacing, 0.02em);
                    font-family: var(--feature-stack-secondary-btn-font, var(--font-ui));
                    cursor: pointer;
                    text-align: center;
                    white-space: nowrap;
                }
                .mode-btn.active {
                    color: #ffffff;
                    border-color: rgba(56, 189, 248, 0.72);
                    background: rgba(56, 189, 248, 0.2);
                }
                .category-grid {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 8px;
                }
                .category-btn {
                    width: 100%;
                }
                .category-btn.commercial.active {
                    border-color: rgba(249, 115, 22, 0.82);
                    background: rgba(249, 115, 22, 0.22);
                    color: #ffedd5;
                }
                .category-btn.art.active {
                    border-color: rgba(56, 189, 248, 0.75);
                    background: rgba(56, 189, 248, 0.2);
                    color: #e0f2fe;
                }
                .hand-feedback-panel {
                    width: 284px;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    border-radius: 10px;
                    background: rgba(0, 0, 0, 0.35);
                    backdrop-filter: blur(4px);
                    padding: 10px;
                    display: flex;
                    flex-direction: column;
                    gap: 9px;
                }
                .hand-feedback-floating {
                    position: fixed;
                    top: ${HAND_FEEDBACK_TOP_PX}px;
                    left: 4vw;
                    z-index: 10000;
                    pointer-events: auto;
                }
                .hand-feedback-status {
                    color: rgba(198, 255, 225, 0.96);
                    font-family: var(--font-mono);
                    font-size: 0.72rem;
                    line-height: 1.4;
                    min-height: 1.7em;
                    opacity: 1;
                    transform: translateY(0);
                    transition: opacity 260ms ease, transform 260ms ease;
                }
                .hand-feedback-status.lost {
                    color: #fecaca;
                }
                .hand-feedback-status.fading {
                    opacity: 0.2;
                    transform: translateY(3px);
                }
                .hand-feedback-crop {
                    width: 100%;
                    aspect-ratio: 4 / 3;
                    border-radius: 7px;
                    overflow: hidden;
                    border: 1px solid rgba(255, 255, 255, 0.22);
                    background: rgba(0, 0, 0, 0.82);
                    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.05);
                }
                .start-btn.gesture-btn.active {
                    border-color: rgba(76, 175, 80, 0.6);
                    background: rgba(76, 175, 80, 0.05);
                }
                .status-success {
                    color: #4CAF50;
                    font-weight: 600;
                }
                .start-btn:hover {
                    border-color: rgba(255, 255, 255, 0.9);
                    background: rgba(255, 255, 255, 0.08);
                    box-shadow: 0 0 15px rgba(255, 255, 255, 0.1);
                }
                .start-label-large {
                    font-size: var(--feature-stack-primary-btn-size, 0.98rem); 
                    font-weight: var(--feature-stack-primary-btn-weight, 600);
                    line-height: var(--feature-stack-primary-btn-line-height, 1);
                    text-transform: uppercase; 
                    letter-spacing: var(--feature-stack-primary-btn-letter-spacing, 0.05em);
                }
                .start-label-small {
                    font-size: 0.62rem; 
                    text-transform: uppercase; 
                    letter-spacing: 0.035em;
                    font-weight: 600;
                    opacity: 1; 
                    line-height: 1;
                }
                /* Scroll Hint Styles */
                .scroll-hint {
                    position: fixed; 
                    bottom: 5vh; 
                    left: 50%;
                    transform: translateX(-50%);
                    font-family: var(--font-ui);
                    font-size: 0.9rem;
                    color: rgba(255, 255, 255, 0.6);
                    animation: bounce 2s infinite;
                    z-index: 50; 
                    pointer-events: none;
                }
                @keyframes bounce {
                    0%, 20%, 50%, 80%, 100% { transform: translateX(-50%) translateY(0); }
                    40% { transform: translateX(-50%) translateY(-10px); }
                    60% { transform: translateX(-50%) translateY(-5px); }
                }
                .stability-notice {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    z-index: 10020;
                    pointer-events: none;
                    max-width: min(560px, 86vw);
                    padding: 16px 20px;
                    border-radius: 12px;
                    border: 1px solid rgba(0, 0, 0, 0.14);
                    background: rgba(255, 255, 255, 0.96);
                    backdrop-filter: blur(10px);
                    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
                    text-align: center;
                }
                .stability-notice p {
                    margin: 0;
                    color: rgba(0, 0, 0, 0.86);
                    font-family: var(--font-ui);
                    font-size: 0.86rem;
                    letter-spacing: 0.03em;
                    line-height: 1.45;
                }
                .preview-canvas {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                @media (max-width: 900px) {
                    .start-overlay {
                        padding: 100px 12px 0 0;
                    }
                    .start-btn,
                    .size-control,
                    .refresh-stack-btn,
                    .feed-control-panel,
                    .filter-control-panel,
                    .hand-feedback-panel {
                        width: min(92vw, 284px);
                    }
                    .left-story-panel {
                        display: none;
                    }
                    .hand-feedback-floating {
                        top: 100px;
                        left: 12px;
                    }
                }

                /* LIGHT MODE OVERRIDES - BRIGHT WHITE THEME */
                [data-theme="light"] .start-btn, 
                [data-theme="light"] .size-control,
                [data-theme="light"] .feed-control-panel,
                [data-theme="light"] .filter-control-panel,
                [data-theme="light"] .hand-feedback-panel,
                [data-theme="light"] .refresh-stack-btn {
                    background: #ffffff !important;
                    border: 1px solid #000000 !important;
                    color: #000000 !important;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                }

                /* Force ALL text inside these controls to be black */
                [data-theme="light"] .activation-stack * {
                    color: #000000;
                }

                [data-theme="light"] .size-control-header,
                [data-theme="light"] .photo-story-live-header,
                [data-theme="light"] .size-control-scale span,
                [data-theme="light"] .sensitivity-note {
                    color: #000000 !important;
                    font-weight: 600;
                    opacity: 1;
                }

                [data-theme="light"] .size-control-value,
                [data-theme="light"] .hand-feedback-status {
                    color: #000000 !important;
                    font-weight: 700;
                }

                /* High Contrast Hover States */
                [data-theme="light"] .start-btn:hover,
                [data-theme="light"] .refresh-stack-btn:hover {
                    background: #000000 !important;
                    border-color: #000000 !important;
                    color: #ffffff !important;
                    box-shadow: 0 6px 16px rgba(0,0,0,0.2) !important;
                }
                /* IMPORTANT: When button is hovered, ensure children (text) turn white */
                [data-theme="light"] .start-btn:hover *,
                [data-theme="light"] .refresh-stack-btn:hover * {
                    color: #ffffff !important;
                }

                /* Sliders */
                [data-theme="light"] .size-slider-segment {
                    background: rgba(0, 0, 0, 0.2) !important;
                }
                [data-theme="light"] .size-slider-knob {
                    background: #000000 !important;
                    border: 2px solid #ffffff !important;
                    color: #ffffff !important;
                    box-shadow: 0 0 0 1px #000000 !important;
                }
                
                /* EXPLICITLY FORCE SLIDER TEXT WHITE (Override blanket black rule) */
                [data-theme="light"] .size-slider-knob-label {
                    color: #ffffff !important;
                    font-weight: 700;
                    /* opacity handled by interaction classes */
                }

                /* Mode Buttons */
                [data-theme="light"] .mode-btn {
                    background: #ffffff !important;
                    border: 1px solid #000000 !important;
                    color: #000000 !important;
                }
                [data-theme="light"] .mode-btn:hover {
                    background: #000000 !important;
                    color: #ffffff !important;
                }
                [data-theme="light"] .mode-btn.active {
                    background: #000000 !important;
                    color: #ffffff !important;
                    border-color: #000000 !important;
                    font-weight: 700;
                }

                /* Category Buttons (Specific Colors - High Contrast) */
                [data-theme="light"] .category-btn.art.active {
                    background: #0000ff !important; /* Pure Blue */
                    color: #ffffff !important;
                    border-color: #0000ff !important;
                }
                [data-theme="light"] .category-btn.commercial.active {
                    background: #ff6b00 !important; /* Deep Orange */
                    color: #ffffff !important;
                    border-color: #ff6b00 !important;
                }

                /* Left Story Panel */
                [data-theme="light"]  .left-story-shell {
                    background: rgba(255, 255, 255, 0.9);
                    border: 1px solid rgba(0, 0, 0, 0.1);
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
                }
                [data-theme="light"] .left-story-title-row {
                    color: #000000;
                    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
                }
                [data-theme="light"] .left-story-body-label {
                    color: rgba(0, 0, 0, 0.6);
                }
                [data-theme="light"] .left-story-copy {
                    color: #333333;
                }

                /* Scroll Hint */
                [data-theme="light"] .scroll-hint {
                    color: #000000;
                }
            `}</style>


            {/* INTRO SEQUENCE */}
            {introVisible && (
                <IntroSequence
                    onPhysicsStart={() => {
                        setIntroComplete(true);
                    }}
                    onSequenceEnd={() => {
                        setIntroVisible(false);
                    }}
                />
            )}

            {/* CARD STACKER */}
            <CardStacker
                images={images}
                anchorX={anchorX}
                anchorY={anchorY}
                cardWidth={cardWidth}
                active={introComplete}
                stack={stack}
                lastAction={lastAction}
                containerRef={containerRef}
            />

            {/* SCROLL HINT */}
            <AnimatePresence>
                {introComplete && !hintDismissed && (
                    <motion.div
                        className="scroll-hint"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1, transition: { delay: 1.0, duration: 1.0 } }}
                        exit={{ opacity: 0 }}
                    >
                        SCROLL DOWN
                    </motion.div>
                )}
            </AnimatePresence>

            {/* POST-INTRO CTA (Experience Module) 
                ALWAYS MOUNTED (to register window.triggerAudio) 
                but visual state controlled by experienceStarted
            */}
            <ExperienceModule
                autoStart={experienceStarted}
                src={audioSrc}
                captions={captions}
            />
        </>
    );
};

export default LandingOrchestrator;
