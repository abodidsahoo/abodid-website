(() => {
  if (window.siteDestination) return;

  const config = document.currentScript?.dataset || {};
  const headings = new Map(Object.entries(JSON.parse(config.destinations || "{}")));
  function addHeadings(values) {
    for (const [path, title] of Object.entries(values)) headings.set(path, title);
  }
  if (config.destinationHeadings?.startsWith("{")) addHeadings(JSON.parse(config.destinationHeadings));
  if (config.catalog) {
    // Also covers server-rendered pages and links added by a client-side filter.
    fetch(config.catalog, { priority: "low" }).then(response => response.ok ? response.json() : {}).then(addHeadings).catch(() => {});
  }
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const handoffKey = "site-destination-handoff";
  const siteHosts = new Set(["abodid.com", "www.abodid.com", "lab.abodid.com", "curation.abodid.com", "photos.abodid.com", "podcast.abodid.com"]);
  let active;
  let frame;
  let slowTimer;
  let hydration;
  let nativeSource;

  const pathKey = url => url.origin + (url.pathname.replace(/\/+$/, "") || "/") + url.search;
  const clean = text => text?.replace(/\s+/g, " ").trim();
  function isPage(from, to) {
    if (!/^https?:$/.test(to.protocol) || (to.origin !== from.origin && !siteHosts.has(to.hostname))) return false;
    if (from.origin === to.origin && from.pathname === to.pathname && from.search === to.search) return false;
    if (/^\/(?:api|_astro|_image|_vercel|downloads|images|fonts|audio|scripts|icons)(?:\/|$)/i.test(to.pathname)) return false;
    return !/\.(?:pdf|zip|gz|dmg|exe|docx?|xlsx?|pptx?|csv|tsv|ics|vcf|epub|json|xml|rss|txt|md|css|m?js|wasm|woff2?|ttf|otf|svg|jpe?g|png|webp|avif|gif|ico|heic|mp[34]|webm|mov|wav|m4a|glb|gltf)$/i.test(to.pathname);
  }

  function titleFor(url, link) {
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const local = headings.get(pathKey(url)) || headings.get(path);
    const card = link?.querySelector("h1,h2,h3,h4,[data-destination-heading]");
    const title = clean(link?.dataset.destinationTitle) || local || clean(card?.textContent);
    if (title) return title;
    const label = clean(link?.getAttribute("aria-label") || link?.textContent)?.replace(/^[←↗→\s]+|[↗→\s]+$/gu, "");
    if (label && label.length < 100 && !/^(?:read|view|see|open|explore|learn|go|visit|back|next|previous|more|here|continue|return|book)\b/i.test(label)) return label;
    let slug = path.split("/").pop() || "Home";
    try { slug = decodeURIComponent(slug); } catch { /* Keep the original path segment. */ }
    return slug.replace(/\.html?$/i, "").replace(/[-_]+/g, " ").replace(/^./u, char => char.toLocaleUpperCase());
  }

  function remember() {
    const heading = document.querySelector("main h1, [role=main] h1") || document.querySelector("body h1");
    const title = clean(heading?.textContent) || clean(document.title);
    if (title && !heading?.closest("#destination-view")) headings.set(pathKey(new URL(location.href)), title);
  }

  function markPendingImages(container) {
    for (const image of container.querySelectorAll("figure img, picture img, img[loading], img[width][height]")) {
      if (!image.complete) image.setAttribute("data-destination-image", "");
    }
  }
  function imageSettled(event) {
    if (event.target instanceof HTMLImageElement) event.target.removeAttribute("data-destination-image");
  }
  document.addEventListener("load", imageSettled, true);
  document.addEventListener("error", imageSettled, true);
  document.addEventListener("astro:hydrate", event => {
    if (event.target.closest("main, [role=main]")) markPendingImages(event.target);
  }, true);

  function clear() {
    cancelAnimationFrame(frame);
    clearTimeout(slowTimer);
    hydration?.abort();
    hydration = undefined;
    if (active?.dialog.open) active.dialog.close();
    active?.dialog.remove();
    active = undefined;
    document.documentElement.removeAttribute("data-destination-pending");
  }

  function show(url, source, title = titleFor(url, source?.closest?.("a[href], area[href]")), startedAt = Date.now()) {
    if (active?.url.href === url.href && active.dialog.isConnected) return active;
    clear();
    const dialog = document.createElement("dialog");
    dialog.id = "destination-view";
    dialog.setAttribute("aria-labelledby", "destination-view-title");
    dialog.setAttribute("aria-describedby", "destination-view-status");
    dialog.dataset.layout = /\/(?:blog|obsidian-vault|system-manual|research-papers)\/.+/.test(url.pathname) ? "article" : "grid";
    dialog.innerHTML = '<div class="destination-line" aria-hidden="true"><i></i></div><div class="destination-content"><h1 id="destination-view-title" tabindex="-1" autofocus></h1><div class="destination-status"><span id="destination-view-status">Loading page…</span><a data-destination-retry hidden>Reload page</a></div><div class="destination-grid" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div></div>';
    dialog.querySelector("h1").textContent = title;
    const retry = dialog.querySelector("a");
    retry.href = url.href;
    retry.addEventListener("click", event => {
      event.preventDefault();
      if (location.href === url.href) location.reload();
      else location.assign(url.href);
    });
    dialog.addEventListener("cancel", event => {
      event.preventDefault();
      history.back();
    });
    (document.body || document.documentElement).append(dialog);
    document.documentElement.setAttribute("data-destination-pending", "");
    dialog.showModal();
    const view = { url, title, dialog, startedAt, fraction: .07 };
    active = view;
    const bar = dialog.querySelector(".destination-line i");
    const start = performance.now() - Math.max(0, Date.now() - startedAt);
    // Continuous elapsed-time curve. It has a fast first response and no timed steps or reset.
    function advance(now) {
      if (active !== view || reducedMotion.matches) return;
      const distance = 1 - .93 / (1 + Math.log1p(Math.max(0, now - start) / 340));
      bar.style.transform = "scaleX(" + distance + ")";
      view.fraction = distance;
      frame = requestAnimationFrame(advance);
    }
    if (!reducedMotion.matches) frame = requestAnimationFrame(advance);
    slowTimer = setTimeout(() => { retry.hidden = false; }, Math.max(0, 8000 - (Date.now() - startedAt)));
    return view;
  }

  function arrived() {
    const main = document.querySelector("main, [role=main], .admin-wrapper") || document.body;
    const islands = main?.querySelectorAll('astro-island[client="only"][ssr]') || [];
    // Keep a title on screen for pages whose entire main area is a client-only app.
    const readable = !islands.length || [...main.querySelectorAll("h1,h2,p,article,form,canvas,img,video,astro-island:not([ssr])")]
      .some(node => !node.closest("template, [hidden], #destination-view") && node.getClientRects().length > 0);
    if (readable) {
      const view = active;
      clear();
      remember();
      if (main) markPendingImages(main);
      if (view && !reducedMotion.matches) {
        const line = document.createElement("div");
        line.className = "destination-finish";
        line.setAttribute("aria-hidden", "true");
        document.body.append(line);
        const motion = line.animate([
          { transform: "scaleX(" + view.fraction + ")", opacity: 1 },
          { transform: "scaleX(1)", opacity: 1, offset: .68 },
          { transform: "scaleX(1)", opacity: 0 },
        ], { duration: 190, easing: "ease-out" });
        motion.finished.then(() => line.remove(), () => line.remove());
      }
      return;
    }
    const pending = active;
    if (!pending || !pending.dialog.isConnected) show(new URL(location.href), null, pending?.title || clean(document.title), pending?.startedAt);
    hydration?.abort();
    hydration = new AbortController();
    for (const island of islands) island.addEventListener("astro:hydrate", arrived, { once: true, signal: hydration.signal });
  }

  // A new document can take over a native navigation before its app or body is ready.
  function carry(url, title) {
    try { sessionStorage.setItem(handoffKey, JSON.stringify({ url: pathKey(url), title, time: active?.startedAt || Date.now() })); } catch { /* Storage is optional. */ }
  }
  try {
    const handoff = JSON.parse(sessionStorage.getItem(handoffKey) || "null");
    sessionStorage.removeItem(handoffKey);
    if (handoff?.url === pathKey(new URL(location.href)) && Date.now() - handoff.time < 120000) {
      show(new URL(location.href), null, handoff.title, handoff.time);
    }
  } catch { /* An ordinary direct visit needs no handoff. */ }

  window.siteDestination = { isPage, show, clear, arrived, carry, remember };
  document.addEventListener("DOMContentLoaded", arrived, { once: true });
  window.addEventListener("pageshow", event => { if (event.persisted) { clear(); remember(); } });
  window.addEventListener("pagehide", () => {
    clear();
    if (nativeSource) document.title = nativeSource.title;
    nativeSource = undefined;
  });
  window.addEventListener("popstate", () => {
    if (nativeSource && location.href === nativeSource.url) {
      document.title = nativeSource.title;
      nativeSource = undefined;
      clear();
    }
  });

  // Runs after page controls and Astro have accepted or cancelled their own clicks.
  window.addEventListener("click", event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.composedPath().find(node => node instanceof Element && node.matches("a[href],area[href]"));
    if (!link || link.closest("#destination-view") || link.hasAttribute("download")) return;
    const target = link.getAttribute("target") || document.querySelector("base[target]")?.target;
    if (target && target.toLowerCase() !== "_self") return;
    const url = new URL(link.getAttribute("href"), link.baseURI);
    const from = new URL(location.href);
    if (!isPage(from, url)) return;
    const view = show(url, link);
    if (url.origin !== from.origin) return;
    carry(url, view.title);
    // The native reload fills the entry we just opened, so Back returns to the source once.
    event.preventDefault();
    nativeSource = { url: from.href, title: document.title };
    try {
      if (link.dataset.astroHistory === "replace") history.replaceState(history.state, "", url);
      else history.pushState(null, "", url);
      document.title = view.title;
      location.reload();
    } catch { location.assign(url.href); }
  });
  // Covers location.assign/replace from app controls, and native browser traversals.
  window.navigation?.addEventListener("navigate", event => {
    if (event.destination.sameDocument || event.hashChange || event.downloadRequest != null || event.formData) return;
    const url = new URL(event.destination.url);
    if (!isPage(new URL(location.href), url)) return;
    const view = show(url, event.sourceElement);
    if (url.origin === location.origin) carry(url, view.title);
    event.signal.addEventListener("abort", () => { if (active === view) clear(); }, { once: true });
  });
})();
