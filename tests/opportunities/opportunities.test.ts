import { describe, it, expect } from 'vitest';

import { canonicalizeCaptureUrl, canonicalizeUrl, cleanHtmlToText, computeContentHash } from '../../src/lib/opportunities/scraper';
import { parseDeadline, parseEventDate } from '../../src/lib/opportunities/extractor';
import { LLMExtractionOutputSchema, type Opportunity } from '../../src/lib/opportunities/types';
import { createSessionToken, verifySessionToken } from '../../src/lib/opportunities/auth';
import { generateIcsFile, generateGoogleCalendarUrl } from '../../src/lib/opportunities/calendar';
import { formatTimeRemaining } from '../../src/lib/opportunities/reminders';

describe('Opportunity Assistant Core Functionality', () => {
    describe('URL Canonicalization & Deduplication', () => {
        it('strips tracking parameters and hashes', () => {
            const raw = 'https://example.com/jobs/creative-tech/?utm_source=twitter&utm_medium=social&ref=123#apply';
            const canonical = canonicalizeUrl(raw);
            expect(canonical).toBe('https://example.com/jobs/creative-tech');
        });

        it('lowercases protocol and hostname and removes redundant trailing slashes', () => {
            const raw = 'HTTPS://WWW.EXAMPLE.COM/residency/2026/';
            const canonical = canonicalizeUrl(raw);
            expect(canonical).toBe('https://www.example.com/residency/2026');
        });

        it('preserves valid functional query parameters', () => {
            const raw = 'https://jobs.lever.co/company/abc-123?page=2';
            const canonical = canonicalizeUrl(raw);
            expect(canonical).toBe('https://jobs.lever.co/company/abc-123?page=2');
        });

        it('preserves event and information-session fragments for browser captures', () => {
            expect(canonicalizeCaptureUrl('https://www.cdh.cam.ac.uk/phd/#2-information-sessions'))
                .toBe('https://www.cdh.cam.ac.uk/phd#2-information-sessions');
            expect(canonicalizeCaptureUrl('https://example.com/course/#apply'))
                .toBe('https://example.com/course');
        });

        it('computes deterministic content hashes', () => {
            const hash1 = computeContentHash('Open Call 2026 Deadline: Oct 15');
            const hash2 = computeContentHash('Open Call 2026 Deadline: Oct 15');
            const hash3 = computeContentHash('Different Content');
            expect(hash1).toBe(hash2);
            expect(hash1).not.toBe(hash3);
        });
    });

    describe('HTML Cleaning & Text Extraction', () => {
        it('strips scripts, styles, navs, footers, and cookie banners', () => {
            const html = `
                <html>
                <head><script>alert("xss")</script><style>.ad { color: red; }</style></head>
                <body>
                    <nav><a href="/">Home</a><a href="/about">About</a></nav>
                    <div class="cookie-banner">Accept our cookies</div>
                    <main>
                        <h1>Digital Art Fellowship 2026</h1>
                        <p>We are offering a $10,000 grant for artists working with generative AI.</p>
                        <p>Deadline: November 30, 2026.</p>
                    </main>
                    <footer>Copyright 2026 Footer info</footer>
                </body>
                </html>
            `;
            const cleaned = cleanHtmlToText(html);
            expect(cleaned).toContain('Digital Art Fellowship 2026');
            expect(cleaned).toContain('$10,000 grant');
            expect(cleaned).not.toContain('alert("xss")');
            expect(cleaned).not.toContain('Accept our cookies');
            expect(cleaned).not.toContain('Footer info');
        });
    });

    describe('Deterministic Date & Deadline Parsing', () => {
        it('parses exact ISO dates with time', () => {
            const result = parseDeadline('2026-11-30T17:00:00Z', 'UTC');
            expect(result.deadline_confidence).toBe('exact');
            expect(result.deadline_at).toBeTruthy();
            expect(result.deadline_timezone).toBe('UTC');
        });

        it('parses date-only strings', () => {
            const result = parseDeadline('2026-10-15', null);
            expect(result.deadline_confidence).toBe('date_only');
            expect(result.deadline_at).toBeTruthy();
        });

        it('identifies rolling deadlines without manufacturing dates', () => {
            const result = parseDeadline('Rolling basis / open until filled', null);
            expect(result.deadline_confidence).toBe('rolling');
            expect(result.deadline_at).toBeNull();
            expect(result.deadline_raw).toBe('Rolling basis / open until filled');
        });

        it('flags vague deadlines as needs_verification', () => {
            const result = parseDeadline('Late September 2026', 'EST');
            expect(result.deadline_confidence).toBe('needs_verification');
            expect(result.deadline_at).toBeNull();
            expect(result.deadline_raw).toBe('Late September 2026');
            expect(result.deadline_timezone).toBe('EST');
        });

        it('handles missing or null deadline gracefully', () => {
            const result = parseDeadline(null, null);
            expect(result.deadline_confidence).toBe('none');
            expect(result.deadline_at).toBeNull();
        });

        it('parses event dates into ISO format', () => {
            const eventIso = parseEventDate('2026-12-05');
            expect(eventIso).toBeTruthy();
            expect(eventIso?.startsWith('2026-12-05')).toBe(true);
        });

        it('resolves a yearless information-session date using capture context', () => {
            const eventIso = parseEventDate(
                'Thursday, September 24, 7:30 PM',
                '2026-09-23T04:30:00.000Z',
                'Asia/Kolkata',
            );
            expect(eventIso).toBe('2026-09-24T14:00:00.000Z');
        });

        it('resolves tomorrow using the browser timezone', () => {
            const eventIso = parseEventDate(
                'Tomorrow at 7:30 PM',
                '2026-09-23T18:45:00.000Z',
                'Asia/Kolkata',
            );
            expect(eventIso).toBe('2026-09-25T14:00:00.000Z');
        });

        it('interprets a manual local event time in its stated timezone', () => {
            const eventIso = parseEventDate(
                '2026-09-24T19:30',
                null,
                'Asia/Kolkata',
            );
            expect(eventIso).toBe('2026-09-24T14:00:00.000Z');
        });
    });

    describe('Zod Schema Validation for LLM Output', () => {
        it('validates and normalizes categories', () => {
            const rawOutput = {
                title: 'Senior Creative Technologist',
                organisation: 'Random Studio',
                category: 'JOB',
                deadline: '2026-12-01',
                timezone: 'GMT',
                event_date: null,
                location: 'London, UK',
                requirements: ['Portfolio', 'CV', '3 Years Experience'],
                next_action: 'Submit CV via portal',
                application_url: 'https://example.com/apply',
                meeting_url: null,
                fee_or_funding: '£65,000/year',
                summary: 'Full-time creative tech role building interactive installations.',
            };

            const parsed = LLMExtractionOutputSchema.parse(rawOutput);
            expect(parsed.category).toBe('job');
            expect(parsed.title).toBe('Senior Creative Technologist');
            expect(parsed.requirements.length).toBe(3);
        });

        it('falls back to other category if unknown category is returned', () => {
            const rawOutput = {
                title: 'Exhibition Call',
                organisation: 'Gallery',
                category: 'unusual_category_type',
            };
            const parsed = LLMExtractionOutputSchema.parse(rawOutput);
            expect(parsed.category).toBe('other');
        });
    });

    describe('HMAC Session Token Auth', () => {
        it('creates and verifies valid session tokens', () => {
            const token = createSessionToken();
            expect(verifySessionToken(token)).toBe(true);
        });

        it('rejects tampered session tokens', () => {
            const token = createSessionToken();
            const tampered = token.slice(0, -4) + 'abcd';
            expect(verifySessionToken(tampered)).toBe(false);
        });
    });

    describe('Calendar & Time Utilities', () => {
        const mockOpp: Opportunity = {
            id: '123e4567-e89b-12d3-a456-426614174000',
            title: 'Creative Coding Residency',
            organisation: 'Studio X',
            category: 'residency',
            source_url: 'https://studiox.org/residency',
            canonical_url: 'https://studiox.org/residency',
            deadline_at: '2026-11-15T23:59:00.000Z',
            deadline_raw: '2026-11-15',
            deadline_timezone: 'UTC',
            deadline_confidence: 'exact',
            event_date: null,
            location: 'Berlin',
            requirements: ['Portfolio PDF', 'Project Pitch'],
            next_action: 'Draft 500-word pitch',
            application_url: 'https://studiox.org/apply',
            meeting_url: null,
            fee_or_funding: '€3,000 stipend',
            summary: 'Two-month residency in Berlin for media artists.',
            status: 'interested',
            outcome: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            extracted_at: new Date().toISOString(),
            source_hash: null,
            llm_model: 'google/gemini-2.5-flash',
            llm_extraction_count: 1,
            notes: null,
        };

        it('generates valid RFC 5545 .ics file content', () => {
            const ics = generateIcsFile(mockOpp, 'deadline');
            expect(ics).toContain('BEGIN:VCALENDAR');
            expect(ics).toContain('SUMMARY:[DEADLINE] Creative Coding Residency (Studio X)');
            expect(ics).toContain('LOCATION:Berlin');
            expect(ics).toContain('END:VCALENDAR');
        });

        it('generates valid Google Calendar URL', () => {
            const gcalUrl = generateGoogleCalendarUrl(mockOpp, 'deadline');
            expect(gcalUrl.startsWith('https://calendar.google.com/calendar/render?')).toBe(true);
            expect(gcalUrl).toContain('Creative');
        });

        it('formats friendly time remaining', () => {
            const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
            const formatted = formatTimeRemaining(future);
            expect(formatted).toContain('5 days');
        });
    });

    describe('Eligibility Extraction & Validation', () => {
        it('rejects junk time/pagination numbers like 00-10 or opening hours', async () => {
            const { extractEligibility } = await import('../../src/lib/opportunities/ui-helpers');
            const oppWithJunk: Opportunity = {
                id: 'test',
                title: 'SAM Residencies Open Call',
                organisation: 'Singapore Art Museum',
                category: 'residency',
                source_url: 'https://singaporeartmuseum.org',
                canonical_url: 'https://singaporeartmuseum.org',
                deadline_at: null,
                deadline_raw: null,
                deadline_timezone: null,
                deadline_confidence: 'none',
                event_date: null,
                location: 'Singapore',
                requirements: ['Hours: 10:00 - 19:00', 'Doc ref: 00-10', 'Portfolio of 10 works'],
                next_action: null,
                application_url: null,
                meeting_url: null,
                fee_or_funding: null,
                summary: 'Residency cycle 00-10 at SAM studios.',
                status: 'inbox',
                outcome: null,
                created_at: '',
                updated_at: '',
                extracted_at: '',
                source_hash: null,
                llm_model: null,
                llm_extraction_count: 0,
                notes: null,
            };

            const tags = extractEligibility(oppWithJunk);
            expect(tags).not.toContain('00-10');
            expect(tags).not.toContain('Age 00-10');
            expect(tags).toContain('Singapore only');
        });

        it('correctly extracts valid age ranges and career stages', async () => {
            const { extractEligibility } = await import('../../src/lib/opportunities/ui-helpers');
            const opp: Opportunity = {
                id: 'test2',
                title: 'Emerging Filmmaker Grant',
                organisation: 'Film Foundation',
                category: 'grant',
                source_url: 'https://filmfoundation.org',
                canonical_url: 'https://filmfoundation.org',
                deadline_at: null,
                deadline_raw: null,
                deadline_timezone: null,
                deadline_confidence: 'none',
                event_date: null,
                location: 'UK',
                requirements: ['Applicants must be aged 18 to 35', 'Early-career artists only'],
                next_action: null,
                application_url: null,
                meeting_url: null,
                fee_or_funding: null,
                summary: 'Grant for early career filmmakers.',
                status: 'inbox',
                outcome: null,
                created_at: '',
                updated_at: '',
                extracted_at: '',
                source_hash: null,
                llm_model: null,
                llm_extraction_count: 0,
                notes: null,
            };

            const tags = extractEligibility(opp);
            expect(tags).toContain('Age 18–35');
            expect(tags).toContain('Early Career');
            expect(tags).toContain('UK residents');
        });
    });

    describe('Smart Title Normalization & Formatting', () => {
        it('normalizes shouting ALL-CAPS titles into clean Title Case while preserving hyphens and years', async () => {
            const { formatOpportunityTitle } = await import('../../src/lib/opportunities/ui-helpers');
            
            const raw1 = 'RESEARCH-CREATION RESIDENCY PROGRAM IN ARTS & TECHNOLOGIES – 2027-28';
            expect(formatOpportunityTitle(raw1)).toBe('Research-Creation Residency Program in Arts & Technologies – 2027-28');

            const raw2 = 'SAM RESIDENCIES OPEN CALL 2026';
            expect(formatOpportunityTitle(raw2)).toBe('SAM Residencies Open Call 2026');

            const raw3 = 'CALL FOR AI AND VR ARTISTS - LONDON';
            expect(formatOpportunityTitle(raw3)).toBe('Call for AI and VR Artists - London');

            const raw4 = 'INTERNATIONAL FELLOWSHIP IN ART & TECHNOLOGY (MIT)';
            expect(formatOpportunityTitle(raw4)).toBe('International Fellowship in Art & Technology (MIT)');
        });

        it('preserves already natural casing without modification', async () => {
            const { formatOpportunityTitle } = await import('../../src/lib/opportunities/ui-helpers');
            
            const normal = 'Mozilla Technology Fund: Open Call for AI Builders';
            expect(formatOpportunityTitle(normal)).toBe('Mozilla Technology Fund: Open Call for AI Builders');
        });
    });
});
