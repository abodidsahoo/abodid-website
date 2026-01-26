import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@supabase/supabase-js';
import BubbleCloud from './BubbleCloud';
import SimpleAudioRecorder from './SimpleAudioRecorder';

const supabase = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY
);

// Fallback images if database empty
const FALLBACK_IMAGES = [
    "https://raw.githubusercontent.com/manikandan-ko/invisible-punctum/main/public/images/img1.jpg",
    "https://raw.githubusercontent.com/manikandan-ko/invisible-punctum/main/public/images/img2.jpg",
    "https://raw.githubusercontent.com/manikandan-ko/invisible-punctum/main/public/images/img3.jpg",
    "https://raw.githubusercontent.com/manikandan-ko/invisible-punctum/main/public/images/img4.jpg",
    "https://raw.githubusercontent.com/manikandan-ko/invisible-punctum/main/public/images/img5.jpg",
];

const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
    exit: { opacity: 0, y: -20, transition: { duration: 0.4, ease: "easeIn" } }
};

export default function PunctumGame() {
    const [step, setStep] = useState('intro'); // intro, select, input, viz, analysis
    const [images, setImages] = useState([]);
    const [selectedImage, setSelectedImage] = useState(null);
    const [userInput, setUserInput] = useState('');
    const [audioData, setAudioData] = useState({ blob: null, duration: 0 }); // New audio state
    const [comments, setComments] = useState([]);
    const [analysisResult, setAnalysisResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Load images on mount
    useEffect(() => {
        const fetchImages = async () => {
            try {
                // Fetch from OUR LOCAL internal API endpoint (Ownership!)
                const res = await fetch("/api/punctum-images", {
                    cache: "no-store"
                });

                if (!res.ok) throw new Error("Failed to fetch from local endpoint");

                const data = await res.json();
                const validImages = Array.isArray(data) ? data : [];

                // Shuffle and pick 5
                const shuffled = validImages.sort(() => 0.5 - Math.random()).slice(0, 5);

                // Map to simpler structure
                const mapped = shuffled.map((url, i) => ({
                    id: i,
                    url: typeof url === 'string' ? url : url.url
                }));

                setImages(mapped.length > 0 ? mapped : FALLBACK_IMAGES.map((url, i) => ({ id: i, url })));
            } catch (err) {
                console.error("Failed to fetch images", err);
                setImages(FALLBACK_IMAGES.map((url, i) => ({ id: i, url })));
            }
        };
        fetchImages();
    }, []);

    // Fetch comments when image selected
    useEffect(() => {
        if (!selectedImage) return;

        const fetchComments = async () => {
            try {
                const { data, error } = await supabase
                    .from('photo_feedback')
                    .select('feeling_text') // Updated column name
                    .eq('image_url', selectedImage.url)
                    .not('feeling_text', 'is', null);

                if (error) throw error;

                const justText = data.map(d => d.feeling_text).filter(Boolean);
                setComments(justText.length > 0 ? justText : ["No comments yet. Be the first!", "What do you see?", "Mysterious..."]);
            } catch (err) {
                setComments(["Peaceful", "Looks like a dream", "Is this real?", "Sadness", "Hope"]);
            }
        };
        fetchComments();
    }, [selectedImage]);

    const handleSelect = (img) => {
        setSelectedImage(img);
        setStep('input');
        setAudioData({ blob: null, duration: 0 }); // Reset audio
        setUserInput('');
    };

    const handleInputSubmit = async (e) => {
        e.preventDefault();

        // Validation: Need either text or audio
        if (!userInput.trim() && !audioData.blob) return;

        let audioUrl = null;
        let audioPath = null;

        try {
            // 1. Upload Audio if exists
            if (audioData.blob) {
                const ext = 'webm';
                // Random filename
                const filename = `audio/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

                const { data, error } = await supabase.storage
                    .from('invisible-punctum-assets')
                    .upload(filename, audioData.blob, {
                        cacheControl: '3600',
                        upsert: false
                    });

                if (error) throw error;

                audioPath = data.path;
                const { data: { publicUrl } } = supabase.storage
                    .from('invisible-punctum-assets')
                    .getPublicUrl(audioPath);

                audioUrl = publicUrl;
            }

            // 2. Insert Record
            const { error: insertError } = await supabase.from('photo_feedback').insert([{
                image_url: selectedImage.url,
                feeling_text: userInput,
                project_id: 'invisible-punctum',
                // New Audio Fields
                audio_url: audioUrl,
                audio_path: audioPath,
                audio_duration_ms: audioData.duration * 1000,
                audio_mime: audioData.blob ? 'audio/webm' : null
            }]);

            if (insertError) throw insertError;

            // 3. Update Local State for Viz
            // If audio only, we add a [Audio] placeholder text for the bubble
            const commentText = userInput.trim() || "Previously: [Audio Response]";
            setComments(prev => [...prev, commentText]);
            setStep('viz');

        } catch (err) {
            console.error("Upload/Insert failed:", err);
            // We proceed to Viz anyway to keep flow active in demo, or show alerts
            alert("Saved locally, but upload failed: " + err.message);
            setStep('viz');
        }
    };

    const handleAnalyze = async () => {
        setStep('analysis');
        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/analyze-image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    imageUrl: selectedImage.url,
                    comments: comments
                })
            });

            if (!res.ok) throw new Error("Analysis failed");

            const data = await res.json();
            setAnalysisResult(data);
        } catch (err) {
            console.error(err);
            setError("AI was unable to process this image. It might be too complex.");
        } finally {
            setLoading(false);
        }
    };

    const reset = () => {
        setStep('select');
        setSelectedImage(null);
        setUserInput('');
        setComments([]);
        setAnalysisResult(null);
        setAudioData({ blob: null, duration: 0 });
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
            overflow: 'hidden'
        }}>
            <AnimatePresence mode="wait">

                {/* INTRO */}
                {step === 'intro' && (
                    <motion.div
                        key="intro"
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        style={{ textAlign: 'center', maxWidth: '640px', padding: '0 24px' }}
                    >
                        <h1 style={{
                            fontSize: '4.5rem',
                            fontWeight: 200,
                            letterSpacing: '-0.02em',
                            background: 'linear-gradient(180deg, #fff 0%, #888 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            marginBottom: '32px',
                            marginTop: 0
                        }}>
                            Invisible Punctums
                        </h1>
                        <p style={{ fontSize: '1.25rem', color: '#888', lineHeight: 1.6, marginBottom: '56px', fontWeight: 300 }}>
                            An experiment in human vs artificial sentiment.<br />
                            Can AI understand the <i>punctum</i>—the prick, the wound—of a photograph?
                        </p>
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
                        <h2 style={{ fontSize: '2rem', fontWeight: 200, marginBottom: '60px', color: '#fff' }}>Select an image that calls to you.</h2>
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
                            width: '360px', height: '480px',
                            borderRadius: '4px', overflow: 'hidden', marginBottom: '40px',
                            boxShadow: '0 40px 80px rgba(0,0,0,0.6)',
                            border: '1px solid rgba(255,255,255,0.05)'
                        }}>
                            <img src={selectedImage.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>

                        <form onSubmit={handleInputSubmit} style={{ width: '100%', maxWidth: '480px', textAlign: 'center' }}>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 300, marginBottom: '24px', color: '#ccc' }}>What is the punctum here?</h3>

                            {/* AUDIO RECORDER */}
                            <div style={{ marginBottom: '32px' }}>
                                <SimpleAudioRecorder onRecordingComplete={(blob, duration) => setAudioData({ blob, duration })} />
                            </div>

                            <textarea
                                autoFocus
                                value={userInput}
                                onChange={e => setUserInput(e.target.value)}
                                placeholder="Or type your feeling..."
                                rows={3}
                                style={{
                                    width: '100%',
                                    padding: '16px 0',
                                    background: 'transparent',
                                    border: 'none',
                                    borderBottom: '1px solid rgba(255,255,255,0.2)',
                                    color: '#fff',
                                    fontSize: '20px',
                                    marginBottom: '40px',
                                    outline: 'none',
                                    textAlign: 'center',
                                    fontWeight: 300,
                                    resize: 'none'
                                }}
                            />
                            <button
                                type="submit"
                                disabled={!userInput.trim() && !audioData.blob}
                                style={{
                                    padding: '16px 40px',
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
                                SUBMIT RECORD
                            </button>
                            <div style={{ marginTop: '20px', fontSize: '12px', color: '#444' }}>Press Enter to submit</div>
                        </form>
                    </motion.div>
                )}

                {/* VISUALIZATION */}
                {step === 'viz' && (
                    <motion.div
                        key="viz"
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        style={{ width: '100%', height: '100vh', position: 'relative', overflow: 'hidden' }}
                    >
                        <div style={{
                            position: 'absolute',
                            top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                            width: '30vh', height: '40vh',
                            borderRadius: '4px', overflow: 'hidden', zIndex: 0,
                            opacity: 0.3,
                            filter: 'blur(4px)'
                        }}>
                            <img src={selectedImage.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>

                        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 10 }}>
                            <BubbleCloud
                                comments={comments}
                                onAskAI={handleAnalyze}
                            />
                        </div>
                    </motion.div>
                )}

                {/* ANALYSIS RESULT */}
                {step === 'analysis' && (
                    <motion.div
                        key="analysis"
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        style={{ width: '100%', maxWidth: '1000px', textAlign: 'center', padding: '20px' }}
                    >
                        {loading ? (
                            <div className="loader" style={{ height: '50vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                                <motion.div
                                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                                    transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                                    style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#fff', marginBottom: '32px' }}
                                />
                                <p style={{ fontSize: '14px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#666' }}>Consulting Synthetic Mind...</p>
                            </div>
                        ) : error ? (
                            <div style={{ color: '#ff6b6b' }}>
                                <h3 style={{ fontWeight: 300 }}>Connection Severed</h3>
                                <p>{error}</p>
                                <button onClick={reset} style={{ padding: '8px 16px', background: '#333', color: '#fff', border: 'none', borderRadius: '4px', marginTop: '16px' }}>Retry Connection</button>
                            </div>
                        ) : (
                            <div style={{ textAlign: 'left', padding: '0 20px' }}>

                                {/* HEADER: VERDICT + SCORE */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '40px', alignItems: 'start', marginBottom: '60px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '40px' }}>
                                    <div>
                                        <h4 style={{ fontSize: '12px', letterSpacing: '0.1em', color: '#666', textTransform: 'uppercase', marginBottom: '8px' }}>Analysis Verdict</h4>
                                        <h1 style={{ fontSize: '3rem', fontWeight: 200, margin: 0, color: '#fff' }}>{analysisResult.verdict}</h1>
                                        <p style={{ fontSize: '1.2rem', color: '#888', marginTop: '16px', maxWidth: '400px', lineHeight: 1.5 }}>{analysisResult.reasoning}</p>

                                        {/* Tags / Emotions */}
                                        <div style={{ marginTop: '24px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                            {analysisResult.primary_emotion && (
                                                <span style={{ padding: '4px 12px', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '100px', fontSize: '11px', color: '#fff' }}>
                                                    Primary: {analysisResult.primary_emotion}
                                                </span>
                                            )}
                                            {analysisResult.top_secondary_emotions?.slice(0, 3).map((emote, i) => (
                                                <span key={i} style={{ padding: '4px 12px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '100px', fontSize: '11px', color: '#888' }}>
                                                    {emote}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <h4 style={{ fontSize: '12px', letterSpacing: '0.1em', color: '#666', textTransform: 'uppercase', marginBottom: '16px' }}>Trainability Score</h4>
                                        <div style={{
                                            fontSize: '6rem',
                                            fontWeight: 100,
                                            lineHeight: .9,
                                            color: analysisResult.trainability_score > 70 ? '#fff' : analysisResult.trainability_score < 30 ? '#ffd166' : '#fff'
                                        }}>
                                            {analysisResult.trainability_score}
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#444', marginTop: '8px' }}>OUT OF 100</div>
                                    </div>
                                </div>

                                {/* COLUMNS: ANALYSIS */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px' }}>
                                    <div>
                                        <h4 style={{ fontSize: '12px', letterSpacing: '0.1em', color: '#666', textTransform: 'uppercase', marginBottom: '24px' }}>AI Perception</h4>
                                        <p style={{ lineHeight: 1.8, fontSize: '15px', color: '#ccc', fontWeight: 300 }}>"{analysisResult.punctum_analysis}"</p>
                                    </div>
                                    <div>
                                        <h4 style={{ fontSize: '12px', letterSpacing: '0.1em', color: '#666', textTransform: 'uppercase', marginBottom: '24px' }}>Human Consensus</h4>
                                        <p style={{ lineHeight: 1.8, fontSize: '15px', color: '#ccc', fontWeight: 300 }}>{analysisResult.human_context_analysis}</p>
                                    </div>
                                </div>

                                <div style={{ marginTop: '80px', textAlign: 'center' }}>
                                    <button
                                        onClick={reset}
                                        className="hover-btn"
                                        style={{
                                            padding: '16px 32px',
                                            background: '#fff',
                                            color: '#000',
                                            border: 'none',
                                            borderRadius: '100px',
                                            cursor: 'pointer',
                                            fontWeight: 500,
                                            fontSize: '14px',
                                            letterSpacing: '0.05em',
                                            transition: 'transform 0.2s'
                                        }}
                                    >
                                        ANALYZE ANOTHER IMAGE
                                    </button>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}

            </AnimatePresence>
        </div>
    );
}
