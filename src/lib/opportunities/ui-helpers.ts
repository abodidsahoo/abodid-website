import type { Opportunity, OpportunityCategory, OpportunityStatus } from './types';

/**
 * Formats deadline into prominent, human days remaining text.
 * e.g. "31 days left", "Tomorrow", "6 hours left", "Rolling deadline", "Past deadline"
 */
export function formatDaysRemaining(deadlineAt: string | null | undefined, confidence?: string): {
    label: string;
    level: 'critical' | 'warning' | 'neutral' | 'rolling' | 'expired';
} {
    if (confidence === 'rolling') {
        return { label: 'Rolling deadline', level: 'rolling' };
    }

    if (!deadlineAt) {
        if (confidence === 'needs_verification') {
            return { label: 'Needs verification', level: 'warning' };
        }
        return { label: 'No deadline set', level: 'neutral' };
    }

    const now = Date.now();
    const deadlineTime = new Date(deadlineAt).getTime();
    if (isNaN(deadlineTime)) {
        return { label: 'Invalid date', level: 'neutral' };
    }

    const diffMs = deadlineTime - now;

    if (diffMs < 0) {
        return { label: 'Past deadline', level: 'expired' };
    }

    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) {
        const mins = Math.max(1, Math.floor(diffMs / (1000 * 60)));
        return { label: `${mins}m left`, level: 'critical' };
    }
    if (diffHours <= 24) {
        const hrs = Math.floor(diffHours);
        return { label: `${hrs} hours left`, level: 'critical' };
    }
    if (diffDays === 1) {
        return { label: 'Tomorrow', level: 'critical' };
    }
    if (diffDays <= 3) {
        return { label: `${diffDays} days left`, level: 'critical' };
    }
    if (diffDays <= 7) {
        return { label: `${diffDays} days left`, level: 'warning' };
    }

    return { label: `${diffDays} days left`, level: 'neutral' };
}

/**
 * Live formatted preview for calendar date picker in modals.
 * e.g. "17 Oct 2026 · 31 days remaining"
 */
export function formatLiveDatePreview(dateStr: string | null | undefined): string | null {
    if (!dateStr || !dateStr.trim()) return null;

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;

    const formattedDate = date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });

    const now = Date.now();
    const diffMs = date.getTime() - now;

    let remainingText = '';
    if (diffMs < 0) {
        remainingText = 'Past deadline';
    } else {
        const diffHours = diffMs / (1000 * 60 * 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffHours <= 24) {
            remainingText = 'Today';
        } else if (diffDays === 1) {
            remainingText = 'Tomorrow (1 day left)';
        } else {
            remainingText = `${diffDays} days remaining`;
        }
    }

    return `${formattedDate} · ${remainingText}`;
}

/**
 * Extracts real eligibility restrictions if they actually exist in requirements, location, or summary.
 * Returns empty array if no eligibility rules exist.
 */
export function extractEligibility(opp: Opportunity): string[] {
    const items: string[] = [];
    const textPool = [
        ...(opp.requirements || []),
        opp.location || '',
        opp.summary || '',
        opp.notes || '',
    ].join(' ');

    if (!textPool.trim()) return [];

    // Strict Age restrictions e.g. "Age 18–35", "Ages 21 to 40", "aged 18 to 35", "under 35 years old", "18-30 years"
    // Must contain explicit "age/ages/aged" or "years old" and valid adult/youth numbers (min >= 16, max <= 85)
    const explicitAgeRange = textPool.match(/\b(?:age[sd]?\s*(?:limit|range)?\s*[:]?\s*)(\d{2})\s*(?:[-–]|to|\s*[-–]\s*)\s*(\d{2})\b/i);
    const yearsOldRange = textPool.match(/\b(\d{2})\s*(?:[-–]|to|\s*[-–]\s*)\s*(\d{2})\s*(?:years?\s*(?:old)?|yo)\b/i);
    const underAge = textPool.match(/\bunder\s*(?:the\s*age\s*of\s*)?(\d{2})\s*(?:years?\s*old)?\b/i);
    const over18 = textPool.match(/\b(?:18\s*\+|21\s*\+|adults?\s*18\+)\b/i);

    if (explicitAgeRange) {
        const min = parseInt(explicitAgeRange[1], 10);
        const max = parseInt(explicitAgeRange[2], 10);
        if (min >= 16 && max <= 85 && min < max) {
            items.push(`Age ${min}–${max}`);
        }
    } else if (yearsOldRange) {
        const min = parseInt(yearsOldRange[1], 10);
        const max = parseInt(yearsOldRange[2], 10);
        if (min >= 16 && max <= 85 && min < max) {
            items.push(`Age ${min}–${max}`);
        }
    } else if (underAge) {
        const max = parseInt(underAge[1], 10);
        if (max >= 18 && max <= 45) {
            items.push(`Under ${max}`);
        }
    } else if (over18) {
        items.push('18+ only');
    }

    // Nationality & Region restrictions
    const regions = [
        { regex: /\b(singapore(?:\s+citizens?|\s+prs?|\s+residents?|\s+only)?)\b/i, label: 'Singapore only' },
        { regex: /\b(india(?:\s+only|\s+residents|\s+citizens)?)\b/i, label: 'India only' },
        { regex: /\b(uk(?:\s+residents|\s+only|\s+citizens)?|united kingdom)\b/i, label: 'UK residents' },
        { regex: /\b(eu\/eea|european union|eea citizens?)\b/i, label: 'EU/EEA' },
        { regex: /\b(us(?:\s+citizens|\s+residents|\s+only)?|united states)\b/i, label: 'US only' },
        { regex: /\b(southeast asia|asean(?:\s+region|\s+citizens)?)\b/i, label: 'Southeast Asia' },
        { regex: /\b(global|international|worldwide(?:\s+applicants)?|open worldwide|all nationalities)\b/i, label: 'Worldwide' },
    ];

    for (const r of regions) {
        if (r.regex.test(textPool) && !items.includes(r.label)) {
            items.push(r.label);
            break; // take first matched geographic scope
        }
    }

    // Career Stage & Discipline restrictions
    const stages = [
        { regex: /\b(emerging(?:\s+artists?|\s+filmmakers?|\s+writers?|\s+creatives?)?|early[- ]career)\b/i, label: 'Early Career' },
        { regex: /\b(mid[- ]career)\b/i, label: 'Mid Career' },
        { regex: /\b(students?|undergraduates?|postgraduates?|phd\s*candidates?)\b/i, label: 'Students' },
        { regex: /\b(women(?:\s+only|\s+filmmakers|\s+artists)?|female-identifying)\b/i, label: 'Women only' },
    ];

    for (const s of stages) {
        if (s.regex.test(textPool) && !items.includes(s.label)) {
            items.push(s.label);
            break;
        }
    }

    return items.slice(0, 3); // Max 3 concise badges
}

/**
 * Natural sentence/title capitalization for categories
 */
export function formatCategoryTitle(category: OpportunityCategory | string): string {
    switch (category) {
        case 'open_call': return 'Open Call';
        case 'job': return 'Job';
        case 'residency': return 'Residency';
        case 'grant': return 'Grant';
        case 'fellowship': return 'Fellowship';
        case 'conference': return 'Conference';
        case 'event': return 'Event';
        default: return 'Other';
    }
}

/**
 * Natural sentence/title capitalization for workflow statuses
 */
export function formatStatusTitle(status: OpportunityStatus | string): string {
    switch (status) {
        case 'inbox': return 'Inbox';
        case 'interested': return 'Interested';
        case 'preparing': return 'Preparing';
        case 'submitted': return 'Submitted';
        case 'registered': return 'Registered';
        case 'attending': return 'Attending';
        case 'done': return 'Done';
        case 'dismissed': return 'Dismissed';
        default: return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Inbox';
    }
}

const LOWERCASE_WORDS = new Set([
    'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'nor', 'of', 'on', 'or', 'so', 'the', 'to', 'up', 'yet', 'via', 'with', 'from', '&'
]);

const PRESERVED_ACRONYMS = new Set([
    'AI', 'VR', 'AR', 'XR', 'UI', 'UX', 'SAM', 'MIT', 'EU', 'UK', 'US', 'USA', 'NYC', 'PDF', 'PR', 'ID', 'LLM', 'ML', 'NFT', 'CERN', 'NASA', 'UNESCO', 'DAAD', 'NEA', 'NEH', 'IRCAM', 'ZKM', 'V&A'
]);

/**
 * Automatically converts shouting ALL-CAPS titles into natural, clean Title Case
 * while preserving acronyms (AI, SAM, VR, MIT), hyphens, and year numbers (2027-28).
 * e.g. "RESEARCH-CREATION RESIDENCY PROGRAM IN ARTS & TECHNOLOGIES – 2027-28"
 * -> "Research-Creation Residency Program in Arts & Technologies – 2027-28"
 */
export function formatOpportunityTitle(rawTitle: string | null | undefined): string {
    if (!rawTitle || !rawTitle.trim()) return 'Untitled Opportunity';

    const trimmed = rawTitle.trim();

    // Check if the title is predominantly uppercase (more than 70% of alphabetic letters are uppercase)
    const letters = trimmed.replace(/[^a-zA-Z]/g, '');
    const isAllOrMostlyUpper = letters.length > 3 && (letters.replace(/[^A-Z]/g, '').length / letters.length) > 0.7;

    if (!isAllOrMostlyUpper) {
        return trimmed;
    }

    // Split words by space or hyphens/dashes while preserving delimiters
    const tokens = trimmed.split(/(\s+|[-–—/])/);

    let isFirstWord = true;

    const formattedTokens = tokens.map((token) => {
        // If it's whitespace or punctuation delimiter, keep as is
        if (/^(\s+|[-–—/]+)$/.test(token)) {
            return token;
        }

        const upperToken = token.toUpperCase();
        const cleanUpper = upperToken.replace(/[^a-zA-Z0-9&]/g, '');
        if (PRESERVED_ACRONYMS.has(cleanUpper)) {
            isFirstWord = false;
            return upperToken;
        }

        const lowerToken = token.toLowerCase();
        const cleanLower = lowerToken.replace(/[^a-zA-Z0-9&]/g, '');

        // Check if it's a number range like 2027-28 or 2026
        if (/^\d{2,4}(?:[-–]\d{2,4})?$/.test(cleanLower)) {
            isFirstWord = false;
            return token;
        }

        if (!isFirstWord && LOWERCASE_WORDS.has(cleanLower)) {
            return lowerToken;
        }

        isFirstWord = false;
        // Capitalize first alphabetic character, keeping any leading punctuation
        return lowerToken.replace(/^([^a-zA-Z]*)([a-zA-Z])(.*)$/, (_, lead, char, rest) => lead + char.toUpperCase() + rest);
    });

    return formattedTokens.join('');
}
