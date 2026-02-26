(function () {
  "use strict";

  var STORAGE_KEY = "abodid_journey_v1";
  var SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000;
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
