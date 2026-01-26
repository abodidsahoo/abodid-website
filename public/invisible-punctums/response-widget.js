(() => {
    "use strict";

    class ResponseWidget {
        constructor(formElement, options = {}) {
            this.form = formElement;
            this.onSuccess = options.onSuccess || (() => { });
            this.modalApi = options.modalApi || null; // { close: fn }

            this.els = {
                name: this.form.querySelector(".wf-field-name input, #t2-wf-name, #rp3-wf-name"),
                feel: this.form.querySelector(".wf-field-feel textarea, #t2-wf-feel, #rp3-wf-feel"),
                submitBtn: this.form.querySelector('button[type="submit"]'),
                status: this.form.querySelector(".wf-status, #t2-wf-status, #rp3-wf-status"),
            };

            this.currentImageUrl = null;
            this.recorder = null;
            this.isRecordingCtx = false;

            this.initUI();
            this.bindEvents();
        }

        setContext(url) {
            this.currentImageUrl = url;
            this.resetState();
        }

        resetState() {
            // Clear Inputs
            if (this.els.name) this.els.name.value = "";
            if (this.els.feel) this.els.feel.value = "";
            if (this.els.status) this.els.status.textContent = "";
            if (this.els.submitBtn) this.els.submitBtn.disabled = false;

            // Reset Audio
            if (this.recorder) this.recorder.reset();
            this.setViewState("initial");
        }

        initUI() {
            // Avoid double init
            if (this.form.dataset.rwInit) return;
            this.form.dataset.rwInit = "true";

            // Create Container
            const audioBox = document.createElement("div");
            audioBox.className = "wf-field";
            audioBox.style.marginTop = "24px";

            const label = document.createElement("span");
            label.className = "wf-label";
            label.textContent = "Audio Response";
            audioBox.appendChild(label);

            const boxInner = document.createElement("div");
            Object.assign(boxInner.style, {
                border: "1px solid var(--border-color, #ccc)",
                borderRadius: "8px",
                padding: "16px",
                background: "var(--bg-card, #fff)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "12px",
                transition: "background 0.2s, border-color 0.2s"
            });
            audioBox.appendChild(boxInner);

            // Recorder Mount Point (for AudioRecorderUI canvas/timer)
            this.recorderMount = document.createElement("div");
            this.recorderMount.style.width = "100%";
            this.recorderMount.style.display = "none";
            boxInner.appendChild(this.recorderMount);

            // Big Mic Button
            this.bigMicBtn = document.createElement("button");
            this.bigMicBtn.type = "button";
            this.bigMicBtn.className = "wf-audio-start-btn";
            Object.assign(this.bigMicBtn.style, {
                width: "100%", padding: "20px", border: "2px dashed var(--border-color, #ccc)",
                borderRadius: "6px", background: "transparent", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: "8px", color: "var(--text-color, #555)", fontSize: "15px", fontWeight: "500",
                transition: "all 0.2s ease"
            });
            this.bigMicBtn.innerHTML = `
        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" style="opacity:0.8">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 2.34 9 4v6c0 1.66 1.34 3 3 3z"/>
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
        </svg>
        <span>Press here to record audio</span>
      `;
            // Hover effects
            this.bigMicBtn.onmouseover = () => { this.bigMicBtn.style.borderColor = "#666"; this.bigMicBtn.style.background = "rgba(0,0,0,0.02)"; };
            this.bigMicBtn.onmouseout = () => { this.bigMicBtn.style.borderColor = "var(--border-color, #ccc)"; this.bigMicBtn.style.background = "transparent"; };
            boxInner.appendChild(this.bigMicBtn);

            // Controls Row
            this.controlsRow = document.createElement("div");
            Object.assign(this.controlsRow.style, {
                display: "none", width: "100%", justifyContent: "space-between", alignItems: "center", marginTop: "10px"
            });
            boxInner.appendChild(this.controlsRow);

            // Stop Button
            this.stopBtn = document.createElement("button");
            this.stopBtn.type = "button";
            this.stopBtn.textContent = "Stop Recording";
            Object.assign(this.stopBtn.style, {
                background: "#e02e2e", color: "#fff", border: "none", padding: "8px 16px",
                borderRadius: "4px", cursor: "pointer", fontWeight: "600", fontSize: "14px"
            });
            this.controlsRow.appendChild(this.stopBtn);

            // Redo Button
            this.redoBtn = document.createElement("button");
            this.redoBtn.type = "button";
            this.redoBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg> Record again`;
            Object.assign(this.redoBtn.style, {
                background: "transparent", color: "var(--text-color, #555)", border: "1px solid var(--border-color, #ccc)",
                padding: "8px 16px", borderRadius: "4px", cursor: "pointer", fontSize: "14px",
                display: "flex", alignItems: "center"
            });
            this.controlsRow.appendChild(this.redoBtn);

            // Inject into Form
            // Try to find the "Feel" field to inject after
            let targetParent = this.form.querySelector('.wf-field-feel');
            if (!targetParent && this.els.feel) targetParent = this.els.feel.closest('.wf-field');

            if (targetParent) {
                targetParent.parentElement.insertBefore(audioBox, targetParent.nextSibling);
            } else {
                // Fallback: append to form before actions
                const actions = this.form.querySelector('.wf-actions');
                if (actions) this.form.insertBefore(audioBox, actions);
                else this.form.appendChild(audioBox);
            }

            // Initialize Actual Recorder Instance
            if (window.AudioRecorderUI) {
                this.recorder = new window.AudioRecorderUI(this.recorderMount, { hideControls: true });
            } else {
                console.error("ResponseWidget: AudioRecorderUI not found. Is audio-response.js loaded?");
            }

            this.setViewState("initial");
        }

        setViewState(state) {
            this.isRecordingCtx = (state === "recording" || state === "recorded");

            // Toggle 'required' on text input if recording is active/present
            if (this.els.feel) this.els.feel.required = !this.isRecordingCtx;

            if (state === "initial") {
                this.bigMicBtn.style.display = "flex";
                this.recorderMount.style.display = "none";
                this.controlsRow.style.display = "none";
                this.stopBtn.style.display = "none";
                this.redoBtn.style.display = "none";
            } else if (state === "recording") {
                this.bigMicBtn.style.display = "none";
                this.recorderMount.style.display = "block";
                this.controlsRow.style.display = "flex";
                this.stopBtn.style.display = "block";
                this.redoBtn.style.display = "none";
            } else if (state === "recorded") {
                this.bigMicBtn.style.display = "none";
                this.recorderMount.style.display = "block";
                this.controlsRow.style.display = "flex";
                this.stopBtn.style.display = "none";
                this.redoBtn.style.display = "flex";
            }
        }

        bindEvents() {
            // UI Buttons
            this.bigMicBtn.addEventListener("click", () => {
                this.setViewState("recording");
                if (this.recorder) this.recorder.start();
            });
            this.stopBtn.addEventListener("click", () => {
                if (this.recorder) this.recorder.stop();
                this.setViewState("recorded");
            });
            this.redoBtn.addEventListener("click", () => {
                if (this.recorder) this.recorder.reset();
                this.setViewState("initial");
            });

            // Form Submit
            this.form.addEventListener("submit", (e) => this.handleSubmit(e));
        }

        async handleSubmit(e) {
            e.preventDefault();
            if (!this.currentImageUrl || !window.UntrainableCore) return;

            const supa = window.UntrainableCore.getSupaClient();
            const core = window.UntrainableCore;

            const name = this.els.name ? this.els.name.value.trim() : "";
            const feeling = this.els.feel ? this.els.feel.value.trim() : "";
            const hasAudio = this.recorder && this.recorder.hasRecording();

            if (!feeling && !hasAudio) {
                this.updateStatus("Please write or record something.");
                return;
            }

            this.setBusy(true);
            this.updateStatus(hasAudio ? "Uploading Audio..." : "Saving...");

            try {
                let uploadedAudio = null;
                if (hasAudio && window.uploadAudioToSupabase) {
                    const data = this.recorder.getRecordingData();
                    const ext = data.mimeType.includes("opus") ? "webm" : "webm";
                    const imgId = core.imageIdFromUrl(this.currentImageUrl);
                    const filename = `image/${imgId}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;

                    uploadedAudio = await window.uploadAudioToSupabase(supa, "audio-responses", filename, data.blob);
                    uploadedAudio.mime = data.mimeType;
                    uploadedAudio.duration = data.durationMs;
                }

                const payload = {
                    image_url: this.currentImageUrl,
                    image_id: core.imageIdFromUrl(this.currentImageUrl),
                    name: name || null,
                    feeling_text: feeling || (hasAudio ? "[Audio Response]" : ""),
                    audio_url: uploadedAudio ? uploadedAudio.publicUrl : null,
                    audio_path: uploadedAudio ? uploadedAudio.path : null,
                    audio_mime: uploadedAudio ? uploadedAudio.mime : null,
                    audio_duration_ms: uploadedAudio ? uploadedAudio.duration : null,
                    page_url: window.location.href,
                    user_agent: navigator.userAgent
                };

                const { error } = await supa.from(core.config.TABLE).insert([payload]);
                if (error) throw error;

                this.updateStatus("Saved. Thank you!");
                setTimeout(() => {
                    if (this.modalApi && this.modalApi.close) this.modalApi.close();
                    this.onSuccess();
                }, 650);

            } catch (err) {
                console.error("ResponseWidget: Submit failed", err);
                this.updateStatus("Could not save. Please try again.");
            } finally {
                this.setBusy(false);
            }
        }

        updateStatus(msg) {
            if (this.els.status) this.els.status.textContent = msg;
        }

        setBusy(isBusy) {
            if (this.els.submitBtn) this.els.submitBtn.disabled = isBusy;
        }
    }

    window.ResponseWidget = ResponseWidget;
    console.log("[ResponseWidget] Loaded.");

})();
