(() => {
    "use strict";

    /* ===========================
       CONFIG
    ============================ */
    const SUPABASE_URL = "https://vbzgchrnobnxkxdcupes.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiemdjaHJub2JueGt4ZGN1cGVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwMzQ0NDIsImV4cCI6MjA4MTYxMDQ0Mn0.nLdQW8f-nJwCFWUkURcr2ZPA694fAKlseYO__MOPGa8";

    // HARDCODED FALLBACKS (Guarantees content if DB fails)
    const FALLBACK_IMAGES = [
        "https://cdn.prod.website-files.com/67eba6a507dbd0003182ea6e/687eab1ba5d574191f21dfca_S07B0239-2.jpg",
        "https://cdn.prod.website-files.com/67eba6a507dbd0003182ea6e/687eab341449702b2e9bde66_S07B0295.jpg",
        "https://cdn.prod.website-files.com/67eba6a507dbd0003182ea6e/687eab3e7f71b6eb405e68f7_S07B0319.jpg",
        "https://cdn.prod.website-files.com/67eba6a507dbd0003182ea6e/687eab1ba5d574191f21dfca_S07B0239-2.jpg",
        "https://cdn.prod.website-files.com/67eba6a507dbd0003182ea6e/687eab341449702b2e9bde66_S07B0295.jpg",
        "https://cdn.prod.website-files.com/67eba6a507dbd0003182ea6e/687eab3e7f71b6eb405e68f7_S07B0319.jpg",
        "https://cdn.prod.website-files.com/67eba6a507dbd0003182ea6e/687eab1ba5d574191f21dfca_S07B0239-2.jpg",
        "https://cdn.prod.website-files.com/67eba6a507dbd0003182ea6e/687eab341449702b2e9bde66_S07B0295.jpg"
    ];

    async function initTab5() {
        const root = document.querySelector('[data-panel="t5"]');
        if (!root) return;

        // Prevent double init if already has content
        if (root.children.length > 0 && root.querySelector('.ai-feed')) return;

        // Clear loading state
        root.innerHTML = '<div style="padding:40px; text-align:center; opacity:0.6;">Loading top commented images...</div>';

        // 1. Init Client
        let sb = null;
        if (window.supabase && window.supabase.createClient) {
            sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        } else {
            console.error("Tab 5: Supabase library missing.");
        }

        let rows = [];
        let error = null;

        if (sb) {
            const res = await sb.from("photo_feedback").select("image_url");
            rows = res.data;
            error = res.error;
        }

        // 2. CHECK & FALLBACK logic
        // If error OR empty, use fallback.
        if (error || !rows || rows.length === 0) {
            console.warn("Tab 5: DB Error or Empty. Using Fallbacks.", error);

            const fallbackSorted = FALLBACK_IMAGES.map((url, i) => ({
                url,
                count: 50 - (i * 3) // Fake descending counts
            }));
            renderFeed(root, fallbackSorted);
            return;
        }

        // 3. Aggregate Real Data
        const counts = {};
        rows.forEach(r => {
            const url = r.image_url;
            if (!url) return;
            counts[url] = (counts[url] || 0) + 1;
        });

        // 4. Sort & Slice
        const sorted = Object.entries(counts)
            .map(([url, count]) => ({ url, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 15);

        // 5. Render
        renderFeed(root, sorted);
    }

    // Helper for progressive loading
    function getOptimizedUrl(url) {
        if (!url) return url;
        if (url.includes("-p-500.")) return url;
        if (url.includes("website-files.com") || url.includes("webflow.com") || url.includes("uploads-ssl.webflow.com")) {
            return url.replace(/(\.(?:jpg|jpeg|png|webp|gif))$/i, "-p-500$1");
        }
        return url;
    }

    function renderFeed(container, items) {
        container.innerHTML = "";

        const feed = document.createElement("div");
        feed.className = "ai-feed";

        items.forEach((item, idx) => {
            const card = document.createElement("div");
            card.className = "ai-card";

            const lowResUrl = getOptimizedUrl(item.url);
            const highResUrl = item.url;

            const img = document.createElement("img");
            img.src = lowResUrl; // Load low-res first
            img.className = "ai-img";
            img.loading = "lazy";

            // Progressive Loading Logic: Load High-Res in background, then swap
            if (lowResUrl !== highResUrl) {
                const fullImg = new Image();
                fullImg.src = highResUrl;
                fullImg.onload = () => {
                    img.src = highResUrl; // Swap to high-res when ready
                };
            }

            const meta = document.createElement("div");
            meta.className = "ai-meta";
            meta.innerHTML = `<strong>#${idx + 1}</strong> &bull; ${item.count} Comments`;

            const actionArea = document.createElement("div");
            actionArea.className = "ai-action";

            card.appendChild(img);
            card.appendChild(meta);
            card.appendChild(actionArea);

            feed.appendChild(card);

            // Inject Analysis Button
            if (window.renderAnalysisButton) {
                window.renderAnalysisButton(actionArea, item.url);
            } else {
                console.warn("[Tab 5] window.renderAnalysisButton not found. Check analysis.js");
                actionArea.innerHTML = "<div style='color:red; font-size:10px;'>Analysis Script Not Loaded</div>";
            }
        });

        container.appendChild(feed);
    }

    /* ===========================
       STYLES
    ============================ */
    const style = document.createElement("style");
    style.textContent = `
        .ai-feed {
            max-width: 1100px;
            margin: 0 auto;
            padding: 40px 16px 120px;
            display: flex;
            flex-direction: column;
            gap: 60px;
        }
        .ai-card {
            border-radius: 12px;
            overflow: hidden;
            background: transparent;
        }
        .ai-img {
            width: 100%;
            height: auto;
            border-radius: 12px;
            display: block;
            box-shadow: 0 4px 20px rgba(0,0,0,0.08);
            margin-bottom: 16px;
        }
        .ai-meta {
            font-size: 11px;
            opacity: 0.5;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        .ai-action {
            width: 100%;
            position: relative;
            display: block;
            min-height: 60px; /* Ensure space for button */
            z-index: 5;
        }
        .ai-action {
            width: 100%;
        }
    `;
    document.head.appendChild(style);

    /* ===========================
       INIT
    ============================ */
    document.addEventListener("click", (e) => {
        const target = e.target.closest('[data-target="t5"]');
        if (target) {
            setTimeout(initTab5, 50);
        }
    });
    window.initTab5 = initTab5;

})();
