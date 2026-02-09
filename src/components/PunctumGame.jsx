import React, { useState, useEffect, useRef } from 'react';
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

// MOCK DATA REMOVED PER USER REQUEST
const MOCK_AI_DATA = null;

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
        setCurrentStatus(message.replace(/\[.*?\]\s*/, '')); // Remove [TAG] for cleaner UI status
    };

    const [audioBlobUrl, setAudioBlobUrl] = useState(null);
    const [error, setError] = useState(null);
    const [aiReport, setAiReport] = useState(null);
    const [currentStatus, setCurrentStatus] = useState("");
    const [showResults, setShowResults] = useState(false);
    const [collectiveTheme, setCollectiveTheme] = useState("");



    // Auto-scroll ref for terminal
    const logEndRef = useRef(null);

    // Auto-scroll to bottom of logs
    useEffect(() => {
        if (logEndRef.current) {
            logEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [logs]);

    // Navigation Handler
    const handleNext = () => {
        if (step === 'viz') {
            analyzeAI();
        } else if (step === 'analysis-ai') {
            analyzeHumans();
        } else if (step === 'analysis-human') {
            synthesize();
        }
    };

    const handlePrev = () => {
        if (step === 'analysis-ai') {
            setStep('viz');
        } else if (step === 'analysis-human') {
            setStep('analysis-ai');
        } else if (step === 'analysis-synthesis') {
            setStep('analysis-human');
        }
    };

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

    // 4. UI PROGRESS STATE
    const [progress, setProgress] = useState(0);

    // Simulate progress when loading
    useEffect(() => {
        if (!loading && !loadingKeywords) {
            setProgress(0);
            return;
        }

        setProgress(0);
        const interval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 95) return prev;
                // Non-linear progression: Fast start, slow finish
                const increment = prev < 50 ? Math.random() * 5 + 2 : Math.random() * 2 + 0.5;
                return Math.min(prev + increment, 99);
            });
        }, 150);

        return () => clearInterval(interval);
    }, [loading, loadingKeywords]);

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




    // State for Feedback Modal
    const [feedbackModal, setFeedbackModal] = useState({ isOpen: false, type: 'success', context: '' });
    const [feedbackText, setFeedbackText] = useState('');
    const [sendingFeedback, setSendingFeedback] = useState(false);

    // Helper to open feedback modal
    const openFeedback = (type, context) => {
        setFeedbackModal({ isOpen: true, type, context });
        setFeedbackText('');
    };

    const handleSendFeedback = async () => {
        setSendingFeedback(true);
        try {
            await fetch('/api/send-feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    feedback: feedbackText,
                    type: feedbackModal.type,
                    context: feedbackModal.context
                })
            });
            alert("Thank you. Your thoughts have been received.");
            setFeedbackModal({ isOpen: false, type: 'success', context: '' });
        } catch (err) {
            console.error(err);
            alert("Failed to send feedback, but we heard you.");
        }
    };

    // Helper: Resize & Convert Blob to Base64 (Compressed)
    const blobToBase64 = async (url) => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // Max dimensions to prevent payload too large errors
                const MAX_SIZE = 800; // ample for vision models
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                // Compress to JPEG 0.7
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.onerror = reject;
            img.src = url;
        });
    };

    // New Multi-Stage Analysis Functions
    const analyzeAI = async () => {
        setStep('analysis-ai');
        setLoading(true);
        setError(null);
        setLogs(prev => [...prev, { message: "Initializing Neural Interface...", type: "system", timestamp: new Date() }]);

        try {
            addLog(`[VISION] Analyzing image: ${selectedImage.url.split('/').pop()}...`, "info");

            // Convert to Base64 because standard fetch to external API cannot access localhost/blob URLs
            addLog(`[VISION] Encoding visual data...`, "system");
            const base64Image = await blobToBase64(selectedImage.url);

            addLog(`[VISION] Connecting to specialized AI models...`, "info");

            const visionStart = Date.now();
            const visionRes = await Promise.race([
                fetch('/api/analyze-vision', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        imageUrl: base64Image, // Send Base64 data URI
                        userContext: userInput
                    })
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error("Analysis timed out (120s). The neural link was severed.")), 120000))
            ]);

            if (!visionRes.ok) {
                const errData = await visionRes.json().catch(() => ({}));
                const errMsg = errData.error || `Status ${visionRes.status}`;
                throw new Error(errMsg);
            }

            const visionData = await visionRes.json();
            const visionTime = ((Date.now() - visionStart) / 1000).toFixed(2);

            addLog(`[VISION] Success in ${visionTime}s`, "success");
            addLog(`[VISION] Model: ${visionData.model_used}`, "success");
            addLog(`[VISION] Detected Emotion: ${visionData.dominant_emotion || visionData.ai_feeling || 'Complex State'}`, "info");

            // Init partial report
            // STRICT MODE: No defaults. If data is missing/undefined, we want it to break or show "Unknown" explicitly if acceptable, 
            // but user requested to "show error when there is not a good analysis".
            // Since API now throws on missing critical fields, we can trust the data here is reasonably complete if we reached this point.

            setAiReport({
                ...visionData,
                ai_keywords: visionData.emotional_keywords || [],
                ai_feeling: visionData.ai_feeling,
                visual_summary: visionData.visual_summary,
                ai_emotions: visionData.ai_emotions || [],
                dominant_emotion: visionData.dominant_emotion,
                vision_analysis: visionData
            });

        } catch (err) {
            console.error("Analysis Error:", err);

            let displayMessage = err.message || "AI Connection Failed";
            let detailedLogs = [];

            // Try to parse if it's a JSON error report
            try {
                const parsedError = JSON.parse(err.message);
                if (parsedError && typeof parsedError === 'object') {
                    displayMessage = parsedError.message || displayMessage;

                    if (parsedError.google_error) {
                        // Parse specific error codes
                        if (displayMessage.includes("429") || displayMessage.includes("Rate Limit")) {
                            displayMessage = "System busy (Rate Limit). Please try again in a few seconds.";
                        } else if (displayMessage.includes("402") || displayMessage.includes("Insufficient Credit")) {
                            displayMessage = "AI Resource Limit Reached. Please check provider credits.";
                        } else if (displayMessage.includes("401") || displayMessage.includes("Authentication Failed")) {
                            displayMessage = "System Configuration Error (Auth Failed).";
                        }
                    }

                    setError(displayMessage);
                    addLog(`[CRITICAL] ${displayMessage}`, "error");
                    detailedLogs.forEach(log => addLog(`[DEBUG] ${log}`, "error"));

                    // Auto-open feedback modal for non-transient errors
                    if (!displayMessage.includes("System busy")) {
                        setTimeout(() => {
                            const feedbackMsg = `Analysis Failed: ${displayMessage}\n\nDetails:\n${detailedLogs.join('\n')}`;
                            openFeedback('error', feedbackMsg);
                        }, 2000);
                    }
                }
            } catch (e) {
                // If not JSON, we already have displayMessage fallback
            }
        } finally {
            setLoading(false);
            setCurrentStatus("");
        }
    };

    const analyzeHumans = async () => {
        setStep('analysis-human');
        setLoading(true);
        addLog(`[CONSENSUS] Retrieving human memory bank...`, "info");

        // Simulate fetching/processing delay for effect
        setTimeout(async () => {
            try {
                const humanComments = comments.map(c => c.feeling_text).filter(Boolean);
                if (userInput && !humanComments.includes(userInput)) {
                    humanComments.unshift(userInput);
                }

                addLog(`[CONSENSUS] Found ${humanComments.length} human responses.`, "info");
                addLog(`[CONSENSUS] Extracting collective sentiment keywords...`, "info");

                // Calculate Collective Theme from Keywords
                let theme = "Collective";
                if (keywords && keywords.length > 0) {
                    // Capitalize and join top 2 keywords
                    theme = keywords.slice(0, 2).map(k => k.charAt(0).toUpperCase() + k.slice(1)).join(" & ");
                } else if (userInput) {
                    theme = userInput;
                }
                setCollectiveTheme(theme);

                setLoading(false);
            } catch (err) {
                addLog(`[CONSENSUS] Error: ${err.message}`, "error");
                setLoading(false);
                setTimeout(() => openFeedback('error', `Human Analysis Failed: ${err.message}`), 1000);
            }
        }, 1500);
    };

    const synthesize = async () => {
        if (!aiReport || !aiReport.vision_analysis) {
            openFeedback('error', "Cannot perform synthesis: AI Analysis is missing. Please try to re-establish the connection or restart the experiment.");
            return;
        }

        setStep('analysis-synthesis');
        setLoading(true);
        addLog(`[SYNTHESIS] Initiating Comparative Analysis...`, "info");

        try {
            const humanComments = comments.map(c => c.feeling_text).filter(Boolean);
            if (userInput && !humanComments.includes(userInput)) {
                humanComments.unshift(userInput);
            }

            // PARSE AI KEYWORDS: 
            // Robustly handle string or array formats
            let aiKeywords = [];
            if (Array.isArray(aiReport.ai_feeling_keywords)) {
                aiKeywords = aiReport.ai_feeling_keywords;
            } else if (typeof aiReport.ai_feeling_keywords === 'string') {
                aiKeywords = aiReport.ai_feeling_keywords.split(/[\s,]+/);
            } else {
                aiKeywords = aiReport.ai_emotions || [];
            }

            // HUMAN KEYWORDS:
            const humanKeywords = keywords && keywords.length > 0 ? keywords : humanComments;

            // PREPARE TEXT BLOCKS FOR COMPARISON
            const aiDescriptionText = aiReport.ai_feeling_description || aiReport.ai_feeling || aiKeywords.join(", ");
            // Use user input if available, otherwise join top comments
            const humanDescriptionText = userInput || comments.slice(0, 3).map(c => c.feeling_text).join(". ");

            // DIRECT FETCH (Refined 3v3 Analysis)
            const consensusRes = await fetch('/api/analyze-consensus', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    aiEmotions: aiKeywords,
                    humanEmotions: humanKeywords
                })
            });

            if (!consensusRes.ok) {
                const errData = await consensusRes.json().catch(() => ({}));
                throw new Error(errData.error || "Consensus Failed");
            }

            const consensusData = await consensusRes.json();
            addLog(`[SYNTHESIS] Success. Model: ${consensusData.model_used}`, "success");
            addLog(`[SYNTHESIS] Semantic Match: ${consensusData.consensus_percentage}%`, "info");

            // Update Report with Synthesis Data
            setAiReport(prev => ({
                ...prev,
                consensus_score: consensusData.consensus_percentage || 0,
                // Map context_explanation to the 'analysis' field expected by UI consumers
                analysis: consensusData.context_explanation,
                model_used: `${prev.model_used} + ${consensusData.model_used}`,
            }));

            setConsensusData(consensusData);

            // Success Feedback
            setTimeout(() => openFeedback('success', 'Experiment Completed Successfully'), 2000);

        } catch (err) {
            console.error("Synthesis Error", err);
            setError(err.message || "Synthesis Failed");
            addLog(`[SYNTHESIS] Critical Failure: ${err.message}`, "error");
        } finally {
            setLoading(false);
        }
    };

    // SMART RETRY HANDLER
    const handleRetry = () => {
        setError(null); // Clear error if any

        // Re-trigger the current step's function
        if (step === 'analysis-ai') {
            analyzeAI();
        } else if (step === 'analysis-human') {
            analyzeHumans();
        } else if (step === 'analysis-synthesis') {
            synthesize();
        } else {
            // Fallback if step is unknown, though unlikely in this flow
            window.location.reload();
        }
    };

    const copyErrorToClipboard = () => {
        if (!error) return;
        navigator.clipboard.writeText(error).then(() => {
            alert("Error copied to clipboard");
        });
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

            {/* FEEDBACK MODAL */}
            <AnimatePresence>
                {feedbackModal.isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                            background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)',
                            zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            style={{
                                width: '90%', maxWidth: '800px', // Wider box
                                background: '#111', border: `1px solid ${feedbackModal.type === 'error' ? '#ff4444' : '#00ff00'}`,
                                borderRadius: '12px', padding: '40px', textAlign: 'center',
                                boxShadow: `0 0 50px ${feedbackModal.type === 'error' ? 'rgba(255, 68, 68, 0.1)' : 'rgba(0, 255, 0, 0.1)'}`
                            }}
                        >
                            <h3 style={{
                                fontFamily: "'Poppins', sans-serif", fontSize: '20px', fontWeight: 600,
                                color: feedbackModal.type === 'error' ? '#ff4444' : '#fff', marginBottom: '24px',
                                letterSpacing: '0.05em'
                            }}>
                                {feedbackModal.type === 'error' ? 'CONNECTION INTERRUPTED' : 'EXPERIMENT COMPLETE'}
                            </h3>

                            {/* Scrollable Error Content */}
                            <div style={{
                                maxHeight: '30vh', overflowY: 'auto',
                                background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '4px',
                                marginBottom: '24px', border: '1px solid rgba(255,255,255,0.05)',
                                textAlign: 'left'
                            }}>
                                <p style={{
                                    fontFamily: "'Inconsolata', monospace", color: '#ccc',
                                    marginBottom: '0', lineHeight: '1.6', fontSize: '11px', whiteSpace: 'pre-wrap'
                                }}>
                                    {feedbackModal.type === 'error'
                                        ? `ANALYSIS FAILED.\n\nDETAILS:\n${feedbackModal.context}`
                                        : "Thank you for participating in this study of human-machine divergence."}
                                </p>
                            </div>

                            <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '14px', color: '#888', marginBottom: '16px' }}>
                                Would you like to report this issue?
                            </p>

                            <textarea
                                value={feedbackText}
                                onChange={e => setFeedbackText(e.target.value)}
                                placeholder="Additional context (optional)..."
                                style={{
                                    width: '100%', height: '80px', background: '#222', border: '1px solid #333',
                                    color: '#fff', borderRadius: '8px', padding: '12px', fontFamily: "'Inconsolata', monospace",
                                    marginBottom: '32px', resize: 'none', fontSize: '13px'
                                }}
                            />
                            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                                <button
                                    onClick={() => setFeedbackModal({ ...feedbackModal, isOpen: false })}
                                    className="hover-btn"
                                    style={{
                                        padding: '14px 32px', background: 'transparent', border: '1px solid #666',
                                        color: '#aaa', borderRadius: '50px', cursor: 'pointer', fontFamily: "'Poppins', sans-serif",
                                        fontSize: '12px', letterSpacing: '0.05em', transition: 'all 0.2s'
                                    }}
                                    onMouseOver={e => { e.currentTarget.style.borderColor = '#fff'; e.currentTarget.style.color = '#fff'; }}
                                    onMouseOut={e => { e.currentTarget.style.borderColor = '#666'; e.currentTarget.style.color = '#aaa'; }}
                                >
                                    CLOSE & RETRY
                                </button>
                                <button
                                    onClick={handleSendFeedback}
                                    disabled={sendingFeedback}
                                    className="hover-btn"
                                    style={{
                                        padding: '14px 40px',
                                        background: feedbackModal.type === 'error' ? '#ff4444' : '#fff',
                                        color: feedbackModal.type === 'error' ? '#fff' : '#000',
                                        border: 'none', borderRadius: '50px', cursor: 'pointer',
                                        fontWeight: 600, fontFamily: "'Poppins', sans-serif",
                                        fontSize: '12px', letterSpacing: '0.05em', transition: 'transform 0.2s',
                                        opacity: sendingFeedback ? 0.7 : 1
                                    }}
                                    onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
                                    onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                                >
                                    {sendingFeedback ? 'SENDING...' : 'SEND REPORT'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* NEW LEFT-SIDE CONTROLS (Restart + Nav) - Below "Go back" link */}
            <AnimatePresence>
                {(step.startsWith('analysis') || step === 'viz' || step === 'consensus') && (
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        style={{
                            position: 'fixed',
                            top: '80px', // Below the "Go back to homepage" link (approx 20px + 40px height + gap)
                            left: '20px',
                            zIndex: 10001,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                            alignItems: 'flex-start'
                        }}
                    >
                        {/* RESTART BUTTON */}
                        <button
                            onClick={() => window.location.reload()}
                            className="hover-btn"
                            style={{
                                background: 'rgba(0,0,0,0.6)',
                                border: '1px solid rgba(255, 255, 255, 0.3)',
                                borderRadius: '4px',
                                padding: '8px 16px',
                                color: '#fff',
                                fontFamily: "'Inconsolata', monospace",
                                fontSize: '11px',
                                textTransform: 'uppercase',
                                cursor: 'pointer',
                                backdropFilter: 'blur(5px)',
                                letterSpacing: '0.1em',
                                width: '100%',
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                            onMouseOver={e => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                e.currentTarget.style.borderColor = '#fff';
                            }}
                            onMouseOut={e => {
                                e.currentTarget.style.background = 'rgba(0,0,0,0.6)';
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                            }}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                            RESTART
                        </button>

                        {/* NAVIGATION BUTTONS */}
                        <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                            <button
                                onClick={handlePrev}
                                disabled={step === 'viz' || step === 'select'}
                                className="hover-btn"
                                style={{
                                    flex: 1,
                                    background: 'rgba(0,0,0,0.6)',
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    borderRadius: '4px',
                                    padding: '8px',
                                    color: (step === 'viz' || step === 'select') ? '#555' : '#fff',
                                    fontFamily: "'Inconsolata', monospace",
                                    fontSize: '11px',
                                    cursor: (step === 'viz' || step === 'select') ? 'default' : 'pointer',
                                    backdropFilter: 'blur(5px)',
                                    display: 'flex', justifyContent: 'center', alignItems: 'center'
                                }}
                                onMouseOver={e => {
                                    if (step !== 'viz' && step !== 'select') {
                                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                        e.currentTarget.style.borderColor = '#fff';
                                    }
                                }}
                                onMouseOut={e => {
                                    e.currentTarget.style.background = 'rgba(0,0,0,0.6)';
                                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                                }}
                            >
                                ← PREV
                            </button>
                            <button
                                onClick={handleNext}
                                disabled={step === 'analysis-synthesis'}
                                className="hover-btn"
                                style={{
                                    flex: 1,
                                    background: 'rgba(0,0,0,0.6)',
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    borderRadius: '4px',
                                    padding: '8px',
                                    color: step === 'analysis-synthesis' ? '#555' : '#fff',
                                    fontFamily: "'Inconsolata', monospace",
                                    fontSize: '11px',
                                    cursor: step === 'analysis-synthesis' ? 'default' : 'pointer',
                                    backdropFilter: 'blur(5px)',
                                    display: 'flex', justifyContent: 'center', alignItems: 'center'
                                }}
                                onMouseOver={e => {
                                    if (step !== 'analysis-synthesis') {
                                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                        e.currentTarget.style.borderColor = '#fff';
                                    }
                                }}
                                onMouseOut={e => {
                                    e.currentTarget.style.background = 'rgba(0,0,0,0.6)';
                                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                                }}
                            >
                                NEXT →
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* STATUS LOG - TOP RIGHT (Below Restart Button) */}
            <AnimatePresence>
                {(logs.length > 0 && (step.startsWith('analysis') || step === 'viz' || step === 'consensus')) && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        style={{
                            position: 'fixed',
                            top: '70px', /* Shifted down to avoid overlap with Restart Button */
                            right: '20px',
                            width: '300px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px',
                            zIndex: 9999,
                        }}
                    >
                        {/* TERMINAL CONTAINER */}
                        <div style={{
                            width: '100%',
                            maxHeight: '400px',
                            background: 'rgba(0, 0, 0, 0.85)',
                            border: '1px solid rgba(0, 255, 0, 0.2)',
                            borderRadius: '8px',
                            padding: '12px',
                            fontFamily: "'Fira Code', monospace",
                            fontSize: '10px',
                            color: '#0f0',
                            overflowY: 'auto',
                            boxShadow: '0 0 20px rgba(0, 255, 0, 0.1)',
                            backdropFilter: 'blur(5px)'
                        }}>
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
                .blinking-cursor {
                    animation: blink 1s step-end infinite;
                }
                @keyframes blink { 50% { opacity: 0; } }
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

                            {/* 5. ACTION BUTTON (RESTORED) */}
                            {!loading && (
                                <button
                                    onClick={analyzeAI}
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
                                    Analyze What AI Feels
                                </button>
                            )}

                        </motion.div>
                    )}


                    {/* STEP 4: AI ANALYSIS & COMPARISON */}
                    {/* MULTI-STAGE ANALYSIS PIPELINE */}
                    {
                        step.startsWith('analysis') && (
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
                                {/* Removed Top Right Controls (Restart + Nav) - Moved to Persistent Left Side */}
                                {loading ? (
                                    <div className="loader" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                                        <div style={{ position: 'relative', width: '120px', height: '120px', marginBottom: '40px' }}>
                                            {/* Static Ring */}
                                            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)' }} />

                                            {/* Spinning Glow */}
                                            <motion.div
                                                animate={{ rotate: 360 }}
                                                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                                                style={{
                                                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', borderRadius: '50%',
                                                    borderTop: '2px solid #00f3ff', borderRight: '2px solid transparent',
                                                    boxShadow: '0 0 20px rgba(0, 243, 255, 0.3)'
                                                }}
                                            />

                                            {/* Center Percentage */}
                                            <div style={{
                                                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                <span style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '24px', color: '#fff' }}>
                                                    {Math.round(progress)}%
                                                </span>
                                            </div>
                                        </div>

                                        {/* Status Sequence */}
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '18px', letterSpacing: '0.05em', color: '#fff', marginBottom: '8px' }}>
                                                {step === 'analysis-ai' ? (progress < 40 ? 'SCANNING PIXELS' : progress < 80 ? 'DETECTING CONTEXT' : 'SYNTHESIZING EMOTION') :
                                                    step === 'analysis-human' ? (progress < 50 ? 'READING MEMORIES' : 'EXTRACTING THEMES') :
                                                        'CALCULATING GAP'}
                                            </div>
                                            <div style={{ fontFamily: 'Inconsolata, monospace', fontSize: '12px', color: '#666' }}>
                                                {step === 'analysis-ai' && progress < 30 && `[Vectors: ${(progress * 124).toFixed(0)}]`}
                                                {step === 'analysis-ai' && progress >= 30 && progress < 55 && `[Layer: Deep Convolution]`}
                                                {step === 'analysis-ai' && progress >= 55 && progress < 75 && `[Layer: Multi-Head Attention]`}
                                                {step === 'analysis-ai' && progress >= 75 && `[Layer: Semantic Weights]`}

                                                {step === 'analysis-human' && progress < 50 && `[Scanning Collective Memory...]`}
                                                {step === 'analysis-human' && progress >= 50 && `[Sources: ${comments.length} verified]`}

                                                {step === 'analysis-synthesis' && `[Divergence Check...]`}
                                            </div>

                                            {/* MANUAL RESTART BRIDGE - For slow connections/model hangs */}
                                            {progress > 50 && (
                                                <motion.div
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    style={{ marginTop: '30px' }}
                                                >
                                                    <p style={{ fontSize: '10px', color: '#444', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                                        Taking longer than expected?
                                                    </p>
                                                    <button
                                                        onClick={handleRetry}
                                                        className="hover-btn"
                                                        style={{
                                                            padding: '10px 24px',
                                                            background: 'rgba(255, 255, 255, 0.05)',
                                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                                            color: '#888',
                                                            borderRadius: '100px',
                                                            fontSize: '11px',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.3s'
                                                        }}
                                                        onMouseOver={e => { e.target.style.background = 'rgba(255,255,255,0.1)'; e.target.style.color = '#fff'; }}
                                                        onMouseOut={e => { e.target.style.background = 'rgba(255,255,255,0.05)'; e.target.style.color = '#888'; }}
                                                    >
                                                        FORCE RESTART STEP
                                                    </button>
                                                </motion.div>
                                            )}

                                            {/* REAL-TIME STATUS - Added per user request */}
                                            {/* REAL-TIME TERMINAL LOG */}
                                            <div
                                                className="terminal-window"
                                                style={{
                                                    marginTop: '20px',
                                                    width: '100%',
                                                    maxWidth: '600px',
                                                    height: '120px',
                                                    background: 'rgba(0, 0, 0, 0.6)',
                                                    border: '1px solid rgba(0, 243, 255, 0.3)',
                                                    borderRadius: '4px',
                                                    padding: '12px',
                                                    overflowY: 'auto',
                                                    textAlign: 'left',
                                                    fontFamily: "'Fira Code', monospace",
                                                    fontSize: '11px',
                                                    boxShadow: '0 0 15px rgba(0, 243, 255, 0.1) inset'
                                                }}
                                            >
                                                {logs.map((log, i) => (
                                                    <div key={i} style={{ marginBottom: '4px', color: log.type === 'error' ? '#ff4444' : log.type === 'success' ? '#00ff66' : '#00f3ff' }}>
                                                        <span style={{ opacity: 0.5 }}>[{log.timestamp.toLocaleTimeString()}]</span> {log.message}
                                                    </div>
                                                ))}
                                                <div ref={logEndRef} />
                                            </div>

                                            {/* COMPACT ERROR UI */}
                                            {error && (
                                                <div style={{ marginTop: '10px' }}>
                                                    <div style={{ color: '#ff4444', fontSize: '11px', fontFamily: 'monospace', cursor: 'pointer', marginBottom: '4px', textDecoration: 'underline' }} onClick={() => navigator.clipboard.writeText(error)}>
                                                        [COPY ERROR]
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                                                        <button onClick={handleRetry} className="hover-btn" style={{ padding: '4px 12px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', fontSize: '10px', borderRadius: '4px', cursor: 'pointer' }}>RETRY</button>
                                                        <button onClick={() => openFeedback('error', `Reported Error: ${error}`)} className="hover-btn" style={{ padding: '4px 12px', background: '#ff4444', color: '#fff', border: 'none', fontSize: '10px', borderRadius: '4px', cursor: 'pointer' }}>REPORT</button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {/* ERROR DISPLAY - COMPACT & CONTEXTUAL */}
                                        {
                                            error && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: -10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    style={{
                                                        maxWidth: '500px', margin: '0 auto 30px',
                                                        padding: '10px 20px',
                                                        borderLeft: '2px solid #ff4444',
                                                        background: 'rgba(0,0,0,0.3)',
                                                        textAlign: 'left',
                                                        display: 'flex', flexDirection: 'column', gap: '8px'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#ff4444', textTransform: 'uppercase' }}>
                                                            PROCESS FAILURE
                                                        </span>
                                                        <button
                                                            onClick={copyErrorToClipboard}
                                                            style={{ background: 'none', border: 'none', color: '#666', fontSize: '10px', cursor: 'pointer', textDecoration: 'underline' }}
                                                        >
                                                            COPY ERROR
                                                        </button>
                                                    </div>

                                                    <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#999', lineHeight: '1.4' }}>
                                                        {error}
                                                    </div>

                                                    <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                                                        <button
                                                            onClick={handleRetry}
                                                            className="hover-btn"
                                                            style={{
                                                                padding: '6px 16px', borderRadius: '4px',
                                                                background: 'rgba(255,255,255,0.1)', color: '#fff',
                                                                border: 'none', fontSize: '10px', fontWeight: 600, cursor: 'pointer'
                                                            }}
                                                        >
                                                            RETRY STEP
                                                        </button>

                                                        <button
                                                            onClick={() => openFeedback('error', `Reported Error: ${error}`)}
                                                            className="hover-btn"
                                                            style={{
                                                                padding: '6px 16px', borderRadius: '4px',
                                                                background: '#ff4444', color: '#fff',
                                                                border: 'none', fontSize: '10px', fontWeight: 600, cursor: 'pointer',
                                                                flex: 1
                                                            }}
                                                        >
                                                            SEND ERROR REPORT
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            )
                                        }

                                        {/* HEADER - Top Spacer */}
                                        <div style={{ textAlign: 'center', marginBottom: '20px', flexShrink: 0 }}>
                                            <p style={{ color: '#666', fontSize: '11px', fontFamily: 'monospace', textTransform: 'uppercase' }}>
                                                {step === 'analysis-ai' ? 'STAGE 1: MACHINE PERCEPTION' : (step === 'analysis-human' ? 'STAGE 2: HUMAN SENTIMENT' : 'STAGE 3: FINAL SYNTHESIS')}
                                            </p>
                                        </div>

                                        {/* STAGE 1: AI VIEW (Centered, Clean, Split) */}
                                        {step === 'analysis-ai' && (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                style={{ textAlign: 'center', maxWidth: '800px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '40px' }}
                                            >
                                                {/* SECTION A: WHAT AI SAW */}
                                                <div>
                                                    <div style={{ fontSize: '12px', color: '#00f3ff', letterSpacing: '0.2em', marginBottom: '12px', fontFamily: 'monospace', textTransform: 'uppercase' }}>
                                                        WHAT AI SAW
                                                    </div>
                                                    <div style={{ fontSize: '14px', color: '#ccc', lineHeight: '1.6', fontFamily: 'monospace', maxWidth: '600px', margin: '0 auto' }}>
                                                        "{aiReport?.visual_summary}"
                                                    </div>
                                                </div>

                                                {/* SECTION B: WHAT AI FELT */}
                                                <div>
                                                    <div style={{ fontSize: '12px', color: '#00f3ff', letterSpacing: '0.2em', marginBottom: '12px', fontFamily: 'monospace', textTransform: 'uppercase' }}>
                                                        WHAT AI FELT
                                                    </div>
                                                    <div style={{
                                                        fontSize: '24px', fontWeight: 300, color: '#fff',
                                                        marginBottom: '16px', fontFamily: '"Cormorant Garamond", serif', fontStyle: 'italic', maxWidth: '600px'
                                                    }}>
                                                        "{aiReport?.ai_feeling_description || aiReport?.ai_feeling || "Analyzing..."}"
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                                                        {aiReport?.ai_keywords?.slice(0, 3).map((kw, i) => (
                                                            <span key={i} style={{
                                                                fontSize: '11px', fontFamily: 'monospace', color: '#00f3ff',
                                                                padding: '6px 12px', background: 'rgba(0, 243, 255, 0.05)',
                                                                border: '1px solid rgba(0, 243, 255, 0.2)', borderRadius: '100px'
                                                            }}>
                                                                {kw}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}

                                        {/* STAGE 2 & 3: COMPARATIVE VIEW (Side-by-Side, EMOTION ONLY) */}
                                        {(step === 'analysis-human' || step === 'analysis-synthesis') && (
                                            <div style={{
                                                display: 'grid', gridTemplateColumns: '1fr 1px 1fr', gap: '40px', width: '100%', maxWidth: '1000px',
                                                flex: 1, alignItems: 'center', padding: '0 20px'
                                            }}>
                                                {/* AI SIDE (Left) - STRICTLY EMOTION ONLY */}
                                                <motion.div
                                                    initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                                                    style={{ textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: '20px' }}
                                                >
                                                    <div style={{ fontSize: '11px', color: '#00f3ff', letterSpacing: '0.2em', marginBottom: '24px', fontFamily: 'monospace' }}>MACHINE FEELING</div>

                                                    {/* Primary Emotion (Large) - NOW USING KEYWORDS */}
                                                    <div style={{
                                                        fontSize: '32px', lineHeight: '1.2', color: '#fff', marginBottom: '24px',
                                                        fontFamily: 'monospace', textTransform: 'uppercase',
                                                        display: 'flex', flexDirection: 'column', gap: '8px'
                                                    }}>
                                                        {aiReport?.ai_feeling_keywords && Array.isArray(aiReport.ai_feeling_keywords) ? (
                                                            aiReport.ai_feeling_keywords.slice(0, 3).map((k, i) => (
                                                                <span key={i}>{k}</span>
                                                            ))
                                                        ) : (
                                                            <span>{aiReport?.dominant_emotion || "ANALYZING"}</span>
                                                        )}
                                                    </div>

                                                    {/* Secondary Emotions (Keywords) - REMOVED for clean trinity focus per user request */}
                                                    {/* 
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                                                        {aiReport?.ai_emotions?.slice(0, 3).map((e, i) => (
                                                            <span key={i} style={{
                                                                color: '#00f3ff', fontSize: '12px', border: '1px solid rgba(0, 243, 255, 0.3)',
                                                                padding: '6px 14px', borderRadius: '100px', background: 'rgba(0, 243, 255, 0.05)', fontFamily: 'monospace'
                                                            }}>
                                                                {e}
                                                            </span>
                                                        ))}
                                                    </div> 
                                                    */}
                                                </motion.div>

                                                {/* Divider Line (Grid Column 2) */}
                                                <div style={{ height: '60%', width: '1px', background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.2), transparent)' }} />

                                                {/* HUMAN SIDE (Right) - STRICTLY EMOTION ONLY */}
                                                <motion.div
                                                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                                                    style={{ textAlign: 'center', paddingLeft: '20px' }}
                                                >
                                                    <div style={{ fontSize: '11px', color: '#ff0055', letterSpacing: '0.2em', marginBottom: '24px', fontFamily: 'monospace' }}>HUMAN FEELING</div>

                                                    {/* Primary Emotion (Large) - NOW USING KEYWORDS */}
                                                    <div style={{
                                                        fontSize: '32px', lineHeight: '1.2', color: '#fff', marginBottom: '24px',
                                                        fontFamily: 'monospace', textTransform: 'uppercase',
                                                        display: 'flex', flexDirection: 'column', gap: '8px'
                                                    }}>
                                                        {keywords && keywords.length > 0 ? (
                                                            keywords.slice(0, 3).map((k, i) => (
                                                                <span key={i}>{k}</span>
                                                            ))
                                                        ) : (
                                                            <span>{userInput || "COLLECTIVE"}</span>
                                                        )}
                                                    </div>

                                                    {/* Secondary Emotions (Keywords) - REMOVED for clean trinity focus per user request */}
                                                    {/* 
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                                                        {keywords.slice(0, 3).map((k, i) => (
                                                            <span key={i} style={{
                                                                color: '#ff0055', fontSize: '12px', border: '1px solid rgba(255,0,85,0.3)',
                                                                padding: '6px 14px', borderRadius: '100px', background: 'rgba(255, 0, 85, 0.05)', fontFamily: 'monospace'
                                                            }}>
                                                                {k}
                                                            </span>
                                                        ))}
                                                    </div> 
                                                    */}
                                                </motion.div>
                                            </div>
                                        )}

                                        {/* STAGE 3: CONSENSUS RESULT (Direct Display - No Toggle) */}
                                        {step === 'analysis-synthesis' && (
                                            <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                style={{
                                                    width: '100%', height: '100%',
                                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                                    padding: '20px'
                                                }}
                                            >
                                                <div style={{ fontSize: '12px', color: '#888', letterSpacing: '0.2em', marginBottom: '20px', fontFamily: 'monospace' }}>SEMANTIC CONSENSUS</div>

                                                <div style={{
                                                    fontSize: '120px', fontWeight: 800, lineHeight: 1,
                                                    color: consensusData?.consensus_percentage > 50 ? '#00ff66' : '#ff4444',
                                                    textShadow: '0 0 50px rgba(0,0,0,0.5)', fontFamily: 'monospace'
                                                }}>
                                                    {consensusData?.consensus_percentage}%
                                                </div>

                                                {/* Context Explanation */}
                                                <div style={{
                                                    fontSize: '18px', maxWidth: '600px', textAlign: 'center',
                                                    color: '#fff', fontFamily: 'monospace',
                                                    margin: '30px 0', lineHeight: '1.6'
                                                }}>
                                                    {consensusData?.context_explanation}
                                                </div>

                                                <button
                                                    onClick={() => window.location.reload()}
                                                    className="hover-btn"
                                                    style={{
                                                        marginTop: '20px', padding: '16px 48px',
                                                        background: '#fff', color: '#000', borderRadius: '100px',
                                                        fontSize: '14px', fontWeight: 600, letterSpacing: '0.1em', cursor: 'pointer'
                                                    }}
                                                >
                                                    START NEW EXPERIMENT
                                                </button>
                                            </motion.div>
                                        )}


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

                                            <div style={{ marginTop: '0px', marginBottom: '30px' }}>
                                                {/* OLD ERROR UI REMOVED */}
                                            </div>

                                            {/* PRIMARY ACTION BUTTONS (RESTORED) */}
                                            <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginTop: '40px' }}>
                                                {step === 'analysis-ai' && (
                                                    <button
                                                        onClick={analyzeHumans}
                                                        className="hover-btn"
                                                        style={{
                                                            padding: '16px 48px',
                                                            background: '#ff0055', color: '#fff',
                                                            border: 'none', borderRadius: '100px',
                                                            fontWeight: 600, fontSize: '13px', letterSpacing: '0.1em',
                                                            cursor: 'pointer', boxShadow: '0 0 20px rgba(255,0,85,0.3)'
                                                        }}
                                                    >
                                                        REVEAL HUMAN PERSPECTIVE
                                                    </button>
                                                )}
                                                {step === 'analysis-human' && (
                                                    <button
                                                        onClick={synthesize}
                                                        className="hover-btn"
                                                        style={{
                                                            padding: '16px 48px',
                                                            background: '#fff', color: '#000',
                                                            border: 'none', borderRadius: '100px',
                                                            fontWeight: 600, fontSize: '13px', letterSpacing: '0.1em',
                                                            cursor: 'pointer', boxShadow: '0 0 30px rgba(255,255,255,0.2)'
                                                        }}
                                                    >
                                                        CALCULATE CONSENSUS
                                                    </button>
                                                )}
                                                {step === 'analysis-synthesis' && (
                                                    /* Synthesis has its own reload button in main block, no extra button needed here */
                                                    null
                                                )}
                                            </div>

                                            {/* Punctum Reference Link */}

                                            {/* Punctum Reference Link */}

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
                                                        color: '#444',
                                                        textDecoration: 'none',
                                                        transition: 'color 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => e.target.style.color = '#fff'}
                                                    onMouseLeave={(e) => e.target.style.color = '#444'}
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
        </div>
    );
}

