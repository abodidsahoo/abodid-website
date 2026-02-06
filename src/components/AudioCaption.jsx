import React, { useState, useEffect, useRef } from 'react';

const AudioCaption = ({ captions }) => {
    const [activeIndex, setActiveIndex] = useState(-1);
    const [displayedText, setDisplayedText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isAudioPlaying, setIsAudioPlaying] = useState(false);
    const lastIndexRef = useRef(-1);
    const audioRefCache = useRef(null);

    // Find active caption based on audio time
    const findActiveCaption = (currentTime) => {
        return captions.findIndex(
            (cap) => currentTime >= cap.start && currentTime < cap.end
        );
    };

    // Get audio element from AudioControl
    const getAudioElement = () => {
        if (audioRefCache.current) return audioRefCache.current;

        // AudioControl exposes the audio element as window.landingAudio
        if (typeof window !== 'undefined' && window.landingAudio) {
            audioRefCache.current = window.landingAudio;
            return audioRefCache.current;
        }
        return null;
    };

    useEffect(() => {
        let animationFrameId;

        const updateCaption = () => {
            const audioElement = getAudioElement();

            if (audioElement && !audioElement.paused) {
                setIsAudioPlaying(true);
                const currentTime = audioElement.currentTime;
                const newIndex = findActiveCaption(currentTime);

                // Only update if index changed
                if (newIndex !== lastIndexRef.current) {
                    setActiveIndex(newIndex);
                    lastIndexRef.current = newIndex;

                    // Reset typewriter for new line
                    if (newIndex >= 0) {
                        setDisplayedText('');
                        setIsTyping(true);
                    }
                }
            } else {
                setIsAudioPlaying(false);
            }

            animationFrameId = requestAnimationFrame(updateCaption);
        };

        animationFrameId = requestAnimationFrame(updateCaption);

        return () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        };
    }, [captions]);

    // Typewriter effect for current line
    useEffect(() => {
        if (!isTyping || activeIndex < 0) return;

        const currentText = captions[activeIndex]?.text || '';
        let charIndex = 0;

        const typeInterval = setInterval(() => {
            if (charIndex <= currentText.length) {
                setDisplayedText(currentText.slice(0, charIndex));
                charIndex++;
            } else {
                setIsTyping(false);
                clearInterval(typeInterval);
            }
        }, 20); // 20ms per character for subtle typewriter

        return () => clearInterval(typeInterval);
    }, [activeIndex, isTyping, captions]);

    // Get prev/current/next text
    const prevText = activeIndex > 0 ? captions[activeIndex - 1]?.text : '';
    const currentText = activeIndex >= 0 ? displayedText : '';
    const nextText = activeIndex >= 0 && activeIndex < captions.length - 1
        ? captions[activeIndex + 1]?.text
        : '';

    // Always render the container to avoid hydration errors
    // But only show content when audio is playing and we have an active caption
    const shouldShowCaptions = isAudioPlaying && activeIndex >= 0;

    return (
        <div className="caption-overlay" style={{ opacity: shouldShowCaptions ? 1 : 0, transition: 'opacity 0.3s ease' }}>
            <div className="caption-window">
                <div className="caption-line caption-prev">{prevText}</div>
                <div className="caption-line caption-current">{currentText}</div>
                <div className="caption-line caption-next">{nextText}</div>
            </div>

            <style>{`
                .caption-overlay {
                    position: fixed;
                    top: 240px; /* Adjusted to be below new AudioControl pos */
                    right: 4vw; /* Moved to Right */
                    z-index: 1000;
                    pointer-events: none;
                    max-width: 500px;
                }

                .caption-window {
                    display: flex;
                    flex-direction: column;
                    gap: 0.35rem;
                    align-items: flex-end; /* Right align container */
                }

                .caption-line {
                    font-family: 'Inconsolata', 'Space Mono', monospace;
                    font-size: 0.9rem; /* Increased font size as requested */
                    font-weight: 300;
                    line-height: 1.5;
                    letter-spacing: 0.02em;
                    transition: opacity 0.3s ease, transform 0.3s ease;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                    text-align: right; /* Right align text */
                    font-variant: small-caps;
                }

                .caption-prev {
                    opacity: 0.35;
                    color: rgba(255, 255, 255, 0.6);
                    font-size: 0.75rem; /* Proportionally larger */
                    transform: translateY(0);
                }

                .caption-current {
                    opacity: 1;
                    color: rgba(255, 255, 255, 1);
                    font-weight: 400;
                    text-shadow: 0 0 12px rgba(255, 255, 255, 0.4);
                    font-size: 0.9rem;
                }

                .caption-next {
                    opacity: 0.35;
                    color: rgba(255, 255, 255, 0.6);
                    font-size: 0.75rem; /* Proportionally larger */
                    transform: translateY(0);
                }

                /* Hide on mobile */
                @media (max-width: 768px) {
                    .caption-overlay {
                        display: none;
                    }
                }
            `}</style>
        </div>
    );
};

export default AudioCaption;
