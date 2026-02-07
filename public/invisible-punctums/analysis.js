(() => {
    "use strict";

    // [DEV] UNCOMMENT TO TEST LOCALLY
    window.USE_LOCAL_ANALYSIS_URL = true;

    let ENDPOINT = "https://kybjzwqfoljgniyxmbts.supabase.co/functions/v1/analyze-image";
    if (window.USE_LOCAL_ANALYSIS_URL) {
        ENDPOINT = "http://localhost:54321/";
    }

    /* ===========================
       CONFIG
    ============================ */
    const LOADING_MESSAGES = [
        "Reading comments...",
        "analyzing emotional sentiment...",
        "computing trainability...",
        "evaluating meaning variability...",
        "synthesizing results..."
    ];

    // Sample/Demo Analysis Data
    const SAMPLE_ANALYSIS_DATA = {
        analytics: {
            trainability_score: 40,
            variability_emotion: 22,
            gemini: {
                model_used: "gemini-1.5-pro",
                aggregate: {
                    primary_emotion: "Mixed Emotions",
                    top_secondary: ["romantic", "calmness", "scary", "decay", "darkness"],
                    representative_quotes: [
                        "This feels so romantic, like a moonlit seashore at dawn",
                        "The darkness is scary but there's something peaceful about it",
                        "I see decay and abandonment, it makes me feel uneasy",
                        "It's hauntingly beautiful - could be the moon or a dark room, I can't tell",
                        "There's a calm solitude here that feels both peaceful and lonely"
                    ]
                }
            },
            advanced: {
                final_emotion: "Darkness and Sadness",
                keywords: ["dark seashore", "solitary", "moon", "negative", "haunting"],
                synthesis: {
                    // Replaced single synthesis_text with split analysis
                    agreement_level: "Low Consensus (22%)"
                },
                human_response_analysis: "The human response analysis shows diverse interpretations, leading to a low consensus score. Some felt romance and saw a moonlit dawn, while others experienced scary darkness and decay. This high variability indicates that humans do not agree on a single emotional meaning.",
                trainability_analysis: "The AI perceived this image as dark and sad, which aligns with some human responses but conflicts with the romantic interpretations. Due to the high gap between consistent AI detection and scattered human consensus, the trainability score is low (40%)."
            }
        }
    };

    /* ===========================
       GLOBAL QUEUE SYSTEM
    ============================ */
    const analysisQueue = [];
    let isQueueRunning = false;

    async function processQueue() {
        if (isQueueRunning || analysisQueue.length === 0) return;

        isQueueRunning = true;
        const task = analysisQueue[0]; // Peek

        try {
            if (task.onStart) task.onStart();
            await task.fn();
        } catch (e) {
            console.error("[Queue] Task failed", e);
        } finally {
            analysisQueue.shift(); // Remove done task
            isQueueRunning = false;

            // Notify next waiting task (optional UI update)
            if (analysisQueue.length > 0) {
                // Determine new positions? 
                // For now, simple recursion
                processQueue();
            }
        }
    }

    /* ===========================
       UI BUILDER
    ============================ */
    function createAnalysisUI(container, imageUrl) {
        if (!container || !imageUrl) return;

        // Widget Container
        const widget = document.createElement("div");
        widget.className = "um-analyze-widget";

        // 1. Button Wrapper
        const btnWrapper = document.createElement("div");
        btnWrapper.className = "um-btn-wrapper";

        const btn = document.createElement("button");
        btn.className = "um-matte-btn";
        btn.type = "button";
        btn.innerHTML = `<span class="um-btn-text">Check AI Trainability Score</span>`;

        // 2. Explanatory Text
        const caption = document.createElement("div");
        caption.className = "um-caption";
        caption.textContent = "Analyze human response variability and AI trainability";

        btnWrapper.appendChild(btn);
        btnWrapper.appendChild(caption);

        // 3. Result Panel
        const panel = document.createElement("div");
        panel.className = "um-analyze-panel";
        panel.style.display = "none";

        let isOpen = false;
        let hasLoaded = false;
        let isLoading = false;
        let isQueued = false;

        // Queue Logic
        function enqueueAnalysis() {
            isQueued = true;
            isLoading = true; // Block UI interactions

            // Initial Queued State
            panel.innerHTML = `
                <div class="um-loading-view">
                    <div class="um-spinner" style="opacity:0.5; animation-duration: 2s;"></div>
                    <div class="um-loading-text">Queued: Waiting for available slot...</div>
                </div>
            `;

            analysisQueue.push({
                onStart: () => {
                    // Transition to active loading state
                    // runAnalysis will overwrite innerHTML
                },
                fn: async () => {
                    await runAnalysis();
                    isQueued = false; // Task done
                }
            });

            // Update UI count?
            const pos = analysisQueue.length;
            if (pos > 1) {
                const txt = panel.querySelector(".um-loading-text");
                if (txt) txt.innerText = `Queued: Position #${pos}`;
            }

            processQueue();
        }

        // Toggle Logic
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            isOpen = !isOpen;
            updateState();
        });


        function updateState() {
            if (isOpen) {
                panel.style.display = "block";
                btn.classList.add("is-active");
                btn.innerHTML = `<span class="um-btn-text">Hide Analysis</span>`;

                if (!hasLoaded && !isLoading && !isQueued) {
                    enqueueAnalysis();
                }
            } else {
                panel.style.display = "none";
                btn.classList.remove("is-active");
                btn.innerHTML = `<span class="um-btn-text">Check AI Trainability Score</span>`;
            }
        }

        async function runAnalysis(forceLocal = false) {
            isLoading = true;

            // Log Container (Clean List View)
            const logContainer = document.createElement("div");
            logContainer.className = "um-loading-log";
            logContainer.style.cssText = `
                display: flex; 
                flex-direction: column; 
                align-items: flex-start; 
                gap: 8px; 
                margin-top: 0; 
                width: 100%; 
                max-width: 600px;
                font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Mono', 'Droid Sans Mono', 'Source Code Pro', monospace;
                height: 200px;
                overflow-y: auto;
                padding: 16px;
                background: #f9f9f9;
                border-radius: 8px;
                border: 1px solid rgba(0,0,0,0.05);
            `;

            // Initial Message
            const initMsg = document.createElement("div");
            initMsg.className = "um-log-item";
            initMsg.style.cssText = "font-size: 11px; color: #333; font-weight: 600; opacity: 0.8;";
            const time = new Date().toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
            initMsg.innerText = `[${time}] ${forceLocal ? "Initializing Local AI..." : "Initializing analysis engine..."}`;
            logContainer.appendChild(initMsg);

            panel.innerHTML = `
                <div class="um-loading-view" style="min-height: 220px; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%;">
                    <!-- No Spinner, just Log -->
                </div>
            `;
            // Stop Button Container
            const stopContainer = document.createElement("div");
            stopContainer.style.cssText = "margin-bottom: 12px; display: flex; align-items: center; gap: 10px;";

            const stopBtn = document.createElement("button");
            stopBtn.type = "button";
            stopBtn.className = "um-matte-btn";
            stopBtn.style.cssText = "min-width: auto; padding: 6px 12px; font-size: 11px; background: #fee; color: #d32f2f; border-color: #ffcdd2;";
            stopBtn.innerHTML = "Stop Analysis";

            // Abort Controller
            const controller = new AbortController();
            stopBtn.onclick = () => {
                stopBtn.disabled = true;
                stopBtn.innerText = "Stopping...";
                controller.abort();
            };

            stopContainer.appendChild(stopBtn);
            panel.querySelector(".um-loading-view").appendChild(stopContainer);
            panel.querySelector(".um-loading-view").appendChild(logContainer);

            try {
                // Pass a callback to append to log
                const data = await fetchAnalysis(imageUrl, (msg) => {
                    // Check for duplicates (last item)
                    if (logContainer.lastChild && logContainer.lastChild.innerText.includes(msg)) return;

                    const item = document.createElement("div");
                    item.className = "um-log-item";
                    item.style.cssText = "font-size: 11px; color: #555; animation: um-slide-up 0.2s ease-out; line-height: 1.4;";

                    const ts = new Date().toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
                    item.innerText = `[${ts}] ${msg}`;

                    logContainer.appendChild(item);

                    // Auto scroll to bottom
                    logContainer.scrollTop = logContainer.scrollHeight;

                    // Auto scroll
                    item.scrollIntoView({ behavior: "smooth", block: "nearest" });
                }, { force_local: forceLocal, signal: controller.signal });

                hasLoaded = true;
                renderResults(panel, data);
            } catch (err) {
                if (err.name === 'AbortError') {
                    logContainer.innerHTML += `<div class="um-log-item" style="color: #d32f2f; font-weight: bold;">[Analysis Stopped by User]</div>`;
                    // Optional: Re-render UI to waiting state or stay in log view?
                    // For now, leave log view with "Stopped" message.
                    return;
                }
                console.warn("Analysis Failed.", err);

                // Show simulated loading steps for Safari (which fails immediately)
                // to match Chrome's behavior of showing progress
                const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
                if (isSafari && logContainer.children.length <= 1) {
                    // Add fake progress steps to show user something is happening
                    const steps = [
                        "Connecting to analysis server...",
                        "Preparing image data...",
                        "Connection failed"
                    ];

                    for (let i = 0; i < steps.length; i++) {
                        await new Promise(resolve => setTimeout(resolve, 300));
                        const item = document.createElement("div");
                        item.className = "um-log-item";
                        item.style.cssText = "font-size: 11px; color: #555; animation: um-slide-up 0.2s ease-out; line-height: 1.4;";
                        const ts = new Date().toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
                        item.innerText = `[${ts}] ${steps[i]}`;
                        logContainer.appendChild(item);
                        logContainer.scrollTop = logContainer.scrollHeight;
                    }
                }

                hasLoaded = true;

                // 1. Check for BUSY/QUEUE Error
                if (err.message && (err.message.toLowerCase().includes("processing another image") || err.message.toLowerCase().includes("busy"))) {
                    renderBusyUI(panel, true);
                    // AUTO-RETRY IN 3.5s
                    setTimeout(() => {
                        if (isOpen) runAnalysis(forceLocal);
                    }, 3500);
                }
                // 2. Check for PARTIAL DATA (Comments available)
                else if (err.partialData) {
                    // Render dashboard with what we have
                    // We construct a 'fake' full response with the partial data
                    const partialPayload = {
                        parsed: err.partialData,
                        analytics: {
                            variability_emotion: "--",
                            trainability_score: "--",
                            gemini: { model_used: "Failure (Partial Data)" }
                        },
                        model_used: "Partial Data",
                        force_local: forceLocal
                    };
                    renderResults(panel, partialPayload);

                    // Add "View Sample" toggle button below partial results
                    const sampleBtnId = "um-sample-partial-" + Math.floor(Math.random() * 1000);
                    const sampleBtnHtml = `
                        <div style="text-align: center; margin-top: 20px; padding: 20px; border-top: 1px solid #e0e0e0;">
                            <p style="font-size: 12px; color: #666; margin-bottom: 12px;">Analysis incomplete. Want to see what a full analysis looks like?</p>
                            <button type="button" id="${sampleBtnId}" class="um-matte-btn" style="min-width:auto; padding: 10px 16px; font-size:12px;">
                                View Sample
                            </button>
                        </div>
                    `;
                    panel.insertAdjacentHTML('beforeend', sampleBtnHtml);

                    setTimeout(() => {
                        const sampleBtn = document.getElementById(sampleBtnId);
                        if (sampleBtn) {
                            let sampleVisible = false;
                            sampleBtn.onclick = () => {
                                if (!sampleVisible) {
                                    renderSampleAnalysis(panel);
                                    sampleBtn.textContent = "Hide Sample";
                                    sampleVisible = true;
                                } else {
                                    // Re-render partial data view
                                    location.reload(); // Simple way to reset
                                }
                            };
                        }
                    }, 50);
                }
                // 3. Check for RAW COMMENTS (Partial available before AI ran)
                else if (err.rawComments && err.rawComments.length > 0) {
                    const rawPayload = {
                        parsed: { raw_comments: err.rawComments },
                        analytics: {
                            variability_emotion: "--",
                            trainability_score: "--",
                            gemini: { model_used: "Failure (Raw Comments Only)" }
                        },
                        model_used: "Raw Comments Only",
                        force_local: forceLocal
                    };
                    renderResults(panel, rawPayload);
                }
                // 4. Standard Error Fallback
                else {
                    renderErrorUI(panel, err, forceLocal);
                }
            } finally {
                isLoading = false;
            }
        }

        function renderBusyUI(container, isRetrying = false) {
            container.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding: 32px; text-align:center; height: 100%; color: #666;">
                    <div style="font-size: 13px; font-weight: 500; opacity: 0.8; margin-bottom: 8px;">Please wait</div>
                    <div style="font-size: 12px; opacity: 0.6; margin-bottom: 8px;">Server is busy processing another image...</div>
                    ${isRetrying ? `<div style="font-size: 10px; opacity: 0.4;">⟳ Retrying automatically...</div>` : ''}
                </div>
            `;
        }

        function renderErrorUI(container, error, isLocalRun) {
            const errorMsg = error.message || "Unknown error occurred.";
            const uniqueBtnId = "um-retry-local-" + Math.floor(Math.random() * 1000);
            const sampleBtnId = "um-sample-" + Math.floor(Math.random() * 1000);

            let html = `
                <div class="um-error-view" style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding: 32px; text-align:center; height: 100%;">
                    <div style="font-size: 32px; margin-bottom: 16px;">⚠️</div>
                    <h4 style="margin:0 0 8px 0; font-size: 16px; font-weight:700; color:#d93025;">Analysis Failed</h4>
                    <p style="font-size:13px; color:#555; line-height:1.5; margin: 0 0 24px 0; max-width: 500px;">
                        ${errorMsg}
                    </p>
            `;

            if (!isLocalRun) {
                // Cloud Failed -> Offer Local + Sample
                html += `
                    <p style="font-size:11px; opacity:0.6; margin-bottom: 12px;">Cloud analysis unreachable.</p>
                    <button type="button" id="${uniqueBtnId}" class="um-matte-btn" style="min-width:auto; padding: 10px 16px; font-size:12px; margin-bottom: 10px;">
                        Try using a local model
                    </button>
                    ${renderSampleButton(sampleBtnId)}
                `;
            } else {
                // Local Failed -> Offer Cloud + Sample
                html += `
                    <p style="font-size:11px; opacity:0.6; margin-bottom: 12px;">Local analysis failed.</p>
                    <button type="button" id="${uniqueBtnId}" class="um-matte-btn" style="min-width:auto; padding: 10px 16px; font-size:12px; margin-bottom: 10px;">
                        Try using a cloud model
                    </button>
                    ${renderSampleButton(sampleBtnId)}
                `;
            }

            // Helper for sample button
            function renderSampleButton(id) {
                return `
                    <button type="button" id="${id}" class="um-matte-btn" style="min-width:auto; padding: 10px 16px; font-size:12px;">
                        View Sample Analysis
                    </button>
                `;
            }

            html += `</div>`;
            container.innerHTML = html;

            // Wire up buttons with toggle behavior
            setTimeout(() => {
                const retryBtn = document.getElementById(uniqueBtnId);
                const sampleBtn = document.getElementById(sampleBtnId);

                if (retryBtn) {
                    retryBtn.onclick = () => {
                        // Toggle local/cloud based on current state
                        runAnalysis(!isLocalRun);
                    };
                }

                if (sampleBtn) {
                    let sampleVisible = false;
                    let sampleContentId = null;
                    let errorContentId = "um-error-content-" + Math.floor(Math.random() * 1000);

                    // Wrap existing error content in a div so we can hide/show it
                    const errorWrapper = document.createElement('div');
                    errorWrapper.id = errorContentId;
                    while (container.firstChild) {
                        errorWrapper.appendChild(container.firstChild);
                    }
                    container.appendChild(errorWrapper);

                    let currentSampleIndex = 0; // ROTATION STATE

                    sampleBtn.onclick = () => {
                        if (!sampleVisible) {
                            // Hide error content
                            const errorContent = document.getElementById(errorContentId);
                            if (errorContent) {
                                errorContent.style.display = 'none';
                            }

                            // Define showSample locally for this scope
                            const showSample = (index) => {
                                console.log("Rendering sample index (Error UI):", index);

                                // Clean up previous sample if any
                                const oldSample = document.getElementById(sampleContentId);
                                if (oldSample) oldSample.remove();

                                // Create sample content div
                                const sampleDiv = document.createElement('div');
                                sampleContentId = "um-sample-display-" + Math.floor(Math.random() * 1000);
                                sampleDiv.id = sampleContentId;
                                sampleDiv.innerHTML = `
                                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 20px; border-radius: 8px; margin-bottom: 12px; text-align: center;">
                                        <div style="font-size: 18px; margin-bottom: 4px;">📋 Sample Analysis ${index + 1}/${SAMPLE_DATA_LIBRARY.length}</div>
                                        <div style="font-size: 11px; opacity: 0.9;">This is demo data showing what a successful analysis looks like</div>
                                    </div>
                                `;

                                // Insert at top of container
                                container.insertBefore(sampleDiv, container.firstChild);

                                // Render sample results
                                const resultsDiv = document.createElement('div');
                                sampleDiv.appendChild(resultsDiv);

                                // USE DATA FROM LIBRARY
                                const data = SAMPLE_DATA_LIBRARY[index];
                                renderResults(resultsDiv, data, true);

                                // BUTTON WRAPPER (Hide + See Another)
                                const hideBtnId = "um-hide-sample-btn-" + Math.floor(Math.random() * 1000);
                                const nextBtnId = "um-next-sample-btn-" + Math.floor(Math.random() * 1000);

                                const controlDiv = document.createElement('div');
                                controlDiv.style.cssText = "text-align: left; margin-top: 16px; padding-top: 16px; border-top: 1px solid #e0e0e0; display:flex; gap:12px; align-items:center;";

                                controlDiv.innerHTML = `
                                    <button type="button" id="${hideBtnId}" class="um-matte-btn" style="min-width: auto; padding: 10px 18px; font-size: 12px;">
                                        Hide Sample
                                    </button>
                                    <button type="button" id="${nextBtnId}" class="um-matte-btn" style="
                                        min-width: auto; 
                                        padding: 10px 18px; 
                                        font-size: 12px;
                                        background: #E3F2FD; 
                                        color: #1565C0;
                                        border: 1px solid #BBDEFB;
                                    ">
                                        See Another Sample ↻
                                    </button>
                                `;
                                sampleDiv.appendChild(controlDiv);

                                // Wire up buttons
                                setTimeout(() => {
                                    // HIDE BUTTON
                                    const hideBtn = document.getElementById(hideBtnId);
                                    if (hideBtn) {
                                        hideBtn.onclick = () => {
                                            console.log("Hiding sample...");
                                            const sDiv = document.getElementById(sampleContentId);
                                            if (sDiv) sDiv.remove();

                                            const errorContent = document.getElementById(errorContentId);
                                            if (errorContent) errorContent.style.display = 'block';
                                            sampleVisible = false;
                                        };
                                    }

                                    // NEXT BUTTON
                                    const nextBtn = document.getElementById(nextBtnId);
                                    if (nextBtn) {
                                        nextBtn.onclick = () => {
                                            // Rotate index
                                            currentSampleIndex = (currentSampleIndex + 1) % SAMPLE_DATA_LIBRARY.length;
                                            // Re-render
                                            showSample(currentSampleIndex);
                                        };
                                    }
                                }, 50);
                            };

                            // Show first sample
                            showSample(currentSampleIndex);
                            sampleVisible = true;
                        }
                    };
                }
            }, 50);
        }

        function renderSampleAnalysis(container, onHide = null) {
            // Add demo banner with Hide button
            const hideBtnId = "um-hide-sample-" + Math.floor(Math.random() * 1000);
            const demoBanner = `
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 20px; border-radius: 8px; margin-bottom: 12px; text-align: center;">
                    <div style="font-size: 18px; margin-bottom: 4px;">📋 Sample Analysis</div>
                    <div style="font-size: 11px; opacity: 0.9;">This is demo data showing what a successful analysis looks like</div>
                </div>
                <div style="text-align: center; margin-bottom: 20px;">
                    <button type="button" id="${hideBtnId}" class="um-matte-btn" style="min-width: auto; padding: 10px 18px; font-size: 12px;">
                        Hide Sample
                    </button>
                </div>
            `;

            // Render using existing function with sample data (hide buttons to prevent duplication)
            container.innerHTML = demoBanner;
            const resultsDiv = document.createElement('div');
            container.appendChild(resultsDiv);
            renderResults(resultsDiv, SAMPLE_ANALYSIS_DATA, true); // hideButtons = true

            // Wire up hide button
            if (onHide) {
                setTimeout(() => {
                    const hideBtn = document.getElementById(hideBtnId);
                    console.log("Looking for hide button:", hideBtnId, hideBtn);
                    if (hideBtn) {
                        hideBtn.style.cursor = "pointer";
                        hideBtn.style.zIndex = "1000";
                        hideBtn.style.pointerEvents = "auto";
                        hideBtn.onclick = (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log("Hide Sample clicked!");
                            onHide();
                        };
                        console.log("Hide button handler attached");
                    } else {
                        console.error("Hide button not found!");
                    }
                }, 100);
            }
        }

        // ... renderResults ...

        /* ===========================
           STYLES
        ============================ */
        // ...

        /* ===========================
           EXPORT
        ============================ */
        async function fetchAnalysis(imgUrl, onProgress, options = {}) {
            // 1. Fetch Comments
            if (onProgress) onProgress("Reading comments from database...");
            let comments = [];
            try {
                if (window.UntrainableCore && window.UntrainableCore.getCommentsForImage) {
                    comments = await window.UntrainableCore.getCommentsForImage(imgUrl);
                }
            } catch (e) {
                console.warn("Failed to fetch comments", e);
            }
            // Fallback comments if none found (for demo consistency)
            if (comments.length === 0) {
                comments = ["It feels lonely", "Dark but peaceful", "Scary", "I love the lighting", "Hauntingly beautiful"];
            }

            // 2. VISION ANALYSIS
            if (onProgress) onProgress("Connecting to Vision Neural Net...");
            const visionRes = await fetch('/api/analyze-vision', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrl: imgUrl })
            });

            if (!visionRes.ok) throw new Error("Vision analysis failed");
            const visionData = await visionRes.json();

            if (onProgress) {
                onProgress(`Vision Model: ${visionData.model_used}`);
                onProgress(`Detected Emotion: ${visionData.dominant_emotion}`);
            }

            // 3. CONSENSUS ANALYSIS
            if (onProgress) onProgress("Calculating Consensus & Trainability...");
            const consensusRes = await fetch('/api/analyze-consensus', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    aiAnalysis: visionData,
                    humanComments: comments
                })
            });

            if (!consensusRes.ok) throw new Error("Consensus analysis failed");
            const consensusData = await consensusRes.json();

            if (onProgress) {
                onProgress(`Consensus Model: ${consensusData.model_used}`);
                onProgress("Gap Analysis complete.");
            }

            // 4. MAP TO LEGACY SCHEMA (for renderResults)
            const finalData = {
                model_used: visionData.model_used,
                raw_comments: comments,
                analytics: {
                    trainability_score: consensusData.trainability_score,
                    variability_emotion: 100 - (consensusData.consensus_score || 0), // Mapping Consensus -> Variability
                    gemini: {
                        aggregate: {
                            dominant_emotion: "Mixed Emotions" // Placeholder for agg
                        }
                    },
                    advanced: {
                        final_emotion: visionData.dominant_emotion,
                        keywords: visionData.emotional_keywords || [],
                        ai_data: {
                            visual_description: visionData.studium_description,
                            dominant_emotion: visionData.dominant_emotion
                        },
                        comparison: {
                            gap_summary: consensusData.gap_analysis,
                            trainability_score: consensusData.trainability_score,
                            trainability_label: consensusData.trainability_score > 70 ? "High" : (consensusData.trainability_score < 40 ? "Low" : "Medium")
                        }
                    }
                }
            };

            return finalData;
        }

        function renderResults(container, data, hideButtons = false) {
            // 1. EXTRACT REAL DATA
            const geminiAgg = data?.analytics?.gemini?.aggregate || data?.parsed?.aggregate || {};
            const advanced = data?.analytics?.advanced || {};
            const synthesis = advanced.synthesis || {};

            const humanKeyEmotion = geminiAgg.dominant_emotion || geminiAgg.primary_emotion || geminiAgg.top_emotion || "Neutral";
            const humanTags = geminiAgg.keywords || geminiAgg.top_secondary || [];
            // Prioritize raw_comments (all comments) -> then AI snippets -> then mapped analysis
            let quotes = data?.raw_comments
                || data?.parsed?.raw_comments
                || data?.human_data?.example_snippets
                || data?.parsed?.human_data?.example_snippets
                || (data?.parsed?.per_comment || []).map(c => c.comment)
                || [];

            // Fallback to raw comments if no analysis available
            if ((!quotes || quotes.length === 0) && data?.parsed?.raw_comments) {
                quotes = data.parsed.raw_comments;
            }

            // NEW: Extract peripheral emotions (Map from key_emotions OR keywords)
            const peripheralEmotions = geminiAgg.key_emotions
                || geminiAgg.people_also_felt
                || geminiAgg.top_secondary
                || geminiAgg.keywords  // Added fallback to keywords
                || [];

            const aiKeyEmotion = advanced.ai_data?.dominant_emotion || advanced.final_emotion || "Pending...";
            const aiTags = advanced.ai_data?.keywords || advanced.keywords || [];

            // NEW: Extract AI visual summary (40-50 words)
            // Extract AI Visual Summary (Prioritize description over summary)
            const aiVisualSummary = data?.ai_data?.visual_description
                || advanced?.ai_data?.visual_description // Fix nested path
                || data?.ai_data?.summary
                || data?.parsed?.ai_data?.visual_description
                || data?.parsed?.ai_data?.summary
                || data?.analytics?.ai_data?.summary
                || "Visual analysis pending...";

            const gapSummary = data?.comparison?.gap_summary
                || data?.parsed?.comparison?.gap_summary
                || advanced?.comparison?.gap_summary
                || synthesis.synthesis_text
                || "Synthesis pending...";

            const trainabilityScore = data?.analytics?.trainability_score
                || advanced?.comparison?.trainability_score
                || "--";

            const variabilityScore = data?.analytics?.variability_emotion
                || advanced?.human_data?.variability_score
                || "--";

            // CORRECT LOGIC: Variability (High = Chaos) -> Consensus (High = Agreement)
            const consensusScore = (typeof variabilityScore === 'number') ? (100 - variabilityScore) : "--";

            // NEW: Extract trainability label
            let trainabilityLabel = data?.comparison?.trainability_label
                || data?.parsed?.comparison?.trainability_label
                || advanced?.comparison?.trainability_label // Fix nested
                || advanced?.trainability_label;

            // Fallback calculation in case backend doesn't return the label
            // (Ensures user always sees High/Moderate/Low tag)
            if (!trainabilityLabel && typeof trainabilityScore === 'number') {
                if (trainabilityScore >= 70) trainabilityLabel = "Easily Trainable";
                else if (trainabilityScore >= 40) trainabilityLabel = "Moderately Trainable";
                else trainabilityLabel = "Difficult to Train";
            }
            if (!trainabilityLabel) trainabilityLabel = "Unknown Trainability";


            // NEW: Extract separate analysis paragraphs
            // Check flat JSON (index.ts) or nested structure (SAMPLE_ANALYSIS_DATA)
            const humanAnalysis = data?.human_data?.human_response_analysis
                || data?.parsed?.human_data?.human_response_analysis
                || advanced?.human_data?.human_response_analysis // Fix nested
                || advanced?.human_response_analysis
                || "Analysis pending...";

            const trainabilityAnalysis = data?.comparison?.trainability_analysis
                || data?.parsed?.comparison?.trainability_analysis
                || advanced?.comparison?.trainability_analysis // Fix nested
                || advanced?.trainability_analysis
                || "Analysis pending...";

            const convergence = synthesis.agreement_level || "Unknown";


            // ID generation
            const uniqueId = "um-" + Math.random().toString(36).substr(2, 9);
            const contentId = `content-${uniqueId}`;
            const btnAnalysisId = `btn-an-${uniqueId}`;
            const btnCommentsId = `btn-co-${uniqueId}`;

            // Helper: Fisher-Yates shuffle for unbiased randomization
            const shuffleArray = (arr) => {
                const shuffled = [...arr];
                for (let i = shuffled.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                }
                return shuffled;
            };

            // Randomize comments for unbiased display
            const randomizedQuotes = shuffleArray(quotes);

            let initialCount;
            // Force lower count to ensure "Show More" appears often
            initialCount = Math.min(3, randomizedQuotes.length);

            const hasMoreComments = randomizedQuotes.length > initialCount;
            const visibleQuotes = randomizedQuotes.slice(0, initialCount);
            const hiddenQuotes = randomizedQuotes.slice(initialCount);

            // Select 4-6 random peripheral emotions for display (using same shuffleArray function)
            const selectedPeripherals = peripheralEmotions.length > 0
                ? shuffleArray(peripheralEmotions).slice(0, Math.min(6, peripheralEmotions.length))
                : [];

            // --- MODEL SOURCE CALCULATION ---
            let displayModelName = "Unknown Source";
            const rawModel = (data.model_used || data.analytics?.gemini?.model_used || "Unknown").toLowerCase();

            if (rawModel.includes("gemma")) {
                displayModelName = "Local Model (Gemma)";
            } else if (rawModel.includes("gemini")) {
                displayModelName = "Google Gemini 1.5 Pro";
            } else {
                displayModelName = rawModel.replace("two - step - ", "").trim();
                // Capitalize
                displayModelName = displayModelName.charAt(0).toUpperCase() + displayModelName.slice(1);
            }

            // ...

            // Helper functions for descriptive labels (Moved up to fix initialization error)
            const getConsensusDesc = (score) => {
                if (typeof score !== 'number') return "";
                if (score >= 80) return "(Strong Consensus)";
                if (score >= 50) return "(Mixed Sentiments)";
                return "(Diverse Interpretations)";
            };

            const getTrainabilityDesc = (score) => {
                if (score >= 80) return "(Strong Alignment)";
                if (score >= 50) return "(Moderate Gap)";
                return "(High Gap)";
            };

            const consensusDesc = typeof consensusScore === 'number' ? getConsensusDesc(consensusScore) : "";
            const trainabilityDesc = typeof trainabilityScore === 'number' ? getTrainabilityDesc(trainabilityScore) : "";

            // 3-Column Detailed Analysis Block
            const blockAnalysis = `
                <div class="um-three-col-grid" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; margin-top:24px;">
                    <!-- COLUMN 1: HUMAN RESPONSE ANALYSIS -->
                    <div class="um-col">
                        <h4 class="um-mock-title">Human Response Analysis</h4>
                        <p class="um-mock-text" style="font-size:12px; line-height:1.6; color:#555; opacity:0.9;">
                            ${humanAnalysis}
                        </p>
                        <!-- Consensus Score Box Below -->
                        <div style="margin-top: 16px;">
                            <div style="background: #f5f5f7; border-radius: 12px; padding: 12px 16px; display: inline-flex; flex-direction: column; align-items: flex-start;">
                                <div style="font-size: 32px; font-weight: 700; color: #1d1d1f; line-height: 1;">${consensusScore}%</div>
                                <div style="font-size: 11px; font-weight: 600; color: #86868b; margin-top: 4px;">Consensus<br><span style="font-weight:400;">${consensusDesc}</span></div>
                            </div>
                        </div>
                    </div>

                    <!-- COLUMN 2: AI RESPONSE ANALYSIS -->
                    <div class="um-col">
                        <h4 class="um-mock-title">AI Response Analysis</h4>
                        <p class="um-mock-text" style="font-size:12px; line-height:1.6; color:#555; opacity:0.9;">
                            ${aiVisualSummary}
                        </p>
                    </div>

                    <!-- COLUMN 3: TRAINABILITY ANALYSIS -->
                    <div class="um-col">
                        <h4 class="um-mock-title">Trainability Analysis</h4>
                         <p class="um-mock-text" style="font-size:12px; line-height:1.6; color:#555; opacity:0.9;">
                            ${trainabilityAnalysis}
                         </p>
                    </div>
                </div>
            `;



            // PASTEL PALETTE (Soft, Readable)
            const pastelColors = ["#E3F2FD", "#F3E5F5", "#E8F5E9", "#FFF3E0", "#FFEBEE", "#ECEFF1"];

            // function to build comment HTML with Flexible Masonry Logic
            const buildCommentPills = (qs) => qs.map(q => {
                const len = q.length;
                let flexBasis = "140px"; // Tiny

                // 6 Variations of sizes
                if (len > 30) flexBasis = "180px"; // Small
                if (len > 70) flexBasis = "260px"; // Medium
                if (len > 120) flexBasis = "360px"; // Large
                if (len > 200) flexBasis = "500px"; // XL
                if (len > 300) flexBasis = "100%"; // Full width

                // Random pastel color
                const bg = pastelColors[Math.floor(Math.random() * pastelColors.length)];

                return `
               <div class="um-comment-pill" style="
                   flex: 1 1 ${flexBasis};
                   background: ${bg};
                   padding: 12px 16px;
                   border-radius: 16px;
                   font-size: 13px;
                   line-height: 1.5;
                   color: #1d1d1f;
                   border: 1px solid rgba(0,0,0,0.03);
                   box-shadow: 0 2px 5px rgba(0,0,0,0.02);
                   transition: transform 0.2s ease;
                   max-width: 100%;
                   box-sizing: border-box;
               " onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                   "${q}"
               </div>`;
            }).join("");

            const blockComments = `
                 <h4 class="um-mock-title" style="margin-top:0; margin-bottom: 16px;">Comments by People</h4>
                 <!-- FLEX CONTAINER: Flexible Masonry -->
                 <div class="um-comment-container" style="
                    display: flex; 
                    flex-wrap: wrap;
                    gap: 12px; 
                    width: 100%;
                    align-items: stretch;
                 ">
                     ${buildCommentPills(visibleQuotes)}
                     <!-- HIDDEN COMMENTS (Initially hidden, revealed inline) -->
                     ${hasMoreComments ? `<div id="hidden-comments-${uniqueId}" style="display:none; width:100%; flex-wrap:wrap; gap:12px;">${buildCommentPills(hiddenQuotes)}</div>` : ''}
                 </div>
                 
                 ${hasMoreComments ? `<button type="button" id="show-more-${uniqueId}" class="um-show-more-btn" style="
                    margin-top: 16px; 
                    background: transparent; 
                    border: 1px solid #d1d1d6; 
                    padding: 8px 20px; 
                    border-radius: 20px; 
                    font-size: 12px; 
                    font-weight: 500; 
                    color: #1d1d1f; 
                    cursor: pointer; 
                    transition: all 0.2s ease;
                 ">Show ${hiddenQuotes.length} more comments</button>` : ''}
            `;


            // 2. RENDER - 3 COLUMN LAYOUT
            container.innerHTML = `
                <div class="um-mock-dashboard">
                
                <!-- ROW 1: 3-COLUMN COMPARISON -->
                <div class="um-three-col-grid" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; margin-bottom: 24px;">
                    <!-- COLUMN 1: WHAT HUMANS FELT (Soft Warm Beige) -->
                    <div class="um-col" style="background: #FAFAF5; border-radius: 20px; padding: 24px;">
                         <div class="um-col-header">
                            <h4 class="um-mock-title" style="color: #8D8D80;">What Humans Felt</h4>
                            <div class="um-big-emotion">${humanKeyEmotion}</div>
                            
                            <!-- Peripheral Emotions Pills -->
                            ${selectedPeripherals.length > 0 ? `
                                <div class="um-mock-tags" style="max-width: 90%; margin-top: 12px;">
                                    ${selectedPeripherals.map(e => `<span style="background: rgba(0,0,0,0.03); border:1px solid rgba(0,0,0,0.05);">${e}</span>`).join("")}
                                </div>
                            ` : ''}
                         </div>
                    </div>

                    <!-- COLUMN 2: HOW AI FELT (Soft Lilac/Cool) -->
                    <div class="um-col" style="background: #F8F7FC; border-radius: 20px; padding: 24px;">
                        <div class="um-col-header">
                            <h4 class="um-mock-title" style="color: #808090;">How AI Felt</h4>
                            <div class="um-big-emotion">${aiKeyEmotion}</div>
                             <div class="um-mock-tags" style="max-width: 90%; margin-top: 12px;">
                                ${aiTags.map(t => `<span style="background: rgba(0,0,0,0.03); border:1px solid rgba(0,0,0,0.05);">${t}</span>`).join("")}
                            </div>
                        </div>
                    </div>
                    
                    <!-- COLUMN 3: TRAINABILITY ANALYSIS (Soft Mint/Neutral) -->
                    <div class="um-col" style="background: #F5F9F7; border-radius: 20px; padding: 24px;">
                        <div class="um-col-header">
                            <h4 class="um-mock-title" style="color: #709080;">Trainability Analysis</h4>
                            <div class="um-big-emotion" style="font-size: 24px;">${trainabilityLabel}</div>
                            
                            <!-- Large Percent Score Box (Left Aligned) -->
                            <div style="margin-top: 12px; background: #fff; border-radius: 16px; padding: 16px; text-align: left; color: #333; display: inline-block; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                                <div style="font-size: 42px; font-weight: 800; line-height: 1; color: #1d1d1f;">
                                    ${trainabilityScore}<span style="font-size: 20px;">%</span>
                                </div>
                                <div style="font-size: 11px; font-weight: 600; margin-top: 4px; opacity: 0.8;">
                                    Trainability ${getTrainabilityDesc(trainabilityScore)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ROW 2: BUTTONS (Middle Section) -->
                  <div class="um-control-row" style="margin-bottom: 24px;">
                      <button type="button" id="${btnAnalysisId}" class="um-tab-btn">Detailed Analysis</button>
                      <button type="button" id="${btnCommentsId}" class="um-tab-btn">Show People's Comments</button>
                  </div>

                <!-- ROW 3: DYNAMIC CONTENT AREA (Expandable detailed analysis) -->
                <div id="${contentId}" class="um-dynamic-content" style="display:none;"></div>

                  <!-- ROW 4: MODEL SOURCE (At the very bottom) -->
                <div style="margin-top: 12px; font-size: 10px; color: #888; text-align: right; width: 100%;">
                    Source: <span id="um-model-source">${displayModelName}</span>
                </div>
                    
                    ${!hideButtons ? `
                    <!-- CONTEXT AWARE MODEL SWITCH (Zero Dead-End) -->
                    <div style="margin-top: 24px; border-top: 1px solid rgba(0,0,0,0.05); padding-top: 20px; display: flex; gap: 10px; justify-content: flex-start;">
                        <button type="button" id="um-manual-local-retry-${uniqueId}" class="um-matte-btn" style="
                            min-width: auto; 
                            padding: 10px 18px; 
                            font-size: 11px; 
                            background: #222; 
                        </button>
                    </div>
                    ` : ''
                }

              </div >
                `;

            // 3. INTERACTIVITY (Using Polling for Robustness)
            const bindInteractions = (attempts = 0) => {
                if (attempts > 50) { // Max ~1.5 seconds
                    console.error("[Analysis] Failed to bind interactions - Elements not found after timeout", { btnAnalysisId, btnCommentsId });
                    return;
                }

                const btnAna = document.getElementById(btnAnalysisId);
                const btnCom = document.getElementById(btnCommentsId);
                const contentBox = document.getElementById(contentId);
                const btnLocal = document.getElementById(`um-manual-local-retry-${uniqueId}`);
                const btnSample = document.getElementById(`um-sample-results-${uniqueId}`);

                // If critical elements missing, retry
                if (!btnAna || !btnCom || !contentBox) {
                    requestAnimationFrame(() => bindInteractions(attempts + 1));
                    return;
                }

                console.log("[Analysis] Elements found. Binding events...");

                if (btnLocal) {
                    btnLocal.onclick = () => {
                        const isSwitchingToLocal = btnLocal.innerText.toLowerCase().includes("local");
                        const newModeText = isSwitchingToLocal ? "Local Model..." : "Cloud Model...";

                        // Instant feedback
                        btnLocal.innerText = `Switching to ${newModeText}`;
                        btnLocal.style.opacity = "0.7";
                        btnLocal.style.pointerEvents = "none";

                        // Restart analysis with toggled mode
                        setTimeout(() => runAnalysis(isSwitchingToLocal), 50);
                    };
                }

                if (btnSample) {
                    let sampleVisible = false;
                    let sampleContentId = null;
                    let errorContentId = "um-error-content-" + Math.floor(Math.random() * 1000);
                    let currentSampleIndex = 0; // ROTATION STATE

                    // Wrap existing error content in a div so we can hide/show it
                    const errorWrapper = document.createElement('div');
                    errorWrapper.id = errorContentId;
                    while (container.firstChild) {
                        errorWrapper.appendChild(container.firstChild);
                    }
                    container.appendChild(errorWrapper);

                    // FUNCTION TO RENDER SAMPLE
                    const showSample = (index) => {
                        console.log("Rendering sample index:", index);

                        // Clean up previous sample if any
                        const oldSample = document.getElementById(sampleContentId);
                        if (oldSample) oldSample.remove();

                        // Create sample content div
                        const sampleDiv = document.createElement('div');
                        sampleContentId = "um-sample-display-" + Math.floor(Math.random() * 1000);
                        sampleDiv.id = sampleContentId;
                        sampleDiv.innerHTML = `
                            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 20px; border-radius: 8px; margin-bottom: 12px; text-align: center;">
                                <div style="font-size: 18px; margin-bottom: 4px;">📋 Sample Analysis ${index + 1}/${SAMPLE_DATA_LIBRARY.length}</div>
                                <div style="font-size: 11px; opacity: 0.9;">This is demo data showing what a successful analysis looks like</div>
                            </div>
                        `;

                        // Insert at top of container
                        container.insertBefore(sampleDiv, container.firstChild);

                        // Render sample results
                        const resultsDiv = document.createElement('div');
                        sampleDiv.appendChild(resultsDiv);

                        // USE DATA FROM LIBRARY
                        const data = SAMPLE_DATA_LIBRARY[index];
                        renderResults(resultsDiv, data, true);

                        // BUTTON WRAPPER (Hide + See Another)
                        const hideBtnId = "um-hide-sample-btn-" + Math.floor(Math.random() * 1000);
                        const nextBtnId = "um-next-sample-btn-" + Math.floor(Math.random() * 1000);

                        const controlDiv = document.createElement('div');
                        controlDiv.style.cssText = "text-align: left; margin-top: 16px; padding-top: 16px; border-top: 1px solid #e0e0e0; display:flex; gap:12px; align-items:center;";

                        controlDiv.innerHTML = `
                            <button type="button" id="${hideBtnId}" class="um-matte-btn" style="min-width: auto; padding: 10px 18px; font-size: 12px;">
                                Hide Sample
                            </button>
                            <button type="button" id="${nextBtnId}" class="um-matte-btn" style="
                                min-width: auto; 
                                padding: 10px 18px; 
                                font-size: 12px;
                                background: #E3F2FD; 
                                color: #1565C0;
                                border: 1px solid #BBDEFB;
                            ">
                                See Another Sample ↻
                            </button>
                        `;
                        sampleDiv.appendChild(controlDiv);

                        // Wire up buttons
                        setTimeout(() => {
                            // HIDE BUTTON
                            const hideBtn = document.getElementById(hideBtnId);
                            if (hideBtn) {
                                hideBtn.onclick = () => {
                                    console.log("Hiding sample...");
                                    const sDiv = document.getElementById(sampleContentId);
                                    if (sDiv) sDiv.remove();

                                    const errorContent = document.getElementById(errorContentId);
                                    if (errorContent) errorContent.style.display = 'block';
                                    sampleVisible = false;
                                };
                            }

                            // NEXT BUTTON
                            const nextBtn = document.getElementById(nextBtnId);
                            if (nextBtn) {
                                nextBtn.onclick = () => {
                                    // Rotate index
                                    currentSampleIndex = (currentSampleIndex + 1) % SAMPLE_DATA_LIBRARY.length;
                                    // Re-render
                                    showSample(currentSampleIndex);
                                };
                            }
                        }, 50);
                    };

                    btnSample.onclick = () => {
                        if (!sampleVisible) {
                            // Hide error content
                            const errorContent = document.getElementById(errorContentId);
                            if (errorContent) {
                                errorContent.style.display = 'none';
                            }

                            // Show first sample
                            showSample(currentSampleIndex);
                            sampleVisible = true;
                        }
                    };
                }

                // Helper to wire up "See More" inside the comments block
                const wireSeeMore = () => {
                    const btnSeeMore = document.getElementById(`show-more-${uniqueId}`);
                    const hiddenDiv = document.getElementById(`hidden-comments-${uniqueId}`);

                    if (btnSeeMore && hiddenDiv) {
                        btnSeeMore.onclick = () => {
                            // Show hidden quotes (flex)
                            hiddenDiv.style.display = 'flex';
                            btnSeeMore.style.display = 'none'; // Hide button after click
                        };
                        // Hover effect
                        btnSeeMore.onmouseover = () => { btnSeeMore.style.background = "rgba(0,0,0,0.05)"; };
                        btnSeeMore.onmouseout = () => { btnSeeMore.style.background = "transparent"; };
                    }
                };

                if (btnAna && btnCom && contentBox) {

                    // TOGGLE LOGIC: Clicking active button hides section.
                    btnAna.onclick = () => {
                        console.log("[Analysis] Detailed Analysis Clicked");
                        const isActive = btnAna.classList.contains("active");

                        // Reset both
                        btnAna.classList.remove("active");
                        btnCom.classList.remove("active");
                        contentBox.style.display = "none";

                        // If NOT active before, activate now
                        if (!isActive) {
                            console.log("[Analysis] activating Detailed Analysis");
                            btnAna.classList.add("active");
                            // Ensure blockAnalysis is treated as string
                            if (blockAnalysis) {
                                contentBox.innerHTML = blockAnalysis;
                                contentBox.style.display = "block";
                            } else {
                                console.error("[Analysis] blockAnalysis is undefined!");
                            }
                        }
                    };

                    btnCom.onclick = () => {
                        console.log("[Analysis] Comments Clicked");
                        const isActive = btnCom.classList.contains("active");

                        // Reset both
                        btnAna.classList.remove("active");
                        btnCom.classList.remove("active");
                        contentBox.style.display = "none";

                        // If NOT active before, activate now
                        if (!isActive) {
                            console.log("[Analysis] activating Comments");
                            btnCom.classList.add("active");
                            if (blockComments) {
                                contentBox.innerHTML = blockComments;
                                contentBox.style.display = "block";
                                // IMPORTANT: Wire up the "See More" button after injecting HTML
                                setTimeout(wireSeeMore, 10);
                            } else {
                                console.error("[Analysis] blockComments is undefined!");
                            }
                        }
                    };
                } else {
                    console.error("[Analysis] Buttons or ContentBox not found!", { btnAna, btnCom, contentBox, btnAnalysisId, btnCommentsId, contentId });
                }
            };

            // Kick off polling
            bindInteractions();
        }

        function renderMockResults(container) {
            container.innerHTML = `< div style = "padding: 20px; text-align: center; opacity: 0.6;" > Mock Data Not Updated for New Layout</div > `;
        }

        widget.appendChild(btnWrapper);
        widget.appendChild(panel);
        container.appendChild(widget);
    }

    /* ===========================
       STYLES
    ============================ */
    const style = document.createElement("style");
    style.textContent = `
                /* CONTAINER */
                .um-analyze-widget {
                    margin-top: 16px;
                    width: 100%;
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                    /* Ensure no strict overflow clipping on main container if not needed */
                }
                .um-btn-wrapper {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 12px; /* Increased gap for decent space */
                    width: 100%;
                    padding-left: 4px; /* Safety padding */
                }

        /* BUTTON (Solid Black) */
        .um-matte-btn {
            appearance: none;
            outline: none;
            border: none;
            background: rgba(0, 0, 0, 0.95);
            color: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 500;
            letter-spacing: 0.5px;
            cursor: pointer;
            transition: all 0.2s ease;
            min-width: 140px;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        /* DARK MODE OVERRIDES */
        .dark-mode .um-matte-btn {
            background: rgba(30, 30, 30, 0.8);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .um-matte-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
        }
        .um-matte-btn.is-active {
            background: rgba(40, 40, 40, 1);
        }

        .um-caption {
            font-size: 11px;
            color: #666;
            margin-left: 2px;
            opacity: 0.8;
            max-width: 360px;
        }
        .dark-mode .um-caption { color: #aaa; }

        /* PANEL */
        .um-analyze-panel {
            margin-top: 16px;
            width: 100%;
            max-width: 1100px;
            background: rgba(255, 255, 255, 0.85);
            border: 1px solid rgba(0, 0, 0, 0.05);
            border-radius: 16px;
            padding: 32px 32px;
            box-sizing: border-box;
            backdrop-filter: blur(24px);
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.06);
            animation: um-fade-in 0.3s ease-out;
        }
        .dark-mode .um-analyze-panel {
            background: rgba(20, 20, 20, 0.7);
            border-color: rgba(255, 255, 255, 0.08);
        }
        @keyframes um-fade-in {
            from { opacity: 0; transform: translateY(-8px); }
            to { opacity: 1; transform: translateY(0); }
        }

        /* LOADING */
        .um-loading-view { display: flex; flex-direction: column; align-items: center; gap: 12px; }
        .um-spinner { width: 24px; height: 24px; border: 2px solid rgba(0, 0, 0, 0.1); border-top-color: #000; border-radius: 50%; animation: um-spin 0.8s infinite linear; }
        .dark-mode .um-spinner { border-top-color: #fff; border-color: rgba(255, 255, 255, 0.1); }
        @keyframes um-spin { to { transform: rotate(360deg); } }
        .um-loading-text { font-size: 12px; opacity: 0.6; font-style: italic; }

        /* DASHBOARD GRID */
        .um-mock-dashboard { display: flex; flex-direction: column; gap: 24px; font-family: system-ui, sans-serif; }
        
        .um-two-col-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 32px;
            border-bottom: 1px solid rgba(0, 0, 0, 0.06);
            padding-bottom: 24px;
        }
        .dark-mode .um-two-col-grid { border-color: rgba(255, 255, 255, 0.08); }

        .um-col-header { margin-bottom: 0; }
        .um-mock-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; opacity: 0.5; margin: 0 0 4px 0; color: inherit; }
        
        .um-big-emotion { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; color: #000; line-height: 1.2; }
        .dark-mode .um-big-emotion { color: #fff; }

        .um-mock-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
        .um-mock-tags span { font-size: 11px; background: rgba(0, 0, 0, 0.05); padding: 3px 8px; border-radius: 4px; color: #555; border: 1px solid rgba(0, 0, 0, 0.02); }
        .dark-mode .um-mock-tags span { background: rgba(255, 255, 255, 0.1); color: #ccc; border-color: transparent; }

        /* SCORES */
        .um-mock-scores { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 0; }
        .um-mock-score-card { background: rgba(0, 0, 0, 0.02); border-radius: 12px; padding: 16px; text-align: center; border: 1px solid rgba(0, 0, 0, 0.04); }
        .dark-mode .um-mock-score-card { background: rgba(255, 255, 255, 0.03); border-color: rgba(255, 255, 255, 0.06); }
        
        .um-mock-score-card.highlight { background: rgba(0, 0, 0, 0.04); border-color: rgba(0, 0, 0, 0.1); }
        .dark-mode .um-mock-score-card.highlight { background: rgba(255, 255, 255, 0.06); border-color: rgba(255, 255, 255, 0.15); }

        .um-mock-val { font-size: 24px; font-weight: 800; margin-bottom: 4px; letter-spacing: -0.5px; }
        .um-mock-label { font-size: 10px; text-transform: uppercase; font-weight: 700; opacity: 0.6; margin-bottom: 2px; }
        .um-mock-desc { font-size: 11px; opacity: 0.5; line-height: 1.3; }

        /* CONTROLS (TABS) */
        .um-control-row {
            display: flex;
            gap: 12px;
            margin-top: 16px;
            justify-content: flex-start; /* Left aligned buttons */
        }
        .um-tab-btn {
            padding: 8px 24px;
            font-size: 12px;
            font-weight: 500;
            background: transparent;
            border: 1px solid rgba(0, 0, 0, 0.1);
            border-radius: 20px; /* Pillow shape */
            cursor: pointer;
            transition: all 0.2s ease;
            color: #555;
            min-width: 120px;
        }
        .dark-mode .um-tab-btn {
            background: transparent;
            border-color: rgba(255, 255, 255, 0.2);
            color: #aaa;
        }
        
        .um-tab-btn:hover {
            background: rgba(0, 0, 0, 0.03);
            color: #000;
            border-color: rgba(0, 0, 0, 0.3);
        }
        .dark-mode .um-tab-btn:hover {
            background: rgba(255, 255, 255, 0.05);
            color: #fff;
            border-color: rgba(255, 255, 255, 0.5);
        }

        .um-tab-btn.active {
            background: #1d1d1f;
            border-color: #1d1d1f;
            color: #fff;
            box-shadow: none;
            font-weight: 600;
            transform: none;
        }
        .dark-mode .um-tab-btn.active {
            background: #fff;
            border-color: #fff;
            color: #000;
        }

        /* DYNAMIC CONTENT AREA */
        .um-dynamic-content {
            margin-top: 16px;
            border-top: 1px solid rgba(0, 0, 0, 0.06);
            padding-top: 20px;
            min-height: 100px;
            animation: um-fade-in-quick 0.2s ease-out;
        }
        .dark-mode .um-dynamic-content { border-color: rgba(255, 255, 255, 0.08); }

        @keyframes um-fade-in-quick {
            from { opacity: 0; transform: translateY(4px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .um-mock-text { font-size: 14px; line-height: 1.6; color: #444; margin: 0; }
        .dark-mode .um-mock-text { color: #ccc; }

        /* PASTEL COMMENTS */
        .um-comment-grid { display: flex; flex-wrap: wrap; gap: 10px; }
        .um-comment-pill {
            background: #f4f4f5;
            color: #333;
            padding: 10px 14px;
            border-radius: 12px;
            font-size: 13px;
            line-height: 1.5;
            flex: 1 1 45%;
            min-width: 200px;
            border: 1px solid rgba(0, 0, 0, 0.03);
        }
        .dark-mode .um-comment-pill { background: rgba(255, 255, 255, 0.08); color: #ddd; border-color: transparent; }

        `;
    document.head.appendChild(style);

    /* ===========================
       EXPORT
    ============================ */
    async function fetchAnalysis(imgUrl, onProgress) {
        // Check if local dev or prod
        const res = await fetch(ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image_url: imgUrl, mode: "full" })
        });

        if (!res.ok) throw new Error("Backend Error: " + res.status);

        // STREAM READER (NDJSON)
        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let finalData = null;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");

            // Process all complete lines
            buffer = lines.pop(); // Keep the last incomplete chunk

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const msg = JSON.parse(line);
                    if (msg.type === "progress") {
                        if (onProgress) onProgress(msg.message || `Step: ${msg.step} `);
                    } else if (msg.type === "result") {
                        finalData = msg.data;
                    } else if (msg.type === "error") {
                        // CRITICAL: Throw explicit error to break loop and fail fetchAnalysis
                        throw new Error("Backend Error: " + msg.error);
                    }
                } catch (e) {
                    if (e.message.startsWith("Backend Error:")) throw e; // Propagate up
                    console.warn("[Stream Parse Error]", e);
                }
            }
        }

        if (!finalData) throw new Error("Stream ended without final result.");
        return finalData;
    }

    /* ===========================
       EXPORT
    ============================ */
    window.renderAnalysisButton = createAnalysisUI;
    console.log("[Analysis] Module Loaded. window.renderAnalysisButton is ready.");

})();
