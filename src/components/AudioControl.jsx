import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const AudioControl = ({ src }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef(null);
    const [hasInteracted, setHasInteracted] = useState(false);

    useEffect(() => {
        // Initialize Audio
        const audio = new Audio(src);
        audio.loop = true;
        audio.volume = 0.5;
        audioRef.current = audio;

        // Expose global trigger for EntryScreen to call synchronously
        window.triggerAudio = () => {
            if (!audio) return;
            audio.play()
                .then(() => {
                    setIsPlaying(true);
                    setHasInteracted(true);
                })
                .catch(err => {
                    console.error("Audio Auto-Play blocked:", err);
                    // If blocked, we just stay in "OFF" state until user clicks manually
                });
        };

        return () => {
            delete window.triggerAudio;
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, [src]);

    const togglePlay = () => {
        if (!audioRef.current) return;

        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play().catch(e => console.error("Play failed:", e));
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
                        /* User requested: "triangle with a bit of rounded corners" */
                        <svg width="11" height="14" viewBox="0 0 11 14" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginLeft: '2px' }}>
                            <path d="M10.1519 6.1368C10.8206 6.52123 10.8206 7.47877 10.1519 7.8632L1.50424 12.8344C0.838568 13.2171 0 12.7371 0 11.9712L0 2.02879C0 1.26292 0.838568 0.782937 1.50424 1.1656L10.1519 6.1368Z" fill="white" />
                        </svg>
                    )}
                </div>
                <span className="label-text">
                    {isPlaying ? "PAUSE" : "PLAY"}
                </span>
            </button>

            <style>{`
                .audio-control-wrapper {
                    position: fixed;
                    /* Top Left as requested, just below header area typically */
                    top: 100px; 
                    left: 4vw;
                    z-index: 800;
                    display: flex;
                    align-items: center;
                }

                .audio-btn {
                    background: none;
                    border: none;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    cursor: pointer;
                    padding: 4px;
                    opacity: 0.7;
                    transition: opacity 0.3s;
                }

                .audio-btn:hover {
                    opacity: 1;
                }

                .icon-circle {
                    width: 36px;
                    height: 36px;
                    border: 1px solid rgba(255,255,255,0.4);
                    border-radius: 50%;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    position: relative;
                }

                .label-text {
                    font-family: 'Space Mono', monospace;
                    font-size: 0.75rem;
                    color: white;
                    letter-spacing: 0.05em;
                }
            `}</style>
        </motion.div>
    );
};

export default AudioControl;
