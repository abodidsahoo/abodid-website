import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import AudioRecorder from './AudioRecorder';
import ConstellationGraph from './ConstellationGraph';

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
import { isSupabaseConfigured } from '../lib/services/utils';

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

const normalizeImageKey = (value) => {
    if (!value || typeof value !== 'string') return '';
    try {
        const parsed = new URL(value);
        return `${parsed.origin}${parsed.pathname}`;
    } catch {
        return value.split('?')[0];
    }
};

const normalizePhotoUrl = (value) => (typeof value === 'string' ? value.trim() : '');

const getGalleryUrls = (rawGallery) => {
    if (!Array.isArray(rawGallery)) return [];
    return rawGallery
        .map((entry) => {
            if (typeof entry === 'string') return normalizePhotoUrl(entry);
            if (entry && typeof entry === 'object') return normalizePhotoUrl(entry.url);
            return '';
        })
        .filter(Boolean);
};

const collectPhotographyUrls = (rows) => {
    const urls = [];
    const seen = new Set();

    const addUrl = (url) => {
        const clean = normalizePhotoUrl(url);
        if (!clean) return;
        const key = normalizeImageKey(clean);
        if (!key || seen.has(key)) return;
        seen.add(key);
        urls.push(clean);
    };

    (rows || []).forEach((row) => {
        addUrl(row?.cover_image);
        getGalleryUrls(row?.gallery_images).forEach(addUrl);
    });

    return urls;
};

const normalizeImages = (data) => {
    const list = Array.isArray(data) ? data : [];
    return list
        .map((item) => {
            const url = typeof item === 'string'
                ? item
                : (item?.url || item?.cover_image || item?.image_url);
            return {
                id: typeof item === 'string' ? item : (item?.id || url),
                url,
                title: typeof item === 'string' ? '' : (item?.title || ''),
                key: normalizeImageKey(url)
            };
        })
        .filter(img => img.url);
};

const shuffleArray = (input) => {
    const arr = [...input];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

const buildConsensusNarrative = (consensusScore) => {
    if (typeof consensusScore !== 'number') return "Consensus analysis pending.";
    if (consensusScore >= 70) {
        return "High semantic consensus. Because the AI is closely aligned with human feeling, this image does not require much additional social context to be interpreted correctly.";
    }
    if (consensusScore >= 40) {
        return "Moderate consensus. The AI is partially aligned, but added social context would still sharpen emotional interpretation.";
    }
    return "Low consensus. The AI has not converged on what people feel, so richer social context is likely needed.";
};

export default function PunctumGame() {
    const getPrimaryModel = (value) => {
        if (!value) return null;
        if (typeof value !== 'string') return value;
        return value.split(' + ')[0].trim();
    };
    const [step, setStep] = useState('intro'); // intro, select, input, viz, consensus, analysis
    const [images, setImages] = useState([]);
    const [allImages, setAllImages] = useState([]);
    const [selectedImage, setSelectedImage] = useState(null);
    const [userInput, setUserInput] = useState('');
    const [audioData, setAudioData] = useState({ blob: null, duration: 0 });
    const [comments, setComments] = useState([]);
    const [modelMode, setModelMode] = useState('free'); // 'free' | 'paid'
    const [analysisResult, setAnalysisResult] = useState(null);
    const [keywords, setKeywords] = useState([]);
    const [consensusData, setConsensusData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState([]);
    const [voiceTranscript, setVoiceTranscript] = useState('');
    const [transcriptionStatus, setTranscriptionStatus] = useState('');
    const [rollingIndex, setRollingIndex] = useState(0);
    const [showCollectiveAnalysis, setShowCollectiveAnalysis] = useState(false);
    const [aiViewMode, setAiViewMode] = useState('visual'); // visual | feeling
    const [aiVisualRevealed, setAiVisualRevealed] = useState(false);

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
    const [displayCount, setDisplayCount] = useState(8);
    const commentCount = comments.filter(c => c?.feeling_text || c?.audio_url).length;
    const [commentCountsByUrl, setCommentCountsByUrl] = useState({});
    const [loadingCommentCounts, setLoadingCommentCounts] = useState(false);
    const [commentCountsError, setCommentCountsError] = useState(false);
    const [showCommentedOnly, setShowCommentedOnly] = useState(false);

    const getCommentLabel = (comment, index) => {
        if (comment?.feeling_text) return comment.feeling_text;
        if (comment?.audio_url) return `Audio response ${index}`;
        return 'Response';
    };

    const commentTexts = comments
        .map((c, i) => getCommentLabel(c, i + 1))
        .filter(Boolean);

    const rollingTexts = commentTexts.length ? commentTexts : ['Waiting for responses...'];
    const rollingLen = rollingTexts.length;
    const rollingCurrentIndex = rollingLen ? (rollingIndex % rollingLen) : 0;
    const rollingPrev = rollingTexts[(rollingCurrentIndex - 1 + rollingLen) % rollingLen];
    const rollingCurrent = rollingTexts[rollingCurrentIndex];
    const rollingNext = rollingTexts[(rollingCurrentIndex + 1) % rollingLen];
    const truncateText = (text, maxLen = 60) => {
        if (!text) return '';
        return text.length > maxLen ? `${text.slice(0, Math.max(0, maxLen - 1))}…` : text;
    };



    // Auto-scroll ref for terminal
    const logEndRef = useRef(null);

    // Auto-scroll to bottom of logs
    useEffect(() => {
        if (logEndRef.current) {
            logEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [logs]);

    // Responsive display count (10 desktop, 8 otherwise)
    useEffect(() => {
        const updateCount = () => {
            const width = window.innerWidth;
            setDisplayCount(width >= 1200 ? 10 : 8);
        };
        updateCount();
        window.addEventListener('resize', updateCount);
        return () => window.removeEventListener('resize', updateCount);
    }, []);

    useEffect(() => {
        if (step === 'analysis-ai') {
            setAiViewMode('visual');
            setAiVisualRevealed(false);
        }
    }, [step]);

    useEffect(() => {
        if (step === 'viz') {
            setShowCollectiveAnalysis(false);
        }
    }, [step]);

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
                if (!isSupabaseConfigured() || !supabase) {
                    throw new Error("Supabase not configured");
                }

                const { data, error } = await supabase
                    .from('photography')
                    .select('id, title, cover_image, gallery_images, published, sort_order, created_at')
                    .eq('published', true)
                    .order('sort_order', { ascending: true })
                    .order('created_at', { ascending: false });

                if (error) throw error;

                const urls = collectPhotographyUrls(data || []);
                const normalized = normalizeImages(urls);
                if (normalized.length === 0) throw new Error("No images found in database");

                const shuffled = shuffleArray(normalized);
                if (retryCount > 0) addLog(`[SYSTEM] Connection restored. Loaded ${normalized.length} images.`, 'success');

                setAllImages(normalized);
                setImages(shuffled);
            } catch (err) {
                console.error("Failed to fetch images", err);

                if (retryCount < 2) {
                    addLog(`[SYSTEM] Connection failed (${err?.message || 'Unknown error'}). Retrying... (${retryCount + 1}/3)`, 'warning');
                    setTimeout(() => fetchImages(retryCount + 1), 2000);
                } else {
                    addLog(`[SYSTEM] Critical Failure: ${err?.message || 'Unknown error'}. Enabling Emergency Fallback Protocol.`, 'error');
                    const fallback = normalizeImages(FALLBACK_IMAGES);
                    setAllImages(fallback);
                    setImages(shuffleArray(fallback));
                }
            }
        };
        fetchImages();
    }, []);

    // 1.5. FETCH COMMENT COUNTS (for selection filter)
    useEffect(() => {
        const fetchCommentCounts = async () => {
            setLoadingCommentCounts(true);
            setCommentCountsError(false);
            try {
                if (!isSupabaseConfigured() || !supabase) {
                    setCommentCountsByUrl({});
                    setCommentCountsError(true);
                    setShowCommentedOnly(false);
                    return;
                }

                const { data, error } = await supabase
                    .from('photo_feedback')
                    .select('image_url')
                    .or('project_id.is.null,project_id.eq.invisible-punctum')
                    .not('image_url', 'is', null);

                if (error) throw error;

                const counts = {};
                (data || []).forEach(row => {
                    const key = normalizeImageKey(row?.image_url);
                    if (!key) return;
                    counts[key] = (counts[key] || 0) + 1;
                });

                setCommentCountsByUrl(counts);
            } catch (err) {
                console.error("Failed to fetch comment counts", err);
                setCommentCountsByUrl({});
                setCommentCountsError(true);
                setShowCommentedOnly(false);
            } finally {
                setLoadingCommentCounts(false);
            }
        };
        fetchCommentCounts();
    }, []);

    // 2. FETCH COMMENTS
    useEffect(() => {
        if (!selectedImage) return;
        const fetchComments = async () => {
            try {
                const { data, error } = await supabase
                    .from('photo_feedback')
                    .select('id, feeling_text, audio_url, created_at')
                    .eq('image_url', selectedImage.url)
                    .or('project_id.is.null,project_id.eq.invisible-punctum')
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
    const [progressTarget, setProgressTarget] = useState(0);
    const [progressSpeed, setProgressSpeed] = useState(0.6);
    const [progressIntervalMs, setProgressIntervalMs] = useState(60);
    const [progressBoost, setProgressBoost] = useState(false);
    const [synthesisReady, setSynthesisReady] = useState(false);
    const [showLoader, setShowLoader] = useState(false);
    const progressRef = useRef(0);

    useEffect(() => {
        progressRef.current = progress;
    }, [progress]);

    // Configure smooth progress behavior
    useEffect(() => {
        if (!loading && !loadingKeywords && showLoader) {
            return;
        }

        if (!loading && !loadingKeywords && !showLoader) {
            setProgress(0);
            setProgressTarget(0);
            setProgressSpeed(0.6);
            setProgressIntervalMs(60);
            setProgressBoost(false);
            setSynthesisReady(false);
            return;
        }

        if (loadingKeywords) {
            setProgressTarget(100);
            setProgressSpeed(0.7);
            setProgressIntervalMs(60);
            setProgressBoost(false);
            return;
        }

        if (step === 'analysis-synthesis') {
            setProgressTarget(synthesisReady ? 100 : 99);
            setProgressSpeed(synthesisReady ? 1 : 0.2);
            setProgressIntervalMs(synthesisReady ? 20 : 60);
            setProgressBoost(!!synthesisReady);
            return;
        }

        setProgressTarget(99);
        setProgressSpeed(0.45);
        setProgressIntervalMs(60);
        setProgressBoost(false);
    }, [loading, loadingKeywords, step, synthesisReady, showLoader]);

    // Continuous progress ticking
    useEffect(() => {
        if (!loading && !loadingKeywords && !showLoader) return;

        const interval = setInterval(() => {
            setProgress(prev => {
                if (prev >= progressTarget) return prev;
                const slowFactor = progressBoost
                    ? 1
                    : prev >= 90
                        ? 0.15
                    : prev >= 70
                        ? 0.35
                    : prev >= 50
                                ? 0.6
                                : 1;
                const increment = progressSpeed * slowFactor;
                const next = prev + increment;
                return next > progressTarget ? progressTarget : next;
            });
        }, progressIntervalMs);

        return () => clearInterval(interval);
    }, [loading, loadingKeywords, showLoader, progressTarget, progressSpeed, progressIntervalMs, progressBoost]);

    useEffect(() => {
        if (loading || loadingKeywords) {
            setShowLoader(true);
        }
    }, [loading, loadingKeywords]);

    useEffect(() => {
        if (loading || loadingKeywords || !showLoader) return;
        setProgressTarget(100);
        setProgressSpeed(1);
        setProgressIntervalMs(20);
        setProgressBoost(true);
        const done = setInterval(() => {
            if (progressRef.current >= 100) {
                clearInterval(done);
                setProgressBoost(false);
                setShowLoader(false);
            }
        }, 30);
        return () => clearInterval(done);
    }, [loading, loadingKeywords, showLoader]);

    const waitForProgress = (target) => {
        return new Promise(resolve => {
            const tick = setInterval(() => {
                if (progressRef.current >= target) {
                    clearInterval(tick);
                    resolve();
                }
            }, 30);
        });
    };

    useEffect(() => {
        if (comments.length === 0 || loadingKeywords || !modelMode) return;

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
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ comments: commentList, modelMode })
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
    }, [comments, modelMode]);

    useEffect(() => {
        if (!comments.length) return;
        const interval = setInterval(() => {
            setRollingIndex(prev => {
                const len = Math.max(comments.length, 1);
                return (prev + 1) % len;
            });
        }, 600);
        return () => clearInterval(interval);
    }, [comments.length]);

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
        setVoiceTranscript('');
        setTranscriptionStatus('');
    };

    const handleTranscriptUpdate = (text, meta = {}) => {
        setVoiceTranscript(text || '');
        if (meta.isFinal && text && text.trim()) {
            setUserInput(prev => {
                const clean = prev.trim();
                const finalText = text.trim();
                if (!clean) return finalText;
                if (clean.includes(finalText)) return prev;
                return `${clean} ${finalText}`;
            });
        }
    };

    const getImageKey = (img) => img?.key || normalizeImageKey(img?.url);

    const getCommentedImages = (list) => {
        return list.filter(img => (commentCountsByUrl[getImageKey(img)] || 0) > 0);
    };

    const shuffleSelection = () => {
        if (!allImages.length) return;
        const base = showCommentedOnly ? getCommentedImages(allImages) : allImages;
        const shuffled = shuffleArray(base);
        setImages(shuffled);
    };

    const toggleCommentFilter = () => {
        if (!allImages.length || loadingCommentCounts || commentCountsError) return;
        const next = !showCommentedOnly;
        setShowCommentedOnly(next);
        const base = next ? getCommentedImages(allImages) : allImages;
        setImages(shuffleArray(base));
    };

    useEffect(() => {
        if (!showCommentedOnly) return;
        if (!allImages.length) return;
        if (commentCountsError) {
            setImages(shuffleArray(allImages));
            return;
        }
        const filtered = getCommentedImages(allImages);
        setImages(shuffleArray(filtered));
    }, [showCommentedOnly, commentCountsByUrl, allImages, commentCountsError]);

    const handleSelect = (img) => {
        setSelectedImage(img);
        setStep('context');
        setAudioData({ blob: null, duration: 0 });
        setUserInput('');
    };

    const transcribeAudioServer = async (blob, commentId) => {
        if (!blob || !commentId) return;
        try {
            setTranscriptionStatus('pending');
            const form = new FormData();
            form.append('file', blob, `voice-${Date.now()}.webm`);
            form.append('mode', modelMode);

            const res = await fetch('/api/transcribe-audio', { method: 'POST', body: form });
            if (!res.ok) {
                throw new Error(`Transcription failed (${res.status})`);
            }
            const data = await res.json();
            const text = (data.text || '').trim();

            if (text) {
                await supabase.from('photo_feedback')
                    .update({ feeling_text: text })
                    .eq('id', commentId);

                setComments(prev => prev.map(c => c.id === commentId ? { ...c, feeling_text: text, transcription_status: 'complete' } : c));
            } else {
                setComments(prev => prev.map(c => c.id === commentId ? { ...c, transcription_status: 'error' } : c));
            }
            setTranscriptionStatus('done');
        } catch (err) {
            console.error("Transcription error:", err);
            setComments(prev => prev.map(c => c.id === commentId ? { ...c, transcription_status: 'error' } : c));
            setTranscriptionStatus('error');
        }
    };

    const handleInputSubmit = async (e) => {
        e.preventDefault();
        const transcriptText = voiceTranscript.trim();
        const finalText = userInput.trim() || transcriptText;
        if (!finalText && !audioData.blob) return;
        if (finalText !== userInput.trim()) {
            setUserInput(finalText);
        }

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

            const { data: inserted, error: insertError } = await supabase.from('photo_feedback').insert([{
                image_url: selectedImage.url,
                feeling_text: finalText,
                project_id: 'invisible-punctum',
                audio_url: audioUrl,
                audio_path: audioPath,
                audio_duration_ms: audioData.duration * 1000,
                audio_mime: audioData.mimeType || (audioData.blob ? 'audio/webm' : null)
            }]).select('id, feeling_text, audio_url, created_at').single();

            if (insertError) throw insertError;

            // Optimistic Update
            const localComment = inserted || {
                id: `${Date.now()}`,
                feeling_text: finalText,
                audio_url: audioUrl,
                created_at: new Date().toISOString()
            };

            const needsTranscription = !!audioData.blob && !finalText;
            setComments(prev => [{
                ...localComment,
                transcription_status: needsTranscription ? 'pending' : 'complete'
            }, ...prev]);

            if (needsTranscription && inserted?.id) {
                transcribeAudioServer(audioData.blob, inserted.id);
            }

            const imageKey = getImageKey(selectedImage);
            if (imageKey) {
                setCommentCountsByUrl(prev => ({
                    ...prev,
                    [imageKey]: (prev[imageKey] || 0) + 1
                }));
            }

            setStep('viz');

        } catch (err) {
            console.error("Upload/Insert failed:", err);
            alert("Saved locally, but upload failed: " + err.message);
            setStep('viz');
        }
    };




    // State for Feedback Modal
    const [feedbackModal, setFeedbackModal] = useState({ isOpen: false, type: 'success', context: '' });
    const [showSuccessCard, setShowSuccessCard] = useState(true);
    const [showLicenseCard, setShowLicenseCard] = useState(true);
    const [feedbackText, setFeedbackText] = useState('');
    const [sendingFeedback, setSendingFeedback] = useState(false);
    const [successSequenceActive, setSuccessSequenceActive] = useState(false);
    const successTimerRef = useRef(null);
    const licenseTimerRef = useRef(null);

    // Helper to open feedback modal
    const openFeedback = (type, context) => {
        setFeedbackModal({ isOpen: true, type, context });
        setFeedbackText('');
        if (successTimerRef.current) {
            clearTimeout(successTimerRef.current);
            successTimerRef.current = null;
        }
        if (licenseTimerRef.current) {
            clearTimeout(licenseTimerRef.current);
            licenseTimerRef.current = null;
        }
        if (type === 'success') {
            setSuccessSequenceActive(true);
            setShowSuccessCard(false);
            setShowLicenseCard(false);
            successTimerRef.current = setTimeout(() => {
                setShowSuccessCard(true);
            }, 2000);
            licenseTimerRef.current = setTimeout(() => {
                setShowLicenseCard(true);
                setSuccessSequenceActive(false);
            }, 3000);
        } else {
            setSuccessSequenceActive(false);
        }
    };

    useEffect(() => {
        if (
            feedbackModal.isOpen &&
            feedbackModal.type === 'success' &&
            !showSuccessCard &&
            !showLicenseCard &&
            !successSequenceActive
        ) {
            setFeedbackModal(prev => ({ ...prev, isOpen: false }));
        }
    }, [feedbackModal.isOpen, feedbackModal.type, showSuccessCard, showLicenseCard, successSequenceActive]);

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
                        userContext: userInput,
                        modelMode: modelMode || 'free'
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
            setSynthesisReady(false);
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

            // DIRECT FETCH (Refined 3v3 Analysis) with Auto-Retry
            const maxAttempts = 4;
            const baseDelayMs = 1500;
            let consensusData = null;
            let lastError = null;

            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                    const consensusRes = await fetch('/api/analyze-consensus', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            aiEmotions: aiKeywords,
                            humanEmotions: humanKeywords,
                            modelMode: modelMode || 'free'
                        })
                    });

                    if (!consensusRes.ok) {
                        const errData = await consensusRes.json().catch(() => ({}));
                        throw new Error(errData.error || "Consensus Failed");
                    }

                    consensusData = await consensusRes.json();
                    break;
                } catch (err) {
                    lastError = err;
                    if (attempt < maxAttempts) {
                        const waitMs = baseDelayMs * attempt;
                        addLog(`[SYNTHESIS] Consensus engine busy. Retrying in ${Math.ceil(waitMs / 1000)}s... (Attempt ${attempt}/${maxAttempts})`, "info");
                        await new Promise(resolve => setTimeout(resolve, waitMs));
                    }
                }
            }

            if (!consensusData) {
                throw lastError || new Error("Consensus Failed");
            }

            const tierTag = consensusData.model_tier ? ` (${String(consensusData.model_tier).toUpperCase()})` : '';
            addLog(`[SYNTHESIS] Success. Model: ${consensusData.model_used}${tierTag}`, "success");
            addLog(`[SYNTHESIS] Semantic Match: ${consensusData.consensus_percentage}%`, "info");

            if (consensusData.fallback_used) {
                addLog(`[SYNTHESIS] Using fallback consensus heuristic while providers stabilize.`, "info");
            }

            // Update Report with Synthesis Data
            setAiReport(prev => ({
                ...prev,
                consensus_score: consensusData.consensus_percentage || 0,
                // Map context_explanation to the 'analysis' field expected by UI consumers
                analysis: consensusData.context_explanation,
                model_used: `${prev.model_used} + ${consensusData.model_used}`,
            }));

            setConsensusData(consensusData);

            if (step === 'analysis-synthesis') {
                setSynthesisReady(true);
                setProgressTarget(100);
                setProgressSpeed(1);
                setProgressIntervalMs(20);
                setProgressBoost(true);
                await waitForProgress(100);
                setProgressBoost(false);
            }

            // Success Feedback
            setTimeout(() => openFeedback('success', 'Experiment Completed Successfully'), 400);

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
            fontFamily: 'var(--font-ui)',
            overflow: 'hidden',
            position: 'relative'
        }}>
            {/* FEEDBACK MODAL / TOAST */}
            <AnimatePresence>
                {feedbackModal.isOpen && feedbackModal.type === 'success' && (
                    <motion.div
                        initial={{ opacity: 0, x: -240 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -120 }}
                        style={{
                            position: 'fixed',
                            left: '24px',
                            bottom: '24px',
                            zIndex: 10000,
                            width: '340px',
                            maxWidth: '90vw'
                        }}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {showSuccessCard && (
                                <div style={{
                                    background: '#0b0b0b', border: '1px solid #1f1f1f', borderRadius: '10px',
                                    padding: '16px 18px', boxShadow: '0 10px 40px rgba(0,0,0,0.45)'
                                }}>
                                    <div style={{
                                        fontFamily: 'var(--font-display)', fontSize: '13px', letterSpacing: '0.12em',
                                        color: '#00ff66', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 700
                                    }}>
                                        Experiment Complete
                                    </div>
                                    <div style={{
                                        fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#ffb3b3', lineHeight: '1.5', fontWeight: 600
                                    }}>
                                        Thank you for participating in this study of human-machine divergence.
                                    </div>
                                    <button
                                        onClick={() => setShowSuccessCard(false)}
                                        className="hover-btn"
                                        style={{
                                            marginTop: '12px',
                                            padding: '8px 14px',
                                            background: 'transparent',
                                            border: '1px solid #444',
                                            color: '#bbb',
                                            borderRadius: '999px',
                                            cursor: 'pointer',
                                            fontFamily: 'var(--font-display)',
                                            fontSize: '10px',
                                            letterSpacing: '0.08em'
                                        }}
                                    >
                                        DISMISS
                                    </button>
                                </div>
                            )}

                            {showLicenseCard && (
                                <div style={{
                                    background: '#0b0b0b', border: '1px solid #1f1f1f', borderRadius: '10px',
                                    padding: '14px 18px', boxShadow: '0 10px 40px rgba(0,0,0,0.35)',
                                    position: 'relative'
                                }}>
                                    <button
                                        onClick={() => setShowLicenseCard(false)}
                                        aria-label="Dismiss license prompt"
                                        style={{
                                            position: 'absolute',
                                            top: '8px',
                                            right: '10px',
                                            width: '22px',
                                            height: '22px',
                                            borderRadius: '999px',
                                            border: '1px solid rgba(255,255,255,0.2)',
                                            background: 'rgba(255,255,255,0.06)',
                                            color: '#fff',
                                            cursor: 'pointer',
                                            fontSize: '14px',
                                            lineHeight: '1',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        ×
                                    </button>
                                    <div style={{
                                        fontFamily: 'var(--font-display)', fontSize: '12px', letterSpacing: '0.12em',
                                        color: '#00ff66', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 700
                                    }}>
                                        Buy the license
                                    </div>
                                    <div style={{
                                        fontFamily: 'var(--font-ui)', fontSize: '12px', color: '#ffb3b3', lineHeight: '1.5', fontWeight: 600
                                    }}>
                                        Buy the license of the web app for educational purposes in your institution.
                                    </div>
                                    <button
                                        className="hover-btn"
                                        onClick={() => window.location.href = '/contact'}
                                        style={{
                                            marginTop: '10px',
                                            padding: '8px 14px',
                                            background: 'rgba(255,255,255,0.08)',
                                            border: '1px solid rgba(255,255,255,0.2)',
                                            color: '#fff',
                                            borderRadius: '999px',
                                            cursor: 'pointer',
                                            fontFamily: 'var(--font-display)',
                                            fontSize: '10px',
                                            letterSpacing: '0.08em'
                                        }}
                                    >
                                        CONTACT ME
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}

                {feedbackModal.isOpen && feedbackModal.type === 'error' && (
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
                                background: '#111', border: `1px solid #ff4444`,
                                borderRadius: '12px', padding: '40px', textAlign: 'center',
                                boxShadow: `0 0 50px rgba(255, 68, 68, 0.1)`
                            }}
                        >
                            <h3 style={{
                                fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 600,
                                color: '#ff4444', marginBottom: '24px', letterSpacing: '0.05em'
                            }}>
                                CONNECTION INTERRUPTED
                            </h3>

                            {/* Scrollable Error Content */}
                            <div style={{
                                maxHeight: '30vh', overflowY: 'auto',
                                background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '4px',
                                marginBottom: '24px', border: '1px solid rgba(255,255,255,0.05)',
                                textAlign: 'left'
                            }}>
                                <p style={{
                                    fontFamily: 'var(--font-mono)', color: '#ccc',
                                    marginBottom: '0', lineHeight: '1.6', fontSize: '11px', whiteSpace: 'pre-wrap'
                                }}>
                                    {`ANALYSIS FAILED.\n\nDETAILS:\n${feedbackModal.context}`}
                                </p>
                            </div>

                            <p style={{ fontFamily: 'var(--font-display)', fontSize: '14px', color: '#888', marginBottom: '16px' }}>
                                Would you like to report this issue?
                            </p>

                            <textarea
                                value={feedbackText}
                                onChange={e => setFeedbackText(e.target.value)}
                                placeholder="Additional context (optional)..."
                                style={{
                                    width: '100%', height: '80px', background: '#222', border: '1px solid #333',
                                    color: '#fff', borderRadius: '8px', padding: '12px', fontFamily: 'var(--font-mono)',
                                    marginBottom: '32px', resize: 'none', fontSize: '13px'
                                }}
                            />
                            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                                <button
                                    onClick={() => setFeedbackModal({ ...feedbackModal, isOpen: false })}
                                    className="hover-btn"
                                    style={{
                                        padding: '14px 32px', background: 'transparent', border: '1px solid #666',
                                        color: '#aaa', borderRadius: '50px', cursor: 'pointer', fontFamily: 'var(--font-display)',
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
                                        background: '#ff4444',
                                        color: '#fff',
                                        border: 'none', borderRadius: '50px', cursor: 'pointer',
                                        fontWeight: 600, fontFamily: 'var(--font-display)',
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

            {/* Bottom nav removed */}

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
                            fontFamily: "'Courier New', 'Inconsolata', var(--font-mono), monospace",
                            fontSize: '13px',
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
                                        color: log.type === 'error' ? '#ff4444' : (log.type === 'success' ? '#00ff00' : '#888'),
                                        fontFamily: "'Courier New', 'Inconsolata', var(--font-mono), monospace",
                                        lineHeight: '1.5',
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word'
                                    }}>
                                        <span style={{ opacity: 0.5 }}>[{log.timestamp.toLocaleTimeString().split(' ')[0]}]</span>{' '}
                                        {log.message}
                                    </div>
                                ))}
                                <div style={{ height: '10px' }} />
                            </div>
                        </div>

                        {/* MODELS (Side by Side) */}
                        <div style={{ display: 'flex', gap: '10px', width: '100%', flexWrap: 'wrap' }}>
                            <div style={{
                                flex: '1 1 260px',
                                background: 'rgba(0,0,0,0.75)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '8px',
                                padding: '10px 12px',
                                fontFamily: 'var(--font-ui)',
                                fontSize: '12px',
                                color: '#bbb',
                                fontWeight: 500,
                                lineHeight: '1.5',
                                boxShadow: '0 0 18px rgba(0,0,0,0.3)',
                                backdropFilter: 'blur(6px)'
                            }}>
                                <div style={{ fontSize: '10px', letterSpacing: '0.12em', color: '#888', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 600 }}>
                                    Models Used
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                                    <div>
                                        <div style={{ color: '#888', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>Human response analysis</div>
                                        <div style={{
                                            display: 'inline-block',
                                            padding: '6px 12px',
                                            borderRadius: '6px',
                                            border: '1px solid rgba(255,255,255,0.2)',
                                            background: 'rgba(255,255,255,0.05)',
                                            color: '#fff',
                                            fontSize: '13px',
                                            fontFamily: "'Courier New', 'Inconsolata', var(--font-mono), monospace"
                                        }}>
                                            {keywordModel || 'Pending'}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ color: '#888', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>Image analysis</div>
                                        <div style={{
                                            display: 'inline-block',
                                            padding: '6px 12px',
                                            borderRadius: '6px',
                                            border: '1px solid rgba(255,255,255,0.2)',
                                            background: 'rgba(255,255,255,0.05)',
                                            color: '#fff',
                                            fontSize: '13px',
                                            fontFamily: "'Courier New', 'Inconsolata', var(--font-mono), monospace"
                                        }}>
                                            {getPrimaryModel(aiReport?.vision_analysis?.model_used || aiReport?.model_used) || 'Pending'}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ color: '#888', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>Consensus analysis</div>
                                        <div style={{
                                            display: 'inline-block',
                                            padding: '6px 12px',
                                            borderRadius: '6px',
                                            border: '1px solid rgba(255,255,255,0.2)',
                                            background: 'rgba(255,255,255,0.05)',
                                            color: '#fff',
                                            fontSize: '13px',
                                            fontFamily: "'Courier New', 'Inconsolata', var(--font-mono), monospace"
                                        }}>
                                            {consensusData?.model_used || 'Pending'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(2px); } to { opacity: 1; transform: translateY(0); } }
                .progress-orbit .progress-ring {
                    border: 1px solid rgba(0, 255, 102, 0.25);
                    box-shadow: 0 0 12px rgba(0, 255, 102, 0.18);
                }
                .progress-orbit .progress-ring.pulse {
                    border: 1px solid rgba(0, 255, 102, 0.18);
                    box-shadow: 0 0 18px rgba(0, 255, 102, 0.22);
                    animation: orbitPulse 2.2s ease-in-out infinite;
                }
                .progress-orbit .progress-dot-track {
                    pointer-events: none;
                }
                .progress-orbit .progress-dot {
                    position: absolute;
                    top: -4px;
                    left: 50%;
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    background: #00ff66;
                    box-shadow: 0 0 14px rgba(0, 255, 102, 0.9), 0 0 28px rgba(0, 255, 102, 0.55);
                    transform: translateX(-50%);
                }
                @keyframes orbitPulse {
                    0% { opacity: 0.35; box-shadow: 0 0 10px rgba(0, 255, 102, 0.14); }
                    50% { opacity: 1; box-shadow: 0 0 20px rgba(0, 255, 102, 0.3); }
                    100% { opacity: 0.35; box-shadow: 0 0 10px rgba(0, 255, 102, 0.14); }
                }
                .image-scan-line {
                    animation: imageScan 7.5s ease-in-out infinite;
                }
                @keyframes imageScan {
                    0% { top: 6px; opacity: 0.8; box-shadow: 0 0 10px rgba(0,255,102,0.35), 0 0 18px rgba(0,255,102,0.2); }
                    14% { top: 18%; opacity: 0.95; }
                    28% { top: 36%; opacity: 0.85; }
                    45% { top: 62%; opacity: 1; box-shadow: 0 0 18px rgba(0,255,102,0.6), 0 0 36px rgba(0,255,102,0.4); }
                    58% { top: 54%; opacity: 0.9; }
                    72% { top: 82%; opacity: 0.8; }
                    82% { top: 68%; opacity: 0.95; }
                    92% { top: calc(100% - 8px); opacity: 1; box-shadow: 0 0 22px rgba(0,255,102,0.85), 0 0 44px rgba(0,255,102,0.55); }
                    100% { top: 76%; opacity: 0.85; }
                }
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

            {/* Top-left Navigation */}
            <div
                style={{
                    position: 'fixed',
                    top: '20px',
                    left: '20px',
                    zIndex: 100,
                    display: 'flex',
                    gap: '10px',
                    alignItems: 'center',
                    flexWrap: 'wrap'
                }}
            >
                <a
                    href="/"
                    style={{
                        fontFamily: 'var(--font-ui)',
                        fontSize: '12px',
                        color: '#fff',
                        textDecoration: 'none',
                        padding: '8px 14px',
                        border: '1px solid rgba(255,255,255,0.35)',
                        borderRadius: '999px',
                        background: 'transparent',
                        transition: 'all 0.2s',
                        letterSpacing: '0.06em'
                    }}
                    onMouseEnter={(e) => {
                        e.target.style.borderColor = '#fff';
                    }}
                    onMouseLeave={(e) => {
                        e.target.style.borderColor = 'rgba(255,255,255,0.35)';
                    }}
                >
                    GO TO HOMEPAGE
                </a>
                {(step.startsWith('analysis') || step === 'viz' || step === 'consensus') && (
                    <>
                        <button
                            onClick={handlePrev}
                            disabled={step === 'viz' || step === 'select'}
                            className="hover-btn"
                            style={{
                                padding: '8px 14px',
                                background: 'transparent',
                                border: '1px solid rgba(255,255,255,0.35)',
                                color: '#fff',
                                borderRadius: '999px',
                                fontFamily: 'var(--font-ui)',
                                fontSize: '12px',
                                letterSpacing: '0.08em',
                                cursor: (step === 'viz' || step === 'select') ? 'default' : 'pointer',
                                opacity: (step === 'viz' || step === 'select') ? 0.45 : 1
                            }}
                            onMouseOver={e => { if (step !== 'viz' && step !== 'select') e.currentTarget.style.borderColor = '#fff'; }}
                            onMouseOut={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.35)'; }}
                        >
                            PREVIOUS
                        </button>
                        <button
                            onClick={handleNext}
                            disabled={step === 'analysis-synthesis'}
                            className="hover-btn"
                            style={{
                                padding: '8px 14px',
                                background: 'transparent',
                                border: '1px solid rgba(255,255,255,0.35)',
                                color: '#fff',
                                borderRadius: '999px',
                                fontFamily: 'var(--font-ui)',
                                fontSize: '12px',
                                letterSpacing: '0.08em',
                                cursor: step === 'analysis-synthesis' ? 'default' : 'pointer',
                                opacity: step === 'analysis-synthesis' ? 0.45 : 1
                            }}
                            onMouseOver={e => { if (step !== 'analysis-synthesis') e.currentTarget.style.borderColor = '#fff'; }}
                            onMouseOut={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.35)'; }}
                        >
                            NEXT
                        </button>
                    </>
                )}
            </div>

            {selectedImage?.url && (step?.startsWith('analysis') || step === 'viz' || step === 'consensus') && (
                <div
                    style={{
                        position: 'fixed',
                        top: '108px',
                        left: '20px',
                        width: '300px',
                        maxWidth: '34vw',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        border: '1px solid rgba(255,255,255,0.2)',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
                        zIndex: 110,
                        background: '#000'
                    }}
                >
                    <img
                        src={selectedImage.url}
                        alt="Selected"
                        style={{ width: '100%', height: 'auto', display: 'block' }}
                    />
                    {showLoader && step === 'analysis-ai' && loading && (
                        <div
                            className="image-scan-line"
                            style={{
                                position: 'absolute',
                                left: '6px',
                                right: '6px',
                                top: '6px',
                                height: '2px',
                                background: 'linear-gradient(90deg, rgba(0,255,102,0) 0%, rgba(0,255,102,0.75) 18%, rgba(0,255,102,1) 50%, rgba(0,255,102,0.75) 82%, rgba(0,255,102,0) 100%)',
                                boxShadow: '0 0 14px rgba(0,255,102,0.6), 0 0 28px rgba(0,255,102,0.35)',
                                borderRadius: '999px',
                                pointerEvents: 'none'
                            }}
                        />
                    )}
                </div>
            )}

            <div style={{ position: 'relative', zIndex: 1, width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <AnimatePresence mode="wait">

                    {/* INTRO */}
                    {step === 'intro' && (
                        <>
                            <motion.div
                                key="intro"
                                variants={containerVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                style={{ textAlign: 'center', maxWidth: '640px', padding: '0 24px', position: 'relative', zIndex: 10 }}
                            >
                                <h1 style={{
                                    fontFamily: 'var(--font-ui)',
                                    fontSize: '4.5rem',
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
                                <p style={{ fontFamily: 'var(--font-ui)', fontSize: '1.4rem', color: '#e6e6e6', lineHeight: 1.5, marginBottom: '56px', fontWeight: 500 }}>
                                    This experiment explores the divergence between human feelings and machine vision and shows which images require a richer social and emotional context for AI to interpret the photograph with precision.
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                    <button
                                        onClick={() => setStep('select')}
                                        className="hover-btn"
                                        style={{
                                            padding: '20px 54px',
                                            fontSize: '16px',
                                            background: '#fff',
                                            color: '#000',
                                            border: '1px solid #fff',
                                            borderRadius: '100px',
                                            cursor: 'pointer',
                                            fontWeight: 600,
                                            letterSpacing: '0.08em',
                                            transition: 'all 0.3s ease',
                                            fontFamily: 'var(--font-ui)',
                                            minWidth: '260px'
                                        }}
                                        onMouseOver={(e) => { e.target.style.transform = 'translateY(-1px)'; }}
                                        onMouseOut={(e) => { e.target.style.transform = 'translateY(0)'; }}
                                    >
                                        START EXPERIMENT
                                    </button>
                                    <button
                                        onClick={() => setModelMode(modelMode === 'paid' ? 'free' : 'paid')}
                                        className="hover-btn"
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px',
                                            padding: '7px 10px',
                                            fontSize: '10px',
                                            background: modelMode === 'paid' ? 'rgba(0,255,102,0.15)' : 'rgba(255,255,255,0.05)',
                                            color: modelMode === 'paid' ? '#00ff66' : '#b5b5b5',
                                            border: `1px solid ${modelMode === 'paid' ? 'rgba(0,255,102,0.6)' : 'rgba(255,255,255,0.2)'}`,
                                            borderRadius: '999px',
                                            cursor: 'pointer',
                                            fontWeight: 500,
                                            letterSpacing: '0.08em',
                                            transition: 'all 0.2s ease',
                                            fontFamily: 'var(--font-ui)',
                                            lineHeight: 1,
                                            marginTop: '6px'
                                        }}
                                    >
                                        <span style={{
                                            width: '14px',
                                            height: '14px',
                                            borderRadius: '4px',
                                            border: `1px solid ${modelMode === 'paid' ? '#00ff66' : 'rgba(255,255,255,0.4)'}`,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '10px',
                                            lineHeight: 1
                                        }}>
                                            {modelMode === 'paid' ? '✓' : ''}
                                        </span>
                                        Use paid models
                                    </button>
                                </div>
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
                            <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: '1.6rem', fontWeight: 600, marginBottom: '20px', color: '#fff' }}>Select an image to proceed with the analysis.</h2>
                            <div className="punctum-grid">
                                {images.slice(0, displayCount).map((img, i) => {
                                    const responseCount = commentCountsByUrl[getImageKey(img)] || 0;
                                    return (
                                    <motion.div
                                        key={img.id || i}
                                        whileHover={{ scale: 1.03, y: -5 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => handleSelect(img)}
                                        className="punctum-tile"
                                    >
                                        <img
                                            src={img.url}
                                            alt="Selection"
                                            className="punctum-image"
                                            onMouseOver={e => e.target.style.opacity = 1}
                                            onMouseOut={e => e.target.style.opacity = 0.9}
                                        />
                                        {responseCount > 0 && (
                                            <div className="response-count">
                                                {responseCount} response{responseCount === 1 ? '' : 's'}
                                            </div>
                                        )}
                                    </motion.div>
                                    );
                                })}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginTop: '28px', flexWrap: 'wrap' }}>
                                <button
                                    onClick={shuffleSelection}
                                    className="hover-btn"
                                    style={{
                                        padding: '10px 20px',
                                        fontSize: '12px',
                                        background: 'rgba(255,255,255,0.06)',
                                        color: '#fff',
                                        border: '1px solid rgba(255,255,255,0.2)',
                                        borderRadius: '999px',
                                        cursor: 'pointer',
                                        fontWeight: 500,
                                        letterSpacing: '0.08em',
                                        transition: 'all 0.3s ease',
                                        fontFamily: 'var(--font-ui)'
                                    }}
                                    onMouseOver={(e) => { e.target.style.borderColor = '#fff'; e.target.style.background = 'rgba(255,255,255,0.12)'; }}
                                    onMouseOut={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.2)'; e.target.style.background = 'rgba(255,255,255,0.06)'; }}
                                >
                                    SHUFFLE IMAGES
                                </button>
                                <button
                                    onClick={toggleCommentFilter}
                                    disabled={loadingCommentCounts || commentCountsError}
                                    className="hover-btn"
                                    style={{
                                        padding: '10px 20px',
                                        fontSize: '12px',
                                        background: showCommentedOnly ? 'rgba(0,255,102,0.18)' : 'rgba(255,255,255,0.06)',
                                        color: showCommentedOnly ? '#00ff66' : '#fff',
                                        border: `1px solid ${showCommentedOnly ? 'rgba(0,255,102,0.6)' : 'rgba(255,255,255,0.2)'}`,
                                        borderRadius: '999px',
                                        cursor: commentCountsError ? 'not-allowed' : (loadingCommentCounts ? 'wait' : 'pointer'),
                                        fontWeight: 500,
                                        letterSpacing: '0.08em',
                                        transition: 'all 0.3s ease',
                                        fontFamily: 'var(--font-ui)',
                                        opacity: (loadingCommentCounts || commentCountsError) ? 0.6 : 1
                                    }}
                                    onMouseOver={(e) => {
                                        if (!showCommentedOnly) {
                                            e.target.style.borderColor = '#fff';
                                            e.target.style.background = 'rgba(255,255,255,0.12)';
                                        }
                                    }}
                                    onMouseOut={(e) => {
                                        if (!showCommentedOnly) {
                                            e.target.style.borderColor = 'rgba(255,255,255,0.2)';
                                            e.target.style.background = 'rgba(255,255,255,0.06)';
                                        }
                                    }}
                                >
                                    {commentCountsError ? 'RESPONSES UNAVAILABLE' : 'SHOW IMAGES WITH RESPONSES'}
                                </button>
                            </div>
                            <style>{`
                                .punctum-grid {
                                    display: grid;
                                    grid-template-columns: repeat(5, minmax(0, 1fr));
                                    gap: 20px;
                                    justify-content: center;
                                }
                                .punctum-tile {
                                    width: 100%;
                                    aspect-ratio: 1 / 1;
                                    background: #111;
                                    border-radius: 6px;
                                    overflow: hidden;
                                    cursor: pointer;
                                    box-shadow: 0 20px 40px rgba(0,0,0,0.4);
                                    border: 1px solid rgba(255,255,255,0.05);
                                    position: relative;
                                }
                                .punctum-image {
                                    width: 100%;
                                    height: 100%;
                                    object-fit: cover;
                                    opacity: 0.9;
                                    transition: opacity 0.3s;
                                    display: block;
                                }
                                .response-count {
                                    position: absolute;
                                    left: 10px;
                                    bottom: 10px;
                                    padding: 6px 10px;
                                    font-size: 10px;
                                    font-family: var(--font-mono);
                                    color: #fff;
                                    background: rgba(0,0,0,0.6);
                                    border: 1px solid rgba(255,255,255,0.2);
                                    border-radius: 999px;
                                    letter-spacing: 0.08em;
                                    text-transform: uppercase;
                                    backdrop-filter: blur(6px);
                                }
                                @media (max-width: 1200px) {
                                    .punctum-grid {
                                        grid-template-columns: repeat(4, minmax(0, 1fr));
                                    }
                                }
                                @media (max-width: 900px) {
                                    .punctum-grid {
                                        grid-template-columns: repeat(3, minmax(0, 1fr));
                                    }
                                }
                                @media (max-width: 700px) {
                                    .punctum-grid {
                                        grid-template-columns: repeat(2, minmax(0, 1fr));
                                    }
                                }
                                @media (max-width: 520px) {
                                    .punctum-grid {
                                        grid-template-columns: 1fr;
                                    }
                                }
                            `}</style>
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

                            {/* Image Container */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'flex-end',
                                justifyContent: 'center',
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
                            </div>

                            {/* Concept Text */}
                            <div style={{ maxWidth: '750px', marginBottom: '32px' }}>
                                <p style={{
                                    fontFamily: 'var(--font-ui)',
                                    fontSize: '20px',
                                    lineHeight: '1.5',
                                    color: '#ccc',
                                    marginBottom: '24px'
                                }}>
                                    Think of what this photograph makes you feel. In the next step, either share your response in text or add a voice memo.
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
                                height: '35vh',
                                maxWidth: '90vw',
                                borderRadius: '8px', overflow: 'hidden', marginBottom: '24px',
                                boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
                                border: '1px solid rgba(255,255,255,0.05)',
                                display: 'flex', justifyContent: 'center', alignItems: 'center'
                            }}>
                                <img src={selectedImage.url} style={{ width: 'auto', height: '100%', objectFit: 'contain' }} />
                            </div>

                            <form onSubmit={handleInputSubmit} style={{ width: '100%', maxWidth: '900px', textAlign: 'center' }}>
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
                                                fontFamily: 'var(--font-mono)',
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
                                        <AudioRecorder
                                            onRecordingComplete={(blob, duration, mimeType) => setAudioData({ blob, duration, mimeType })}
                                            onTranscript={handleTranscriptUpdate}
                                            onTranscriptionState={(state) => setTranscriptionStatus(state)}
                                        />
                                        {(voiceTranscript || transcriptionStatus) && (
                                            <div style={{
                                                marginTop: '10px',
                                                padding: '10px 12px',
                                                width: '100%',
                                                borderRadius: '8px',
                                                border: '1px solid rgba(255,255,255,0.08)',
                                                background: 'rgba(255,255,255,0.04)',
                                                color: '#cfcfcf',
                                                fontSize: '12px',
                                                lineHeight: '1.5',
                                                fontFamily: 'var(--font-ui)',
                                                textAlign: 'left'
                                            }}>
                                                <div style={{ fontSize: '10px', color: '#777', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>
                                                    Live Transcript
                                                </div>
                                                <div>{voiceTranscript || (transcriptionStatus === 'error' ? 'Transcription unavailable in this browser.' : 'Listening...')}</div>
                                            </div>
                                        )}
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
                                paddingTop: '14vh',
                                paddingBottom: '6vh',
                                padding: '14vh 20px 6vh',
                                textAlign: 'center',
                                overflow: 'auto'
                            }}
                        >
                            <div style={{ position: 'relative', width: '100%', maxWidth: '980px', minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <AnimatePresence mode="wait">
                                    {!showCollectiveAnalysis ? (
                                        <motion.div
                                            key="human-flow"
                                            initial={{ opacity: 1 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.35 }}
                                            style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                                        >
                                            {/* 1. HUMAN RESPONSES (Shown First) */}
                                            <div style={{
                                                marginBottom: '36px',
                                                maxWidth: '900px',
                                                maxHeight: '22vh',
                                                overflowY: 'auto',
                                                padding: '0 10px'
                                            }}>
                                                <h4 style={{
                                                    fontSize: '12px', letterSpacing: '0.28em', color: '#666',
                                                    textTransform: 'uppercase', marginBottom: '14px'
                                                }}>
                                                    Human Responses
                                                </h4>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                                                    {comments.map((comment, i) => (
                                                        <React.Fragment key={`comment-${i}`}>
                                                            {comment.feeling_text && (
                                                                <div style={{
                                                                    padding: '8px 12px',
                                                                    background: 'rgba(255,255,255,0.05)',
                                                                    border: '1px solid rgba(255,255,255,0.14)',
                                                                    color: '#d0d0d0',
                                                                    borderRadius: '6px',
                                                                    fontSize: '12px',
                                                                    fontFamily: 'var(--font-mono)',
                                                                    transition: 'all 0.2s',
                                                                    cursor: 'default'
                                                                }}
                                                                    onMouseOver={e => { e.target.style.color = '#fff'; e.target.style.background = 'rgba(255,255,255,0.1)'; }}
                                                                    onMouseOut={e => { e.target.style.color = '#d0d0d0'; e.target.style.background = 'rgba(255,255,255,0.05)'; }}
                                                                >
                                                                    {comment.feeling_text}
                                                                </div>
                                                            )}
                                                            {comment.audio_url && (
                                                                <div style={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '8px',
                                                                    padding: '6px 10px',
                                                                    background: 'rgba(0,255,102,0.08)',
                                                                    border: '1px solid rgba(0,255,102,0.3)',
                                                                    color: '#9cffc1',
                                                                    borderRadius: '999px',
                                                                    fontSize: '11px',
                                                                    fontFamily: 'var(--font-mono)',
                                                                    transition: 'all 0.2s'
                                                                }}>
                                                                    <AudioPlayerButton
                                                                        url={comment.audio_url}
                                                                        label={`AUDIO ${i + 1}`}
                                                                        small
                                                                    />
                                                                    <span style={{ opacity: 0.8 }}>
                                                                        {comment.created_at ? new Date(comment.created_at).toLocaleString() : 'Voice note'}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {(comment.transcription_status === 'pending' || (comment.audio_url && !comment.feeling_text)) && (
                                                                <div style={{
                                                                    padding: '6px 10px',
                                                                    background: 'rgba(255,255,255,0.06)',
                                                                    border: '1px solid rgba(255,255,255,0.12)',
                                                                    color: '#bbb',
                                                                    borderRadius: '999px',
                                                                    fontSize: '11px',
                                                                    fontFamily: 'var(--font-mono)',
                                                                    letterSpacing: '0.06em'
                                                                }}>
                                                                    TRANSCRIBING AUDIO...
                                                                </div>
                                                            )}
                                                        </React.Fragment>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* HUMAN INPUTS NOTE (Moved from sidebar) */}
                                            {!loadingKeywords && (
                                                <div style={{
                                                    marginBottom: '34px',
                                                    maxWidth: '620px',
                                                    textAlign: 'center',
                                                    background: 'rgba(255,255,255,0.06)',
                                                    border: '1px solid rgba(255,255,255,0.18)',
                                                    borderRadius: '10px',
                                                    padding: '12px 16px',
                                                    fontFamily: 'var(--font-ui)',
                                                    fontSize: '12px',
                                                    color: '#cfcfcf',
                                                    fontWeight: 500,
                                                    lineHeight: '1.6',
                                                    boxShadow: '0 0 18px rgba(0,0,0,0.25)'
                                                }}>
                                                    <div style={{ fontSize: '10px', letterSpacing: '0.14em', color: '#9a9a9a', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 700 }}>
                                                        ★ Human Inputs Note
                                                    </div>
                                                    <div>
                                                        {commentCount < 3
                                                            ? `Only ${commentCount} human responses so far. More inputs will sharpen the divergence signal.`
                                                            : `${commentCount} human responses contributed to this consensus.`
                                                        }
                                                    </div>
                                                </div>
                                            )}

                                            {/* 3. ANALYSIS DRUM + PROGRESS */}
                                            <div style={{ marginBottom: '36px', width: '100%', maxWidth: '900px' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', justifyContent: 'center', alignItems: 'center' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                        <div className="progress-orbit" style={{ position: 'relative', width: '190px', height: '190px' }}>
                                                            <div className="progress-ring" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', borderRadius: '50%' }} />
                                                            <div className="progress-ring pulse" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', borderRadius: '50%' }} />
                                                            {loadingKeywords && (
                                                                <div
                                                                    className="progress-dot-track"
                                                                    style={{
                                                                        position: 'absolute',
                                                                        top: 0,
                                                                        left: 0,
                                                                        width: '100%',
                                                                        height: '100%',
                                                                        transform: `rotate(${Math.min(progress, 100) / 100 * 360}deg)`,
                                                                        transition: 'transform 0.06s linear'
                                                                    }}
                                                                >
                                                                    <div className="progress-dot" />
                                                                </div>
                                                            )}
                                                            <div style={{
                                                                position: 'absolute',
                                                                top: '50%',
                                                                left: '50%',
                                                                transform: 'translate(-50%, -50%)',
                                                                textAlign: 'center',
                                                                width: '140px'
                                                            }}>
                                                                {loadingKeywords ? (
                                                                    <>
                                                                        <div style={{
                                                                            fontSize: '34px',
                                                                            fontWeight: 700,
                                                                            color: '#ffffff',
                                                                            fontFamily: 'var(--font-display)',
                                                                            letterSpacing: '0.04em',
                                                                            marginBottom: '6px'
                                                                        }}>
                                                                            {Math.round(progress)}%
                                                                        </div>
                                                                        <div style={{
                                                                            fontSize: '11px',
                                                                            letterSpacing: '0.2em',
                                                                            color: '#8df5b6',
                                                                            textTransform: 'uppercase',
                                                                            fontFamily: 'var(--font-mono)',
                                                                            lineHeight: 1.4
                                                                        }}>
                                                                            Analyzing human comments
                                                                        </div>
                                                                        <div style={{
                                                                            marginTop: '6px',
                                                                            fontSize: '10px',
                                                                            color: '#6f6f6f',
                                                                            fontFamily: 'var(--font-mono)',
                                                                            letterSpacing: '0.12em'
                                                                        }}>
                                                                            Reading memories...
                                                                        </div>
                                                                    </>
                                                                ) : (
                                                                    <div style={{
                                                                        fontSize: '14px',
                                                                        letterSpacing: '0.2em',
                                                                        color: '#eafff2',
                                                                        textTransform: 'uppercase',
                                                                        fontFamily: 'var(--font-mono)',
                                                                        lineHeight: 1.4
                                                                    }}>
                                                                        Analysis Complete
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {loadingKeywords && (
                                                        <div style={{ width: '100%', maxWidth: '520px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                                                            <div style={{ opacity: 0.35, fontSize: '12px', marginBottom: '6px' }}>{truncateText(rollingPrev)}</div>
                                                            <motion.div
                                                                key={rollingCurrentIndex}
                                                                initial={{ opacity: 0, y: 10 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                transition={{ duration: 0.18 }}
                                                                style={{ fontSize: '15px', color: '#fff', fontWeight: 600 }}
                                                            >
                                                                {truncateText(rollingCurrent)}
                                                            </motion.div>
                                                            <div style={{ opacity: 0.35, fontSize: '12px', marginTop: '6px' }}>{truncateText(rollingNext)}</div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {!loadingKeywords && (
                                                <button
                                                    onClick={() => setShowCollectiveAnalysis(true)}
                                                    className="hover-btn"
                                                    style={{
                                                        padding: '16px 48px',
                                                        background: 'var(--color-brand-red)',
                                                        color: '#fff',
                                                        border: 'none',
                                                        borderRadius: '100px',
                                                        cursor: 'pointer',
                                                        fontWeight: 500,
                                                        fontSize: '13px',
                                                        letterSpacing: '0.1em',
                                                        textTransform: 'uppercase',
                                                        transition: 'all 0.3s',
                                                        boxShadow: '0 0 20px rgba(163, 0, 33, 0.35)'
                                                    }}
                                                    onMouseOver={(e) => { e.target.style.background = '#c1002f'; }}
                                                    onMouseOut={(e) => { e.target.style.background = 'var(--color-brand-red)'; }}
                                                >
                                                    Show Collective Analysis
                                                </button>
                                            )}
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="collective-flow"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.35 }}
                                            style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}
                                        >
                                            {/* 4. COLLECTIVE ANALYSIS (Final Three) */}
                                            <div style={{ marginBottom: '48px', maxWidth: '900px' }}>
                                                <h4 style={{
                                                    fontSize: '12px', letterSpacing: '0.28em', color: '#666',
                                                    textTransform: 'uppercase', marginBottom: '28px'
                                                }}>
                                                    Collective Analysis of all Human Responses
                                                </h4>
                                                {loadingKeywords ? (
                                                    <div style={{ opacity: 0.5, fontSize: '1.1rem', fontFamily: 'var(--font-mono)' }}>Synthesizing...</div>
                                                ) : keywords.length > 0 ? (
                                                    <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                                        {keywords.slice(0, 3).map((k, i) => (
                                                            <span key={i} style={{
                                                                fontSize: '20px',
                                                                fontFamily: 'var(--font-mono)',
                                                                color: '#00f3ff',
                                                                padding: '20px 30px',
                                                                background: 'rgba(0, 243, 255, 0.12)',
                                                                border: '1px solid rgba(0, 243, 255, 0.35)',
                                                                borderRadius: '999px',
                                                                textTransform: 'uppercase',
                                                                letterSpacing: '0.08em'
                                                            }}>
                                                                {k}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div style={{ opacity: 0.5, fontSize: '1.1rem', fontFamily: 'var(--font-mono)' }}>Gathering collective memory...</div>
                                                )}
                                            </div>

                                            {/* 5. ACTION BUTTON (RESTORED) */}
                                            <button
                                                onClick={analyzeAI}
                                                className="hover-btn"
                                                disabled={loading}
                                                style={{
                                                    padding: '16px 48px',
                                                    background: loading ? 'rgba(163, 0, 33, 0.45)' : 'var(--color-brand-red)',
                                                    color: '#fff',
                                                    border: 'none',
                                                    borderRadius: '100px',
                                                    cursor: loading ? 'default' : 'pointer',
                                                    fontWeight: 500,
                                                    fontSize: '13px',
                                                    letterSpacing: '0.1em',
                                                    textTransform: 'uppercase',
                                                    transition: 'all 0.3s',
                                                    boxShadow: '0 0 20px rgba(163, 0, 33, 0.35)',
                                                    opacity: loading ? 0.6 : 1
                                                }}
                                                onMouseOver={(e) => { if (!loading) e.target.style.background = '#c1002f'; }}
                                                onMouseOut={(e) => { if (!loading) e.target.style.background = 'var(--color-brand-red)'; }}
                                            >
                                                Analyze What AI Feels
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

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
                                {showLoader ? (
                                    <div className="loader" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                                    <div className="progress-orbit" style={{ position: 'relative', width: '190px', height: '190px', marginBottom: '40px' }}>
                                        {/* Base Ring */}
                                        <div className="progress-ring" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', borderRadius: '50%' }} />

                                        {/* Soft Pulse */}
                                        <div className="progress-ring pulse" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', borderRadius: '50%' }} />

                                        {/* Traveling Glow Dot */}
                                        <div
                                            className="progress-dot-track"
                                            style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                width: '100%',
                                                height: '100%',
                                                transform: `rotate(${Math.min(progress, 100) / 100 * 360}deg)`,
                                                transition: 'transform 0.06s linear'
                                            }}
                                        >
                                            <div className="progress-dot" />
                                        </div>

                                        {/* Center Percentage */}
                                            <div style={{
                                                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '32px', color: '#fff' }}>
                                                    {Math.floor(progress)}%
                                                </span>
                                            </div>
                                        </div>

                                        {/* Status Sequence */}
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '18px', letterSpacing: '0.05em', color: '#fff', marginBottom: '8px' }}>
                                                {step === 'analysis-ai' ? (progress < 40 ? 'SCANNING PIXELS' : progress < 80 ? 'DETECTING CONTEXT' : 'SYNTHESIZING EMOTION') :
                                                    step === 'analysis-human' ? (progress < 50 ? 'READING MEMORIES' : 'EXTRACTING THEMES') :
                                                        'CALCULATING GAP'}
                                            </div>
                                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#666' }}>
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

                                            {/* ACTIVE STATUS BOX */}
                                            <div
                                                style={{
                                                    marginTop: '20px',
                                                    width: '100%',
                                                    maxWidth: '520px',
                                                    background: 'rgba(0, 0, 0, 0.6)',
                                                    border: '1px solid rgba(0, 243, 255, 0.3)',
                                                    borderRadius: '8px',
                                                    padding: '14px 16px',
                                                    textAlign: 'center',
                                                    fontFamily: 'var(--font-mono)',
                                                    fontSize: '12px',
                                                    lineHeight: '1.6',
                                                    boxShadow: '0 0 15px rgba(0, 243, 255, 0.12) inset'
                                                }}
                                            >
                                                <div style={{ fontSize: '10px', letterSpacing: '0.2em', color: '#5cf2ff', textTransform: 'uppercase', marginBottom: '6px' }}>
                                                    Active Process
                                                </div>
                                                <div style={{ color: '#e7fdff', fontSize: '14px' }}>
                                                    {currentStatus || 'Initializing analysis...'}
                                                </div>
                                            </div>

                                            {/* COMPACT ERROR UI */}
                                            {error && (
                                                <div style={{ marginTop: '10px' }}>
                                                    <div style={{ color: '#ff4444', fontSize: '11px', fontFamily: 'var(--font-mono)', cursor: 'pointer', marginBottom: '4px', textDecoration: 'underline' }} onClick={() => navigator.clipboard.writeText(error)}>
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
                                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#ff4444', textTransform: 'uppercase' }}>
                                                            PROCESS FAILURE
                                                        </span>
                                                        <button
                                                            onClick={copyErrorToClipboard}
                                                            style={{ background: 'none', border: 'none', color: '#666', fontSize: '10px', cursor: 'pointer', textDecoration: 'underline' }}
                                                        >
                                                            COPY ERROR
                                                        </button>
                                                    </div>

                                                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#999', lineHeight: '1.4' }}>
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
                                            <p style={{ color: '#b6ff5f', fontSize: '16px', fontWeight: 600, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                                                {step === 'analysis-ai' ? 'STAGE 1: MACHINE PERCEPTION' : (step === 'analysis-human' ? 'STAGE 2: ANALYSIS' : 'STAGE 3: FINAL SYNTHESIS')}
                                            </p>
                                        </div>

                                        {/* STAGE 1: AI VIEW (Visual -> Feeling) */}
                                        {step === 'analysis-ai' && (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                style={{ textAlign: 'center', maxWidth: '900px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '24px' }}
                                            >
                                                {aiViewMode === 'visual' ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px' }}>
                                                        <div style={{ fontSize: '12px', color: '#00f3ff', letterSpacing: '0.22em', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
                                                            What AI saw
                                                        </div>

                                                        {!aiVisualRevealed ? (
                                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                                                <button
                                                                    onClick={() => setAiVisualRevealed(true)}
                                                                    className="hover-btn"
                                                                    style={{
                                                                        padding: '14px 34px',
                                                                        background: 'rgba(255,255,255,0.08)',
                                                                        color: '#fff',
                                                                        border: '1px solid rgba(255,255,255,0.2)',
                                                                        borderRadius: '100px',
                                                                        fontWeight: 600,
                                                                        fontSize: '12px',
                                                                        letterSpacing: '0.12em',
                                                                        cursor: 'pointer'
                                                                    }}
                                                                >
                                                                    CLICK TO REVIEW WHAT AI SAW
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div style={{
                                                                    fontSize: '28px',
                                                                    color: '#fff',
                                                                    lineHeight: '1.5',
                                                                    fontFamily: 'var(--font-ui)',
                                                                    fontStyle: 'italic',
                                                                    maxWidth: '720px'
                                                                }}>
                                                                    “{aiReport?.visual_summary || "Analyzing visual context..."}”
                                                                </div>
                                                                <div style={{
                                                                    fontSize: '10px',
                                                                    color: '#7a7a7a',
                                                                    fontFamily: 'var(--font-mono)',
                                                                    letterSpacing: '0.14em',
                                                                    textTransform: 'uppercase'
                                                                }}>
                                                                    [Did AI guess it right?]
                                                                </div>

                                                                <button
                                                                    onClick={() => setAiViewMode('feeling')}
                                                                    className="hover-btn"
                                                                    style={{
                                                                        padding: '14px 38px',
                                                                        background: 'var(--color-brand-red)',
                                                                        color: '#fff',
                                                                        border: 'none',
                                                                        borderRadius: '100px',
                                                                        fontWeight: 600,
                                                                        fontSize: '12px',
                                                                        letterSpacing: '0.12em',
                                                                        cursor: 'pointer',
                                                                        boxShadow: '0 0 20px rgba(163, 0, 33, 0.35)'
                                                                    }}
                                                                >
                                                                    WHAT AI FELT
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <div style={{ fontSize: '12px', color: '#00f3ff', letterSpacing: '0.22em', marginBottom: '10px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
                                                            What AI felt
                                                        </div>
                                                        <div style={{
                                                            fontSize: '34px', fontWeight: 300, color: '#fff',
                                                            marginBottom: '18px', fontFamily: 'var(--font-body)', fontStyle: 'italic'
                                                        }}>
                                                            "{aiReport?.ai_feeling_description || aiReport?.ai_feeling || "Analyzing..."}"
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                                            {(aiReport?.ai_feeling_keywords && Array.isArray(aiReport.ai_feeling_keywords)
                                                                ? aiReport.ai_feeling_keywords
                                                                : aiReport?.ai_keywords || []
                                                            ).slice(0, 3).map((kw, i) => (
                                                                <span key={i} style={{
                                                                    fontSize: '20px', fontFamily: 'var(--font-mono)', color: '#00f3ff',
                                                                    padding: '20px 30px', background: 'rgba(0, 243, 255, 0.12)',
                                                                    border: '1px solid rgba(0, 243, 255, 0.35)', borderRadius: '999px'
                                                                }}>
                                                                    {kw}
                                                                </span>
                                                            ))}
                                                        </div>

                                                        <div style={{ marginTop: '28px' }}>
                                                            <button
                                                                onClick={analyzeHumans}
                                                                className="hover-btn"
                                                                style={{
                                                                    padding: '16px 48px',
                                                                    background: 'var(--color-brand-red)', color: '#fff',
                                                                    border: 'none', borderRadius: '100px',
                                                                    fontWeight: 600, fontSize: '13px', letterSpacing: '0.1em',
                                                                    cursor: 'pointer', boxShadow: '0 0 20px rgba(163, 0, 33, 0.35)'
                                                                }}
                                                            >
                                                                COMPARE HUMAN/AI
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
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
                                                    style={{ textAlign: 'center', paddingRight: '20px', borderRight: 'none' }}
                                                >
                                                    <div style={{ fontSize: '11px', color: '#00f3ff', letterSpacing: '0.2em', marginBottom: '24px', fontFamily: 'var(--font-mono)' }}>MACHINE FEELING</div>

                                                    {/* Primary Emotion (Large) - NOW USING KEYWORDS */}
                                                    <div style={{
                                                        fontSize: '32px', lineHeight: '1.2', color: '#fff', marginBottom: '24px',
                                                        fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
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
                                                                padding: '6px 14px', borderRadius: '100px', background: 'rgba(0, 243, 255, 0.05)', fontFamily: 'var(--font-mono)'
                                                            }}>
                                                                {e}
                                                            </span>
                                                        ))}
                                                    </div> 
                                                    */}
                                                </motion.div>

                                                {/* Divider Line (Grid Column 2) */}
                                                <div style={{ height: '70%', width: '1px', margin: '0 auto', background: 'rgba(255,255,255,0.2)' }} />

                                                {/* HUMAN SIDE (Right) - STRICTLY EMOTION ONLY */}
                                                <motion.div
                                                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                                                    style={{ textAlign: 'center', paddingLeft: '20px', borderLeft: 'none' }}
                                                >
                                                    <div style={{ fontSize: '11px', color: '#ff0055', letterSpacing: '0.2em', marginBottom: '24px', fontFamily: 'var(--font-mono)' }}>HUMAN FEELING</div>

                                                    {/* Primary Emotion (Large) - NOW USING KEYWORDS */}
                                                    <div style={{
                                                        fontSize: '32px', lineHeight: '1.2', color: '#fff', marginBottom: '24px',
                                                        fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
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
                                                                padding: '6px 14px', borderRadius: '100px', background: 'rgba(255, 0, 85, 0.05)', fontFamily: 'var(--font-mono)'
                                                            }}>
                                                                {k}
                                                            </span>
                                                        ))}
                                                    </div> 
                                                    */}
                                                </motion.div>
                                            </div>
                                        )}

                                        {step === 'analysis-human' && (
                                            <div style={{ marginTop: '24px', textAlign: 'center' }}>
                                                <button
                                                    onClick={synthesize}
                                                    className="hover-btn"
                                                    style={{
                                                        padding: '16px 48px',
                                                        background: 'var(--color-brand-red)',
                                                        color: '#fff',
                                                        border: 'none',
                                                        borderRadius: '100px',
                                                        fontWeight: 600,
                                                        fontSize: '13px',
                                                        letterSpacing: '0.1em',
                                                        cursor: 'pointer',
                                                        boxShadow: '0 0 20px rgba(163, 0, 33, 0.35)'
                                                    }}
                                                >
                                                    ANALYZE CONSENSUS
                                                </button>
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
                                                <div style={{ fontSize: '12px', color: '#888', letterSpacing: '0.2em', marginBottom: '20px', fontFamily: 'var(--font-mono)' }}>SEMANTIC CONSENSUS</div>

                                                <div style={{
                                                    fontSize: '120px', fontWeight: 800, lineHeight: 1,
                                                    color: consensusData?.consensus_percentage > 50 ? '#00ff66' : '#ff4444',
                                                    textShadow: '0 0 50px rgba(0,0,0,0.5)', fontFamily: 'var(--font-mono)'
                                                }}>
                                                    {consensusData?.consensus_percentage}%
                                                </div>

                                                {/* Context Explanation */}
                                                <div style={{
                                                    fontSize: '18px', maxWidth: '600px', textAlign: 'center',
                                                    color: '#fff', fontFamily: 'var(--font-mono)',
                                                    margin: '30px 0', lineHeight: '1.6'
                                                }}>
                                                    {buildConsensusNarrative(consensusData?.consensus_percentage || 0)}
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
                                                {step === 'analysis-human' && null}
                                                {step === 'analysis-synthesis' && (
                                                    /* Synthesis has its own reload button in main block, no extra button needed here */
                                                    null
                                                )}
                                            </div>

                                            {/* Punctum Reference Link moved to left controls */}
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
