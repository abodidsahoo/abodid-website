import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import "../styles/bsa-schedule.css";

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const MANCHESTER_TIME_ZONE = "Europe/London";
const MANCHESTER_TIME_LABEL = "Manchester Time (Europe/London, GMT/BST)";

const scheduleClient =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        // Keep this schedule page informational/public and isolated
        // from any authenticated session on the same domain.
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })
    : null;

const formatterCache = new Map();

const KIND_LABELS = {
  session: "Session",
  special: "Special",
  break: "Break",
};

const SESSION_SCOPE_OPTIONS = [
  { value: "all", label: "All Sessions" },
  { value: "paper", label: "Paper Sessions" },
  { value: "non-paper", label: "Plenary & Special" },
];

const DESKTOP_DRAWER_GAP = 16;
const MOBILE_DRAWER_GAP = 8;

function getFormatter(locale, options) {
  const key = `${locale}:${JSON.stringify(options)}`;
  if (!formatterCache.has(key)) {
    formatterCache.set(key, new Intl.DateTimeFormat(locale, options));
  }
  return formatterCache.get(key);
}

function partsToObject(parts) {
  const mapped = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      mapped[part.type] = part.value;
    }
  }
  return mapped;
}

function parseTheme(themeCode, track) {
  const raw = (themeCode || "").trim().toUpperCase();

  if (!raw) {
    return {
      fullCode: "",
      group: "",
      track: track ?? null,
    };
  }

  const compact = raw.replace(/\s+/g, "");
  const parsed = compact.match(/^([A-Z]+)(\d+)$/);

  if (parsed) {
    return {
      fullCode: compact,
      group: parsed[1],
      track: track ?? Number(parsed[2]),
    };
  }

  return {
    fullCode: compact,
    group: compact.replace(/[^A-Z]/g, "") || compact,
    track: track ?? null,
  };
}

function isLikelySpeakerLine(line) {
  const normalized = line.trim().replace(/^[-\u2022]\s*/, "");
  if (!normalized) {
    return false;
  }

  const lowered = normalized.toLowerCase();
  if (
    lowered.startsWith("speaker:") ||
    lowered.startsWith("speakers:") ||
    lowered.startsWith("chair:") ||
    lowered.startsWith("presenter:") ||
    lowered.startsWith("presenters:") ||
    lowered.startsWith("moderator:") ||
    lowered.startsWith("discussant:")
  ) {
    return true;
  }

  if (/^(dr|prof|mr|mrs|ms)\.?\s+/i.test(normalized)) {
    return true;
  }

  const stripped = normalized.replace(/[.,;:()]/g, "");
  return /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}$/.test(stripped);
}

function cleanTitleForUi(titleRaw, titleDisplay) {
  const source =
    typeof titleDisplay === "string" && titleDisplay.trim().length > 0
      ? titleDisplay
      : titleRaw || "";

  const lines = source
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return "Untitled Session";
  }

  const filtered = lines.filter((line) => !isLikelySpeakerLine(line));
  const finalLines = filtered.length ? filtered : lines;

  return finalLines.join(" / ").replace(/\s+/g, " ").trim();
}

function normalizeRoomName(room) {
  if (Array.isArray(room)) {
    return room[0]?.name || "TBA";
  }

  if (room && typeof room === "object") {
    return room.name || "TBA";
  }

  return "TBA";
}

function getMinutesFromIsoInTimeZone(isoValue, timeZone) {
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = partsToObject(
    getFormatter("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      hourCycle: "h23",
    }).formatToParts(date),
  );

  const hour = Number(parts.hour);
  const minute = Number(parts.minute);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }

  return hour * 60 + minute;
}

function buildTimeSlotKey(startMinutes, endMinutes) {
  if (startMinutes === null || endMinutes === null) {
    return "";
  }
  return `${startMinutes}-${endMinutes}`;
}

function formatDayHeading(dayValue, timeZone) {
  const [year, month, day] = dayValue.split("-").map(Number);
  const dayDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  return getFormatter("en-GB", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(dayDate);
}

function formatShortDay(dayValue, timeZone) {
  const [year, month, day] = dayValue.split("-").map(Number);
  const dayDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  return getFormatter("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(dayDate);
}

function formatTime(isoValue, timeZone) {
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }

  return getFormatter("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).format(date);
}

function formatTimeRange(startIso, endIso, timeZone) {
  return `${formatTime(startIso, timeZone)}-${formatTime(endIso, timeZone)}`;
}

function formatPanelTimestamp(date, timeZone) {
  return getFormatter("en-GB", {
    timeZone,
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
    hour12: false,
    hourCycle: "h23",
  }).format(date);
}

function getSessionBlockBadgeParts(sessionBlock) {
  const normalized = (sessionBlock || "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return [];
  }

  return normalized
    .split(/\s*&\s*/g)
    .map((part) => part.replace(/\bRound Table\b/gi, "Roundtable").trim())
    .filter(Boolean);
}

function isPaperSessionEvent(event) {
  const text = `${event.sessionBlock || ""} ${event.titleDisplay || ""}`.toLowerCase();
  return /\bpaper session\b/.test(text);
}

function sortEvents(a, b) {
  if (a.day !== b.day) {
    return a.day.localeCompare(b.day);
  }

  const startDelta = Date.parse(a.startAt) - Date.parse(b.startAt);
  if (startDelta !== 0) {
    return startDelta;
  }

  const roomDelta = a.roomName.localeCompare(b.roomName, undefined, {
    sensitivity: "base",
  });
  if (roomDelta !== 0) {
    return roomDelta;
  }

  const sortA = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
  const sortB = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
  if (sortA !== sortB) {
    return sortA - sortB;
  }

  return a.titleDisplay.localeCompare(b.titleDisplay, undefined, {
    sensitivity: "base",
  });
}

function sortNowPanelEvents(a, b) {
  const roomDelta = a.roomName.localeCompare(b.roomName, undefined, {
    sensitivity: "base",
  });

  if (roomDelta !== 0) {
    return roomDelta;
  }

  return Date.parse(a.startAt) - Date.parse(b.startAt);
}

function normalizeEvent(row, timeZone) {
  const themeParts = parseTheme(row.theme_code, row.track);

  return {
    id: row.id,
    day: row.day,
    startAt: row.start_at,
    endAt: row.end_at,
    sessionBlock: row.session_block || "",
    kind: row.kind || "session",
    themeCode: themeParts.fullCode,
    themeGroup: themeParts.group,
    track: themeParts.track,
    roomName: normalizeRoomName(row.room),
    titleDisplay: cleanTitleForUi(row.title_raw, row.title_display),
    sortOrder: row.sort_order,
    startMinutes: getMinutesFromIsoInTimeZone(row.start_at, timeZone),
    endMinutes: getMinutesFromIsoInTimeZone(row.end_at, timeZone),
  };
}

function getConferenceDayFromDate(date, timeZone) {
  const parts = partsToObject(
    getFormatter("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date),
  );

  if (!parts.year || !parts.month || !parts.day) {
    return null;
  }

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function titleCaseKind(kind) {
  const fallback = kind || "session";
  return KIND_LABELS[fallback] || fallback.charAt(0).toUpperCase() + fallback.slice(1);
}

const BsaScheduleApp = () => {
  const conferenceTimeZone = MANCHESTER_TIME_ZONE;

  const [conferenceDays, setConferenceDays] = useState([]);
  const [themes, setThemes] = useState([]);
  const [eventsByDay, setEventsByDay] = useState({});

  const [selectedDays, setSelectedDays] = useState([]);
  const [selectedThemes, setSelectedThemes] = useState([]);
  const [selectedTimeSlots, setSelectedTimeSlots] = useState([]);
  const [sessionScope, setSessionScope] = useState("all");

  const [showNowPanel, setShowNowPanel] = useState(false);
  const [highlightedTimeKey, setHighlightedTimeKey] = useState("");
  const [activeEvent, setActiveEvent] = useState(null);
  const [drawerBottomOffset, setDrawerBottomOffset] = useState(DESKTOP_DRAWER_GAP);

  const [isLoadingMeta, setIsLoadingMeta] = useState(true);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [clockTick, setClockTick] = useState(Date.now());
  const inFlightDaysRef = useRef(new Set());

  useEffect(() => {
    if (!scheduleClient) {
      setLoadError(
        "Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY. Add them to your environment and refresh.",
      );
      setIsLoadingMeta(false);
      return;
    }

    let isCancelled = false;

    async function loadMeta() {
      setIsLoadingMeta(true);
      setLoadError("");

      const [daysResponse, themesResponse] = await Promise.all([
        scheduleClient
          .from("conference_days")
          .select("day, label")
          .order("day", { ascending: true }),
        scheduleClient
          .from("themes")
          .select("code, name")
          .order("code", { ascending: true }),
      ]);

      if (isCancelled) {
        return;
      }

      if (daysResponse.error) {
        setLoadError(daysResponse.error.message);
      }

      if (themesResponse.error) {
        setLoadError((prev) => prev || themesResponse.error.message);
      }

      const nextDays = daysResponse.data || [];
      const nextThemes = themesResponse.data || [];

      setConferenceDays(nextDays);
      setThemes(nextThemes);
      setSelectedDays((prev) =>
        prev.length > 0 ? prev : nextDays.map((day) => day.day),
      );
      setIsLoadingMeta(false);
    }

    loadMeta();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedDays.length || !scheduleClient) {
      return;
    }

    const missingDays = selectedDays.filter(
      (day) => !(day in eventsByDay) && !inFlightDaysRef.current.has(day),
    );

    if (!missingDays.length) {
      return;
    }

    let isCancelled = false;

    async function loadEvents() {
      setIsLoadingEvents(true);
      setLoadError("");

      for (const day of missingDays) {
        inFlightDaysRef.current.add(day);
      }

      const { data, error } = await scheduleClient
        .from("events")
        .select(
          "id, day, start_at, end_at, session_block, kind, theme_code, track, title_raw, title_display, sort_order, room:rooms(name)",
        )
        .in("day", missingDays)
        .order("day", { ascending: true })
        .order("start_at", { ascending: true })
        .order("sort_order", { ascending: true, nullsFirst: false });

      for (const day of missingDays) {
        inFlightDaysRef.current.delete(day);
      }

      if (isCancelled) {
        return;
      }

      if (error) {
        setLoadError(error.message);
        setIsLoadingEvents(false);
        return;
      }

      setEventsByDay((prev) => {
        const next = { ...prev };

        for (const day of missingDays) {
          if (!(day in next)) {
            next[day] = [];
          }
        }

        for (const row of data || []) {
          const normalized = normalizeEvent(row, conferenceTimeZone);
          if (!(normalized.day in next)) {
            next[normalized.day] = [];
          }
          next[normalized.day] = [...next[normalized.day], normalized];
        }

        for (const day of missingDays) {
          next[day] = [...next[day]].sort(sortEvents);
        }

        return next;
      });

      setIsLoadingEvents(false);
    }

    loadEvents();

    return () => {
      isCancelled = true;
    };
  }, [conferenceTimeZone, eventsByDay, selectedDays]);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setClockTick(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, []);

  useEffect(() => {
    if (!activeEvent) {
      return;
    }

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setActiveEvent(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeEvent]);

  useEffect(() => {
    let rafId = 0;

    const computeDrawerOffset = () => {
      const footer = document.querySelector(".site-footer");
      const isMobile = window.matchMedia("(max-width: 640px)").matches;
      const baseGap = isMobile ? MOBILE_DRAWER_GAP : DESKTOP_DRAWER_GAP;

      if (!footer) {
        setDrawerBottomOffset(baseGap);
        return;
      }

      const footerRect = footer.getBoundingClientRect();
      const overlap = Math.max(0, window.innerHeight - footerRect.top);
      const nextOffset = Math.round(baseGap + overlap);

      setDrawerBottomOffset((prev) => (prev === nextOffset ? prev : nextOffset));
    };

    const onViewportChange = () => {
      if (rafId) {
        return;
      }
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        computeDrawerOffset();
      });
    };

    computeDrawerOffset();
    window.addEventListener("scroll", onViewportChange, { passive: true });
    window.addEventListener("resize", onViewportChange);

    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener("scroll", onViewportChange);
      window.removeEventListener("resize", onViewportChange);
    };
  }, []);

  const themeNameMap = useMemo(() => {
    const lookup = new Map();

    for (const theme of themes) {
      const parsed = parseTheme(theme.code, null);
      const code = parsed.group || parsed.fullCode;
      if (code && !lookup.has(code)) {
        lookup.set(code, theme.name);
      }
    }

    return lookup;
  }, [themes]);

  const themeOptions = useMemo(() => {
    const codes = new Set();

    for (const theme of themes) {
      const parsed = parseTheme(theme.code, null);
      if (parsed.group) {
        codes.add(parsed.group);
      }
    }

    for (const dayEvents of Object.values(eventsByDay)) {
      for (const event of dayEvents) {
        if (event.themeGroup) {
          codes.add(event.themeGroup);
        }
      }
    }

    return Array.from(codes)
      .sort((a, b) => a.localeCompare(b))
      .map((code) => ({
        code,
        name: themeNameMap.get(code) || code,
      }));
  }, [eventsByDay, themeNameMap, themes]);

  useEffect(() => {
    setSelectedThemes((prev) =>
      prev.filter((code) => themeOptions.some((option) => option.code === code)),
    );
  }, [themeOptions]);

  const selectedEvents = useMemo(() => {
    return selectedDays
      .flatMap((day) => eventsByDay[day] || [])
      .sort(sortEvents);
  }, [eventsByDay, selectedDays]);

  const timeSlotOptions = useMemo(() => {
    const slotMap = new Map();

    for (const event of selectedEvents) {
      const key = buildTimeSlotKey(event.startMinutes, event.endMinutes);
      if (!key) {
        continue;
      }

      if (!slotMap.has(key)) {
        slotMap.set(key, {
          key,
          startMinutes: event.startMinutes,
          endMinutes: event.endMinutes,
          startAt: event.startAt,
          endAt: event.endAt,
          count: 0,
          breakCount: 0,
        });
      }

      const slot = slotMap.get(key);
      slot.count += 1;
      if (event.kind === "break") {
        slot.breakCount += 1;
      }
    }

    return Array.from(slotMap.values()).sort((a, b) => {
      if (a.startMinutes !== b.startMinutes) {
        return a.startMinutes - b.startMinutes;
      }
      return a.endMinutes - b.endMinutes;
    });
  }, [selectedEvents]);

  useEffect(() => {
    setSelectedTimeSlots((prev) =>
      prev.filter((key) => timeSlotOptions.some((option) => option.key === key)),
    );
  }, [timeSlotOptions]);

  const selectedTimeSlotSet = useMemo(() => new Set(selectedTimeSlots), [selectedTimeSlots]);

  const baseFilteredEvents = useMemo(() => {
    return selectedEvents.filter((event) => {
      if (selectedThemes.length > 0 && !selectedThemes.includes(event.themeGroup)) {
        return false;
      }

      if (sessionScope === "paper" && !isPaperSessionEvent(event)) {
        return false;
      }

      if (sessionScope === "non-paper" && isPaperSessionEvent(event)) {
        return false;
      }

      return true;
    });
  }, [selectedEvents, selectedThemes, sessionScope]);

  const visibleEvents = useMemo(() => {
    if (!selectedTimeSlotSet.size) {
      return baseFilteredEvents;
    }

    return baseFilteredEvents.filter((event) => {
      const key = buildTimeSlotKey(event.startMinutes, event.endMinutes);
      return key && selectedTimeSlotSet.has(key);
    });
  }, [baseFilteredEvents, selectedTimeSlotSet]);

  const groupedSchedule = useMemo(() => {
    const dayMap = new Map();

    for (const event of visibleEvents) {
      if (!dayMap.has(event.day)) {
        const knownDay = conferenceDays.find((item) => item.day === event.day);
        dayMap.set(event.day, {
          day: event.day,
          label: knownDay?.label || formatDayHeading(event.day, conferenceTimeZone),
          timeMap: new Map(),
        });
      }

      const dayGroup = dayMap.get(event.day);
      const timeKey = event.startAt;

      if (!dayGroup.timeMap.has(timeKey)) {
        dayGroup.timeMap.set(timeKey, {
          startAt: event.startAt,
          endAt: event.endAt,
          key: `${event.day}|${timeKey}`,
          events: [],
        });
      }

      dayGroup.timeMap.get(timeKey).events.push(event);
    }

    return Array.from(dayMap.values())
      .sort((a, b) => a.day.localeCompare(b.day))
      .map((group) => ({
        day: group.day,
        label: group.label,
        totalEvents: Array.from(group.timeMap.values()).reduce(
          (sum, timeGroup) => sum + timeGroup.events.length,
          0,
        ),
        timeGroups: Array.from(group.timeMap.values())
          .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt))
          .map((timeGroup) => ({
            ...timeGroup,
            events: [...timeGroup.events].sort(sortEvents),
          })),
      }));
  }, [conferenceDays, conferenceTimeZone, visibleEvents]);

  useEffect(() => {
    if (!activeEvent) {
      return;
    }

    const existsInFilteredSet = visibleEvents.some((event) => event.id === activeEvent.id);
    if (!existsInFilteredSet) {
      setActiveEvent(null);
    }
  }, [activeEvent, visibleEvents]);

  const nowPanelData = useMemo(() => {
    const nowMs = clockTick;

    const current = baseFilteredEvents
      .filter((event) => {
        const startMs = Date.parse(event.startAt);
        const endMs = Date.parse(event.endAt);
        return startMs <= nowMs && nowMs < endMs;
      })
      .sort(sortNowPanelEvents);

    if (current.length) {
      return {
        mode: "current",
        referenceTime: new Date(nowMs),
        rows: current,
      };
    }

    let nextStart = Number.POSITIVE_INFINITY;

    for (const event of baseFilteredEvents) {
      const startMs = Date.parse(event.startAt);
      if (startMs > nowMs && startMs < nextStart) {
        nextStart = startMs;
      }
    }

    if (Number.isFinite(nextStart)) {
      const nextRows = baseFilteredEvents
        .filter((event) => Date.parse(event.startAt) === nextStart)
        .sort(sortNowPanelEvents);

      return {
        mode: "next",
        referenceTime: new Date(nowMs),
        nextStart: new Date(nextStart),
        rows: nextRows,
      };
    }

    return {
      mode: "empty",
      referenceTime: new Date(nowMs),
      rows: [],
    };
  }, [baseFilteredEvents, clockTick]);

  const todayInConferenceTimeZone = useMemo(
    () => getConferenceDayFromDate(new Date(clockTick), conferenceTimeZone),
    [clockTick, conferenceTimeZone],
  );

  const conferenceStartMs = useMemo(() => {
    const starts = [];
    for (const dayEvents of Object.values(eventsByDay)) {
      for (const event of dayEvents) {
        const startMs = Date.parse(event.startAt);
        if (Number.isFinite(startMs)) {
          starts.push(startMs);
        }
      }
    }

    if (!starts.length) {
      return null;
    }

    return Math.min(...starts);
  }, [eventsByDay]);

  const conferenceCountdown = useMemo(() => {
    if (!conferenceStartMs) {
      return null;
    }

    const deltaMs = conferenceStartMs - clockTick;
    const totalSeconds = Math.max(0, Math.floor(Math.abs(deltaMs) / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const hh = String(hours).padStart(2, "0");
    const mm = String(minutes).padStart(2, "0");
    const ss = String(seconds).padStart(2, "0");

    if (deltaMs <= 0) {
      return {
        status: "live",
        daysLeft: 0,
        timerLabel: "Live",
      };
    }

    return {
      status: "upcoming",
      daysLeft: Math.ceil(deltaMs / 86400000),
      timerLabel: `${days}d ${hh}:${mm}:${ss}`,
    };
  }, [conferenceStartMs, clockTick]);

  const scheduleCountLabel = useMemo(() => {
    const count = visibleEvents.length;
    if (count === 1) {
      return "1 event";
    }
    return `${count} events`;
  }, [visibleEvents.length]);

  const sessionScopeLabel = useMemo(
    () =>
      SESSION_SCOPE_OPTIONS.find((option) => option.value === sessionScope)?.label ||
      "All Sessions",
    [sessionScope],
  );

  const onToggleDay = (dayValue) => {
    setSelectedDays((prev) => {
      if (prev.includes(dayValue)) {
        return prev.filter((day) => day !== dayValue);
      }

      return [...prev, dayValue].sort((a, b) => a.localeCompare(b));
    });
  };

  const onToggleTheme = (themeCode) => {
    setSelectedThemes((prev) => {
      if (prev.includes(themeCode)) {
        return prev.filter((code) => code !== themeCode);
      }

      return [...prev, themeCode].sort((a, b) => a.localeCompare(b));
    });
  };

  const onToggleTimeSlot = (slotKey) => {
    setSelectedTimeSlots((prev) => {
      if (prev.includes(slotKey)) {
        return prev.filter((key) => key !== slotKey);
      }
      return [...prev, slotKey];
    });
  };

  const hasConfiguredDays = conferenceDays.length > 0;

  return (
    <div className="bsa-schedule-app">
      <header className="bsa-hero" aria-label="BSA schedule intro">
        <div className="bsa-hero-top">
          <div className="bsa-hero-title-wrap">
            <p className="bsa-eyebrow">BSA Conference Planner</p>
            <h1>BSA Schedule</h1>
          </div>
          <a className="bsa-page-link-btn" href="/bsa-networking">
            Go to Networking page
          </a>
        </div>
        <p className="bsa-intro-copy">
          Filter by day, stream, and time.
          <br />
          All times are fixed to <strong>{MANCHESTER_TIME_LABEL}</strong>.
        </p>
      </header>

      <section className="bsa-control-shell" aria-label="Schedule filters">
        <div className="bsa-control-grid">
          <fieldset className="bsa-filter-group bsa-day-group">
            <legend>Days</legend>
            <div className="bsa-filter-actions">
              <button
                type="button"
                className="bsa-inline-btn"
                onClick={() =>
                  setSelectedDays(conferenceDays.map((conferenceDay) => conferenceDay.day))
                }
                disabled={!hasConfiguredDays}
              >
                Select all
              </button>
              <button
                type="button"
                className="bsa-inline-btn"
                onClick={() => setSelectedDays([])}
                disabled={!selectedDays.length}
              >
                Clear
              </button>
            </div>
            <div className="bsa-day-chip-wrap">
              {conferenceDays.map((conferenceDay) => {
                const isActive = selectedDays.includes(conferenceDay.day);
                const shortLabel = conferenceDay.label
                  ? conferenceDay.label
                  : formatShortDay(conferenceDay.day, conferenceTimeZone);
                const dayNumber = Number(conferenceDay.day.split("-")[2]);

                return (
                  <button
                    type="button"
                    key={conferenceDay.day}
                    className={`bsa-day-chip ${isActive ? "is-active" : ""}`}
                    onClick={() => onToggleDay(conferenceDay.day)}
                    aria-pressed={isActive}
                    title={formatDayHeading(conferenceDay.day, conferenceTimeZone)}
                  >
                    <span className="bsa-day-chip-num">{Number.isFinite(dayNumber) ? dayNumber : "--"}</span>
                    <span className="bsa-day-chip-text">{shortLabel}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="bsa-filter-group bsa-theme-group">
            <legend>Themes / Streams</legend>
            <div className="bsa-chip-wrap">
              {themeOptions.length === 0 && (
                <span className="bsa-fallback-text">Themes will appear once data loads.</span>
              )}
              {themeOptions.map((theme) => {
                const isActive = selectedThemes.includes(theme.code);

                return (
                  <button
                    type="button"
                    key={theme.code}
                    className={`bsa-chip bsa-theme-chip ${isActive ? "is-active" : ""}`}
                    onClick={() => onToggleTheme(theme.code)}
                    aria-pressed={isActive}
                    title={theme.code}
                  >
                    {theme.name}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="bsa-filter-group bsa-scope-group">
            <legend>Session Scope</legend>
            <div className="bsa-scope-card-wrap">
              {SESSION_SCOPE_OPTIONS.map((option) => {
                const isActive = sessionScope === option.value;
                return (
                  <button
                    type="button"
                    key={option.value}
                    className={`bsa-scope-card ${isActive ? "is-active" : ""}`}
                    onClick={() => setSessionScope(option.value)}
                    aria-pressed={isActive}
                  >
                    <span className="bsa-scope-card-title">{option.label}</span>
                    <span className="bsa-scope-card-subtitle">
                      {option.value === "all"
                        ? "Everything in the selected days"
                        : option.value === "paper"
                          ? "Only paper session content"
                          : "Plenary, special, roundtable and break items"}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="bsa-filter-group bsa-time-slot-group">
            <legend>Time Slots</legend>
            <div className="bsa-filter-actions">
              <button
                type="button"
                className="bsa-inline-btn"
                onClick={() => setSelectedTimeSlots(timeSlotOptions.map((slot) => slot.key))}
                disabled={!timeSlotOptions.length}
              >
                Select all
              </button>
              <button
                type="button"
                className="bsa-inline-btn"
                onClick={() => setSelectedTimeSlots([])}
                disabled={!selectedTimeSlots.length}
              >
                Clear
              </button>
            </div>
            <div className="bsa-chip-wrap">
              {timeSlotOptions.length === 0 && (
                <span className="bsa-fallback-text">Time slots will appear once data loads.</span>
              )}
              {timeSlotOptions.map((slot) => {
                const isActive = selectedTimeSlots.includes(slot.key);
                const slotLabel = formatTimeRange(
                  slot.startAt,
                  slot.endAt,
                  conferenceTimeZone,
                );
                const breakOnly = slot.breakCount > 0 && slot.breakCount === slot.count;

                return (
                  <button
                    type="button"
                    key={slot.key}
                    className={`bsa-chip bsa-time-slot-chip ${isActive ? "is-active" : ""}`}
                    onClick={() => onToggleTimeSlot(slot.key)}
                    aria-pressed={isActive}
                    title={breakOnly ? `${slotLabel} (Break)` : slotLabel}
                  >
                    <span className="bsa-time-slot-label">
                      {breakOnly ? `${slotLabel} · Break` : slotLabel}
                    </span>
                    <span className="bsa-time-slot-count">{slot.count}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

        </div>

        <section className="bsa-now-strip" aria-label="Current conference context">
          <div className="bsa-now-strip-main">
            <p className="bsa-now-strip-title">What's happening now</p>
            <p className="bsa-now-note">
              Current reference: {formatPanelTimestamp(new Date(clockTick), conferenceTimeZone)}
            </p>
          </div>
          <div className="bsa-now-strip-metrics">
            <div className="bsa-now-metric">
              <span>Days Left</span>
              <strong>{conferenceCountdown ? conferenceCountdown.daysLeft : "--"}</strong>
            </div>
            <div className="bsa-now-metric">
              <span>Countdown</span>
              <strong>{conferenceCountdown ? conferenceCountdown.timerLabel : "--"}</strong>
            </div>
          </div>
          <button
            type="button"
            className="bsa-now-button"
            onClick={() => setShowNowPanel((prev) => !prev)}
            aria-expanded={showNowPanel}
          >
            {showNowPanel ? "Hide live panel" : "Open live panel"}
          </button>
        </section>

        <p className="bsa-filter-summary" role="status" aria-live="polite">
          Showing {scheduleCountLabel}
          {` | Scope: ${sessionScopeLabel}`}
          {todayInConferenceTimeZone
            ? ` | Today in Manchester: ${todayInConferenceTimeZone}`
            : ""}
          {selectedTimeSlots.length > 0 ? ` | Time slots: ${selectedTimeSlots.length}` : ""}
        </p>
      </section>

      {showNowPanel && (
        <section className="bsa-now-panel" aria-live="polite">
          <div className="bsa-now-panel-head">
            <h2>
              {nowPanelData.mode === "current"
                ? "What's happening now"
                : nowPanelData.mode === "next"
                  ? "Next up"
                  : "No live or upcoming sessions in current filter"}
            </h2>
            <p>{formatPanelTimestamp(nowPanelData.referenceTime, conferenceTimeZone)}</p>
          </div>

          {nowPanelData.mode === "next" && nowPanelData.nextStart && (
            <p className="bsa-next-start">
              Next start time: {formatTime(nowPanelData.nextStart.toISOString(), conferenceTimeZone)}
            </p>
          )}

          {nowPanelData.rows.length > 0 ? (
            <ul className="bsa-now-list">
              {nowPanelData.rows.map((event) => (
                <li key={`live-${event.id}`}>
                  <button
                    type="button"
                    className="bsa-now-item"
                    onClick={() => setActiveEvent(event)}
                  >
                    <span className="bsa-now-time">
                      {formatTimeRange(event.startAt, event.endAt, conferenceTimeZone)}
                    </span>
                    <span className="bsa-now-room">{event.roomName}</span>
                    <span className="bsa-now-title">{event.titleDisplay}</span>
                    <span className="bsa-now-theme">{event.themeCode || "N/A"}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="bsa-empty-state">
              Adjust your day or theme filters to explore other sessions.
            </p>
          )}
        </section>
      )}

      <section className="bsa-schedule-shell" aria-label="Conference schedule list">
        {isLoadingMeta && <p className="bsa-status-line">Loading conference metadata...</p>}
        {isLoadingEvents && <p className="bsa-status-line">Loading schedule rows...</p>}
        {loadError && <p className="bsa-error-line">{loadError}</p>}

        {!isLoadingMeta && !conferenceDays.length && (
          <p className="bsa-empty-state">
            No conference days found. Add rows to <code>conference_days</code> first.
          </p>
        )}

        {!isLoadingMeta && conferenceDays.length > 0 && groupedSchedule.length === 0 && (
          <p className="bsa-empty-state">
            No events match your filters. Try selecting more days/themes or clearing time-slot filters.
          </p>
        )}

        {groupedSchedule.map((dayGroup) => (
          <section
            className="bsa-day-block"
            key={dayGroup.day}
            aria-labelledby={`bsa-day-${dayGroup.day}`}
          >
            <div className="bsa-day-header">
              <h2 id={`bsa-day-${dayGroup.day}`}>{dayGroup.label}</h2>
              <span>{dayGroup.totalEvents} items</span>
            </div>

            {dayGroup.timeGroups.map((timeGroup) => {
              const isTimeHighlighted = highlightedTimeKey === timeGroup.key;

              return (
                <div
                  className={`bsa-time-group ${isTimeHighlighted ? "is-highlighted" : ""}`}
                  key={timeGroup.key}
                >
                  <button
                    type="button"
                    className="bsa-time-chip"
                    onClick={() =>
                      setHighlightedTimeKey((prev) =>
                        prev === timeGroup.key ? "" : timeGroup.key,
                      )
                    }
                    aria-pressed={isTimeHighlighted}
                  >
                    {formatTimeRange(timeGroup.startAt, timeGroup.endAt, conferenceTimeZone)}
                  </button>

                  <ul className="bsa-event-list">
                    {timeGroup.events.map((event) => {
                      const slotKey = buildTimeSlotKey(
                        event.startMinutes,
                        event.endMinutes,
                      );
                      const rowHighlight =
                        highlightedTimeKey === `${event.day}|${event.startAt}` ||
                        (selectedTimeSlotSet.size > 0 && slotKey && selectedTimeSlotSet.has(slotKey));

                      return (
                        <li key={event.id}>
                          <button
                            type="button"
                            className={`bsa-event-row ${rowHighlight ? "is-active" : ""}`}
                            onClick={() => setActiveEvent(event)}
                          >
                            <span className="bsa-event-room">{event.roomName}</span>
                            <span className="bsa-event-title">{event.titleDisplay}</span>
                            <span className="bsa-event-meta">
                              {getSessionBlockBadgeParts(event.sessionBlock).map((part, index) => (
                                <span
                                  key={`${event.id}-session-${index}`}
                                  className="bsa-badge bsa-badge-session"
                                >
                                  {part}
                                </span>
                              ))}
                              {event.themeCode && (
                                <span className="bsa-badge">{event.themeCode}</span>
                              )}
                              {event.kind !== "session" && (
                                <span className="bsa-badge bsa-kind-badge">
                                  {titleCaseKind(event.kind)}
                                </span>
                              )}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </section>
        ))}
      </section>

      <aside
        className={`bsa-detail-drawer ${activeEvent ? "is-open" : ""}`}
        aria-hidden={!activeEvent}
        style={{ bottom: `${drawerBottomOffset}px` }}
      >
        {activeEvent && (
          <>
            <div className="bsa-drawer-head">
              <p>
                {formatDayHeading(activeEvent.day, conferenceTimeZone)} |{" "}
                {formatTimeRange(activeEvent.startAt, activeEvent.endAt, conferenceTimeZone)}
              </p>
              <button type="button" onClick={() => setActiveEvent(null)}>
                Close
              </button>
            </div>
            <h3>{activeEvent.titleDisplay}</h3>
            <dl className="bsa-drawer-grid">
              <div>
                <dt>Room</dt>
                <dd>{activeEvent.roomName}</dd>
              </div>
              <div>
                <dt>Theme</dt>
                <dd>{activeEvent.themeCode || "N/A"}</dd>
              </div>
              <div>
                <dt>Theme Name</dt>
                <dd>{themeNameMap.get(activeEvent.themeGroup) || "N/A"}</dd>
              </div>
              <div>
                <dt>Kind</dt>
                <dd>{titleCaseKind(activeEvent.kind)}</dd>
              </div>
              <div>
                <dt>Session Block</dt>
                <dd>{activeEvent.sessionBlock || "N/A"}</dd>
              </div>
            </dl>
          </>
        )}
      </aside>
    </div>
  );
};

export default BsaScheduleApp;
