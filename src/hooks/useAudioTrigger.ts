import { useEffect, useRef, useState } from 'react';

export type AudioTriggerState =
    | 'idle'
    | 'requesting_microphone'
    | 'listening'
    | 'sound_detected'
    | 'error';

interface UseAudioTriggerProps {
    onTrigger?: (intensity: number) => void;
    threshold?: number;
    cooldownMs?: number;
    isActive?: boolean;
}

const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

export const useAudioTrigger = ({
    onTrigger,
    threshold = 0.1,
    cooldownMs = 220,
    isActive = true,
}: UseAudioTriggerProps) => {
    const [audioState, setAudioState] = useState<AudioTriggerState>('idle');
    const [inputLevel, setInputLevel] = useState(0);
    const [errorMessage, setErrorMessage] = useState('');

    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const frameRef = useRef<number>(0);
    const nextTriggerAtRef = useRef(0);
    const baselineRef = useRef(0);
    const lastLevelEmitRef = useRef(0);
    const statusTimeoutRef = useRef<number>(0);

    useEffect(() => {
        nextTriggerAtRef.current = 0;
        baselineRef.current = 0;
    }, [threshold, cooldownMs]);

    useEffect(() => {
        if (!isActive || typeof window === 'undefined') {
            if (frameRef.current) {
                window.cancelAnimationFrame(frameRef.current);
                frameRef.current = 0;
            }
            if (statusTimeoutRef.current) {
                window.clearTimeout(statusTimeoutRef.current);
                statusTimeoutRef.current = 0;
            }
            sourceRef.current?.disconnect();
            sourceRef.current = null;
            analyserRef.current?.disconnect();
            analyserRef.current = null;
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
                streamRef.current = null;
            }
            if (audioContextRef.current) {
                void audioContextRef.current.close();
                audioContextRef.current = null;
            }
            setInputLevel(0);
            setErrorMessage('');
            setAudioState('idle');
            return undefined;
        }

        let cancelled = false;

        const cleanup = () => {
            if (frameRef.current) {
                window.cancelAnimationFrame(frameRef.current);
                frameRef.current = 0;
            }
            if (statusTimeoutRef.current) {
                window.clearTimeout(statusTimeoutRef.current);
                statusTimeoutRef.current = 0;
            }
            sourceRef.current?.disconnect();
            sourceRef.current = null;
            analyserRef.current?.disconnect();
            analyserRef.current = null;
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
                streamRef.current = null;
            }
            if (audioContextRef.current) {
                void audioContextRef.current.close();
                audioContextRef.current = null;
            }
        };

        const initializeAudioTrigger = async () => {
            try {
                setErrorMessage('');
                setAudioState('requesting_microphone');

                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    },
                });

                if (cancelled) {
                    stream.getTracks().forEach((track) => track.stop());
                    return;
                }

                const AudioContextCtor =
                    window.AudioContext ||
                    (
                        window as Window & typeof globalThis & {
                            webkitAudioContext?: typeof AudioContext;
                        }
                    ).webkitAudioContext;

                if (!AudioContextCtor) {
                    throw new Error('This browser does not support Web Audio.');
                }

                const audioContext = new AudioContextCtor();
                if (audioContext.state === 'suspended') {
                    await audioContext.resume();
                }

                const analyser = audioContext.createAnalyser();
                analyser.fftSize = 1024;
                analyser.smoothingTimeConstant = 0.16;

                const source = audioContext.createMediaStreamSource(stream);
                source.connect(analyser);

                audioContextRef.current = audioContext;
                analyserRef.current = analyser;
                sourceRef.current = source;
                streamRef.current = stream;
                baselineRef.current = 0;
                nextTriggerAtRef.current = 0;
                setAudioState('listening');

                const buffer = new Uint8Array(analyser.fftSize);

                const tick = () => {
                    frameRef.current = 0;
                    if (cancelled || !analyserRef.current) return;

                    analyserRef.current.getByteTimeDomainData(buffer);

                    let sumSquares = 0;
                    let peak = 0;
                    for (let index = 0; index < buffer.length; index += 1) {
                        const sample = (buffer[index] - 128) / 128;
                        const magnitude = Math.abs(sample);
                        sumSquares += sample * sample;
                        if (magnitude > peak) peak = magnitude;
                    }

                    const rms = Math.sqrt(sumSquares / buffer.length);
                    const amplitude = clamp((rms * 3.6) + (peak * 0.28), 0, 1.6);
                    const currentBaseline = baselineRef.current > 0
                        ? baselineRef.current
                        : Math.max(amplitude * 0.85, 0.008);
                    const baselineEase = amplitude > currentBaseline ? 0.018 : 0.12;
                    const nextBaseline =
                        currentBaseline + ((amplitude - currentBaseline) * baselineEase);
                    baselineRef.current = nextBaseline;

                    const dynamicLevel = Math.max(0, amplitude - (nextBaseline * 0.92));
                    const triggerLevel = clamp(
                        dynamicLevel / Math.max(threshold, 0.008),
                        0,
                        2.6,
                    );
                    const visualLevel = clamp(
                        (amplitude - (nextBaseline * 0.5)) / 0.24,
                        0,
                        1,
                    );
                    const now = window.performance.now();

                    if (now - lastLevelEmitRef.current > 32) {
                        setInputLevel(visualLevel);
                        lastLevelEmitRef.current = now;
                    }

                    if (
                        triggerLevel >= 1 &&
                        now >= nextTriggerAtRef.current
                    ) {
                        const intensity = clamp(
                            (triggerLevel - 0.82) / 1.12,
                            0.14,
                            1,
                        );
                        const triggerInterval = clamp(
                            cooldownMs * (1.02 - (intensity * 0.72)),
                            88,
                            cooldownMs,
                        );
                        nextTriggerAtRef.current = now + triggerInterval;
                        try {
                            onTrigger?.(intensity);
                        } catch (error) {
                            console.error('Audio trigger callback failed:', error);
                        }
                        setAudioState('sound_detected');
                        if (statusTimeoutRef.current) {
                            window.clearTimeout(statusTimeoutRef.current);
                        }
                        statusTimeoutRef.current = window.setTimeout(() => {
                            if (!cancelled) {
                                setAudioState('listening');
                            }
                        }, 140);
                    }

                    frameRef.current = window.requestAnimationFrame(tick);
                };

                frameRef.current = window.requestAnimationFrame(tick);
            } catch (error) {
                console.error('Audio trigger initialization failed:', error);
                if (cancelled) return;
                const message =
                    error instanceof Error
                        ? error.message
                        : 'Microphone access was not available.';
                setErrorMessage(message);
                setAudioState('error');
            }
        };

        void initializeAudioTrigger();

        return () => {
            cancelled = true;
            cleanup();
        };
    }, [cooldownMs, isActive, onTrigger, threshold]);

    return {
        audioState,
        inputLevel,
        errorMessage,
        isListening:
            audioState === 'listening' || audioState === 'sound_detected',
    };
};
