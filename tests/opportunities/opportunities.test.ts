import { describe, it, expect } from 'vitest';

import {
    canonicalizeCaptureUrl,
    canonicalizeUrl,
    cleanHtmlToText,
    computeContentHash,
    extractHtmlTitle,
    prioritizeOpportunityText,
} from '../../src/lib/opportunities/scraper';
import {
    getExtractionSystemPrompt,
    extractExplicitDeadline,
    parseDeadline,
    parseEventDate,
    resolveOpportunityDeadline,
} from '../../src/lib/opportunities/extractor';
import { LLMExtractionOutputSchema, type Opportunity } from '../../src/lib/opportunities/types';
import { isValidOpportunityUsername, normalizeOpportunityUsername } from '../../src/lib/opportunities/username';
import { opportunityToSavedInsert, savedRowToOpportunity } from '../../src/lib/opportunities/saved';
import { generateIcsFile, generateGoogleCalendarUrl } from '../../src/lib/opportunities/calendar';
import { formatTimeRemaining } from '../../src/lib/opportunities/reminders';
import {
    isOpportunityAttention,
    isOpportunityPastDeadline,
    opportunityAttentionScore,
    selectAttentionOpportunities,
} from '../../src/lib/opportunities/attention';
import { normalizeOpportunityCaptureUrl, unwrapOpportunityRedirect } from '../../src/lib/opportunities/captureUrl';
import { formatDaysRemaining, formatStatusTitle, getFirstName } from '../../src/lib/opportunities/ui-helpers';
import {
    WORKFLOW_STATUSES,
    normalizeOpportunityStatus,
    opportunityMatchesTrackerStatus,
} from '../../src/components/opportunities/OpportunityStatusPicker';
import { getOpportunityMenuPosition } from '../../src/lib/opportunities/menuPosition';
import {
    getOpportunitySupportPromptStorageKey,
    shouldShowOpportunitySupportPrompt,
} from '../../src/lib/opportunities/supportPrompt';

describe('Opportunity Assistant Core Functionality', () => {
    describe('Settings menu positioning', () => {
        it('keeps the menu inside narrow viewports', () => {
            const position = getOpportunityMenuPosition({
                triggerRect: { top: 120, right: 308, bottom: 164 },
                menuWidth: 340,
                menuHeight: 460,
                viewportWidth: 320,
                viewportHeight: 568,
            });

            expect(position.left).toBe(12);
            expect(position.width).toBe(296);
            expect(position.top).toBeGreaterThanOrEqual(12);
            expect(position.top + position.maxHeight).toBeLessThanOrEqual(556);
        });

        it('flips above the trigger when there is more usable space there', () => {
            const position = getOpportunityMenuPosition({
                triggerRect: { top: 700, right: 1400, bottom: 744 },
                menuWidth: 340,
                menuHeight: 420,
                viewportWidth: 1440,
                viewportHeight: 900,
            });

            expect(position.top).toBeLessThan(700);
            expect(position.left + position.width).toBeLessThanOrEqual(1428);
        });
    });

    describe('Support milestone prompt', () => {
        it('appears for the owner after ten saved opportunities without limiting further saves', () => {
            expect(shouldShowOpportunitySupportPrompt({
                opportunityCount: 10,
                isOwner: true,
                isLoading: false,
                hasBeenDismissed: false,
            })).toBe(true);

            expect(shouldShowOpportunitySupportPrompt({
                opportunityCount: 25,
                isOwner: true,
                isLoading: false,
                hasBeenDismissed: false,
            })).toBe(true);
        });

        it('stays hidden for visitors, during loading, or after dismissal', () => {
            expect(shouldShowOpportunitySupportPrompt({
                opportunityCount: 10,
                isOwner: false,
                isLoading: false,
                hasBeenDismissed: false,
            })).toBe(false);

            expect(shouldShowOpportunitySupportPrompt({
                opportunityCount: 10,
                isOwner: true,
                isLoading: true,
                hasBeenDismissed: false,
            })).toBe(false);

            expect(shouldShowOpportunitySupportPrompt({
                opportunityCount: 10,
                isOwner: true,
                isLoading: false,
                hasBeenDismissed: true,
            })).toBe(false);
        });

        it('uses a normalized per-user dismissal key', () => {
            expect(getOpportunitySupportPromptStorageKey('  Yashaswinee1995  '))
                .toBe('opportunity-support-prompt:v1:yashaswinee1995');
        });
    });

    describe('Profile personalization', () => {
        it('uses only the first display-name token in the dashboard greeting', () => {
            expect(getFirstName('  Yashaswinee Chandra  ')).toBe('Yashaswinee');
            expect(getFirstName('Abodid')).toBe('Abodid');
            expect(getFirstName('')).toBe('there');
        });

        it('limits user-provided names so responsive headings remain stable', () => {
            expect(getFirstName('A'.repeat(80))).toHaveLength(40);
        });
    });

    describe('Action-oriented workflow presentation', () => {
        it('uses only the two plain-language workflow stages', () => {
            expect(WORKFLOW_STATUSES.map((status) => status.label)).toEqual([
                'Reviewing', 'Applied',
            ]);
            expect(normalizeOpportunityStatus('reviewing')).toBe('reviewing');
            expect(normalizeOpportunityStatus('applied')).toBe('applied');
            expect(formatStatusTitle('applied')).toBe('Applied');
        });

        it('keeps workflow filters exact and unambiguous', () => {
            expect(opportunityMatchesTrackerStatus('reviewing', 'reviewing')).toBe(true);
            expect(opportunityMatchesTrackerStatus('applied', 'applied')).toBe(true);
            expect(opportunityMatchesTrackerStatus('reviewing', 'applied')).toBe(false);
        });

        it('reserves red urgency for the final 48 hours', () => {
            const inHours = (hours: number) => new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
            expect(formatDaysRemaining(inHours(47), 'exact').level).toBe('critical');
            expect(formatDaysRemaining(inHours(72), 'exact').level).toBe('warning');
            expect(formatDaysRemaining(inHours(40 * 24), 'exact').level).toBe('neutral');
        });
    });

    describe('Attention selection', () => {
        const now = new Date('2026-09-24T00:00:00.000Z').getTime();
        const opportunity = (overrides: Partial<Opportunity> = {}) => ({
            id: 'attention-item',
            title: 'Opportunity',
            status: 'reviewing',
            is_high_priority: false,
            deadline_at: null,
            event_date: null,
            deadline_confidence: 'none',
            ...overrides,
        } as Opportunity);

        it('includes active opportunities due within seven days', () => {
            expect(isOpportunityAttention(opportunity({ deadline_at: '2026-09-30T00:00:00.000Z' }), now)).toBe(true);
            expect(isOpportunityAttention(opportunity({ deadline_at: '2026-10-02T00:00:00.000Z' }), now)).toBe(false);
        });

        it('includes high priorities while excluding applied items', () => {
            expect(isOpportunityAttention(opportunity({ is_high_priority: true }), now)).toBe(true);
            expect(isOpportunityAttention(opportunity({ is_high_priority: true, status: 'applied' }), now)).toBe(false);
        });

        it('identifies passed dates while preserving rolling and undated opportunities', () => {
            expect(isOpportunityPastDeadline(opportunity({ deadline_at: '2026-09-23T00:00:00.000Z' }), now)).toBe(true);
            expect(isOpportunityPastDeadline(opportunity({ deadline_at: '2026-09-25T00:00:00.000Z' }), now)).toBe(false);
            expect(isOpportunityPastDeadline(opportunity({ deadline_confidence: 'rolling' }), now)).toBe(false);
            expect(isOpportunityPastDeadline(opportunity(), now)).toBe(false);
        });

        it('puts the nearest high-priority work first', () => {
            const selected = selectAttentionOpportunities([
                opportunity({ id: 'standard-soon', deadline_at: '2026-09-26T00:00:00.000Z' }),
                opportunity({ id: 'priority-soon', is_high_priority: true, deadline_at: '2026-09-25T00:00:00.000Z' }),
            ], now);
            expect(selected.map((item) => item.id)).toEqual(['priority-soon', 'standard-soon']);
        });

        it('ranks reviewing work ahead of already applied items', () => {
            const reviewing = opportunity({ status: 'reviewing' });
            const applied = opportunity({ status: 'applied', is_high_priority: true });
            expect(opportunityAttentionScore(reviewing, now)).toBeLessThan(
                opportunityAttentionScore(applied, now),
            );
        });
    });

    describe('URL Canonicalization & Deduplication', () => {
        it('unwraps LinkedIn safety links before fetching or saving them', () => {
            const wrapped = 'https://www.linkedin.com/safety/go?url=https%3A%2F%2Fexample.org%2Fgrant%2F%3Futm_source%3Dlinkedin&trk=flagship';

            expect(unwrapOpportunityRedirect(wrapped)).toBe('https://example.org/grant/?utm_source=linkedin');
            expect(normalizeOpportunityCaptureUrl(wrapped)).toEqual({
                sourceUrl: 'https://example.org/grant/?utm_source=linkedin',
                canonicalUrl: 'https://example.org/grant',
            });
        });

        it('does not unwrap lookalike LinkedIn hosts', () => {
            const lookalike = 'https://linkedin.com.example.org/safety/go?url=https%3A%2F%2Fexample.org%2Fgrant';
            expect(unwrapOpportunityRedirect(lookalike)).toBe(lookalike);
        });

        it('rejects non-web protocols inside a safety redirect', () => {
            const wrapped = 'https://www.linkedin.com/safety/go?url=javascript%3Aalert%281%29';
            expect(() => unwrapOpportunityRedirect(wrapped)).toThrow('Unsupported URL protocol');
        });

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

        it('preserves useful JSON-LD fields from script-rendered opportunity pages', () => {
            const html = `
                <html><head>
                    <script type="application/ld+json">
                        {
                            "@context": "https://schema.org",
                            "@graph": [{
                                "@type": "JobPosting",
                                "title": "Creative Technologist",
                                "validThrough": "2027-02-10T23:59:00Z",
                                "hiringOrganization": { "@type": "Organization", "name": "Example Studio" }
                            }]
                        }
                    </script>
                </head><body><main><h1>Join our team</h1></main></body></html>
            `;
            const cleaned = cleanHtmlToText(html);

            expect(cleaned).toContain('STRUCTURED PAGE DATA');
            expect(cleaned).toContain('Creative Technologist');
            expect(cleaned).toContain('2027-02-10T23:59:00Z');
            expect(cleaned).toContain('Example Studio');
        });

        it('extracts a clean document title for server-side captures and re-extraction', () => {
            const title = extractHtmlTitle('<html><head><title>  Creative Grant 2027 | Example  </title></head></html>');
            expect(title).toBe('Creative Grant 2027 | Example');
        });

        it('preserves labelled deadline evidence when a long browser capture is truncated', () => {
            const longCapture = [
                'CURRENT PAGE: Example Opportunity',
                'A'.repeat(6500),
                'The application deadline is noon UK time on 15 January 2027.',
                'B'.repeat(7000),
                'LINK TARGETS: Apply: https://example.com/apply',
            ].join('\n\n');
            const prioritized = prioritizeOpportunityText(longCapture);

            expect(prioritized.length).toBeLessThanOrEqual(12000);
            expect(prioritized).toContain('application deadline is noon UK time on 15 January 2027');
            expect(prioritized).toContain('https://example.com/apply');
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

        it('parses unambiguous numeric dates without guessing ambiguous locale order', () => {
            expect(parseDeadline('31/01/2027', 'Europe/London').deadline_at)
                .toBe('2027-01-31T00:00:00.000Z');

            const ambiguous = parseDeadline('01/02/2027', null);
            expect(ambiguous.deadline_at).toBeNull();
            expect(ambiguous.deadline_confidence).toBe('needs_verification');
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

        it('parses a natural-language UK deadline with noon and daylight rules', () => {
            const winter = parseDeadline('The application deadline is noon (UK time) on 15 January 2027.', null);
            expect(winter.deadline_at).toBe('2027-01-15T12:00:00.000Z');
            expect(winter.deadline_timezone).toBe('Europe/London');
            expect(winter.deadline_confidence).toBe('exact');

            const summer = parseDeadline('Applications close at 5:30 pm UK time on 15 July 2027.', null);
            expect(summer.deadline_at).toBe('2027-07-15T16:30:00.000Z');

            const preciseDateWithVagueProgrammeSeason = parseDeadline(
                'Application deadline: 15 January 2027. The programme begins in summer 2027.',
                'Europe/London',
            );
            expect(preciseDateWithVagueProgrammeSeason.deadline_at).toBe('2027-01-15T00:00:00.000Z');
        });

        it('uses an explicitly labelled page deadline when the model omits or confuses it', () => {
            const pageText = `
                PhD Studentships in Transformative Humanities
                Information and Q&A session: 10 November 2026 at 11am UK time.
                The application deadline for this scheme is noon (UK time) on 15 January 2027.
                Successful applicants will be notified in March 2027.
            `;

            expect(extractExplicitDeadline(pageText)?.text).toContain('15 January 2027');

            const missingModelDeadline = resolveOpportunityDeadline(null, 'UK time', pageText);
            expect(missingModelDeadline.deadline_at).toBe('2027-01-15T12:00:00.000Z');

            const confusedModelDeadline = resolveOpportunityDeadline('2026-11-10T11:00:00+00:00', 'Europe/London', pageText);
            expect(confusedModelDeadline.deadline_at).toBe('2027-01-15T12:00:00.000Z');

            const wrongTimeOnCorrectDay = resolveOpportunityDeadline('2027-01-15T09:00:00+00:00', 'Europe/London', pageText);
            expect(wrongTimeOnCorrectDay.deadline_at).toBe('2027-01-15T12:00:00.000Z');
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
        it('ships complete server-side extraction instructions with the application', () => {
            const prompt = getExtractionSystemPrompt();
            expect(prompt).toContain('TARGET-SELECTION RULES (HIGHEST PRIORITY)');
            expect(prompt).toContain('Never put an application fee or submission charge in this field.');
            expect(prompt).toContain('If no application-fee information is stated, use null.');
            expect(prompt).toContain('Output strict JSON only.');
            expect(prompt.length).toBeGreaterThan(2_000);
        });

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
                application_fee: null,
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

    describe('Multi-user profile and saved-row boundaries', () => {
        it('normalizes names and rejects reserved route usernames', () => {
            expect(normalizeOpportunityUsername('Yashaswinee Sahoo')).toBe('yashaswineesahoo');
            expect(isValidOpportunityUsername('yashaswinee')).toBe(true);
            expect(isValidOpportunityUsername('settings')).toBe(false);
            expect(isValidOpportunityUsername('ab')).toBe(false);
        });

        it('round-trips the existing opportunity shape through one user-owned row', () => {
            const source = {
                id: 'saved-source',
                title: 'Creative Residency',
                organisation: 'Studio X',
                category: 'residency',
                source_url: 'https://example.com/residency',
                canonical_url: 'https://example.com/residency',
                deadline_at: '2027-01-01T00:00:00.000Z',
                deadline_raw: '1 January 2027',
                deadline_timezone: 'UTC',
                deadline_confidence: 'date_only',
                event_date: null,
                location: 'London',
                requirements: ['Portfolio'],
                completed_requirements: ['Portfolio'],
                next_action: 'Draft proposal',
                application_url: 'https://example.com/apply',
                meeting_url: null,
                fee_or_funding: 'Funded',
                application_fee: '£20',
                summary: 'A residency.',
                status: 'reviewing',
                outcome: null,
                created_at: '2026-10-01T00:00:00.000Z',
                updated_at: '2026-10-01T00:00:00.000Z',
                extracted_at: '2026-10-01T00:00:00.000Z',
                source_hash: 'hash',
                llm_model: 'model',
                llm_extraction_count: 1,
                notes: 'Private note',
                is_high_priority: true,
            } as Opportunity;
            const insert = opportunityToSavedInsert('user-a', source);
            const restored = savedRowToOpportunity({
                id: source.id,
                created_at: source.created_at,
                updated_at: source.updated_at,
                ...insert,
            });

            expect(restored.title).toBe(source.title);
            expect(restored.organisation).toBe(source.organisation);
            expect(restored.notes).toBe('Private note');
            expect(restored.is_high_priority).toBe(true);
            expect(restored.completed_requirements).toEqual(['Portfolio']);
            expect(restored.application_fee).toBe('£20');
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
            completed_requirements: [],
            next_action: 'Draft 500-word pitch',
            application_url: 'https://studiox.org/apply',
            meeting_url: null,
            fee_or_funding: '€3,000 stipend',
            application_fee: 'No application fee',
            summary: 'Two-month residency in Berlin for media artists.',
            status: 'reviewing',
            outcome: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            extracted_at: new Date().toISOString(),
            source_hash: null,
            llm_model: 'google/gemini-2.5-flash',
            llm_extraction_count: 1,
            notes: null,
            is_high_priority: false,
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
                completed_requirements: [],
                next_action: null,
                application_url: null,
                meeting_url: null,
                fee_or_funding: null,
                application_fee: null,
                summary: 'Residency cycle 00-10 at SAM studios.',
                status: 'reviewing',
                outcome: null,
                created_at: '',
                updated_at: '',
                extracted_at: '',
                source_hash: null,
                llm_model: null,
                llm_extraction_count: 0,
                notes: null,
                is_high_priority: false,
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
                completed_requirements: [],
                next_action: null,
                application_url: null,
                meeting_url: null,
                fee_or_funding: null,
                application_fee: null,
                summary: 'Grant for early career filmmakers.',
                status: 'reviewing',
                outcome: null,
                created_at: '',
                updated_at: '',
                extracted_at: '',
                source_hash: null,
                llm_model: null,
                llm_extraction_count: 0,
                notes: null,
                is_high_priority: false,
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
