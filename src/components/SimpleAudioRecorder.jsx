import React, { useState, useRef, useEffect } from 'react';

const SimpleAudioRecorder = ({ onRecordingComplete }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [isCountdown, setIsCountdown] = useState(false);
    const [countdownVal, setCountdownVal] = useState(3);
    const [audioBlob, setAudioBlob] = useState(null);
    const [duration, setDuration] = useState(0);
    const [mimeType, setMimeType] = useState('audio/webm');

    // Playback State
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentAudio, setCurrentAudio] = useState(null);

    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);
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
        };
    }, []);

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

                // Cleanup Visualizer
                if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
                if (sourceRef.current) sourceRef.current.disconnect();

                // Stop Stream
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            setDuration(0);

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
                    fontSize: '60px',
                    fontWeight: 900,
                    color: '#fff',
                    animation: 'pulse 0.5s infinite alternate'
                }}>
                    {countdownVal}
                </div>
            )}

            {/* 3. RECORDING STATE */}
            {isRecording && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>

                    {/* VISUALIZER CANVAS - CLEARLY VISIBLE BOX */}
                    <div style={{
                        width: '240px', height: '60px',
                        background: '#000', // Explicit black background for high contrast
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '8px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden'
                    }}>
                        <canvas ref={canvasRef} width="240" height="60" />
                    </div>

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
                </div>
            )}

            {/* 4. PREVIEW STATE */}
            {audioBlob && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                    <div style={{
                        width: '100%', height: '32px',
                        background: 'rgba(255,255,255,0.1)',
                        marginBottom: '16px',
                        borderRadius: '4px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <span style={{ fontSize: '11px', color: '#fff', letterSpacing: '0.1em', fontWeight: 600 }}>RECORDING CAPTURED</span>
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

export default SimpleAudioRecorder;
