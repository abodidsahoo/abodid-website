(function () {
  "use strict";

  var STORAGE_KEY = "abodid_journey_v1";
  var SESSION_TIMEOUT_MS = 30 * 60 * 1000;
  var MAX_EVENTS = 30;
  var MAX_RECENT = 8;
  var MAX_TOP = 6;
  var SESSION_COOKIE = "abodid_journey_session";
  var LAST_PAGE_COOKIE = "abodid_journey_last_page";

  function safeParse(value) {
    try {
      return JSON.parse(value);
    } catch (_error) {
      return null;
    }
  }

  function cleanString(value, maxLen) {
    if (typeof value !== "string") return "";
    return value.trim().slice(0, maxLen);
  }

  function makeSessionId() {
    return (
      "journey_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).slice(2, 8)
    );
  }

  function setCookie(name, value, maxAgeSeconds) {
    try {
      document.cookie =
        name +
        "=" +
        encodeURIComponent(value) +
        "; Max-Age=" +
        String(maxAgeSeconds) +
        "; Path=/; SameSite=Lax";
    } catch (_error) {
      // no-op
    }
  }

  function loadJourney() {
    try {
      return safeParse(localStorage.getItem(STORAGE_KEY));
    } catch (_error) {
      return null;
    }
  }

  function saveJourney(journey) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(journey));
    } catch (_error) {
      // no-op
    }
  }

  function readSourceParams() {
    var params = new URLSearchParams(window.location.search);
    return {
      sourcePage: cleanString(
        params.get("from") || params.get("source_page") || "",
        180
      ),
      sourceName: cleanString(params.get("source_name") || "", 120),
      cta: cleanString(params.get("cta") || "", 120),
    };
  }

  var now = Date.now();
  var pathname = cleanString(window.location.pathname || "", 180);
  var pageTitle = cleanString(document.title || "", 180);
  var sourceParams = readSourceParams();

  var journey = loadJourney();
  var journeyUpdatedAt = journey && journey.updatedAt ? Date.parse(journey.updatedAt) : NaN;
  var shouldResetJourney =
    !journey ||
    typeof journey !== "object" ||
    !Number.isFinite(journeyUpdatedAt) ||
    now - journeyUpdatedAt > SESSION_TIMEOUT_MS;

  if (shouldResetJourney) {
    journey = {
      sessionId: makeSessionId(),
      startedAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
      landingPage: pathname,
      initialReferrer: cleanString(document.referrer || "", 400),
      lastSourcePage: "",
      lastSourceName: "",
      lastCta: "",
      pageEvents: [],
      pageStats: {},
    };
  }

  if (!journey.sessionId) journey.sessionId = makeSessionId();
  if (!journey.startedAt) journey.startedAt = new Date(now).toISOString();
  if (!journey.updatedAt) journey.updatedAt = new Date(now).toISOString();
  if (!journey.landingPage) journey.landingPage = pathname;
  if (!Array.isArray(journey.pageEvents)) journey.pageEvents = [];
  if (!journey.pageStats || typeof journey.pageStats !== "object")
    journey.pageStats = {};

  if (!journey.initialReferrer && document.referrer) {
    journey.initialReferrer = cleanString(document.referrer, 400);
  }

  if (!sourceParams.sourcePage) {
    try {
      if (document.referrer) {
        var refUrl = new URL(document.referrer);
        if (refUrl.origin === window.location.origin) {
          sourceParams.sourcePage = cleanString(refUrl.pathname, 180);
        }
      }
    } catch (_error) {
      // no-op
    }
  }

  if (sourceParams.sourcePage) journey.lastSourcePage = sourceParams.sourcePage;
  if (sourceParams.sourceName) journey.lastSourceName = sourceParams.sourceName;
  if (sourceParams.cta) journey.lastCta = sourceParams.cta;

  journey.pageEvents.push({
    path: pathname,
    title: pageTitle,
    enteredAt: new Date(now).toISOString(),
    sourcePage: sourceParams.sourcePage,
    cta: sourceParams.cta,
  });
  if (journey.pageEvents.length > MAX_EVENTS) {
    journey.pageEvents = journey.pageEvents.slice(-MAX_EVENTS);
  }

  function persistJourney() {
    journey.updatedAt = new Date().toISOString();
    saveJourney(journey);
    setCookie(SESSION_COOKIE, cleanString(journey.sessionId, 128), 7 * 24 * 60 * 60);
    setCookie(LAST_PAGE_COOKIE, pathname, 7 * 24 * 60 * 60);
  }

  var pageStartMs = now;
  var didFinalize = false;

  function finalizeDuration() {
    if (didFinalize) return;
    didFinalize = true;

    var elapsed = Math.max(0, Date.now() - pageStartMs);
    var existing = Number(journey.pageStats[pathname] || 0);
    journey.pageStats[pathname] = existing + elapsed;
    persistJourney();
  }

  function buildSnapshot() {
    var latest = loadJourney() || journey;
    if (!latest.pageStats || typeof latest.pageStats !== "object") {
      latest.pageStats = {};
    }
    if (!Array.isArray(latest.pageEvents)) latest.pageEvents = [];

    var effectiveStats = {};
    Object.keys(latest.pageStats).forEach(function (key) {
      effectiveStats[key] = Number(latest.pageStats[key] || 0);
    });

    if (!didFinalize) {
      var currentElapsed = Math.max(0, Date.now() - pageStartMs);
      effectiveStats[pathname] = Number(effectiveStats[pathname] || 0) + currentElapsed;
    }

    var latestTitleByPath = {};
    latest.pageEvents.forEach(function (eventItem) {
      var pathKey = cleanString(eventItem.path || "", 180);
      var titleValue = cleanString(eventItem.title || "", 180);
      if (pathKey && titleValue) latestTitleByPath[pathKey] = titleValue;
    });

    var recentPages = latest.pageEvents.slice(-MAX_RECENT).map(function (eventItem) {
      return {
        path: cleanString(eventItem.path || "", 180),
        title: cleanString(eventItem.title || "", 180),
        enteredAt: cleanString(eventItem.enteredAt || "", 80),
        sourcePage: cleanString(eventItem.sourcePage || "", 180),
        cta: cleanString(eventItem.cta || "", 120),
      };
    });

    var visitSequence = latest.pageEvents.slice(-MAX_EVENTS).map(function (eventItem) {
      return {
        path: cleanString(eventItem.path || "", 180),
        title: cleanString(eventItem.title || "", 180),
        enteredAt: cleanString(eventItem.enteredAt || "", 80),
      };
    });

    var uniquePagesLookup = {};
    var uniquePagesVisited = 0;
    latest.pageEvents.forEach(function (eventItem) {
      var p = cleanString(eventItem.path || "", 180);
      if (!p || uniquePagesLookup[p]) return;
      uniquePagesLookup[p] = true;
      uniquePagesVisited += 1;
    });

    var totalTrackedMs = 0;
    Object.keys(effectiveStats).forEach(function (pathKey) {
      totalTrackedMs += Math.max(0, Number(effectiveStats[pathKey] || 0));
    });

    var immediatePreviousPage = "";
    if (latest.pageEvents.length >= 2) {
      var previousEvent = latest.pageEvents[latest.pageEvents.length - 2];
      immediatePreviousPage = cleanString(previousEvent.path || "", 180);
    }

    var topPages = Object.keys(effectiveStats)
      .map(function (pathKey) {
        return {
          path: cleanString(pathKey, 180),
          title: cleanString(latestTitleByPath[pathKey] || "", 180),
          durationMs: Math.max(0, Math.round(Number(effectiveStats[pathKey] || 0))),
        };
      })
      .sort(function (a, b) {
        return b.durationMs - a.durationMs;
      })
      .slice(0, MAX_TOP);

    return {
      sessionId: cleanString(latest.sessionId || "", 128),
      startedAt: cleanString(latest.startedAt || "", 80),
      currentPath: pathname,
      currentPageTitle: pageTitle,
      landingPage: cleanString(latest.landingPage || "", 180),
      initialReferrer: cleanString(latest.initialReferrer || "", 400),
      lastSourcePage: cleanString(latest.lastSourcePage || "", 180),
      lastSourceName: cleanString(latest.lastSourceName || "", 120),
      lastCta: cleanString(latest.lastCta || "", 120),
      totalTrackedMs: Math.max(0, Math.round(totalTrackedMs)),
      totalPageViews: latest.pageEvents.length,
      uniquePagesVisited: uniquePagesVisited,
      immediatePreviousPage: immediatePreviousPage,
      recentPages: recentPages,
      visitSequence: visitSequence,
      topPages: topPages,
    };
  }

  persistJourney();
  window.__abodidJourney = {
    getSnapshot: buildSnapshot,
  };

  window.addEventListener("pagehide", finalizeDuration, { capture: true });
  window.addEventListener("beforeunload", finalizeDuration);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") finalizeDuration();
  });
})();

(function () {
  "use strict";

  var ANALYTICS_STORAGE_KEY = "abodid_analytics_v1";
  var VISITOR_STORAGE_KEY = "abodid_visitor_id_v1";
  var ANALYTICS_ENDPOINT = "/api/analytics/collect";
  var SESSION_TIMEOUT_MS = 30 * 60 * 1000;
  var IDLE_TIMEOUT_MS = 60 * 1000;
  var HUMAN_ENGAGEMENT_THRESHOLD_SECONDS = 2;
  var LONG_SESSION_CHECKPOINT_SECONDS = 90;
  var MAX_BUFFERED_EVENTS = 30;
  var MAX_REPLAY_POINTS = 60;

  function analyticsSafeParse(value) {
    try {
      return JSON.parse(value);
    } catch (_error) {
      return null;
    }
  }

  function analyticsCleanString(value, maxLength) {
    if (typeof value !== "string") return "";
    return value.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, maxLength);
  }

  function createUuid() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
      }

      var bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 15) | 64;
      bytes[8] = (bytes[8] & 63) | 128;
      var hex = Array.prototype.map.call(bytes, function (byte) {
        return byte.toString(16).padStart(2, "0");
      }).join("");
      return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
    } catch (_error) {
      return "";
    }
  }

  function getOrCreatePersistentVisitorId() {
    try {
      var existing = localStorage.getItem(VISITOR_STORAGE_KEY);
      if (existing && existing.length >= 16) return existing;
      var generated = createUuid();
      localStorage.setItem(VISITOR_STORAGE_KEY, generated);
      return generated;
    } catch (_e) {
      return createUuid();
    }
  }

  function setPersistentExclusion() {
    try {
      document.cookie = "abodid_analytics_exclude=1; Path=/; Max-Age=31536000; SameSite=Lax";
      localStorage.setItem("abodid_analytics_exclude", "1");
    } catch (_e) {
      // no-op
    }
  }

  function analyticsIsExcluded() {
    try {
      var hostname = (window.location.hostname || "").toLowerCase();
      var pathname = (window.location.pathname || "/").toLowerCase();
      var search = window.location.search || "";
      var port = window.location.port || "";

      // 1. Developer query parameter override (?dev=1, ?admin=1, ?preview=1, ?owner=1, ?exclude=1, ?debug=1, ?testing=1)
      var hasDevParam = /[?&](dev|admin|preview|owner|exclude|debug|testing)=1/i.test(search);
      if (hasDevParam) {
        setPersistentExclusion();
        return true;
      }

      // 2. Localhost, loopback, private LAN IPs and common dev ports
      var isLocalHost = hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "0.0.0.0" ||
        hostname === "::1" ||
        hostname.endsWith(".local") ||
        hostname.endsWith(".internal") ||
        hostname.endsWith(".lan") ||
        /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|169\.254\.)/.test(hostname);

      var isDevPort = port === "4321" || port === "3000" || port === "5173" || port === "8080";
      if (isLocalHost || isDevPort) return true;

      // 3. Vercel preview / branch deployment domains
      if (hostname.endsWith(".vercel.app") && !hostname.startsWith("abodid.")) {
        return true;
      }

      // 4. Admin & internal testing paths
      var isAdminOrTestPath = /^\/(admin|api|preview|test)(\/|$)/.test(pathname) ||
        /^\/.*(^|[-_/])test(\/|$)/.test(pathname) ||
        pathname === "/hand-tracking-test" ||
        pathname === "/landing-grid-test" ||
        pathname === "/work/layout-preview" ||
        /^\/research\/admin(\/|$)/.test(pathname) ||
        /^\/resources\/admin(\/|$)/.test(pathname);

      if (isAdminOrTestPath) {
        setPersistentExclusion();
        return true;
      }

      // 5. Explicit cookie exclusion or Supabase Admin login cookie
      var hasExclusionCookie = (document.cookie || "").split(";").some(function (part) {
        var trimmed = part.trim();
        return trimmed === "abodid_analytics_exclude=1" ||
               (trimmed.startsWith("sb-") && trimmed.indexOf("-auth-token=") !== -1);
      });
      if (hasExclusionCookie) return true;

      // 6. Explicit localStorage exclusion or Supabase Admin login tokens
      var hasExclusionStorage = localStorage.getItem("abodid_analytics_exclude") === "1" ||
                                localStorage.getItem("abodid_dev_mode") === "true";
      if (hasExclusionStorage) return true;

      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && (/^sb-.*-auth-token$/.test(key) || key === "supabase.auth.token")) {
          setPersistentExclusion();
          return true;
        }
      }

      // 7. Automated bots, WebDriver & Headless agents
      if (navigator.webdriver === true ||
          window.__nightmare ||
          window._phantom ||
          window.callPhantom ||
          window.__selenium_evaluate) {
        return true;
      }

      return false;
    } catch (_e) {
      return false;
    }
  }

  function readUtmParams() {
    var params = new URLSearchParams(window.location.search);
    return {
      source: analyticsCleanString(params.get("utm_source") || "", 100),
      medium: analyticsCleanString(params.get("utm_medium") || "", 100),
      campaign: analyticsCleanString(params.get("utm_campaign") || "", 150),
      term: analyticsCleanString(params.get("utm_term") || "", 150),
      content: analyticsCleanString(params.get("utm_content") || "", 150),
    };
  }

  function loadAnalyticsState() {
    try {
      return analyticsSafeParse(localStorage.getItem(ANALYTICS_STORAGE_KEY));
    } catch (_error) {
      return null;
    }
  }

  function saveAnalyticsState(state) {
    try {
      localStorage.setItem(ANALYTICS_STORAGE_KEY, JSON.stringify(state));
    } catch (_error) {
      // Analytics must never interrupt the public site.
    }
  }

  function sendAnalyticsPayload(payload, preferBeacon) {
    var body = JSON.stringify(payload);
    try {
      if (preferBeacon && navigator.sendBeacon) {
        var blob = new Blob([body], { type: "application/json" });
        if (navigator.sendBeacon(ANALYTICS_ENDPOINT, blob)) return Promise.resolve();
      }

      return window.fetch(ANALYTICS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body,
        credentials: "same-origin",
        keepalive: true,
      }).catch(function () {});
    } catch (_error) {
      return Promise.resolve();
    }
  }

  if (analyticsIsExcluded()) {
    var fallbackSessionId = createUuid() || "00000000-0000-4000-8000-000000000000";
    window.__abodidAnalytics = window.__abodidAnalytics || {
      getSessionId: function () { return fallbackSessionId; },
      getVisitorId: function () { return fallbackSessionId; },
      trackMenuEvent: function () { return Promise.resolve(); },
      trackInteraction: function () { return Promise.resolve(); },
      prepareSubmission: function () { return Promise.resolve(); },
    };
    return;
  }

  var now = Date.now();
  var pathname = analyticsCleanString(window.location.pathname || "/", 240);
  var storedState = loadAnalyticsState() || {};
  var lastActivityAt = Number(storedState.lastActivityAt || 0);
  var sessionExpired = !storedState.sessionId || !lastActivityAt || now - lastActivityAt > SESSION_TIMEOUT_MS;
  var visitorId = getOrCreatePersistentVisitorId();
  var sessionId = sessionExpired ? createUuid() : storedState.sessionId;
  var isReturningVisitor = Boolean(storedState.visitorId && (storedState.visitorId === visitorId || sessionExpired));
  var landingPage = sessionExpired ? pathname : analyticsCleanString(storedState.landingPage || pathname, 240);
  var utm = sessionExpired ? readUtmParams() : (storedState.utm || readUtmParams());
  var initialReferrer = sessionExpired
    ? analyticsCleanString(document.referrer || "", 500)
    : analyticsCleanString(storedState.initialReferrer || "", 500);
  var sessionStartedAt = sessionExpired ? new Date().toISOString() : (storedState.startedAt || new Date().toISOString());

  if (!visitorId || !sessionId) return;

  var pageEvents = Array.isArray(storedState.pageEvents) && !sessionExpired ? storedState.pageEvents : [];
  pageEvents.push({ path: pathname, title: analyticsCleanString(document.title || "", 200), enteredAt: new Date().toISOString() });

  var bufferedEvents = Array.isArray(storedState.bufferedEvents) && !sessionExpired ? storedState.bufferedEvents : [];
  var bufferedReplay = Array.isArray(storedState.bufferedReplay) && !sessionExpired ? storedState.bufferedReplay : [];
  var hasConverted = Boolean(storedState.hasConverted);
  var conversionType = storedState.conversionType || null;
  var sessionStartTime = Date.now();

  var nextState = {
    visitorId: visitorId,
    sessionId: sessionId,
    landingPage: landingPage,
    startedAt: sessionStartedAt,
    utm: utm,
    initialReferrer: initialReferrer,
    lastActivityAt: now,
    pageEvents: pageEvents,
    bufferedEvents: bufferedEvents,
    bufferedReplay: bufferedReplay,
    hasConverted: hasConverted,
    conversionType: conversionType,
  };
  saveAnalyticsState(nextState);

  var engagedMilliseconds = 0;
  var activeSince = null;
  var lastInteractionAt = performance.now();
  var focused = typeof document.hasFocus === "function" ? document.hasFocus() : true;
  var hasSentInitial = false;
  var hasSentLongCheckpoint = false;

  function isActivelyViewing() {
    return document.visibilityState === "visible" && focused &&
      performance.now() - lastInteractionAt < IDLE_TIMEOUT_MS;
  }

  function resumeEngagement() {
    if (activeSince === null && isActivelyViewing()) {
      activeSince = performance.now();
      scheduleInitialFlush();
    }
  }

  function pauseEngagement() {
    if (activeSince === null) return;
    engagedMilliseconds += Math.max(0, performance.now() - activeSince);
    activeSince = null;
  }

  function currentEngagedSeconds() {
    var activeMilliseconds = activeSince === null ? 0 : Math.max(0, performance.now() - activeSince);
    return Math.floor((engagedMilliseconds + activeMilliseconds) / 1000);
  }

  // Client-Side Intent Inference
  function calculateClientIntent() {
    var paths = pageEvents.map(function (p) { return p.path || ""; });
    var isPhoto = paths.some(function (p) { return p.indexOf("photo") !== -1 || p.indexOf("odisha") !== -1; });
    var isObsidian = paths.some(function (p) { return p.indexOf("obsidian") !== -1 || p.indexOf("payments") !== -1; });
    var isTech = paths.some(function (p) { return p.indexOf("lab") !== -1 || p.indexOf("xr") !== -1 || p.indexOf("research") !== -1; });
    var isFilm = paths.some(function (p) { return p.indexOf("film") !== -1 || p.indexOf("brand") !== -1 || p.indexOf("video") !== -1; });

    if (isObsidian) return { category: "obsidian", score: 85 };
    if (isPhoto) return { category: "photography", score: 80 };
    if (isTech) return { category: "creative_tech", score: 80 };
    if (isFilm) return { category: "film_brand", score: 75 };
    return { category: "general", score: Math.min(60, currentEngagedSeconds() * 2) };
  }

  // Client-Side Friction Diagnostics
  function calculateClientFriction() {
    var flags = [];
    var totalSec = currentEngagedSeconds();
    var paths = pageEvents.map(function (p) { return p.path || ""; });
    var hasPricing = paths.some(function (p) { return p.indexOf("payments") !== -1 || p.indexOf("pricing") !== -1; });
    var hasContact = paths.some(function (p) { return p.indexOf("contact") !== -1; });

    var formStarts = bufferedEvents.filter(function (e) { return e.type === "form_start"; }).length;
    var formSubmits = bufferedEvents.filter(function (e) { return e.type === "form_submit"; }).length;
    var deadClicks = bufferedEvents.filter(function (e) { return e.type === "dead_click"; }).length;

    if (hasPricing && !hasConverted) flags.push("pricing_abandoned");
    if (hasContact && formStarts === 0 && !hasConverted) flags.push("contact_unstarted");
    if (formStarts > 0 && formSubmits === 0 && !hasConverted) flags.push("form_abandoned");
    if (deadClicks >= 2) flags.push("dead_clicks");
    if (totalSec < 6 && pageEvents.length === 1 && !hasConverted) flags.push("quick_exit");

    return flags;
  }

  function getDeviceContext() {
    var ua = navigator.userAgent || "";
    var isTablet = /iPad|Tablet|PlayBook|Silk/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    var isMobile = !isTablet && /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);

    if (isTablet) {
      var isIpad = /iPad/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      return {
        type: "tablet",
        label: isIpad ? "iPad" : "Tablet",
      };
    }
    if (isMobile) {
      if (/iPhone/i.test(ua)) return { type: "mobile", label: "iPhone" };
      if (/Android/i.test(ua)) return { type: "mobile", label: "Android Phone" };
      return { type: "mobile", label: "Mobile Phone" };
    }
    if (/Macintosh|Mac OS X/i.test(ua)) return { type: "desktop", label: "MacBook / macOS" };
    if (/Windows/i.test(ua)) return { type: "desktop", label: "Windows PC" };
    if (/Linux/i.test(ua)) return { type: "desktop", label: "Linux Desktop" };
    return { type: "desktop", label: "Laptop / Desktop" };
  }

  // Send Single Unified Batched Session Snapshot (Only 2-4 calls total per entire visit)
  function flushSessionSnapshot(preferBeacon) {
    pauseEngagement();
    var intent = calculateClientIntent();
    var friction = calculateClientFriction();
    var totalSec = currentEngagedSeconds();
    var device = getDeviceContext();

    nextState.lastActivityAt = Date.now();
    saveAnalyticsState(nextState);

    return sendAnalyticsPayload({
      action: "session_snapshot",
      sessionId: sessionId,
      visitorId: visitorId,
      pagePath: pathname,
      landingPage: landingPage,
      exitPage: pathname,
      referrer: initialReferrer,
      utm: utm,
      device: device,
      startedAt: sessionStartedAt,
      engagedSeconds: totalSec,
      intentCategory: intent.category,
      intentScore: intent.score,
      isReturning: isReturningVisitor,
      converted: hasConverted,
      conversionType: conversionType,
      frictionFlags: friction,
      events: bufferedEvents.slice(-25),
      replayData: bufferedReplay.slice(-60),
    }, preferBeacon);
  }

  function scheduleInitialFlush() {
    if (hasSentInitial) return;
    var timer = window.setTimeout(function () {
      if (currentEngagedSeconds() >= HUMAN_ENGAGEMENT_THRESHOLD_SECONDS && !hasSentInitial) {
        hasSentInitial = true;
        flushSessionSnapshot(false);
      }
    }, 2500);
  }

  function recordInteraction() {
    lastInteractionAt = performance.now();
    resumeEngagement();

    // Check for long-session checkpoint
    if (!hasSentLongCheckpoint && currentEngagedSeconds() >= LONG_SESSION_CHECKPOINT_SECONDS) {
      hasSentLongCheckpoint = true;
      flushSessionSnapshot(false);
    }
  }

  function pushEvent(type, label, metadata) {
    if (bufferedEvents.length >= MAX_BUFFERED_EVENTS) bufferedEvents.shift();
    var timeOffsetSec = Math.round((Date.now() - sessionStartTime) / 1000);
    bufferedEvents.push({
      type: analyticsCleanString(type, 30),
      label: analyticsCleanString(label, 120),
      timeOffset: timeOffsetSec,
      ...(metadata || {}),
    });
    nextState.bufferedEvents = bufferedEvents;
    saveAnalyticsState(nextState);
  }

  function pushReplayPoint(type, xNorm, yNorm) {
    if (bufferedReplay.length >= MAX_REPLAY_POINTS) return;
    var timeOffsetSec = Math.round((Date.now() - sessionStartTime) / 1000);
    bufferedReplay.push([
      type === "click" ? 1 : type === "scroll" ? 2 : 0,
      Math.round(xNorm * 100),
      Math.round(yNorm * 100),
      timeOffsetSec,
    ]);
  }

  // Dead / Rage Click detection
  var clickHistory = [];
  function checkDeadOrRageClick(event) {
    var target = event.target;
    var isInteractive = target && (
      target.closest("a") || target.closest("button") || target.closest("input") ||
      target.closest("select") || target.closest("textarea") || target.closest("[role='button']")
    );

    var clickNow = Date.now();
    var x = event.clientX;
    var y = event.clientY;

    clickHistory.push({ x: x, y: y, time: clickNow });
    clickHistory = clickHistory.filter(function (c) { return clickNow - c.time < 1500; });

    var clusteredClicks = clickHistory.filter(function (c) {
      return Math.abs(c.x - x) < 35 && Math.abs(c.y - y) < 35;
    });

    var xNorm = window.innerWidth > 0 ? x / window.innerWidth : 0;
    var yNorm = window.innerHeight > 0 ? y / window.innerHeight : 0;
    pushReplayPoint("click", xNorm, yNorm);

    if (clusteredClicks.length >= 3 && !isInteractive) {
      pushEvent("dead_click", "Repeated clicks on non-interactive element");
    } else if (isInteractive) {
      var ctaText = analyticsCleanString(target.innerText || target.getAttribute("aria-label") || target.title || "CTA Button", 80);
      pushEvent("cta_click", ctaText);
    }
  }

  // Form Interactions
  function initFormListeners() {
    document.addEventListener("focusin", function (e) {
      var target = e.target;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        recordInteraction();
        var form = target.closest("form");
        var formId = form ? (form.id || form.getAttribute("action") || "contact-form") : "input";
        pushEvent("form_start", "Started filling form: " + formId);
      }
    }, { capture: true });

    document.addEventListener("submit", function (e) {
      hasConverted = true;
      conversionType = "form_submission";
      nextState.hasConverted = true;
      nextState.conversionType = conversionType;
      pushEvent("form_submit", "Submitted form");
      flushSessionSnapshot(false);
    }, { capture: true });
  }

  // Sample pointer movement (throttled ~250ms for low compute overhead)
  var lastPointerMoveAt = 0;
  window.addEventListener("pointermove", function (e) {
    var pNow = performance.now();
    if (pNow - lastPointerMoveAt < 250) return;
    lastPointerMoveAt = pNow;
    var xNorm = window.innerWidth > 0 ? e.clientX / window.innerWidth : 0;
    var yNorm = window.innerHeight > 0 ? e.clientY / window.innerHeight : 0;
    pushReplayPoint("move", xNorm, yNorm);
  }, { passive: true });

  window.addEventListener("pointerdown", function (e) {
    recordInteraction();
    checkDeadOrRageClick(e);
  }, { passive: true });

  window.addEventListener("keydown", recordInteraction, { passive: true });
  window.addEventListener("touchstart", recordInteraction, { passive: true });

  window.addEventListener("scroll", function () {
    recordInteraction();
    var docHeight = document.documentElement.scrollHeight || 1;
    var yNorm = (window.scrollY || window.pageYOffset || 0) / docHeight;
    pushReplayPoint("scroll", 0.5, yNorm);
  }, { passive: true });

  window.addEventListener("focus", function () {
    focused = true;
    recordInteraction();
  });
  window.addEventListener("blur", function () {
    focused = false;
    pauseEngagement();
  });

  // Final Flushes on Page Hide / Tab Change
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") {
      flushSessionSnapshot(true);
    } else {
      recordInteraction();
    }
  });

  window.addEventListener("pagehide", function () {
    flushSessionSnapshot(true);
  }, { capture: true });

  initFormListeners();

  window.__abodidAnalytics = {
    getSessionId: function () { return sessionId; },
    getVisitorId: function () { return visitorId; },
    trackMenuEvent: function () { return Promise.resolve(); },
    trackInteraction: function (type, label, meta) {
      pushEvent(type, label, meta);
      return Promise.resolve();
    },
    prepareSubmission: function () {
      hasConverted = true;
      nextState.hasConverted = true;
      return flushSessionSnapshot(false);
    },
  };

  resumeEngagement();
})();


