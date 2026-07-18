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
  var ANALYTICS_ENDPOINT = "/api/analytics/collect";
  var SESSION_TIMEOUT_MS = 30 * 60 * 1000;
  var IDLE_TIMEOUT_MS = 60 * 1000;
  var FLUSH_INTERVAL_MS = 15 * 1000;
  var HUMAN_ENGAGEMENT_THRESHOLD_SECONDS = 2;

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

  function analyticsIsExcluded() {
    var hostname = window.location.hostname.toLowerCase();
    var pathname = window.location.pathname || "/";
    var excludedPath = /^\/(admin|api|preview|test)(\/|$)/.test(pathname) ||
      /^\/.*(^|[-_/])test(\/|$)/.test(pathname) ||
      pathname === "/hand-tracking-test" ||
      pathname === "/landing-grid-test" ||
      pathname === "/work/layout-preview" ||
      /^\/research\/admin(\/|$)/.test(pathname) ||
      /^\/resources\/admin(\/|$)/.test(pathname);
    var ownerExcluded = document.cookie.split(";").some(function (part) {
      return part.trim() === "abodid_analytics_exclude=1";
    });

    return excludedPath || ownerExcluded || navigator.webdriver === true ||
      hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
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
      // Analytics must never interrupt the public site.
      return Promise.resolve();
    }
  }

  if (analyticsIsExcluded()) return;

  var now = Date.now();
  var pathname = analyticsCleanString(window.location.pathname || "/", 240);
  var storedState = loadAnalyticsState() || {};
  var lastActivityAt = Number(storedState.lastActivityAt || 0);
  var sessionExpired = !storedState.sessionId || !lastActivityAt || now - lastActivityAt > SESSION_TIMEOUT_MS;
  var visitorId = storedState.visitorId || createUuid();
  var sessionId = sessionExpired ? createUuid() : storedState.sessionId;
  var sequenceNumber = sessionExpired ? 1 : Math.max(1, Number(storedState.sequenceNumber || 0) + 1);
  var landingPage = sessionExpired ? pathname : analyticsCleanString(storedState.landingPage || pathname, 240);
  var utm = sessionExpired ? readUtmParams() : (storedState.utm || readUtmParams());
  var initialReferrer = sessionExpired
    ? analyticsCleanString(document.referrer || "", 500)
    : analyticsCleanString(storedState.initialReferrer || "", 500);
  var pageViewId = createUuid();

  if (!visitorId || !sessionId || !pageViewId) return;

  var nextState = {
    visitorId: visitorId,
    sessionId: sessionId,
    sequenceNumber: sequenceNumber,
    landingPage: landingPage,
    utm: utm,
    initialReferrer: initialReferrer,
    lastActivityAt: now,
  };
  saveAnalyticsState(nextState);

  var sessionOpenPromise = sendAnalyticsPayload({
    action: "page_open",
    visitorId: visitorId,
    sessionId: sessionId,
    pageViewId: pageViewId,
    pagePath: pathname,
    pageTitle: analyticsCleanString(document.title || "", 240),
    landingPage: landingPage,
    referrer: initialReferrer,
    utm: utm,
    sequenceNumber: sequenceNumber,
    projectId: analyticsCleanString(document.body.dataset.analyticsProjectId || "", 40),
  }, false);

  var engagedMilliseconds = 0;
  var activeSince = null;
  var lastInteractionAt = performance.now();
  var lastPersistedAt = now;
  var lastSentSeconds = 0;
  var focused = typeof document.hasFocus === "function" ? document.hasFocus() : true;
  var qualificationFlushTimer = null;

  function isActivelyViewing() {
    return document.visibilityState === "visible" && focused &&
      performance.now() - lastInteractionAt < IDLE_TIMEOUT_MS;
  }

  function resumeEngagement() {
    if (activeSince === null && isActivelyViewing()) {
      activeSince = performance.now();
      scheduleQualificationFlush();
    }
  }

  function pauseEngagement() {
    if (qualificationFlushTimer !== null) {
      window.clearTimeout(qualificationFlushTimer);
      qualificationFlushTimer = null;
    }
    if (activeSince === null) return;
    engagedMilliseconds += Math.max(0, performance.now() - activeSince);
    activeSince = null;
  }

  function currentEngagedSeconds() {
    var activeMilliseconds = activeSince === null ? 0 : Math.max(0, performance.now() - activeSince);
    return Math.floor((engagedMilliseconds + activeMilliseconds) / 1000);
  }

  function persistSessionActivity() {
    var persistNow = Date.now();
    if (persistNow - lastPersistedAt < FLUSH_INTERVAL_MS) return;
    lastPersistedAt = persistNow;
    nextState.lastActivityAt = persistNow;
    saveAnalyticsState(nextState);
  }

  function flushEngagement(preferBeacon) {
    var engagedSeconds = currentEngagedSeconds();
    if (engagedSeconds <= lastSentSeconds) return Promise.resolve();
    lastSentSeconds = engagedSeconds;
    persistSessionActivity();
    return sendAnalyticsPayload({
      action: "engagement",
      sessionId: sessionId,
      pageViewId: pageViewId,
      pagePath: pathname,
      engagedSeconds: engagedSeconds,
    }, preferBeacon);
  }

  function scheduleQualificationFlush() {
    if (qualificationFlushTimer !== null || lastSentSeconds >= HUMAN_ENGAGEMENT_THRESHOLD_SECONDS) return;
    var remainingSeconds = Math.max(
      0,
      HUMAN_ENGAGEMENT_THRESHOLD_SECONDS - currentEngagedSeconds()
    );
    qualificationFlushTimer = window.setTimeout(function () {
      qualificationFlushTimer = null;
      if (isActivelyViewing()) flushEngagement(false);
    }, (remainingSeconds * 1000) + 75);
  }

  function startFreshSession() {
    pauseEngagement();
    sessionId = createUuid();
    pageViewId = createUuid();
    sequenceNumber = 1;
    landingPage = pathname;
    utm = readUtmParams();
    initialReferrer = "";
    engagedMilliseconds = 0;
    lastSentSeconds = 0;
    lastPersistedAt = 0;
    nextState = {
      visitorId: visitorId,
      sessionId: sessionId,
      sequenceNumber: sequenceNumber,
      landingPage: landingPage,
      utm: utm,
      initialReferrer: initialReferrer,
      lastActivityAt: Date.now(),
    };
    saveAnalyticsState(nextState);
    sessionOpenPromise = sendAnalyticsPayload({
      action: "page_open",
      visitorId: visitorId,
      sessionId: sessionId,
      pageViewId: pageViewId,
      pagePath: pathname,
      pageTitle: analyticsCleanString(document.title || "", 240),
      landingPage: landingPage,
      referrer: initialReferrer,
      utm: utm,
      sequenceNumber: sequenceNumber,
      projectId: analyticsCleanString(document.body.dataset.analyticsProjectId || "", 40),
    }, false);
  }

  function recordInteraction() {
    if (Date.now() - Number(nextState.lastActivityAt || 0) > SESSION_TIMEOUT_MS) {
      startFreshSession();
    }
    lastInteractionAt = performance.now();
    persistSessionActivity();
    resumeEngagement();
  }

  function trackMenuEvent(event) {
    var allowedEvents = ["menu_open", "menu_dismiss", "menu_link_click"];
    var eventName = analyticsCleanString(event && event.eventName || "", 40);
    if (allowedEvents.indexOf(eventName) === -1) return Promise.resolve();

    recordInteraction();
    var eventId = createUuid();
    if (!eventId) return Promise.resolve();

    var payload = {
      action: "menu_event",
      eventId: eventId,
      eventName: eventName,
      sessionId: sessionId,
      pageViewId: pageViewId,
      pagePath: pathname,
      menuContext: analyticsCleanString(event && event.menuContext || "", 20),
      targetLabel: analyticsCleanString(event && event.targetLabel || "", 120),
      targetUrl: analyticsCleanString(event && event.targetUrl || "", 500),
      targetType: analyticsCleanString(event && event.targetType || "", 30),
      position: Math.max(0, Math.min(100, Math.round(Number(event && event.position) || 0))),
    };

    return Promise.resolve(sessionOpenPromise).then(function () {
      return sendAnalyticsPayload(payload, eventName === "menu_link_click");
    });
  }

  ["pointerdown", "keydown", "scroll", "touchstart"].forEach(function (eventName) {
    window.addEventListener(eventName, recordInteraction, { passive: true });
  });

  window.addEventListener("focus", function () {
    focused = true;
    recordInteraction();
  });
  window.addEventListener("blur", function () {
    focused = false;
    pauseEngagement();
    flushEngagement(false);
  });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") {
      pauseEngagement();
      flushEngagement(true);
    } else {
      recordInteraction();
    }
  });
  window.addEventListener("pagehide", function () {
    pauseEngagement();
    flushEngagement(true);
  }, { capture: true });

  window.setInterval(function () {
    if (!isActivelyViewing()) pauseEngagement();
    else resumeEngagement();
    flushEngagement(false);
  }, FLUSH_INTERVAL_MS);

  window.__abodidAnalytics = {
    getSessionId: function () { return sessionId; },
    trackMenuEvent: trackMenuEvent,
    prepareSubmission: function () {
      if (Date.now() - Number(nextState.lastActivityAt || 0) > SESSION_TIMEOUT_MS) {
        startFreshSession();
      }
      recordInteraction();
      return sessionOpenPromise.then(function () {
        return flushEngagement(false);
      });
    },
  };

  var queuedAnalyticsEvents = Array.isArray(window.__abodidAnalyticsQueue)
    ? window.__abodidAnalyticsQueue.splice(0)
    : [];
  queuedAnalyticsEvents.forEach(function (event) {
    trackMenuEvent(event);
  });

  resumeEngagement();
})();
