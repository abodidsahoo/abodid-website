import { LLMExtractionOutputSchema, type LLMExtractionOutput, type DeadlineConfidence } from './types';

const DEFAULT_MODEL = import.meta.env.OPENROUTER_OPPORTUNITIES_MODEL || process.env.OPENROUTER_OPPORTUNITIES_MODEL || 'google/gemini-2.5-flash';
const FALLBACK_MODEL = 'openai/gpt-4o-mini';

const EXTRACTION_SYSTEM_PROMPT = `You are a precise, intelligent opportunity parser for creative technologists, artists, researchers, designers, and engineers.

Your task is to analyze the provided webpage text and logically segregate the information into accurate, structured JSON fields for database storage.

FIELD EXTRACTION GUIDELINES:
1. title (string, required):
   - The clean, proper name of the opportunity (e.g. "SAM Residencies Open Call 2026", "Creative Fellowship", "AI Art Grant").
   - Strip out website navigation junk, breadcrumbs, social counters, or raw URLs.

2. organisation (string, required):
   - The host foundation, institution, museum, or company offering the opportunity (e.g. "Singapore Art Museum", "Sundance Institute", "Mozilla").

3. category (string, required):
   - Must be strictly one of: "grant", "residency", "fellowship", "open_call", "job", "conference", "event", "other".

4. deadline (string | null):
   - The application / submission deadline timestamp or date (e.g. "2026-10-15T23:59:00Z" or "October 15, 2026").
   - Set to "rolling" if it is open year-round without a fixed cutoff.
   - Do NOT confuse application deadlines with residency operating dates, exhibition dates, or office hours.

5. timezone (string | null):
   - Timezone for the deadline (e.g. "SGT", "EST", "CET", "UTC", "Asia/Singapore"). Null if not stated.

6. event_date (string | null):
   - The dates when the residency, fellowship, conference, or job actually takes place (e.g. "March 2027 – August 2027").

7. location (string | null):
   - Host city and country (e.g. "Singapore", "Berlin, Germany", "Online / Remote").

8. requirements (array of strings):
   - Clean, actionable submission prerequisites (e.g. ["Portfolio (max 10 images/video links)", "Project proposal (500 words)", "CV / Artist Bio", "Artist statement"]).
   - Filter out random numbers, time ranges, website navigation indices, or contact phone numbers.

9. next_action (string | null):
   - One short, concrete next step for the applicant (e.g. "Prepare 500-word proposal draft", "Review guidelines & download application PDF").

10. application_url (string | null):
    - Direct URL to the submission portal (Google Form, Submittable, Typeform, or portal link) if distinct from the main page.

11. fee_or_funding (string | null):
    - Clean financial summary (e.g. "SGD 5,000/month stipend + studio + housing provided", "USD 10,000 production grant", "Free application").

12. summary (string, required):
    - Concise 1-2 sentence overview (max 30 words) summarizing who this is for and what benefits are provided.

Never guess dates or requirements. If a field is not present or unclear, use null. Output strict JSON only.`;

export interface ParsedDeadline {
    deadline_at: string | null;
    deadline_raw: string | null;
    deadline_timezone: string | null;
    deadline_confidence: DeadlineConfidence;
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

    // Check for vague dates
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

    // Attempt to parse standard date or ISO string
    try {
        const parsedDate = new Date(raw);
        if (!isNaN(parsedDate.getTime())) {
            const hasTime = /\b\d{1,2}:\d{2}/.test(raw) || /T\d{2}:\d{2}/.test(raw);
            return {
                deadline_at: parsedDate.toISOString(),
                deadline_raw: raw,
                deadline_timezone: timezoneStr || (hasTime ? null : 'UTC'),
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

/**
 * Parses event date text into ISO timestamp if possible.
 */
export function parseEventDate(eventDateStr: string | null | undefined): string | null {
    if (!eventDateStr || typeof eventDateStr !== 'string') return null;
    try {
        const parsed = new Date(eventDateStr.trim());
        if (!isNaN(parsed.getTime())) {
            return parsed.toISOString();
        }
    } catch {
        // parsing failed
    }
    return null;
}

/**
 * Executes ONE OpenRouter extraction call.
 * This is the ONLY place where LLM extraction happens.
 */
export async function extractOpportunityWithLLM(
    cleanPageText: string,
    pageTitle?: string
): Promise<{ data: LLMExtractionOutput; model: string }> {
    const apiKey = import.meta.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        throw new Error('Server Configuration Error: Missing OPENROUTER_API_KEY');
    }

    const modelsToTry = [DEFAULT_MODEL, FALLBACK_MODEL];
    let lastError: Error | null = null;

    const userPrompt = `${pageTitle ? `PAGE TITLE: ${pageTitle}\n\n` : ''}PAGE:\n${cleanPageText}`;

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
