
/**
 * Audio Response Module
 * Handles microphone access, recording, visualization (waveform), and output.
 * 
 * NOTE: This is loaded as a standard script (no module) to ensure valid global scope access 
 * before untrainable-tabs.js runs.
 */

class AudioRecorderUI {
    constructor(containerEl, options = {}) {
        this.container = containerEl;
        this.options = {
            hideControls: false, // If true, internal buttons are hidden (headless mode)
            ...options
        };

        this.state = "IDLE"; // IDLE, ARMING, LIVE, PROCESSING, REVIEW, ERROR

        this.mediaRecorder = null;
        this.audioChunks = [];
        this.audioCtx = null;
        this.analyser = null;
        this.source = null;
        this.animationId = null;
        this.stream = null;
        this.startTime = 0;
        this.timerInterval = null;
        this.blob = null;
        this.durationMs = 0;

        // UI References
        this.els = {
            wrap: null,
            canvas: null,
            timer: null,
            status: null,
            dot: null,
            actions: null,
            btnStop: null,
            btnRecordAgain: null,
            player: null
        };

        this.initUI();
    }

    initUI() {
        this.container.innerHTML = "";

        // Wrapper
        const wrap = document.createElement("div");
        wrap.className = "ar-wrapper";

        // Canvas (Visualizer) - Hidden initially
        const canvas = document.createElement("canvas");
        canvas.className = "ar-canvas";
        canvas.width = 600;
        canvas.height = 100;

        // Info / Timer
        const meta = document.createElement("div");
        meta.className = "ar-meta";
        const dot = document.createElement("span");
        dot.className = "ar-dot";
        const status = document.createElement("span");
        status.className = "ar-status";
        status.textContent = "Ready";
        const timer = document.createElement("span");
        timer.className = "ar-timer";
        timer.textContent = "00:00";
        // Timer initially hidden
        timer.style.display = "none";

        meta.appendChild(dot);
        meta.appendChild(status);
        meta.appendChild(timer);

        // Controls
        const actions = document.createElement("div");
        actions.className = "ar-actions";
        if (this.options.hideControls) actions.style.display = "none";

        // Stop Button
        const btnStop = document.createElement("button");
        btnStop.className = "ar-btn ar-btn-stop";
        btnStop.type = "button";
        btnStop.textContent = "Stop";
        btnStop.style.display = "none";
        btnStop.onclick = () => this.stop();

        // Custom Player UI (Review Mode)
        const reviewUI = document.createElement("div");
        reviewUI.className = "ar-review-ui";

        const playBtn = document.createElement("button");
        playBtn.className = "ar-play-btn";
        playBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`; // Play Icon
        playBtn.onclick = () => this.togglePlayback();

        const reviewCanvas = document.createElement("canvas");
        reviewCanvas.className = "ar-review-waveform";
        reviewCanvas.width = 300;
        reviewCanvas.height = 32;

        reviewUI.appendChild(playBtn);
        reviewUI.appendChild(reviewCanvas);

        // Record Again (Redo)
        const btnRecordAgain = document.createElement("button");
        btnRecordAgain.className = "ar-btn ar-btn-secondary";
        btnRecordAgain.type = "button";
        btnRecordAgain.textContent = "Redo";
        btnRecordAgain.style.display = "none";
        btnRecordAgain.onclick = () => this.resetAndStart();

        actions.appendChild(btnStop);
        actions.appendChild(btnRecordAgain);

        // Simple Audio Player (native controls)
        const player = document.createElement("audio");
        player.className = "ar-player";
        player.style.display = "none";
        player.controls = true;

        wrap.appendChild(canvas);
        wrap.appendChild(meta);
        wrap.appendChild(actions);
        wrap.appendChild(player);
        this.container.appendChild(wrap);

        this.els = { wrap, canvas, timer, status, dot, actions, btnStop, btnRecordAgain, player };

        this.setState("IDLE");
    }

    setState(newState, msgOverride = null) {
        this.state = newState;
        const { wrap, canvas, timer, status, dot, btnStop, btnRecordAgain, player } = this.els;

        // Reset visual cues
        wrap.setAttribute("data-state", newState);
        status.className = "ar-status"; // Reset modifiers
        dot.className = "ar-dot";

        // Hide specifics first
        btnStop.style.display = "none";
        btnRecordAgain.style.display = "none";
        player.style.display = "none";

        switch (newState) {
            case "IDLE":
                status.textContent = "Press mic to start";
                canvas.style.opacity = "0.3";
                timer.style.display = "none";
                canvas.style.display = "block";
                break;

            case "ARMING":
                status.textContent = msgOverride || "Getting microphone ready… Please wait—don’t speak yet";
                status.classList.add("is-arming");
                canvas.style.display = "block";
                break;

            case "LIVE":
                status.textContent = "Recording";
                canvas.style.opacity = "1";
                timer.style.display = "inline-block";
                dot.classList.add("is-recording");
                if (!this.options.hideControls) btnStop.style.display = "inline-block";
                canvas.style.display = "block";
                break;

            case "PROCESSING":
                status.textContent = "Processing...";
                canvas.style.display = "block";
                break;

            case "REVIEW":
                status.textContent = "Recording complete";
                timer.style.display = "inline-block"; // Show final duration
                canvas.style.display = "none";
                if (!this.options.hideControls) btnRecordAgain.style.display = "inline-block";
                // Show native audio player
                player.style.display = "block";
                player.controls = true;
                break;

            case "ERROR":
                status.textContent = msgOverride || "Error";
                status.style.color = "var(--ar-danger)";
                canvas.style.display = "block";
                break;
        }
    }

    async start() {
        if (this.state === "ARMING" || this.state === "LIVE") return;

        try {
            this.setState("ARMING");

            // Parallel Init
            const ctxPromise = (async () => {
                if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                if (this.audioCtx.state === "suspended") await this.audioCtx.resume();
                return this.audioCtx;
            })();

            const streamPromise = navigator.mediaDevices.getUserMedia({ audio: true });

            const [ctx, stream] = await Promise.all([ctxPromise, streamPromise]);
            this.audioCtx = ctx;
            this.stream = stream;

            // Setup Recorder
            const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
            this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = e => {
                if (e.data.size > 0) this.audioChunks.push(e.data);
            };

            this.mediaRecorder.onstop = () => this.finalizeRecording(mimeType);

            // Analyzer
            this.analyser = this.audioCtx.createAnalyser();
            this.source = this.audioCtx.createMediaStreamSource(this.stream);
            this.source.connect(this.analyser);
            this.analyser.fftSize = 64;

            // Brief instruction sequence (2-3 seconds total)
            this.els.status.textContent = "Please wait, recorder initializing...";
            await new Promise(r => setTimeout(r, 1000));

            this.els.status.textContent = "Initialized";
            await new Promise(r => setTimeout(r, 1000));

            // Transition to LIVE
            this.mediaRecorder.start();
            this.startTime = Date.now();
            this.timerInterval = setInterval(() => this.updateTimer(), 100);

            this.visualize();
            this.setState("LIVE");

        } catch (err) {
            console.error("[Audio] Permission denied", err);
            this.showError("Mic Access Failed: " + err.message);
        }
    }

    stop() {
        if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
            this.mediaRecorder.stop();
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        clearInterval(this.timerInterval);
        cancelAnimationFrame(this.animationId);
        if (this.audioCtx) {
            this.audioCtx.close();
            this.audioCtx = null; // Force recreation on next start
        }

        this.setState("PROCESSING");
    }

    finalizeRecording(mimeType) {
        this.blob = new Blob(this.audioChunks, { type: mimeType });
        this.durationMs = Date.now() - this.startTime;

        const audioURL = URL.createObjectURL(this.blob);
        this.els.player.src = audioURL;

        this.setState("REVIEW");
    }

    resetAndStart() {
        this.reset();
        this.start();
    }

    reset() {
        if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") this.stop();

        this.audioChunks = [];
        this.blob = null;
        this.durationMs = 0;
        this.els.player.src = "";

        this.setState("IDLE");
        this.drawSilentLine();
    }

    drawSilentLine() {
        const cvs = this.els.canvas;
        const ctx = cvs.getContext("2d");
        const w = cvs.width;
        const h = cvs.height;

        ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--ar-bg-canvas") || "#f4f4f5";
        ctx.fillRect(0, 0, w, h);

        ctx.lineWidth = 2;
        ctx.strokeStyle = "#ccc";
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();
    }

    visualize() {
        const cvs = this.els.canvas;
        const ctx = cvs.getContext("2d");
        const w = cvs.width;
        const h = cvs.height;
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            if (!this.stream) return;
            this.animationId = requestAnimationFrame(draw);

            this.analyser.getByteFrequencyData(dataArray);

            ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--ar-bg-canvas") || "#f4f4f5";
            ctx.fillRect(0, 0, w, h);

            const isDark = document.body.classList.contains("dark-mode");
            ctx.fillStyle = isDark ? "#fff" : "#000";

            const barWidth = (w / bufferLength) * 2.5;
            let barHeight;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                barHeight = (dataArray[i] / 255) * h;
                ctx.fillRect(x, h - barHeight, barWidth, barHeight);
                x += barWidth + 1;
            }
        };
        draw();
    }

    updateTimer() {
        const diff = Math.floor((Date.now() - this.startTime) / 1000);
        const m = Math.floor(diff / 60).toString().padStart(2, '0');
        const s = (diff % 60).toString().padStart(2, '0');
        this.els.timer.textContent = `${m}:${s}`;
    }

    showError(msg) {
        this.els.status.textContent = msg;
        this.els.dot.style.background = "transparent";
    }

    hasRecording() { return !!this.blob; }

    getRecordingData() {
        return {
            blob: this.blob,
            durationMs: this.durationMs,
            mimeType: this.blob ? this.blob.type : null
        };
    }
}

async function uploadAudioToSupabase(supabase, bucket, path, blob) {
    if (!supabase) throw new Error("Supabase client not initialized");
    const { data, error } = await supabase.storage.from(bucket).upload(path, blob, { cacheControl: '3600', upsert: false });
    if (error) throw error;
    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path);
    return { path: path, publicUrl: publicData.publicUrl };
}

// Global Assignment
window.AudioRecorderUI = AudioRecorderUI;
window.uploadAudioToSupabase = uploadAudioToSupabase;
