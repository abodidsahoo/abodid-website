import React, { useState, useRef, useEffect } from 'react';

const SimpleAudioRecorder = ({ onRecordingComplete }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState(null);
    const [duration, setDuration] = useState(0);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                setAudioBlob(blob);
                onRecordingComplete(blob, duration);
                chunksRef.current = [];
                stream.getTracks().forEach(track => track.stop()); // Stop mic
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            setDuration(0);

            timerRef.current = setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);

        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("Could not access microphone. Please allow permissions.");
        }
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
        onRecordingComplete(null, 0);
    };

    const formatTime = (secs) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
        <div style={{ width: '100%', marginBottom: '20px', textAlign: 'center' }}>
            {!isRecording && !audioBlob && (
                <button
                    type="button"
                    onClick={startRecording}
                    style={{
                        padding: '12px 24px',
                        borderRadius: '50px',
                        border: '1px solid rgba(255,255,255,0.2)',
                        background: 'rgba(255,255,255,0.05)',
                        color: '#ddd',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '14px',
                        transition: 'all 0.2s'
                    }}
                    className="hover-btn"
                >
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ff4444' }}></span>
                    Record Audio Response
                </button>
            )}

            {isRecording && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        color: '#ff4444', fontWeight: 600, fontSize: '14px',
                        display: 'flex', alignItems: 'center', gap: '8px'
                    }}>
                        <span className="blink-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff4444' }}></span>
                        Recording {formatTime(duration)}
                    </div>
                    <button
                        type="button"
                        onClick={stopRecording}
                        style={{
                            padding: '8px 24px',
                            background: '#ff4444',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '50px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 600
                        }}
                    >
                        Stop Recording
                    </button>
                </div>
            )}

            {audioBlob && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                    <div style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '13px', color: '#fff' }}>
                        Audio Recorded ({formatTime(duration)})
                    </div>
                    <button
                        type="button"
                        onClick={reset}
                        style={{
                            background: 'transparent',
                            color: '#888',
                            border: '1px solid #444',
                            padding: '6px 12px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '11px'
                        }}
                    >
                        Redo
                    </button>
                </div>
            )}
        </div>
    );
};

export default SimpleAudioRecorder;
