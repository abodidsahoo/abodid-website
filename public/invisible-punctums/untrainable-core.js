(() => {
    "use strict";

    /* ===========================
       CONFIGURATION & CONSTANTS
    ============================ */
    const CONF = {
        SUPABASE_URL: "https://vbzgchrnobnxkxdcupes.supabase.co",
        SUPABASE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiemdjaHJub2JueGt4ZGN1cGVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwMzQ0NDIsImV4cCI6MjA4MTYxMDQ0Mn0.nLdQW8f-nJwCFWUkURcr2ZPA694fAKlseYO__MOPGa8",
        TABLE: "photo_feedback",
        IMAGE_JSON_URL: "https://vbzgchrnobnxkxdcupes.supabase.co/functions/v1/webflow-images",
        FALLBACK_IMAGES: [
            "https://cdn.prod.website-files.com/67eba6a507dbd0003182ea6e/687eab1ba5d574191f21dfca_S07B0239-2.jpg",
            "https://cdn.prod.website-files.com/67eba6a507dbd0003182ea6e/687eab341449702b2e9bde66_S07B0295.jpg",
            "https://cdn.prod.website-files.com/67eba6a507dbd0003182ea6e/687eab3e7f71b6eb405e68f7_S07B0319.jpg"
        ]
    };

    /* ===========================
       STATE MANAGEMENT
    ============================ */
    const STATE = {
        _supa: null,
        images: [],
        imagesPromise: null,
        themeSyncers: []
    };

    /* ===========================
       CORE UTILITIES
    ============================ */
    const Core = {
        // Accessors
        config: CONF,

        // Supabase Client Singleton
        getSupaClient: function () {
            if (STATE._supa) return STATE._supa;
            if (!window.supabase || typeof window.supabase.createClient !== "function") {
                console.error("UntrainableCore: Supabase library not found on window.");
                // We throw here or return null? Throwing is safer for debugging.
                throw new Error("Supabase library not loaded.");
            }
            STATE._supa = window.supabase.createClient(CONF.SUPABASE_URL, CONF.SUPABASE_KEY);
            return STATE._supa;
        },

        // Image Fetching Logic
        fetchImagesOnce: async function () {
            if (Array.isArray(STATE.images) && STATE.images.length) return STATE.images;
            if (STATE.imagesPromise) return STATE.imagesPromise;

            STATE.imagesPromise = (async () => {
                try {
                    const res = await fetch(CONF.IMAGE_JSON_URL, { cache: "no-store" });
                    if (!res.ok) throw new Error("Image endpoint HTTP " + res.status);
                    const data = await res.json();
                    STATE.images = Array.isArray(data) ? data : [];
                    if (!STATE.images.length) throw new Error("Empty list returned.");
                    return STATE.images;
                } catch (e) {
                    console.warn("[UntrainableCore] Using fallback images due to:", e);
                    STATE.images = CONF.FALLBACK_IMAGES.slice();
                    return STATE.images;
                }
            })();

            return STATE.imagesPromise;
        },

        // Theme Logic
        applyThemeFromStorage: function () {
            const saved = (() => {
                try { return localStorage.getItem("theme"); } catch { return null; }
            })();
            const isDark = saved === "dark";
            Core.setTheme(isDark); // Reuse setter logic
            return isDark;
        },

        setTheme: function (isDark) {
            // Core Toggles
            document.body.classList.toggle("dark-mode", isDark);
            document.documentElement.classList.toggle("dark-mode", isDark);
            document.getElementById("um-root")?.classList.toggle("dark-mode", isDark);

            // Broad UI Toggles
            document.querySelectorAll(".wf-wall, .wf-wall-inner, .rp-root, .um-root").forEach((el) => {
                el.classList.toggle("dark-mode", isDark);
            });

            // Sync Registered Listeners
            STATE.themeSyncers.forEach(s => s && s.sync && s.sync());

            try { localStorage.setItem("theme", isDark ? "dark" : "light"); } catch { }
        },

        // Register UI components that want theme updates
        registerThemeSyncer: function (syncerObj) {
            STATE.themeSyncers.push(syncerObj);
        },

        // Helper: Extract ID from URL
        imageIdFromUrl: function (url) {
            try {
                const u = new URL(url);
                const last = u.pathname.split("/").filter(Boolean).pop() || "";
                return decodeURIComponent(last);
            } catch {
                const parts = String(url).split("/");
                return decodeURIComponent(parts[parts.length - 1] || "");
            }
        },

        // Helper: Fetch comments for a specific image
        getCommentsForImage: async function (imageUrl) {
            const supa = Core.getSupaClient();
            if (!supa) return [];

            try {
                const { data, error } = await supa
                    .from(CONF.TABLE)
                    .select("feeling_text")
                    .eq("image_url", imageUrl)
                    .not("feeling_text", "is", null)
                    .neq("feeling_text", "");

                if (error) {
                    console.warn("[UntrainableCore] Failed to fetch comments:", error);
                    return [];
                }

                // Return just the text strings
                return (data || []).map(r => r.feeling_text);
            } catch (e) {
                console.warn("[UntrainableCore] Error fetching comments:", e);
                return [];
            }
        }
    };

    // Expose Globally
    window.UntrainableCore = Core;
    console.log("[UntrainableCore] Initialized (Auto-Purge Test).");

})();
