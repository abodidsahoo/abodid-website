import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Sample Data for Simulation
// Sample Data for Simulation
const AnalysisInterface = ({ imageUrl, imageId }) => {
    const [analysisData, setAnalysisData] = useState(null);

    // Auto-scroll logs
    useEffect(() => {
        if (logEndRef.current) {
            logEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs]);

    const startAnalysis = async () => {
        setStatus('queue');
        setLogs([]);
        setAnalysisData(null);

        // Queue visual only
        setTimeout(() => {
            setStatus('processing');
            runRealAnalysis();
        }, 1500);
    };

    const addLog = (msg) => {
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };

    const runRealAnalysis = async () => {
        try {
            // STEP 1: Vision Analysis
            addLog("Connecting to Vision Neural Net...");
            const visionRes = await fetch('/api/analyze-vision', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrl: imageUrl })
            });

            if (!visionRes.ok) {
                const errData = await visionRes.json().catch(() => ({}));
                throw new Error(errData.error || `Vision analysis failed: ${visionRes.status}`);
            }
            const visionData = await visionRes.json();
            addLog(`Vision Model: ${visionData.model_used}`);
            addLog("Visual features extracted.");
            addLog(`Detected Emotion: ${visionData.dominant_emotion}`);

            // STEP 2: Fetch Human Comments (if any)
            addLog("Retrieving human memory bank...");
            // In a real app we'd fetch comments from DB here. 
            // For now, let's use a dummy list or fetch from an endpoint if available.
            // We'll simulate fetching comments for this specific image context
            const humanComments = [" It feels lonely", "Dark but peaceful", "Scary", "I love the lighting"];

            // STEP 3: Consensus Analysis
            addLog("Calculating Consensus & Trainability...");
            const consensusRes = await fetch('/api/analyze-consensus', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    aiAnalysis: visionData,
                    humanComments: humanComments
                })
            });

            if (!consensusRes.ok) throw new Error("Consensus analysis failed");
            const consensusData = await consensusRes.json();
            addLog(`Consensus Model: ${consensusData.model_used}`);
            addLog("Gap Analysis complete.");

            // Finalize
            setAnalysisData({
                ...consensusData,
                ...visionData,
                human_emotions: humanComments
            });

            addLog("Report generated.");
            setTimeout(() => setStatus('complete'), 1000);

        } catch (err) {
            addLog(`Error: ${err.message}`);
            console.error(err);
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto p-6 font-sans text-stone-800">

            {/* Header / Config */}
            <div className="mb-8 flex flex-col items-center justify-center text-center">
                <h2 className="text-sm font-bold uppercase tracking-widest text-stone-500 mb-2">
                    Untrainable Model Analysis v3.0 (Live AI)
                </h2>
                <div className="text-xs bg-green-100 text-green-800 px-3 py-1 rounded-full border border-green-200 inline-flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    LIVE NEURAL CONNECTION
                </div>
            </div>

            <div className="bg-white/80 backdrop-blur-xl border border-white/50 shadow-2xl rounded-3xl overflow-hidden min-h-[600px] flex flex-col relative">

                {/* Image Preview Background (Blurred) */}
                <div
                    className="absolute inset-0 bg-cover bg-center opacity-10 pointer-events-none"
                    style={{ backgroundImage: `url(${imageUrl})` }}
                />

                {/* IDLE STATE */}
                {status === 'idle' && (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 z-10">
                        <div className="w-64 h-64 mb-8 rounded-2xl overflow-hidden shadow-lg rotate-3 transition-transform hover:rotate-0 duration-500">
                            <img src={imageUrl} alt="Analysis Target" className="w-full h-full object-cover" />
                        </div>
                        <h1 className="text-3xl font-light mb-4">Ready to Analyze</h1>
                        <p className="text-stone-500 max-w-md text-center mb-8">
                            Evaluate the gap between AI interpretation and human perception for this image.
                        </p>
                        <button
                            onClick={startAnalysis}
                            className="bg-stone-900 text-white px-8 py-4 rounded-full font-medium hover:scale-105 transition-transform shadow-xl flex items-center gap-3"
                        >
                            <span>Start Analysis</span>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                        </button>
                    </div>
                )}

                {/* QUEUE STATE */}
                {status === 'queue' && (
                    <div className="flex-1 flex flex-col items-center justify-center z-10">
                        <div className="w-16 h-16 border-4 border-stone-200 border-t-stone-800 rounded-full animate-spin mb-6"></div>
                        <h3 className="text-xl font-medium mb-2">In Queue...</h3>
                        <p className="text-stone-400">Position #{queuePos}</p>
                    </div>
                )}

                {/* PROCESSING STATE */}
                {status === 'processing' && (
                    <div className="flex-1 flex flex-col p-8 z-10 font-mono text-sm max-w-2xl mx-auto w-full">
                        <div className="bg-black/5 rounded-xl p-6 h-full overflow-hidden flex flex-col">
                            <div className="flex items-center gap-2 mb-4 border-b border-black/5 pb-2">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                <span className="uppercase text-xs font-bold opacity-50">Live Terminal</span>
                            </div>
                            <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
                                {logs.map((log, i) => (
                                    <div key={i} className="opacity-0 animate-fade-in-up" style={{ animationDelay: '0ms', animationFillMode: 'forwards' }}>
                                        <span className="text-green-700 mr-2">➜</span>
                                        {log}
                                    </div>
                                ))}
                                <div ref={logEndRef} />
                            </div>
                        </div>
                    </div>
                )}

                {/* COMPLETE STATE (Dashboard) */}
                {status === 'complete' && analysisData && (
                    <div className="flex-1 flex flex-col p-0 z-10 overflow-y-auto">
                        {/* Dashboard Header */}
                        <div className="p-8 border-b border-stone-100 bg-white/50">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-lg overflow-hidden shadow-sm">
                                        <img src={imageUrl} className="w-full h-full object-cover" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold">Analysis Report</h2>
                                        <p className="text-stone-400 text-xs uppercase tracking-wider">ID: {imageId.split('-')[0]}...</p>
                                    </div>
                                </div>
                                <button onClick={() => window.location.reload()} className="text-xs font-bold underline opacity-50 hover:opacity-100">
                                    Analyze Another
                                </button>
                            </div>
                        </div>

                        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-12">

                            {/* SCORES */}
                            <div className="space-y-8">
                                <div className="flex items-center gap-6">
                                    <ScoreCircle score={analysisData.trainability_score || 0} label="Trainability" sub="Score" color="text-red-600" />
                                    <ScoreCircle score={analysisData.consensus_score || 0} label="Consensus" sub="Score" color="text-orange-600" />
                                </div>
                                <div className="bg-stone-50 p-6 rounded-2xl border border-stone-100">
                                    <h4 className="text-xs font-bold uppercase text-stone-400 mb-4">Gap Analysis</h4>
                                    <p className="text-sm leading-relaxed text-stone-700">
                                        {analysisData.gap_analysis || "No analysis available."}
                                    </p>
                                </div>
                            </div>

                            {/* COMPARISON */}
                            <div className="space-y-6">
                                <div>
                                    <h4 className="flex items-center gap-2 text-sm font-bold mb-3">
                                        <span className="text-xl">🧠</span> AI Perception
                                    </h4>
                                    <div className="p-4 bg-white rounded-xl shadow-sm border border-stone-100">
                                        <div className="text-lg font-medium mb-1">{analysisData.dominant_emotion || "Analyzing..."}</div>
                                        <div className="text-xs text-stone-400">{analysisData.studium_description || "Visual analysis unavailable."}</div>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="flex items-center gap-2 text-sm font-bold mb-3">
                                        <span className="text-xl">❤️</span> Human Input
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {analysisData.human_emotions && analysisData.human_emotions.map((e, i) => (
                                            <span key={i} className="px-3 py-1 bg-stone-100 rounded-full text-xs font-medium text-stone-600">
                                                {e}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const ScoreCircle = ({ score, label, sub, color }) => (
    <div className="flex flex-col items-center">
        <div className="relative w-32 h-32 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
                <circle cx="64" cy="64" r="60" stroke="#f5f5f4" strokeWidth="8" fill="none" />
                <circle
                    cx="64" cy="64" r="60"
                    stroke="currentColor" strokeWidth="8"
                    fill="none"
                    strokeDasharray={377}
                    strokeDashoffset={377 - (377 * score) / 100}
                    className={`${color} transition-all duration-1000 ease-out`}
                />
            </svg>
            <div className="absolute flex flex-col items-center">
                <span className={`text-3xl font-bold ${color}`}>{score}%</span>
                <span className="text-[10px] uppercase font-bold text-stone-400">{sub}</span>
            </div>
        </div>
        <span className="mt-2 font-bold text-sm text-stone-700">{label}</span>
    </div>
);

export default AnalysisInterface;
