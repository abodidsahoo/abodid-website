import { LLMExtractionOutputSchema, type LLMExtractionOutput, type DeadlineConfidence } from './types';

const DEFAULT_MODEL = import.meta.env.OPENROUTER_OPPORTUNITIES_MODEL || process.env.OPENROUTER_OPPORTUNITIES_MODEL || 'google/gemini-2.5-flash';
const FALLBACK_MODEL = 'openai/gpt-4o-mini';

export const EXTRACTION_SYSTEM_PROMPT = `You are a precise, intelligent opportunity parser for creative technologists, artists, researchers, designers, and engineers.

Your task is to analyze the provided webpage text and logically segregate the information into accurate, structured JSON fields for database storage.

TARGET-SELECTION RULES (HIGHEST PRIORITY):
- The PAGE TITLE, CURRENT PAGE, main heading, SOURCE URL, and URL fragment identify the target opportunity. Extract that target, not a secondary item merely mentioned or linked inside it.
- Only treat a subsection event as the target when the PAGE TITLE, URL fragment, CURRENT SECTION, or main heading explicitly identifies that event.
- A webinar, information/Q&A session, open day, interview, ceremony, or Teams/Zoom link inside a page about a studentship, grant, fellowship, residency, job, conference, or open call is secondary context. It MUST NOT replace the primary opportunity.
- Link labels and LINK TARGETS are supporting evidence, not proof that the linked item is the target.
- If the primary page explicitly labels an application deadline, submission deadline, closing date, "applications close", "apply by", or "submit by" date, use it as deadline. It outranks programme dates, event/session dates, interview dates, notification dates, publication dates, and dates inside navigation or related links.
- Only put a date in event_date when it describes when the target opportunity itself takes place. Never put its application deadline in event_date.
- When a deadline includes a time, return an ISO 8601 timestamp with an explicit numeric UTC offset. Resolve named local time using an IANA timezone. Example: "noon (UK time) on 15 January 2027" becomes deadline "2027-01-15T12:00:00+00:00" and timezone "Europe/London".
- URLs must be literal absolute URLs present in the supplied text or LINK TARGETS. Never return a link label as a URL.

FIELD EXTRACTION GUIDELINES:
1. title (string, required):
   - The clean, proper name of the opportunity (e.g. "SAM Residencies Open Call 2026", "Creative Fellowship", "AI Art Grant").
   - Strip out website navigation junk, breadcrumbs, social counters, or raw URLs.

2. organisation (string, required):
   - The host foundation, institution, museum, or company offering the opportunity (e.g. "Singapore Art Museum", "Sundance Institute", "Mozilla").

3. category (string, required):
   - Must be strictly one of: "grant", "residency", "fellowship", "open_call", "job", "conference", "event", "other".
   - Information sessions, webinars, open days, registration sessions, and scheduled talks MUST use "event".
   - A PhD or degree programme itself is "other", not "fellowship", unless the page explicitly describes a funded fellowship.

4. deadline (string | null):
   - The application / submission deadline timestamp or date (e.g. "2026-10-15T23:59:00Z" or "October 15, 2026").
   - Set to "rolling" if it is open year-round without a fixed cutoff.
   - Do NOT confuse application deadlines with programme dates, residency operating dates, exhibition dates, information sessions, interviews, result notifications, publication dates, or office hours.

5. timezone (string | null):
   - Timezone for the deadline (e.g. "SGT", "EST", "CET", "UTC", "Asia/Singapore"). Null if not stated.

6. event_date (string | null):
   - The dates when the residency, fellowship, conference, or job actually takes place (e.g. "March 2027 – August 2027").
   - For an information session, webinar, open day, registration session, or scheduled talk, this is the session start date and time.
   - Use CAPTURE CONTEXT to resolve relative dates such as "tomorrow" or a month/day with no year.

7. location (string | null):
   - Host city and country (e.g. "Singapore", "Berlin, Germany", "Online / Remote").

8. requirements (array of strings):
   - Clean, actionable submission prerequisites (e.g. ["Portfolio (max 10 images/video links)", "Project proposal (500 words)", "CV / Artist Bio", "Artist statement"]).
   - Filter out random numbers, time ranges, website navigation indices, or contact phone numbers.

9. next_action (string | null):
   - One short, concrete next step for the applicant (e.g. "Prepare 500-word proposal draft", "Review guidelines & download application PDF").

10. application_url (string | null):
    - Direct URL to the submission portal (Google Form, Submittable, Typeform, or portal link) if distinct from the main page.

11. meeting_url (string | null):
    - Direct URL to the online event, webinar, video call, or registration page when present in the supplied link targets.

12. fee_or_funding (string | null):
    - Clean financial summary (e.g. "SGD 5,000/month stipend + studio + housing provided", "USD 10,000 production grant", "Free application").

13. summary (string, required):
    - Concise 1-2 sentence overview (max 30 words) summarizing who this is for and what benefits are provided.

When the PAGE TITLE, CURRENT SECTION, main heading, or URL fragment explicitly identifies a specific event or information session, extract that event—not the broader programme it discusses elsewhere.
Never guess dates or requirements. If a field is not present or unclear, use null. Output strict JSON only.`;

export interface OpportunityExtractionContext {
    sourceUrl?: string;
    capturedAt?: string;
    timezone?: string;
}

export interface ParsedDeadline {
    deadline_at: string | null;
    deadline_raw: string | null;
    deadline_timezone: string | null;
    deadline_confidence: DeadlineConfidence;
}

const MONTHS: Record<string, number> = {
    january: 1,
    jan: 1,
    february: 2,
    feb: 2,
    march: 3,
    mar: 3,
    april: 4,
    apr: 4,
    may: 5,
    june: 6,
    jun: 6,
    july: 7,
    jul: 7,
    august: 8,
    aug: 8,
    september: 9,
    sept: 9,
    sep: 9,
    october: 10,
    oct: 10,
    november: 11,
    nov: 11,
    december: 12,
    dec: 12,
};

const MONTH_PATTERN = Object.keys(MONTHS)
    .sort((a, b) => b.length - a.length)
    .join('|');

function normalizeTimezone(timezoneStr?: string | null, raw = ''): string | null {
    const supplied = timezoneStr?.trim();
    if (supplied?.includes('/')) return supplied;

    const combined = `${supplied || ''} ${raw}`.toLowerCase();
    const aliases: Array<[RegExp, string]> = [
        [/\b(?:uk time|british time|bst)\b/i, 'Europe/London'],
        [/\b(?:gmt|utc)\b/i, 'UTC'],
        [/\b(?:eastern time|et|est|edt)\b/i, 'America/New_York'],
        [/\b(?:central time|ct|cst|cdt)\b/i, 'America/Chicago'],
        [/\b(?:mountain time|mt|mst|mdt)\b/i, 'America/Denver'],
        [/\b(?:pacific time|pt|pst|pdt)\b/i, 'America/Los_Angeles'],
        [/\b(?:central european time|cet|cest)\b/i, 'Europe/Paris'],
        [/\b(?:australian eastern time|aest|aedt)\b/i, 'Australia/Sydney'],
        [/\b(?:india standard time|ist)\b/i, 'Asia/Kolkata'],
    ];

    for (const [pattern, timezone] of aliases) {
        if (pattern.test(combined)) return timezone;
    }

    if (supplied) {
        try {
            new Intl.DateTimeFormat('en-US', { timeZone: supplied }).format();
            return supplied;
        } catch {
            return supplied;
        }
    }

    return null;
}

function extractNaturalDateParts(raw: string): { year: number; month: number; day: number } | null {
    const dayFirst = raw.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_PATTERN})\\.?[,]?\\s+(20\\d{2})\\b`, 'i'));
    if (dayFirst) {
        return {
            year: Number(dayFirst[3]),
            month: MONTHS[dayFirst[2].toLowerCase().replace(/\.$/, '')],
            day: Number(dayFirst[1]),
        };
    }

    const monthFirst = raw.match(new RegExp(`\\b(${MONTH_PATTERN})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?[,]?\\s+(20\\d{2})\\b`, 'i'));
    if (monthFirst) {
        return {
            year: Number(monthFirst[3]),
            month: MONTHS[monthFirst[1].toLowerCase().replace(/\.$/, '')],
            day: Number(monthFirst[2]),
        };
    }

    const isoDate = raw.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
    if (isoDate) {
        return { year: Number(isoDate[1]), month: Number(isoDate[2]), day: Number(isoDate[3]) };
    }

    return null;
}

function extractNaturalTimeParts(raw: string): { hour: number; minute: number } | null {
    if (/\bnoon\b/i.test(raw)) return { hour: 12, minute: 0 };
    if (/\bmidnight\b/i.test(raw)) return { hour: 0, minute: 0 };

    const meridiemTime = raw.match(/\b(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/i);
    if (meridiemTime) {
        let hour = Number(meridiemTime[1]);
        const minute = Number(meridiemTime[2] || 0);
        const meridiem = meridiemTime[3].toLowerCase().replace(/\./g, '');
        if (meridiem === 'pm' && hour < 12) hour += 12;
        if (meridiem === 'am' && hour === 12) hour = 0;
        return { hour, minute };
    }

    const clockTime = raw.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    if (clockTime) return { hour: Number(clockTime[1]), minute: Number(clockTime[2]) };

    return null;
}

/**
 * Deterministically parses extracted deadline text into UTC timestamp, raw text, and confidence.
 */
export function parseDeadline(deadlineStr: string | null | undefined, timezoneStr: string | null | undefined): ParsedDeadline {
    if (!deadlineStr || typeof deadlineStr !== 'string') {
        return {
            deadline_at: null,
            deadline_raw: null,
            deadline_timezone: timezoneStr || null,
            deadline_confidence: 'none',
        };
    }

    const raw = deadlineStr.trim();
    const lower = raw.toLowerCase();

    // Check for rolling / ongoing deadlines
    if (lower.includes('rolling') || lower.includes('ongoing') || lower.includes('open until filled') || lower.includes('no deadline')) {
        return {
            deadline_at: null,
            deadline_raw: raw,
            deadline_timezone: timezoneStr || null,
            deadline_confidence: 'rolling',
        };
    }

    const normalizedTimezone = normalizeTimezone(timezoneStr, raw);

    // Parse explicit ISO timestamps first. They already carry deterministic timezone information.
    if (/^20\d{2}-\d{2}-\d{2}T/.test(raw)) {
        const isoDate = new Date(raw);
        if (!isNaN(isoDate.getTime())) {
            return {
                deadline_at: isoDate.toISOString(),
                deadline_raw: raw,
                deadline_timezone: normalizedTimezone || timezoneStr || null,
                deadline_confidence: 'exact',
            };
        }
    }

    // Parse common human-written dates without depending on the server's locale or timezone.
    const naturalDate = extractNaturalDateParts(raw);
    if (naturalDate) {
        const naturalTime = extractNaturalTimeParts(raw);
        if (naturalTime) {
            const deadlineAt = zonedDateTimeToIso(
                { ...naturalDate, ...naturalTime },
                normalizedTimezone || 'UTC',
            );
            if (deadlineAt) {
                return {
                    deadline_at: deadlineAt,
                    deadline_raw: raw,
                    deadline_timezone: normalizedTimezone || timezoneStr || null,
                    deadline_confidence: normalizedTimezone ? 'exact' : 'needs_verification',
                };
            }
        }

        return {
            deadline_at: new Date(Date.UTC(naturalDate.year, naturalDate.month - 1, naturalDate.day)).toISOString(),
            deadline_raw: raw,
            deadline_timezone: normalizedTimezone || timezoneStr || 'UTC',
            deadline_confidence: 'date_only',
        };
    }

    // Parse unambiguous numeric dates, but never guess whether 01/02 means January 2 or February 1.
    const numericDate = raw.match(/\b(\d{1,2})[/.\-](\d{1,2})[/.\-](20\d{2})\b/);
    if (numericDate) {
        const first = Number(numericDate[1]);
        const second = Number(numericDate[2]);
        const year = Number(numericDate[3]);
        if (first <= 12 && second <= 12) {
            return {
                deadline_at: null,
                deadline_raw: raw,
                deadline_timezone: normalizedTimezone || timezoneStr || null,
                deadline_confidence: 'needs_verification',
            };
        }

        const month = first > 12 ? second : first;
        const day = first > 12 ? first : second;
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            return {
                deadline_at: new Date(Date.UTC(year, month - 1, day)).toISOString(),
                deadline_raw: raw,
                deadline_timezone: normalizedTimezone || timezoneStr || 'UTC',
                deadline_confidence: 'date_only',
            };
        }
    }

    // Mark genuinely vague dates only after checking whether the text also contains a precise date.
    if (
        lower.includes('early') ||
        lower.includes('late') ||
        lower.includes('mid-') ||
        lower.includes('tbd') ||
        lower.includes('tba') ||
        lower.includes('spring') ||
        lower.includes('summer') ||
        lower.includes('autumn') ||
        lower.includes('fall') ||
        lower.includes('winter') ||
        /^[a-zA-Z\s]+20\d\d$/.test(lower) // e.g. "September 2026" without day
    ) {
        return {
            deadline_at: null,
            deadline_raw: raw,
            deadline_timezone: timezoneStr || null,
            deadline_confidence: 'needs_verification',
        };
    }

    // Attempt to parse remaining standard date strings.
    try {
        const parsedDate = new Date(raw);
        if (!isNaN(parsedDate.getTime())) {
            const hasTime = /\b\d{1,2}:\d{2}/.test(raw) || /T\d{2}:\d{2}/.test(raw);
            return {
                deadline_at: parsedDate.toISOString(),
                deadline_raw: raw,
                deadline_timezone: normalizedTimezone || timezoneStr || (hasTime ? null : 'UTC'),
                deadline_confidence: hasTime ? 'exact' : 'date_only',
            };
        }
    } catch {
        // parsing failed
    }

    return {
        deadline_at: null,
        deadline_raw: raw,
        deadline_timezone: timezoneStr || null,
        deadline_confidence: 'needs_verification',
    };
}

const DEADLINE_LABEL_PATTERN = /\b(application deadline|submission deadline|proposal deadline|registration deadline|closing date|applications? close(?:s)?|apply by|submit by)\b/gi;

/**
 * Finds an explicitly labelled deadline sentence in page text. This is a deterministic
 * safety net for model omissions and for pages that also advertise secondary events.
 */
export function extractExplicitDeadline(pageText: string): { text: string; timezone: string | null } | null {
    if (!pageText || typeof pageText !== 'string') return null;

    const normalized = pageText.replace(/\r/g, '').replace(/[ \t]+/g, ' ');
    const matches = Array.from(normalized.matchAll(DEADLINE_LABEL_PATTERN));

    for (const match of matches) {
        const start = match.index!;
        const after = normalized.slice(match.index!, match.index! + 260);
        const paragraphEnd = after.search(/\n{2,}/);
        const end = match.index! + (paragraphEnd >= 0 ? paragraphEnd : Math.min(after.length, 260));
        const candidate = normalized.slice(start, end).replace(/\n+/g, ' ').trim();
        const timezone = normalizeTimezone(null, candidate);
        const parsed = parseDeadline(candidate, timezone);
        if (parsed.deadline_at || parsed.deadline_confidence === 'rolling') {
            return { text: candidate, timezone };
        }
    }

    return null;
}

/**
 * Prefers a clearly labelled page deadline over an absent, vague, or conflicting LLM value.
 */
export function resolveOpportunityDeadline(
    llmDeadline: string | null | undefined,
    llmTimezone: string | null | undefined,
    pageText: string,
): ParsedDeadline {
    const modelDeadline = parseDeadline(llmDeadline, llmTimezone);
    const explicit = extractExplicitDeadline(pageText);
    if (!explicit) return modelDeadline;

    const pageDeadline = parseDeadline(explicit.text, explicit.timezone || llmTimezone);
    if (!pageDeadline.deadline_at && pageDeadline.deadline_confidence !== 'rolling') return modelDeadline;

    if (!modelDeadline.deadline_at || !pageDeadline.deadline_at) return pageDeadline;

    if (pageDeadline.deadline_confidence === 'exact') {
        return modelDeadline.deadline_at === pageDeadline.deadline_at ? modelDeadline : pageDeadline;
    }

    const modelDay = modelDeadline.deadline_at.slice(0, 10);
    const pageDay = pageDeadline.deadline_at.slice(0, 10);
    return modelDay === pageDay ? modelDeadline : pageDeadline;
}

/**
 * Parses event date text into ISO timestamp if possible.
 */
export function parseEventDate(
    eventDateStr: string | null | undefined,
    referenceDate?: string | null,
    timezone?: string | null,
): string | null {
    if (!eventDateStr || typeof eventDateStr !== 'string') return null;
    const raw = eventDateStr.trim();
    const localDateTime = raw.match(/^(20\d{2})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/);
    if (localDateTime && timezone) {
        return zonedDateTimeToIso({
            year: Number(localDateTime[1]),
            month: Number(localDateTime[2]),
            day: Number(localDateTime[3]),
            hour: localDateTime[4] ? Number(localDateTime[4]) : 0,
            minute: localDateTime[5] ? Number(localDateTime[5]) : 0,
        }, timezone);
    }

    const hasExplicitYear = /\b(?:19|20)\d{2}\b/.test(raw);
    if (hasExplicitYear) {
        try {
            const parsed = new Date(raw);
            if (!isNaN(parsed.getTime())) {
                return parsed.toISOString();
            }
        } catch {
            // Continue to the context-aware parser below.
        }
    }
    const reference = referenceDate ? new Date(referenceDate) : new Date();
    if (isNaN(reference.getTime())) return null;

    const timeMatch = raw.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
    let hour = timeMatch ? Number(timeMatch[1]) : 0;
    const minute = timeMatch?.[2] ? Number(timeMatch[2]) : 0;
    const meridiem = timeMatch?.[3]?.toLowerCase();
    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;

    const monthList = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthNames = monthList.join('|');
    const explicitDate = raw.match(new RegExp(`\\b(${monthNames})\\s+(\\d{1,2})(?:,?\\s+(20\\d{2}))?`, 'i'));

    let year: number;
    let month: number;
    let day: number;

    if (explicitDate) {
        year = explicitDate[3] ? Number(explicitDate[3]) : getZonedDateParts(reference, timezone).year;
        month = monthList.findIndex((name) => name.toLowerCase() === explicitDate[1].toLowerCase()) + 1;
        day = Number(explicitDate[2]);
    } else if (/\btomorrow\b/i.test(raw)) {
        const parts = getZonedDateParts(reference, timezone);
        const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1));
        year = next.getUTCFullYear();
        month = next.getUTCMonth() + 1;
        day = next.getUTCDate();
    } else {
        return null;
    }

    return zonedDateTimeToIso({ year, month, day, hour, minute }, timezone);
}

function getZonedDateParts(date: Date, timezone?: string | null) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone || 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hourCycle: 'h23',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
    const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
    return {
        year: Number(parts.year),
        month: Number(parts.month),
        day: Number(parts.day),
        hour: Number(parts.hour),
        minute: Number(parts.minute),
        second: Number(parts.second),
    };
}

function zonedDateTimeToIso(
    parts: { year: number; month: number; day: number; hour: number; minute: number },
    timezone?: string | null,
): string | null {
    const zone = timezone || 'UTC';
    let utcGuess = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0);

    try {
        for (let attempt = 0; attempt < 2; attempt += 1) {
            const zoned = getZonedDateParts(new Date(utcGuess), zone);
            const displayedAsUtc = Date.UTC(zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute, zoned.second);
            utcGuess -= displayedAsUtc - Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0);
        }
        return new Date(utcGuess).toISOString();
    } catch {
        return null;
    }
}

/**
 * Executes ONE OpenRouter extraction call.
 * This is the ONLY place where LLM extraction happens.
 */
export async function extractOpportunityWithLLM(
    cleanPageText: string,
    pageTitle?: string,
    context: OpportunityExtractionContext = {},
): Promise<{ data: LLMExtractionOutput; model: string }> {
    const apiKey = import.meta.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        throw new Error('Server Configuration Error: Missing OPENROUTER_API_KEY');
    }

    const modelsToTry = [DEFAULT_MODEL, FALLBACK_MODEL];
    let lastError: Error | null = null;

    const contextLines = [
        context.sourceUrl ? `SOURCE URL: ${context.sourceUrl}` : '',
        pageTitle ? `PAGE TITLE: ${pageTitle}` : '',
        context.capturedAt ? `CAPTURED AT: ${context.capturedAt}` : '',
        context.timezone ? `BROWSER TIMEZONE: ${context.timezone}` : '',
    ].filter(Boolean);
    const userPrompt = `${contextLines.length ? `CAPTURE CONTEXT:\n${contextLines.join('\n')}\n\n` : ''}PAGE:\n${cleanPageText}`;

    for (const model of modelsToTry) {
        try {
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://abodid.com/opportunities',
                    'X-Title': 'Abodid Opportunity Assistant',
                },
                body: JSON.stringify({
                    model,
                    response_format: { type: 'json_object' },
                    messages: [
                        { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
                        { role: 'user', content: userPrompt },
                    ],
                    temperature: 0.1,
                }),
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`OpenRouter API error (HTTP ${response.status}): ${errText}`);
            }

            const jsonResponse = await response.json();
            const content = jsonResponse.choices?.[0]?.message?.content;

            if (!content) {
                throw new Error('OpenRouter returned an empty message payload');
            }

            // Clean potential markdown fencing from JSON string
            let jsonString = content.trim();
            if (jsonString.startsWith('```json')) {
                jsonString = jsonString.slice(7).replace(/```$/, '').trim();
            } else if (jsonString.startsWith('```')) {
                jsonString = jsonString.slice(3).replace(/```$/, '').trim();
            }

            const rawParsed = JSON.parse(jsonString);
            const validated = LLMExtractionOutputSchema.parse(rawParsed);

            return {
                data: validated,
                model,
            };
        } catch (err: any) {
            lastError = err;
            console.warn(`Extraction attempt with model ${model} failed:`, err?.message || err);
            // Continue to fallback model if available
        }
    }

    throw new Error(`Opportunity extraction failed: ${lastError?.message || 'Unknown error'}`);
}
