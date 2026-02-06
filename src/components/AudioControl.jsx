import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const AudioControl = ({ src }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef(null);
    const [hasInteracted, setHasInteracted] = useState(false);
    const audioContextRef = useRef(null);
    const gainNodeRef = useRef(null); // For volume control in Web Audio graph
    const isPlayingRef = useRef(isPlaying);

    // Keep isPlayingRef in sync with isPlaying state
    useEffect(() => {
        isPlayingRef.current = isPlaying;
    }, [isPlaying]);

    useEffect(() => {
        // Initialize Audio
        const audio = new Audio(src);
        audio.crossOrigin = "anonymous"; // Required for Web Audio API
        audio.loop = true;
        audio.volume = 1.0; // Max volume, controlled via GainNode
        audioRef.current = audio;

        // Create Web Audio API context for Safari-compatible volume control
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        audioContextRef.current = audioContext;

        // Create audio source from the audio element
        const source = audioContext.createMediaElementSource(audio);

        // Create GainNode for volume control (required for Safari with Web Audio API)
        const gainNode = audioContext.createGain();
        gainNode.gain.setValueAtTime(1.0, audioContext.currentTime); // Start at full volume
        gainNodeRef.current = gainNode;

        // Simple audio graph: Audio → GainNode → Speakers
        source.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Expose audio element and gainNode globally
        window.landingAudio = audio;
        window.landingAudioGain = gainNode; // For volume control in Safari

        // Expose global trigger for EntryScreen to call synchronously
        window.triggerAudio = () => {
            if (!isPlayingRef.current) {
                // Resume audio context (required by Safari and other browsers)
                // Safari is particularly strict about this
                if (audioContext.state === 'suspended') {
                    audioContext.resume().catch(err => {
                        console.error('Failed to resume AudioContext:', err);
                    });
                }

                // First time play
                audio.play()
                    .then(() => {
                        setIsPlaying(true);
                        isPlayingRef.current = true; // Update ref immediately
                        setHasInteracted(true);
                    })
                    .catch((err) => {
                        console.error("Audio Auto-Play blocked:", err);
                        // If blocked, we just stay in "OFF" state until user clicks manually
                    });
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

            // Clean up Web Audio API
            if (gainNodeRef.current) {
                gainNodeRef.current.disconnect();
                gainNodeRef.current = null;
            }
            if (audioContextRef.current) {
                audioContextRef.current.close();
                audioContextRef.current = null;
            }
        };
    }, [src]);

    const togglePlay = () => {
        if (!audioRef.current || !audioContextRef.current) return;

        // CRITICAL for Safari: Resume AudioContext on EVERY user interaction
        // Safari suspends AudioContext aggressively and needs explicit resume
        if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume().then(() => {
                console.log('AudioContext resumed for Safari');
            }).catch(err => {
                console.error('Failed to resume AudioContext:', err);
            });
        }

        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play()
                .then(() => {
                    setHasInteracted(true);
                })
                .catch((err) => {
                    console.error("Audio playback error:", err);
                });
        }
        setIsPlaying(!isPlaying);
    };

    return (
        <motion.div
            className="audio-control-wrapper"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 1 }}
        >
            <div className="experience-wrapper">
                <h2 className="experience-title">ENTER THE EXPERIENCE</h2>

                <button className="audio-btn" onClick={togglePlay} aria-label={isPlaying ? "Mute Audio" : "Play Audio"}>
                    <div className="icon-circle">
                        {isPlaying ? (
                            /* Pause Icon: Two Thin Lines */
                            <svg width="10" height="12" viewBox="0 0 10 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect x="0" width="3" height="12" fill="white" />
                                <rect x="7" width="3" height="12" fill="white" />
                            </svg>
                        ) : (
                            /* Play Icon: Rounded Triangle */
                            <svg width="11" height="14" viewBox="0 0 11 14" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginLeft: '2px' }}>
                                <path d="M10.1519 6.1368C10.8206 6.52123 10.8206 7.47877 10.1519 7.8632L1.50424 12.8344C0.838568 13.2171 0 12.7371 0 11.9712L0 2.02879C0 1.26292 0.838568 0.782937 1.50424 1.1656L10.1519 6.1368Z" fill="white" />
                            </svg>
                        )}
                    </div>
                </button>

                {/* Hint text with slow reveal animation */}
                <AnimatePresence>
                    {!hasInteracted ? (
                        <motion.span
                            className="audio-hint"
                            initial={{ opacity: 0, filter: 'blur(4px)' }}
                            animate={{ opacity: 1, filter: 'blur(0px)' }}
                            exit={{ opacity: 0 }}
                            transition={{ delay: 2.5, duration: 2, ease: 'easeOut' }}
                        >
                            Your hovers and scrolls are my paintbrushes.
                        </motion.span>
                    ) : (
                        <motion.span
                            className="audio-hint status-text"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.5 }}
                        >
                            {isPlaying ? "AUDIO ON" : "AUDIO PAUSED"}
                        </motion.span>
                    )}
                </AnimatePresence>
            </div>

            <style>{`
                .audio-control-wrapper {
                    position: fixed;
                    top: 100px; 
                    right: 4vw; /* Moved to Right */
                    z-index: 800;
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end; /* Right align content */
                }

                .experience-wrapper {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    gap: 1.5rem;
                }

                .experience-title {
                    font-family: 'Space Mono', monospace;
                    font-size: 1.5rem; /* Bigger size as requested */
                    font-weight: 700;
                    color: white;
                    margin: 0;
                    letter-spacing: 0.1em;
                    text-align: right;
                    opacity: 0.9;
                }

                .audio-btn {
                    background: none;
                    border: none;
                    display: flex;
                    align-items: center;
                    cursor: pointer;
                    padding: 0;
                    opacity: 0.7;
                    transition: opacity 0.3s;
                }

                .audio-btn:hover {
                    opacity: 1;
                }

                .icon-circle {
                    width: 42px; /* Slightly bigger */
                    height: 42px;
                    border: 1px solid rgba(255,255,255,0.4);
                    border-radius: 50%;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    position: relative;
                }

                .audio-hint {
                    font-family: 'Inconsolata', monospace;
                    font-size: 0.7rem; /* Slightly bigger than before (0.65) */
                    color: rgba(255, 255, 255, 0.6);
                    letter-spacing: 0.02em;
                    white-space: nowrap;
                    font-weight: 300;
                    text-align: right;
                }

                .status-text {
                    font-size: 0.6rem;
                    letter-spacing: 0.1em;
                    opacity: 0.4;
                    text-transform: uppercase;
                }

                /* Mobile/Tablet adjustment */
                @media (max-width: 1024px) {
                    .experience-title {
                        font-size: 1.2rem;
                    }
                    .audio-hint {
                        display: none;
                    }
                }
            `}</style>
        </motion.div>
    );
};

export default AudioControl;
