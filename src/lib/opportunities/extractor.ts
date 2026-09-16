import { LLMExtractionOutputSchema, type LLMExtractionOutput, type DeadlineConfidence } from './types';

const DEFAULT_MODEL = import.meta.env.OPENROUTER_OPPORTUNITIES_MODEL || process.env.OPENROUTER_OPPORTUNITIES_MODEL || 'google/gemini-2.5-flash';
const FALLBACK_MODEL = 'openai/gpt-4o-mini';

const EXTRACTION_SYSTEM_PROMPT = `You are a precise opportunity parser for creative technologists, researchers, designers, and developers.

Extract this opportunity into JSON.

Return only:
title, organisation, category, deadline, timezone, event_date, location, requirements, next_action, application_url, meeting_url, fee_or_funding, summary.

category must be one of:
job, open_call, residency, conference, event, grant, fellowship, other.

requirements must be a short array containing only actual submission or attendance requirements.

next_action must be one short concrete action describing what I should do first.

summary must be maximum 25 words.

Never guess dates, URLs, requirements, timezone or eligibility. Use null when unclear.
Format output as strict JSON.`;

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
