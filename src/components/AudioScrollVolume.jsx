import { useEffect, useRef } from 'react';

const AudioScrollVolume = () => {
    const currentVolumeRef = useRef(0.5); // Current actual volume
    const targetVolumeRef = useRef(0.5);  // Target volume based on scroll

    useEffect(() => {
        let rafId;
        const FADE_SPEED = 0.3; // Lower = slower fade (this gives ~3-4 second transitions)

        const updateVolume = () => {
            const audio = window.landingAudio;

            // Wait for audio to be fully initialized (important for Safari)
            if (!audio || !audio.src) {
                rafId = requestAnimationFrame(updateVolume);
                return;
            }

            // Log once when initialized (for Safari debugging)
            if (!updateVolume.initialized) {
                console.log('[Safari] Scroll volume control initialized');
                updateVolume.initialized = true;
            }

            // Calculate target volume based on scroll position
            const scrollY = window.scrollY;
            const windowHeight = window.innerHeight;

            const zone1End = windowHeight * 0.9;   // Photos area
            const zone2End = windowHeight * 1.5;   // Typewriter/bio area

            let scrollBasedVolume = 0.5;

            if (scrollY < zone1End) {
                scrollBasedVolume = 1.0;
            } else if (scrollY < zone2End) {
                const progress = (scrollY - zone1End) / (zone2End - zone1End);
                scrollBasedVolume = 1.0 - (progress * 0.6); // 1.0 → 0.4
            } else {
                const fadeStart = zone2End;
                const fadeDistance = windowHeight * 0.5;
                const progress = Math.min((scrollY - fadeStart) / fadeDistance, 1);
                scrollBasedVolume = 0.4 - (progress * 0.38); // 0.4 → 0.02 (2% minimum)
            }

            // Check if showreel is playing and audible
            const showreelVideo = document.getElementById('showreel-video');
            const isShowreelPlaying = showreelVideo && !showreelVideo.paused && !showreelVideo.muted;

            // Duck to 0 if showreel is playing, otherwise use scroll-based volume
            targetVolumeRef.current = isShowreelPlaying ? 0 : scrollBasedVolume;

            // Smoothly interpolate to target volume
            const diff = targetVolumeRef.current - currentVolumeRef.current;
            currentVolumeRef.current += diff * FADE_SPEED;

            // Snap to target when close enough
            if (Math.abs(diff) < 0.001) {
                currentVolumeRef.current = targetVolumeRef.current;
            }

            // Apply volume via GainNode (for Web Audio API / Safari)
            const newVolume = Math.max(0, Math.min(1.0, currentVolumeRef.current));

            if (window.landingAudioGain) {
                window.landingAudioGain.gain.setValueAtTime(
                    newVolume,
                    window.landingAudioGain.context.currentTime
                );
            }

            rafId = requestAnimationFrame(updateVolume);
        };

        // Start the volume control loop
        rafId = requestAnimationFrame(updateVolume);

        return () => {
            if (rafId) {
                cancelAnimationFrame(rafId);
            }
        };
    }, []);

    return null;
};

export default AudioScrollVolume;
