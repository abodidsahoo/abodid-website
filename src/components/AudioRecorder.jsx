import React, { useState, useRef, useEffect } from 'react';

const AudioRecorder = ({ onRecordingComplete, onTranscript, onTranscriptionState }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [isCountdown, setIsCountdown] = useState(false);
    const [countdownVal, setCountdownVal] = useState(3);
    const [audioBlob, setAudioBlob] = useState(null);
    const [duration, setDuration] = useState(0);
    const [mimeType, setMimeType] = useState('audio/webm');
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [transcriptionSupported, setTranscriptionSupported] = useState(false);

    // Playback State
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentAudio, setCurrentAudio] = useState(null);

    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);
    const recognitionRef = useRef(null);
    const finalTranscriptRef = useRef('');
    const allowRestartRef = useRef(false);
    const isRecordingRef = useRef(false);
    const recognitionActiveRef = useRef(false);
    const onTranscriptRef = useRef(onTranscript);
    const onTranscriptionStateRef = useRef(onTranscriptionState);
    const audioContextRef = useRef(null);
    const sourceRef = useRef(null);
    const analyserRef = useRef(null);
    const canvasRef = useRef(null);
    const animationFrameRef = useRef(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            if (audioContextRef.current) audioContextRef.current.close().catch(e => console.error(e));
            if (timerRef.current) clearInterval(timerRef.current);
            if (currentAudio) { currentAudio.pause(); }
            if (recognitionRef.current) {
                try { recognitionRef.current.stop(); } catch { }
            }
        };
    }, []);

    useEffect(() => {
        isRecordingRef.current = isRecording;
    }, [isRecording]);

    useEffect(() => {
        onTranscriptRef.current = onTranscript;
    }, [onTranscript]);

    useEffect(() => {
        onTranscriptionStateRef.current = onTranscriptionState;
    }, [onTranscriptionState]);

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        const recognition = new SpeechRecognition();
        recognition.lang = navigator.language || 'en-US';
        recognition.interimResults = true;
        recognition.continuous = true;

        recognition.onresult = (event) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0]?.transcript || '';
                if (event.results[i].isFinal) {
                    finalTranscriptRef.current += transcript + ' ';
                } else {
                    interim += transcript;
                }
            }

            const combined = `${finalTranscriptRef.current}${interim}`.trim();
            if (onTranscriptRef.current) onTranscriptRef.current(combined, { isFinal: false });
        };

        recognition.onerror = () => {
            recognitionActiveRef.current = false;
            setIsTranscribing(false);
            if (onTranscriptionStateRef.current) onTranscriptionStateRef.current('error');
        };

        recognition.onend = () => {
            recognitionActiveRef.current = false;
            setIsTranscribing(false);
            if (onTranscriptionStateRef.current) onTranscriptionStateRef.current('end');
            if (allowRestartRef.current && isRecordingRef.current) {
                setTimeout(() => {
                    try {
                        recognition.start();
                        recognitionActiveRef.current = true;
                        setIsTranscribing(true);
                        if (onTranscriptionStateRef.current) onTranscriptionStateRef.current('listening');
                    } catch { }
                }, 300);
            }
        };

        recognitionRef.current = recognition;
        setTranscriptionSupported(true);
    }, []);

    const startTranscription = () => {
        if (!recognitionRef.current) return;
        finalTranscriptRef.current = '';
        allowRestartRef.current = true;
        try {
            recognitionRef.current.start();
            recognitionActiveRef.current = true;
            setIsTranscribing(true);
            if (onTranscriptionStateRef.current) onTranscriptionStateRef.current('listening');
        } catch { }
    };

    const stopTranscription = () => {
        allowRestartRef.current = false;
        if (!recognitionRef.current || !recognitionActiveRef.current) return;
        try {
            recognitionRef.current.stop();
        } catch { }
        recognitionActiveRef.current = false;
        setIsTranscribing(false);
        if (onTranscriptRef.current) {
            const finalText = finalTranscriptRef.current.trim();
            if (finalText) onTranscriptRef.current(finalText, { isFinal: true });
        }
        if (onTranscriptionStateRef.current) onTranscriptionStateRef.current('stop');
    };

    const ensureAudioContext = async () => {
        if (!audioContextRef.current) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioContextRef.current = new AudioContext();
        }
        if (audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
        }
        return audioContextRef.current;
    };

    const startCountdown = async () => {
        await ensureAudioContext();
        setIsCountdown(true);
        setCountdownVal(3);
        let count = 3;
        const interval = setInterval(() => {
            count--;
            if (count > 0) {
                setCountdownVal(count);
            } else {
                clearInterval(interval);
                setIsCountdown(false);
                startActualRecording();
            }
        }, 1000);
    };

    const startActualRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const ctx = await ensureAudioContext();

            // 1. Setup MediaRecorder
            const type = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
            setMimeType(type);
            mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: type });

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(chunksRef.current, { type });
                setAudioBlob(blob);
                onRecordingComplete(blob, duration, type);
                chunksRef.current = [];
                stopTranscription();

                // Cleanup Visualizer
                if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
                if (sourceRef.current) sourceRef.current.disconnect();

                // Stop Stream
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            setDuration(0);
            if (transcriptionSupported) startTranscription();

            // 2. Setup Audio Visualizer
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 64; // Smaller FFT size for thicker bars
            const source = ctx.createMediaStreamSource(stream);
            source.connect(analyser);
            sourceRef.current = source;
            analyserRef.current = analyser;

            visualize();

            // 3. Timer
            timerRef.current = setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);

        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("Could not access microphone: " + err.message);
            setIsCountdown(false);
        }
    };

    const visualize = () => {
        if (!analyserRef.current || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            animationFrameRef.current = requestAnimationFrame(draw);
            analyserRef.current.getByteFrequencyData(dataArray);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Explicit dark background for contrast
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const barWidth = (canvas.width / bufferLength) * 2;
            let barHeight;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                // Boost signal
                barHeight = (dataArray[i] / 255) * canvas.height * 2.0;

                // Clean white bars
                ctx.fillStyle = `#fff`;
                ctx.fillRect(x, (canvas.height - barHeight) / 2, barWidth - 2, barHeight); // Vertically centered

                x += barWidth;
            }
        };
        draw();
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            clearInterval(timerRef.current);
            stopTranscription();
        }
    };

    const reset = () => {
        setAudioBlob(null);
        setDuration(0);
        if (currentAudio) {
            currentAudio.pause();
            setCurrentAudio(null);
        }
        setIsPlaying(false);
        finalTranscriptRef.current = '';
        stopTranscription();
        onRecordingComplete(null, 0, null);
    };

    const formatTime = (secs) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    // Toggle Play/Pause Logic
    const togglePlayback = () => {
        if (!audioBlob) return;

        if (isPlaying && currentAudio) {
            currentAudio.pause();
            setIsPlaying(false);
            return;
        }

        // If we have an audio object but it's paused effectively (or we want to restart?)
        // Let's simpler logic: always new or resume? 
        // For simplicity: Create new if null, or play current.

        if (currentAudio) {
            currentAudio.play();
            setIsPlaying(true);
        } else {
            const url = URL.createObjectURL(audioBlob);
            const audio = new Audio(url);
            audio.onended = () => setIsPlaying(false);
            audio.play().catch(e => console.error(e));
            setCurrentAudio(audio);
            setIsPlaying(true);
        }
    };

    return (
        <div style={{ width: '100%', marginBottom: '20px', textAlign: 'center' }}>

            {/* 1. INITIAL STATE */}
            {!isRecording && !isCountdown && !audioBlob && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#666', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                        OR RECORD YOUR VOICE
                    </div>
                    <button
                        type="button"
                        onClick={startCountdown}
                        style={{
                            padding: '16px 32px',
                            borderRadius: '50px',
                            border: '1px solid rgba(255,255,255,0.2)',
                            background: 'rgba(255,255,255,0.05)',
                            color: '#ddd',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '12px',
                            fontSize: '15px',
                            transition: 'all 0.2s'
                        }}
                        className="hover-btn"
                    >
                        <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ff4444' }}></span>
                        CLICK TO RECORD
                    </button>
                    <span style={{ fontSize: '11px', color: '#666' }}>(Starts in 3 seconds)</span>
                </div>
            )}

            {/* 2. COUNTDOWN OVERLAY */}
            {isCountdown && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    fontSize: '76px',
                    fontWeight: 900,
                    color: '#fff',
                    animation: 'pulse 0.5s infinite alternate'
                }}>
                    <span className="blink-dot" style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ff4444' }}></span>
                    {countdownVal}
                </div>
            )}

            {/* 3. RECORDING STATE */}
            {isRecording && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                        color: '#ff4444', fontWeight: 600, fontSize: '14px',
                        display: 'flex', alignItems: 'center', gap: '8px'
                    }}>
                        <span className="blink-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff4444' }}></span>
                        Rec: {formatTime(duration)}
                    </div>

                    <button
                        type="button"
                        onClick={stopRecording}
                        className="hover-btn"
                        style={{
                            padding: '12px 32px',
                            background: '#ff4444',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '50px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 600,
                            letterSpacing: '0.05em'
                        }}
                    >
                        STOP RECORDING
                    </button>
                    {transcriptionSupported && (
                        <div style={{ fontSize: '11px', color: isTranscribing ? '#00ff66' : '#666', letterSpacing: '0.08em' }}>
                            {isTranscribing ? 'LIVE TRANSCRIPTION' : 'TRANSCRIPTION READY'}
                        </div>
                    )}
                </div>
            )}

            {/* 4. PREVIEW STATE */}
            {audioBlob && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                    <div style={{
                        padding: '6px 10px',
                        background: 'rgba(0,255,102,0.15)',
                        border: '1px solid rgba(0,255,102,0.5)',
                        color: '#00ff66',
                        borderRadius: '999px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '14px',
                        fontSize: '10px',
                        letterSpacing: '0.1em',
                        fontWeight: 600
                    }}>
                        <span style={{
                            width: '14px',
                            height: '14px',
                            borderRadius: '50%',
                            background: '#00ff66',
                            color: '#000',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '10px',
                            fontWeight: 900
                        }}>✓</span>
                        RECORDING CAPTURED
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            type="button"
                            onClick={togglePlayback}
                            className="hover-btn"
                            style={{
                                padding: '10px 24px',
                                background: '#fff',
                                color: '#000',
                                border: 'none',
                                borderRadius: '100px',
                                cursor: 'pointer',
                                fontSize: '11px',
                                fontWeight: 700,
                                letterSpacing: '0.1em',
                                display: 'flex', alignItems: 'center', gap: '8px',
                                minWidth: '100px', justifyContent: 'center'
                            }}
                        >
                            {isPlaying ? (
                                <>
                                    <span style={{ width: '8px', height: '8px', background: '#000', display: 'inline-block' }}></span>
                                    PAUSE
                                </>
                            ) : (
                                <>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                                    PLAY
                                </>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={reset}
                            style={{
                                padding: '10px 24px',
                                background: 'transparent',
                                color: '#aaa',
                                border: '1px solid rgba(255,255,255,0.2)',
                                borderRadius: '100px',
                                cursor: 'pointer',
                                fontSize: '11px',
                                fontWeight: 600,
                                letterSpacing: '0.1em'
                            }}
                        >
                            REDO
                        </button>
                    </div>
                </div>
            )}


            <style>{`
                @keyframes pulse { from { opacity: 0.6; transform: scale(0.95); } to { opacity: 1; transform: scale(1.05); } }
                .blink-dot { animation: pulse 1s infinite alternate; }
            `}</style>
        </div >
    );
};

export default AudioRecorder;
