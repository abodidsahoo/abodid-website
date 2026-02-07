import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@supabase/supabase-js';

import AudioRecorder from './AudioRecorder';
import ConstellationGraph from './ConstellationGraph';
import SciFiImageReveal from './experiments/SciFiImageReveal';

// Helper for playback
const AudioPlayerButton = ({ url, label = "", small = false }) => {
    const [playing, setPlaying] = useState(false);
    const [audio, setAudio] = useState(null);

    useEffect(() => {
        const a = new Audio(url);
        a.onended = () => setPlaying(false);
        setAudio(a);
        return () => { a.pause(); };
    }, [url]);

    const toggle = () => {
        if (!audio) return;
        if (playing) {
            audio.pause();
            audio.currentTime = 0;
            setPlaying(false);
        } else {
            audio.play().catch(e => console.error("Playback error", e));
            setPlaying(true);
        }
    };

    return (
        <button
            onClick={toggle}
            style={{
                background: playing ? '#ff4444' : (small ? 'rgba(255,255,255,0.1)' : '#fff'),
                color: playing ? '#fff' : (small ? '#ccc' : '#000'),
                border: small ? '1px solid rgba(255,255,255,0.2)' : 'none',
                borderRadius: '50px',
                padding: small ? '4px 12px' : '8px 20px',
                cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                fontSize: small ? '11px' : '14px',
                fontWeight: 600,
                transition: 'all 0.2s'
            }}
        >
            {playing ? (
                <span style={{ width: '8px', height: '8px', background: 'currentColor', borderRadius: '1px' }}></span>
            ) : (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            )}
            {label && <span>{playing ? 'STOP' : label}</span>}
        </button>
    );
};

import { supabase } from '../lib/supabase';

// Fallback images if database empty
const FALLBACK_IMAGES = [
    "https://images.unsplash.com/photo-1518066000714-58f45f1a297d?q=80&w=800&auto=format&fit=crop", // Dark minimal architecture
    "https://images.unsplash.com/photo-1504386106331-1e24749f7e4a?q=80&w=800&auto=format&fit=crop", // Foggy forest
    "https://images.unsplash.com/photo-1498330177096-689e3fb901ca?q=80&w=800&auto=format&fit=crop", // Abstract light
    "https://images.unsplash.com/photo-1516663235285-845fac339ca7?q=80&w=800&auto=format&fit=crop", // Geometric shadows
    "https://images.unsplash.com/photo-1507608616759-54f48f0af0ee?q=80&w=800&auto=format&fit=crop", // Rain on glass
];

const MOCK_AI_DATA = {
    "default": {
        ai_keywords: ["Calculated Symmetry", "Optimal Contrast", "Structural Calm", "Inorganic Peace", "Low Entropy State"],
        trainability_score: 45,
        analysis: "The machine detects strong structural lines and low ambiguity, contrasting sharply with the chaotic emotional variance of the human feedback.",
        ai_feeling: "LOGIC STABILITY",
        model_used: "Gemini 1.5 Pro + GPT-4o Vision"
    },
    0: {
        ai_keywords: ["Fluid Coherence", "Spectral Peace", "Non-Rigid Flow", "Subsurface Glow", "Bioluminescent Calm"],
        trainability_score: 62,
        analysis: "Visual features suggest a state of flow. The machine registers a high probability of 'tranquility' based on spectral softness.",
        ai_feeling: "LIQUID HARMONY",
        model_used: "Gemini 1.5 Flash"
    },
    1: {
        ai_keywords: ["Decay Vectors", "Static Isolation", "Concrete Solitude", "Grid Rigidity", "Desaturated Melancholy"],
        trainability_score: 28,
        analysis: "The AI interprets the lack of color and rigid geometry as a state of abandonment. It detects structure, but no life signs.",
        ai_feeling: "STRUCTURAL MELANCHOLY",
        model_used: "GPT-4o Vision"
    },
    2: {
        ai_keywords: ["Recursive Joy", "High Entropy Delight", "Organic Loop", "Growth Algorithms", "Green Saturation"],
        trainability_score: 75,
        analysis: "The complex fractal patterns trigger a positive feedback loop in the pattern recognition layer. The machine describes this density as 'richness'.",
        ai_feeling: "FRACTAL EUPHORIA",
        model_used: "Gemini 1.5 Pro"
    },
    3: {
        ai_keywords: ["Undefined Variance", "Focus Null", "Emotional Projection", "Blur Gradient", "System Confusion"],
        trainability_score: 15,
        analysis: "Pure abstraction. The machine fails to find a focal point and flags this entry as 'emotionally volatile' due to lack of defined edges.",
        ai_feeling: "INPUT UNCERTAINTY",
        model_used: "Ensemble: Gemini + Claude 3"
    }
};

const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
    exit: { opacity: 0, y: -20, transition: { duration: 0.4, ease: "easeIn" } }
};

export default function PunctumGame() {
    const [step, setStep] = useState('intro'); // intro, select, input, viz, consensus, analysis
    const [images, setImages] = useState([]);
    const [selectedImage, setSelectedImage] = useState(null);
    const [userInput, setUserInput] = useState('');
    const [audioData, setAudioData] = useState({ blob: null, duration: 0 });
    const [comments, setComments] = useState([]);
    const [analysisResult, setAnalysisResult] = useState(null);
    const [keywords, setKeywords] = useState([]);
    const [consensusData, setConsensusData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState([]);

    const addLog = (message, type = 'info') => {
        setLogs(prev => [...prev, { timestamp: new Date(), message, type }]);
    };

    const [audioBlobUrl, setAudioBlobUrl] = useState(null);
    const [error, setError] = useState(null);
    const [aiReport, setAiReport] = useState(null);

    // Manage Blob URL lifecycle
    useEffect(() => {
        if (audioData.blob) {
            const url = URL.createObjectURL(audioData.blob);
            setAudioBlobUrl(url);
            return () => URL.revokeObjectURL(url);
        } else {
            setAudioBlobUrl(null);
        }
    }, [audioData.blob]);

    // Mouse Tracking for Glow Effect
    useEffect(() => {
        const handleMouseMove = (e) => {
            const glow = document.querySelector('.punctum-glow-bg');
            if (glow) {
                glow.style.setProperty('--mouse-x', `${e.clientX}px`);
                glow.style.setProperty('--mouse-y', `${e.clientY}px`);
            }
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    // 1. LOAD IMAGES
    useEffect(() => {
        const fetchImages = async (retryCount = 0) => {
            try {
                const res = await fetch("/api/punctum-images", { cache: "no-store" });
                if (!res.ok) throw new Error(`Status ${res.status}`);
                const data = await res.json();
                const validImages = Array.isArray(data) ? data : [];

                if (validImages.length === 0) throw new Error("No images found in API");

                const shuffled = validImages.sort(() => 0.5 - Math.random()).slice(0, 5);
                const mapped = shuffled.map((url, i) => ({
                    id: i,
                    url: typeof url === 'string' ? url : url.url
                }));
                // Reset fallback log if successful
                if (retryCount > 0) addLog(`[SYSTEM] Connection restored. Loaded ${mapped.length} images.`, 'success');

                setImages(mapped);
            } catch (err) {
                console.error("Failed to fetch images", err);

                if (retryCount < 2) {
                    addLog(`[SYSTEM] Connection failed (${err.message}). Retrying... (${retryCount + 1}/3)`, 'warning');
                    setTimeout(() => fetchImages(retryCount + 1), 2000);
                } else {
                    addLog(`[SYSTEM] Critical Failure: ${err.message}. Enabling Emergency Fallback Protocol.`, 'error');
                    setImages(FALLBACK_IMAGES.map((url, i) => ({ id: i, url })));
                }
            }
        };
        fetchImages();
    }, []);

    // 2. FETCH COMMENTS
    useEffect(() => {
        if (!selectedImage) return;
        const fetchComments = async () => {
            try {
                const { data, error } = await supabase
                    .from('photo_feedback')
                    .select('feeling_text, audio_url, created_at')
                    .eq('image_url', selectedImage.url)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                setComments(data && data.length > 0 ? data : []);
            } catch (err) {
                console.error(err);
                setComments([{ feeling_text: "Peaceful" }, { feeling_text: "Looks like a dream" }]);
            }
        };
        fetchComments();
    }, [selectedImage]);

    // 3. FETCH KEYWORDS
    const [loadingKeywords, setLoadingKeywords] = useState(false);
    const [keywordModel, setKeywordModel] = useState(null);

    useEffect(() => {
        if (comments.length === 0 || loadingKeywords) return;

        const fetchKeywords = async () => {
            setLoadingKeywords(true);

            // Preview prompt construction
            const commentList = comments.map(c => c.feeling_text || "").filter(Boolean);
            const previewPrompt = `Analyze these human responses:\n[${commentList.length} items] (e.g. "${commentList[0]}...")\nReturn EXACTLY 3 evocative...`;

            addLog(`[AI] Reading ${comments.length} human memories...`, 'info');
            addLog(`[AI] PROMPT PREVIEW: ${previewPrompt}`, 'system');
            addLog(`[AI] Sending to OpenRouter Neural Grid...`, 'info');

            try {
                const start = Date.now();
                const res = await fetch('/api/extract-emotions', {
                    method: 'POST',
                    body: JSON.stringify({ comments: commentList })
                });

                if (!res.ok) throw new Error("Keyword extraction failed");

                const data = await res.json();

                // Add backend process logs to terminal
                if (data.logs && Array.isArray(data.logs)) {
                    data.logs.forEach(logMsg => addLog(`[AI] ${logMsg}`, 'info'));
                }

                if (data.keywords) {
                    setKeywords(data.keywords);
                    setKeywordModel(data.model_used);
                    const time = ((Date.now() - start) / 1000).toFixed(2);
                    addLog(`[AI] Synthesized emotional theme in ${time}s`, 'success');
                    if (data.model_used) addLog(`[AI] Poet Algo: ${data.model_used}`, 'info');
                    if (data.prompt) addLog(`[AI] PROMPT: "${data.prompt.replace(/\n/g, ' ').substring(0, 100)}..."`, 'system');
                }
            } catch (e) {
                console.error("Keyword fetch error", e);
                addLog(`[AI] Error: ${e.message || "Unknown Failure"}. Using fallback.`, 'error');
                setKeywords(["Signal", "Lost", "Entropy"]);
            } finally {
                setLoadingKeywords(false);
            }
        };
        fetchKeywords();
    }, [comments]);

    // --- HANDLERS ---

    const reset = () => {
        setStep('select');
        setSelectedImage(null);
        setUserInput('');
        setAudioData({ blob: null, duration: 0 });
        setComments([]);
        setKeywords([]);
        setKeywordModel(null);
        setConsensusData(null);
        setAiReport(null);
        setLoading(false);
        setLogs([]);
    };

    const handleSelect = (img) => {
        setSelectedImage(img);
        setStep('context');
        setAudioData({ blob: null, duration: 0 });
        setUserInput('');
    };

    const handleInputSubmit = async (e) => {
        e.preventDefault();
        if (!userInput.trim() && !audioData.blob) return;

        let audioUrl = null;
        let audioPath = null;

        try {
            if (audioData.blob) {
                // Use detected mime type or fallback
                const mime = audioData.mimeType || 'audio/webm';
                const ext = mime.includes('mp4') ? 'mp4' : 'webm';
                const filename = `audio/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
                const { data, error } = await supabase.storage
                    .from('invisible-punctum-assets')
                    .upload(filename, audioData.blob, { cacheControl: '3600', upsert: false });
                if (error) throw error;
                audioPath = data.path;
                const { data: { publicUrl } } = supabase.storage
                    .from('invisible-punctum-assets')
                    .getPublicUrl(audioPath);
                audioUrl = publicUrl;
            }

            const { error: insertError } = await supabase.from('photo_feedback').insert([{
                image_url: selectedImage.url,
                feeling_text: userInput,
                project_id: 'invisible-punctum',
                audio_url: audioUrl,
                audio_path: audioPath,
                audio_duration_ms: audioData.duration * 1000,
                audio_mime: audioData.mimeType || (audioData.blob ? 'audio/webm' : null)
            }]);

            if (insertError) throw insertError;

            // Optimistic Update
            setComments(prev => [{
                feeling_text: userInput,
                audio_url: audioUrl,
                created_at: new Date().toISOString()
            }, ...prev]);

            setStep('viz');

        } catch (err) {
            console.error("Upload/Insert failed:", err);
            alert("Saved locally, but upload failed: " + err.message);
            setStep('viz');
        }
    };

    const handleHumanAnalysis = async () => {
        setStep('consensus');
        setLoading(true);
        try {
            const res = await fetch('/api/analyze-human-consensus', {
                method: 'POST',
                body: JSON.stringify({ comments: comments.map(c => c.feeling_text || "").filter(Boolean) })
            });
            const data = await res.json();
            setConsensusData(data);
        } catch (err) {
            console.error(err);
            setConsensusData({ consensus_score: 50, label: "DIVERGENCE UNKNOWN", summary: "The data is too chaotic to read." });
        } finally {
            setLoading(false);
        }
    };

    const handleAnalyze = async () => {
        setStep('analysis');
        setLoading(true);
        setError(null);
        setAiReport(null);
        setLogs([]); // Clear previous logs

        addLog("Initializing Neural Interface...", "system");

        try {
            // 1. VISION ANALYSIS
            addLog(`[VISION] Analyzing image: ${selectedImage.url.split('/').pop()}...`, "info");
            addLog(`[VISION] Connecting to OpenRouter API...`, "info");

            const visionStart = Date.now();
            const visionRes = await fetch('/api/analyze-vision', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageUrl: selectedImage.url,
                    userContext: userInput
                })
            });

            if (!visionRes.ok) {
                const errData = await visionRes.json().catch(() => ({}));
                const errMsg = errData.error || `Status ${visionRes.status}`;
                addLog(`[VISION] FAILED: ${errMsg}`, "error");
                throw new Error(errMsg);
            }

            const visionData = await visionRes.json();
            const visionTime = ((Date.now() - visionStart) / 1000).toFixed(2);

            addLog(`[VISION] Success in ${visionTime}s`, "success");
            addLog(`[VISION] Model: ${visionData.model_used}`, "success");
            addLog(`[VISION] Detected Emotion: ${visionData.dominant_emotion}`, "info");

            // 2. CONSENSUS ANALYSIS
            addLog(`[CONSENSUS] Retrieving human memory bank...`, "info");
            const humanComments = comments.map(c => c.feeling_text).filter(Boolean);

            if (userInput && !humanComments.includes(userInput)) {
                humanComments.unshift(userInput);
            }
            addLog(`[CONSENSUS] Found ${humanComments.length} human responses.`, "info");

            addLog(`[CONSENSUS] Calculating semantic distance...`, "info");
            const consensusRes = await fetch('/api/analyze-consensus', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    aiAnalysis: visionData,
                    humanComments: humanComments
                })
            });

            if (!consensusRes.ok) {
                const errData = await consensusRes.json().catch(() => ({}));
                const errMsg = errData.error || `Status ${consensusRes.status}`;
                addLog(`[CONSENSUS] FAILED: ${errMsg}`, "error");
                throw new Error(errMsg);
            }

            const consensusData = await consensusRes.json();
            addLog(`[CONSENSUS] Success. Model: ${consensusData.model_used}`, "success");
            addLog(`[CONSENSUS] Score: ${consensusData.consensus_score}/100`, "info");

            // 3. COMBINE & SET STATE
            const fullReport = {
                ai_keywords: visionData.emotional_keywords || [],
                trainability_score: consensusData.trainability_score || 0,
                consensus_score: consensusData.consensus_score || 0,
                analysis: consensusData.gap_analysis || visionData.studium_description,
                visual_summary: visionData.visual_summary || "Observing physical structure.",
                ai_feeling: visionData.ai_feeling || visionData.dominant_emotion || "COMPLEX",
                model_used: `${visionData.model_used} + ${consensusData.model_used}`,
                vision_analysis: visionData // Store full vision data for detailed view
            };

            setAiReport(fullReport);
            addLog(`[SYSTEM] Report Generation Complete.`, "success");

        } catch (err) {
            console.error(err);
            setError(err.message || "AI Connection Failed");
            addLog(`[CRITICAL] ${err.message}`, "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="game-wrapper" style={{
            width: '100vw',
            minHeight: '100vh',
            background: '#050505',
            color: '#e0e0e0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'Inter', sans-serif",
            overflow: 'hidden',
            position: 'relative'
        }}>

            {/* STATUS LOG - TOP RIGHT */}
            <AnimatePresence>
                {(logs.length > 0 && (step === 'analysis' || step === 'viz' || step === 'consensus')) && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        style={{
                            position: 'fixed',
                            top: '20px',
                            right: '20px',
                            width: '300px',
                            maxHeight: '400px',
                            background: 'rgba(0, 0, 0, 0.85)',
                            border: '1px solid rgba(0, 255, 0, 0.2)',
                            borderRadius: '8px',
                            padding: '12px',
                            fontFamily: "'Fira Code', monospace",
                            fontSize: '10px',
                            color: '#0f0',
                            zIndex: 9999,
                            overflowY: 'auto',
                            boxShadow: '0 0 20px rgba(0, 255, 0, 0.1)',
                            backdropFilter: 'blur(5px)'
                        }}
                    >
                        <div style={{
                            borderBottom: '1px solid rgba(0,255,0,0.2)',
                            paddingBottom: '4px',
                            marginBottom: '8px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontWeight: 'bold',
                            letterSpacing: '0.1em'
                        }}>
                            <span>TERMINAL_LOG</span>
                            <span style={{ width: '6px', height: '6px', background: '#0f0', borderRadius: '50%', boxShadow: '0 0 5px #0f0' }}></span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {logs.map((log, i) => (
                                <div key={i} style={{
                                    opacity: 0,
                                    animation: 'fadeIn 0.2s forwards',
                                    animationDelay: `${i * 0.05}s`,
                                    color: log.type === 'error' ? '#ff4444' : (log.type === 'success' ? '#00ff00' : '#888')
                                }}>
                                    <span style={{ opacity: 0.5 }}>[{log.timestamp.toLocaleTimeString().split(' ')[0]}]</span>{' '}
                                    {log.message}
                                </div>
                            ))}
                            <div style={{ height: '10px' }} />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(2px); } to { opacity: 1; transform: translateY(0); } }
                /* ... existing styles ... */
                .punctum-grid-bg {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 0;
                    pointer-events: none;
                    background-image:
                        linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
                    background-size: 5vw 8vh;
                    background-position: center top;
                    mask-image: radial-gradient(ellipse at center, black 30%, transparent 80%);
                    -webkit-mask-image: radial-gradient(ellipse at center, black 30%, transparent 80%);
                }
                .punctum-glow-bg {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 0;
                    pointer-events: none;
                    opacity: 1;
                    background-image:
                        linear-gradient(to right, rgba(200, 200, 255, 0.15) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(200, 200, 255, 0.15) 1px, transparent 1px);
                    background-size: 5vw 8vh;
                    background-position: center top;
                    mask-image:
                        radial-gradient(
                            circle 300px at var(--mouse-x, -500px) var(--mouse-y, -500px),
                            black,
                            transparent
                        ),
                        radial-gradient(ellipse at center, black 30%, transparent 80%);
                    -webkit-mask-image:
                        radial-gradient(
                            circle 300px at var(--mouse-x, -500px) var(--mouse-y, -500px),
                            black,
                            transparent
                        ),
                        radial-gradient(ellipse at center, black 30%, transparent 80%);
                    mask-composite: intersect;
                    -webkit-mask-composite: source-in;
                }
            `}</style>
            <div className="punctum-grid-bg"></div>
            <div className="punctum-glow-bg"></div>

            {/* Homepage Button - Persistent across all pages */}
            <a
                href="/"
                style={{
                    position: 'fixed',
                    top: '20px',
                    left: '20px',
                    zIndex: 100,
                    fontFamily: 'Inconsolata, monospace',
                    fontSize: '11px',
                    color: '#888',
                    textDecoration: 'none',
                    padding: '8px 16px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '4px',
                    background: 'rgba(0,0,0,0.3)',
                    backdropFilter: 'blur(10px)',
                    transition: 'all 0.2s',
                    letterSpacing: '0.05em'
                }}
                onMouseEnter={(e) => {
                    e.target.style.color = '#fff';
                    e.target.style.borderColor = 'rgba(255,255,255,0.3)';
                    e.target.style.background = 'rgba(0,0,0,0.5)';
                }}
                onMouseLeave={(e) => {
                    e.target.style.color = '#888';
                    e.target.style.borderColor = 'rgba(255,255,255,0.1)';
                    e.target.style.background = 'rgba(0,0,0,0.3)';
                }}
            >
                ← Go back to homepage
            </a>

            <div style={{ position: 'relative', zIndex: 1, width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <AnimatePresence mode="wait">

                    {/* INTRO */}
                    {step === 'intro' && (
                        <>
                            <SciFiImageReveal images={images} />
                            <motion.div
                                key="intro"
                                variants={containerVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                style={{ textAlign: 'center', maxWidth: '640px', padding: '0 24px', position: 'relative', zIndex: 10 }}
                            >
                                <h1 style={{
                                    fontFamily: "'Poppins', sans-serif",
                                    fontSize: '6rem',
                                    fontWeight: 900,
                                    letterSpacing: '-0.03em',
                                    color: '#fff',
                                    lineHeight: 0.9,
                                    marginBottom: '32px',
                                    marginTop: 0,
                                    textTransform: 'uppercase'
                                }}>
                                    Invisible <span style={{ color: '#fff', backgroundColor: '#e60000', padding: '0 10px' }}>Punctums</span>
                                </h1>
                                <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '2rem', color: '#fff', lineHeight: 1.4, marginBottom: '56px', fontWeight: 700 }}>
                                    Exploring the gap between human feeling and machine perception.</p>
                                <button
                                    onClick={() => setStep('select')}
                                    className="hover-btn"
                                    style={{
                                        padding: '18px 42px',
                                        fontSize: '16px',
                                        background: 'transparent',
                                        color: '#fff',
                                        border: '1px solid rgba(255,255,255,0.2)',
                                        borderRadius: '100px',
                                        cursor: 'pointer',
                                        fontWeight: 400,
                                        letterSpacing: '0.05em',
                                        transition: 'all 0.3s ease'
                                    }}
                                    onMouseOver={(e) => { e.target.style.borderColor = '#fff'; e.target.style.background = 'rgba(255,255,255,0.05)'; }}
                                    onMouseOut={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.2)'; e.target.style.background = 'transparent'; }}
                                >
                                    START EXPERIMENT
                                </button>
                            </motion.div>
                        </>
                    )}

                    {/* SELECTION */}
                    {step === 'select' && (
                        <motion.div
                            key="select"
                            variants={containerVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            style={{ width: '100%', maxWidth: '1400px', textAlign: 'center', padding: '40px' }}
                        >
                            <h2 style={{ fontFamily: "'Poppins', sans-serif", fontSize: '2rem', fontWeight: 700, marginBottom: '60px', color: '#fff' }}>Select a photograph that catches your attention the most.</h2>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px', justifyContent: 'center' }}>
                                {images.map((img, i) => (
                                    <motion.div
                                        key={img.id || i}
                                        whileHover={{ scale: 1.03, y: -5 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => handleSelect(img)}
                                        style={{
                                            width: '240px',
                                            height: '320px',
                                            background: '#111',
                                            borderRadius: '4px',
                                            overflow: 'hidden',
                                            cursor: 'pointer',
                                            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                                            border: '1px solid rgba(255,255,255,0.05)'
                                        }}
                                    >
                                        <img src={img.url} alt="Selection" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9, transition: 'opacity 0.3s' }}
                                            onMouseOver={e => e.target.style.opacity = 1}
                                            onMouseOut={e => e.target.style.opacity = 0.9}
                                        />
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 2: CONTEXT / THEORY */}
                    {step === 'context' && (
                        <motion.div
                            key="context"
                            variants={containerVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            style={{
                                width: '100%',
                                height: '100vh',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '20px',
                                textAlign: 'center',
                                position: 'relative'
                            }}
                        >

                            {/* Image and Card Container - Side by Side */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'flex-end',
                                justifyContent: 'center',
                                gap: '20px',
                                marginBottom: '32px',
                                maxWidth: '90vw'
                            }}>
                                {/* Enlarged Image */}
                                <div style={{
                                    height: '35vh',
                                    borderRadius: '4px',
                                    overflow: 'hidden',
                                    boxShadow: '0 30px 60px rgba(0,0,0,0.5)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <img
                                        src={selectedImage.url}
                                        style={{ width: 'auto', height: '100%', objectFit: 'contain' }}
                                    />
                                </div>

                                {/* Info Card - Beside Image */}
                                <div style={{
                                    maxWidth: '200px',
                                    padding: '16px',
                                    background: 'rgba(0,0,0,0.4)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: '4px',
                                    backdropFilter: 'blur(10px)',
                                    alignSelf: 'flex-end'
                                }}>
                                    <p style={{
                                        fontFamily: 'Inconsolata, monospace',
                                        fontSize: '9px',
                                        lineHeight: '1.6',
                                        color: '#888',
                                        textAlign: 'left',
                                        margin: 0
                                    }}>
                                        Punctum is the rare detail that pricks you, haunts you, and pulls your attention.
                                        It is the unexpected—a look, an object, or a shadow that stays in your mind.
                                        <br /><br />
                                        This experiment compares your response with collective human memory and machine vision,
                                        tracing how you feel, how others feel, and where the algorithm diverges.
                                        <br /><br />
                                        <span style={{ color: '#aaa' }}>
                                            Share what the photograph makes you feel.
                                        </span>
                                    </p>
                                </div>
                            </div>

                            {/* Concept Text */}
                            <div style={{ maxWidth: '750px', marginBottom: '32px' }}>
                                <p style={{
                                    fontFamily: '"Cormorant Garamond", serif',
                                    fontSize: '30px',
                                    lineHeight: '1.4',
                                    color: '#ccc',
                                    fontStyle: 'italic',
                                    marginBottom: '24px'
                                }}>
                                    "This experiment explores the divergence between human feeling and machine vision."
                                </p>
                            </div>

                            <button
                                onClick={() => setStep('input')}
                                className="hover-btn"
                                style={{
                                    padding: '16px 48px',
                                    background: '#fff',
                                    color: '#000',
                                    border: 'none',
                                    borderRadius: '100px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    letterSpacing: '0.1em',
                                    transition: 'transform 0.2s'
                                }}
                                onMouseOver={e => e.target.style.transform = 'scale(1.05)'}
                                onMouseOut={e => e.target.style.transform = 'scale(1)'}
                            >
                                SHARE YOUR RESPONSE
                            </button>
                        </motion.div>
                    )}

                    {/* INPUT */}
                    {step === 'input' && selectedImage && (
                        <motion.div
                            key="input"
                            variants={containerVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            style={{ width: '100%', maxWidth: '900px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                        >
                            <div style={{
                                height: '25vh',
                                maxWidth: '90vw',
                                borderRadius: '8px', overflow: 'hidden', marginBottom: '24px',
                                boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
                                border: '1px solid rgba(255,255,255,0.05)',
                                display: 'flex', justifyContent: 'center', alignItems: 'center'
                            }}>
                                <img src={selectedImage.url} style={{ width: 'auto', height: '100%', objectFit: 'contain' }} />
                            </div>

                            <form onSubmit={handleInputSubmit} style={{ width: '100%', maxWidth: '900px', textAlign: 'center' }}>
                                <h3 style={{
                                    fontFamily: '"Cormorant Garamond", serif',
                                    fontSize: '2.5rem',
                                    fontWeight: 300,
                                    fontStyle: 'italic',
                                    lineHeight: '1.2',
                                    marginBottom: '32px',
                                    color: '#fff'
                                }}>
                                    What does this photograph make you feel?
                                </h3>



                                {/* SPLIT CONTAINER */}
                                <div style={{
                                    display: 'flex',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '12px',
                                    background: 'rgba(0,0,0,0.6)',
                                    backdropFilter: 'blur(10px)',
                                    marginBottom: '32px',
                                    minHeight: '200px',
                                    overflow: 'hidden'
                                }}>
                                    {/* LEFT: TEXT INPUT */}
                                    <div style={{ flex: 1, padding: '24px' }}>
                                        <textarea
                                            autoFocus
                                            value={userInput}
                                            onChange={e => setUserInput(e.target.value)}
                                            placeholder="Type your feeling..."
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                background: 'transparent',
                                                border: 'none',
                                                color: '#fff',
                                                fontSize: '18px',
                                                fontFamily: "'Inconsolata', monospace",
                                                outline: 'none',
                                                resize: 'none',
                                                lineHeight: '1.6'
                                            }}
                                        />
                                    </div>

                                    {/* DIVIDER */}
                                    <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }}></div>

                                    {/* RIGHT: AUDIO INPUT */}
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', position: 'relative' }}>
                                        <div style={{ marginBottom: '16px', fontSize: '12px', color: '#666', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                                            OR RECORD YOUR VOICE
                                        </div>
                                        <AudioRecorder onRecordingComplete={(blob, duration, mimeType) => setAudioData({ blob, duration, mimeType })} />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={!userInput.trim() && !audioData.blob}
                                    style={{
                                        padding: '16px 48px',
                                        background: (userInput.trim() || audioData.blob) ? '#fff' : 'rgba(255,255,255,0.05)',
                                        color: (userInput.trim() || audioData.blob) ? '#000' : 'rgba(255,255,255,0.2)',
                                        border: 'none',
                                        borderRadius: '100px',
                                        cursor: (userInput.trim() || audioData.blob) ? 'pointer' : 'default',
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        letterSpacing: '0.05em',
                                        transition: 'all 0.3s'
                                    }}
                                >
                                    SUBMIT RESPONSE
                                </button>
                            </form>
                        </motion.div>
                    )}

                    {/* VIZ STEP: REDESIGNED */}
                    {step === 'viz' && selectedImage && (
                        <motion.div
                            key="viz"
                            variants={containerVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            style={{
                                width: '100%',
                                minHeight: '100vh',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'flex-start',
                                paddingTop: '8vh',
                                paddingBottom: '4vh',
                                padding: '8vh 20px 4vh',
                                textAlign: 'center',
                                overflow: 'auto'
                            }}
                        >
                            {/* 1. IMAGE (Small Anchor) */}
                            {/* 1. IMAGE (Small Anchor) */}
                            <div style={{
                                height: '20vh',
                                marginBottom: '40px',
                                borderRadius: '4px',
                                overflow: 'hidden',
                                boxShadow: '0 10px 20px rgba(0,0,0,0.5)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                flexShrink: 0
                            }}>
                                <img src={selectedImage.url} style={{ width: 'auto', height: '100%', objectFit: 'contain' }} />
                            </div>

                            {/* 2. OVERALL FEELING (Big Letters) */}
                            {/* 2. OVERALL FEELING (Big Letters) */}
                            <div style={{ marginBottom: '48px', maxWidth: '800px' }}>
                                <h4 style={{
                                    fontSize: '10px', letterSpacing: '0.3em', color: '#666',
                                    textTransform: 'uppercase', marginBottom: '16px'
                                }}>
                                    Collective Analysis of all Human Responses
                                </h4>
                                <div style={{
                                    fontSize: '2.5rem',
                                    fontWeight: 200,
                                    lineHeight: 1.2,
                                    textTransform: 'uppercase',
                                    color: '#e0e0e0',
                                    letterSpacing: '-0.02em'
                                }}>
                                    {loadingKeywords ? (
                                        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
                                            {Array(3).fill(0).map((_, i) => (
                                                <motion.span
                                                    key={i}
                                                    animate={{ opacity: [0.3, 1, 0.3] }}
                                                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                                                    style={{
                                                        fontSize: '2.5rem',
                                                        color: '#444',
                                                        fontFamily: "'Cormorant Garamond', serif",
                                                        fontStyle: 'italic',
                                                    }}
                                                >
                                                    Scanning...
                                                </motion.span>
                                            ))}
                                        </div>
                                    ) : keywords.length > 0 ? (
                                        keywords.slice(0, 3).map((k, i) => (
                                            <span key={i} style={{ margin: '0 10px', display: 'inline-block' }}>
                                                {k}
                                            </span>
                                        ))
                                    ) : (
                                        <span style={{ opacity: 0.5, fontSize: '1.5rem' }}>Gathering collective memory...</span>
                                    )}
                                </div>
                            </div>

                            {/* All User Comments - Displayed below collective analysis */}
                            <div style={{
                                marginBottom: '48px',
                                maxWidth: '800px',
                                maxHeight: '20vh',
                                overflowY: 'auto',
                                padding: '0 10px'
                            }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
                                    {comments.map((comment, i) => (
                                        comment.feeling_text && (
                                            <div key={i} style={{
                                                padding: '5px 10px',
                                                background: 'rgba(255,255,255,0.04)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                color: '#999',
                                                borderRadius: '2px',
                                                fontSize: '9px',
                                                fontFamily: 'Inconsolata, monospace',
                                                transition: 'all 0.2s',
                                                cursor: 'default'
                                            }}
                                                onMouseOver={e => { e.target.style.color = '#fff'; e.target.style.background = 'rgba(255,255,255,0.08)'; }}
                                                onMouseOut={e => { e.target.style.color = '#999'; e.target.style.background = 'rgba(255,255,255,0.04)'; }}
                                            >
                                                {comment.feeling_text}
                                            </div>
                                        )
                                    ))}
                                </div>
                            </div>

                            {/* 5. ACTION BUTTON */}
                            <button
                                onClick={handleHumanAnalysis}
                                className="hover-btn"
                                style={{
                                    padding: '16px 48px',
                                    background: '#333',
                                    color: '#fff',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    borderRadius: '100px',
                                    cursor: 'pointer',
                                    fontWeight: 500,
                                    fontSize: '13px',
                                    letterSpacing: '0.1em',
                                    textTransform: 'uppercase',
                                    transition: 'all 0.3s'
                                }}
                                onMouseOver={(e) => { e.target.style.background = '#fff'; e.target.style.color = '#000'; }}
                                onMouseOut={(e) => { e.target.style.background = '#333'; e.target.style.color = '#fff'; }}
                            >
                                Analyze Human Patterns
                            </button>

                        </motion.div>
                    )}

                    {/* STEP 3: HUMAN CONSENSUS (CONSTELLATION) */}
                    {step === 'consensus' && (
                        <motion.div
                            key="consensus"
                            variants={containerVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            style={{
                                width: '100vw',
                                height: '100vh',
                                overflow: 'hidden',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative'
                            }}
                        >
                            {/* Graph Container - Centered & Floating */}
                            <div style={{
                                width: '90%',
                                maxWidth: '1000px',
                                height: '70vh',
                                position: 'relative',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                {consensusData ? (
                                    <ConstellationGraph
                                        consensusScore={consensusData.consensus_score}
                                        divergenceLabel={consensusData.label}
                                    />
                                ) : (
                                    // Fallback manual spinner if data isn't ready immediately
                                    <div style={{
                                        width: '60px', height: '60px',
                                        border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#fff',
                                        borderRadius: '50%',
                                        animation: 'spin 1s linear infinite'
                                    }} />
                                )}
                            </div>

                            {/* Floating Action Bar */}
                            <div style={{
                                position: 'absolute',
                                bottom: '5vh',
                                width: '100%',
                                textAlign: 'center',
                                zIndex: 50
                            }}>


                                <button
                                    onClick={handleAnalyze}
                                    className="hover-btn"
                                    style={{
                                        padding: '18px 48px',
                                        background: '#fff',
                                        color: '#000',
                                        borderRadius: '100px',
                                        fontWeight: 600,
                                        fontSize: '14px',
                                        letterSpacing: '0.1em',
                                        cursor: 'pointer',
                                        border: 'none',
                                        boxShadow: '0 0 30px rgba(255,255,255,0.2)',
                                        transition: 'transform 0.2s'
                                    }}
                                    onMouseOver={e => e.target.style.transform = 'scale(1.05)'}
                                    onMouseOut={e => e.target.style.transform = 'scale(1)'}
                                >
                                    ANALYZE HOW AI FEELS
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 4: AI ANALYSIS & COMPARISON */}
                    {step === 'analysis' && (
                        <motion.div
                            key="analysis"
                            variants={containerVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            style={{
                                width: '100%',
                                height: '100vh',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '4vh 20px 4vh',
                                boxSizing: 'border-box',
                                overflow: 'hidden'
                            }}
                        >
                            {loading ? (
                                <div className="loader" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', fontFamily: 'monospace' }}>
                                    <div style={{ position: 'relative', width: '80px', height: '80px', marginBottom: '32px' }}>
                                        {/* Static White Ring */}
                                        <div style={{
                                            position: 'absolute',
                                            top: 0, left: 0,
                                            width: '100%', height: '100%',
                                            borderRadius: '50%',
                                            border: '1px solid #fff',
                                            opacity: 0.3
                                        }} />

                                        {/* Rotating Green Glow */}
                                        <motion.div
                                            animate={{ rotate: 360 }}
                                            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                                            style={{
                                                position: 'absolute',
                                                top: 0, left: 0,
                                                width: '100%', height: '100%',
                                                borderRadius: '50%',
                                                border: '1px solid transparent',
                                                borderTop: '2px solid #00ff66',
                                                boxShadow: '0 -2px 10px rgba(0, 255, 102, 0.8)'
                                            }}
                                        />
                                    </div>
                                    <div style={{ fontSize: '18px', letterSpacing: '0.1em', color: '#fff' }}>INITIALIZING NEURAL VISION...</div>
                                    <div style={{ fontSize: '12px', color: '#666', marginTop: '12px' }}>EXTRACTING STRUCTURAL VECTORS</div>
                                </div>
                            ) : (
                                <>
                                    {/* HEADER - Top Spacer */}
                                    <div style={{ textAlign: 'center', marginBottom: '40px', flexShrink: 0 }}>

                                        <p style={{ color: '#666', fontSize: '11px', fontFamily: 'monospace', textTransform: 'uppercase' }}>
                                            COMPARING MACHINE PERCEPTION WITH HUMAN SENTIMENT
                                        </p>
                                    </div>

                                    {/* COMPARISON GRID - Centered Content */}
                                    <div style={{
                                        display: 'grid', gridTemplateColumns: '1fr 1px 1fr', gap: '40px', width: '100%', maxWidth: '900px',
                                        background: 'rgba(255,255,255,0.02)', padding: '40px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)',
                                        flex: 1, maxHeight: '50vh', overflowY: 'auto'
                                    }}>

                                        {/* AI COLUMN */}
                                        <div style={{ textAlign: 'right' }}>
                                            <h3 style={{ fontSize: '12px', color: '#00f3ff', letterSpacing: '0.2em', marginBottom: '16px', fontWeight: 600 }}>
                                                MACHINE VISION
                                            </h3>

                                            {/* AI Summary & Feeling Clusters */}
                                            <div style={{ marginBottom: '24px' }}>
                                                <div style={{
                                                    fontSize: '12px', color: '#aaa', fontStyle: 'italic',
                                                    marginBottom: '12px', lineHeight: '1.5', fontFamily: '"Cormorant Garamond", serif'
                                                }}>
                                                    "{aiReport?.visual_summary}"
                                                </div>
                                                <div style={{
                                                    fontSize: '10px', color: '#00f3ff', letterSpacing: '0.1em',
                                                    textTransform: 'uppercase', background: 'rgba(0, 243, 255, 0.05)',
                                                    padding: '8px', borderRadius: '4px', borderRight: '2px solid #00f3ff'
                                                }}>
                                                    AI FEELING: <span style={{ color: '#fff', fontWeight: 300 }}>{aiReport?.ai_feeling}</span>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                                                {aiReport?.ai_keywords.slice(0, 3).map((kw, i) => (
                                                    <motion.div
                                                        key={i}
                                                        initial={{ opacity: 0, x: -20 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: i * 0.1 }}
                                                        style={{
                                                            fontFamily: 'monospace', fontSize: '11px', color: '#888',
                                                            padding: '4px 10px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '2px',
                                                            borderRight: '1px solid rgba(0, 243, 255, 0.3)', maxWidth: '90%'
                                                        }}
                                                    >
                                                        {kw}
                                                    </motion.div>
                                                ))}
                                            </div>
                                            <div style={{ marginTop: '24px', fontSize: '9px', color: '#444', fontFamily: 'monospace' }}>
                                                ENGINE:<br />
                                                <span style={{ color: '#666' }}>{aiReport?.model_used?.split(' + ')[0] || "Neural Grid"}</span>
                                            </div>
                                        </div>

                                        {/* DIVIDER */}
                                        <div style={{ width: '1px', background: 'linear-gradient(to bottom, transparent, #333, transparent)' }} />

                                        {/* HUMAN COLUMN */}
                                        <div style={{ textAlign: 'left' }}>
                                            <h3 style={{ fontSize: '12px', color: '#ff0055', letterSpacing: '0.2em', marginBottom: '8px', fontWeight: 600 }}>
                                                HUMAN SENTIMENT
                                            </h3>
                                            <div style={{ fontSize: '10px', color: '#ff0055', opacity: 0.6, marginBottom: '24px', textTransform: 'uppercase' }}>
                                                CONSENSUS: {consensusData?.label || "DIVERGENT"}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-start' }}>
                                                {keywords.slice(0, 4).map((kw, i) => (
                                                    <motion.div
                                                        key={i}
                                                        initial={{ opacity: 0, x: 20 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: i * 0.1 + 0.4 }}
                                                        style={{
                                                            fontFamily: '"Cormorant Garamond", serif', fontSize: '18px', fontStyle: 'italic', color: '#eee',
                                                            padding: '6px 14px', background: 'rgba(255, 0, 85, 0.05)', borderRadius: '4px',
                                                            borderLeft: '2px solid #ff0055', maxWidth: '90%'
                                                        }}
                                                    >
                                                        {kw}
                                                    </motion.div>
                                                ))}
                                            </div>
                                            <div style={{ marginTop: '32px', fontSize: '10px', color: '#666', fontFamily: 'monospace' }}>
                                                DATA SOURCE:<br />
                                                <span style={{ color: '#888' }}>Analyzed {comments.length} human responses</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* FOOTER - Trainability & Actions */}
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 1.5 }}
                                        style={{
                                            width: '100%', maxWidth: '800px',
                                            textAlign: 'center', marginTop: '20px', flexShrink: 0
                                        }}
                                    >
                                        <div style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '12px',
                                            padding: '8px 16px', borderRadius: '100px',
                                            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
                                            marginBottom: '32px'
                                        }}>
                                            <span style={{
                                                width: '8px', height: '8px', borderRadius: '50%',
                                                background: aiReport?.trainability_score > 50 ? '#00ff00' : '#ff4444'
                                            }} />
                                            <span style={{ fontSize: '12px', color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                                                Analysis: {aiReport?.trainability_score > 50 ? 'Pattern Recognized' : 'High Divergence'}
                                            </span>
                                        </div>

                                        <div style={{ marginTop: '0px', marginBottom: '30px' }}>
                                            <h3 style={{ fontSize: '12px', letterSpacing: '2px', color: '#666', marginBottom: '10px' }}>
                                                COLLECTIVE MEMORY {keywordModel && <span style={{ color: '#333', fontSize: '10px' }}>[{keywordModel}]</span>}
                                            </h3>
                                            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                                {loadingKeywords ? (
                                                    Array(3).fill(0).map((_, i) => (
                                                        <motion.span
                                                            key={i}
                                                            animate={{ opacity: [0.3, 1, 0.3] }}
                                                            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                                                            style={{
                                                                fontSize: '18px',
                                                                color: '#444',
                                                                fontFamily: "'Cormorant Garamond', serif",
                                                                fontStyle: 'italic',
                                                                letterSpacing: '0.05em'
                                                            }}
                                                        >
                                                            Scanning...
                                                        </motion.span>
                                                    ))
                                                ) : (
                                                    keywords.map((word, i) => (
                                                        <motion.span
                                                            key={i}
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ delay: 0.8 + (i * 0.1) }}
                                                            style={{
                                                                padding: '5px 15px',
                                                                border: '1px solid rgba(255,255,255,0.15)',
                                                                borderRadius: '20px',
                                                                fontSize: '18px',
                                                                color: word === "Signal" ? '#ff4444' : '#ccc',
                                                                fontFamily: "'Cormorant Garamond', serif",
                                                                fontStyle: 'italic',
                                                                letterSpacing: '0.05em',
                                                                background: 'rgba(255,255,255,0.02)'
                                                            }}
                                                        >
                                                            {word}
                                                        </motion.span>
                                                    ))
                                                )}
                                            </div>

                                            {/* RETRY MECHANISM */}
                                            {!loadingKeywords && keywords.includes("Signal") && (
                                                <div style={{ marginTop: '15px' }}>
                                                    <button
                                                        onClick={() => {
                                                            setKeywords([]);
                                                            setLoadingKeywords(true);
                                                            // Force effect re-run by updating dependency
                                                            const newComments = [...comments];
                                                            setComments(newComments);
                                                        }}
                                                        style={{
                                                            background: 'transparent',
                                                            border: '1px solid #ff4444',
                                                            color: '#ff4444',
                                                            padding: '6px 16px',
                                                            fontSize: '10px',
                                                            borderRadius: '4px',
                                                            cursor: 'pointer',
                                                            fontFamily: 'monospace',
                                                            letterSpacing: '0.1em',
                                                            textTransform: 'uppercase'
                                                        }}
                                                    >
                                                        Retry Connection
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <button
                                            onClick={reset}
                                            className="hover-btn"
                                            style={{
                                                padding: '16px 40px',
                                                background: '#fff',
                                                color: '#000',
                                                borderRadius: '100px',
                                                cursor: 'pointer',
                                                border: 'none',
                                                fontWeight: 600,
                                                fontSize: '13px',
                                                letterSpacing: '0.1em',
                                                textTransform: 'uppercase'
                                            }}
                                        >
                                            Try Another Image
                                        </button>

                                        {/* Punctum Reference Link */}
                                        <div style={{
                                            position: 'absolute',
                                            bottom: '20px',
                                            right: '20px',
                                            fontSize: '11px'
                                        }}>
                                            <a
                                                href="https://media-studies.com/studium-and-punctum/"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{
                                                    fontFamily: 'Inconsolata, monospace',
                                                    color: '#888',
                                                    textDecoration: 'underline',
                                                    transition: 'color 0.2s'
                                                }}
                                                onMouseEnter={(e) => e.target.style.color = '#fff'}
                                                onMouseLeave={(e) => e.target.style.color = '#888'}
                                            >
                                                Read more about Punctum
                                            </a>
                                        </div>
                                    </motion.div>
                                </>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div >
    );
};
