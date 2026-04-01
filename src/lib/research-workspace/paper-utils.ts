import { createHash, randomBytes } from 'node:crypto';
import type {
    PageProvenance,
    PaperInsightSummary,
    UploadSource
} from './contracts';

const STOP_WORDS = new Set([
    'a',
    'an',
    'and',
    'are',
    'as',
    'at',
    'be',
    'by',
    'for',
    'from',
    'how',
    'in',
    'is',
    'of',
    'on',
    'or',
    'that',
    'the',
    'to',
    'with'
]);

export type PaperMetadataSeed = {
    title?: string | null;
    authors?: string[] | null;
    year?: number | null;
};

export function normalizeWhitespace(value: string): string {
    return value
        .replace(/\r/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
}

export function toReadableTitle(value: string): string {
    return normalizeWhitespace(
        value
            .replace(/\.pdf$/i, '')
            .replace(/[_-]+/g, ' ')
    )
        .split(' ')
        .filter(Boolean)
        .map((segment) => {
            if (/^[A-Z0-9]{2,}$/.test(segment)) {
                return segment;
            }

            return segment.charAt(0).toUpperCase() + segment.slice(1);
        })
        .join(' ');
}

export function slugify(value: string): string {
    return value
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^\w\s-]/g, '')
        .replace(/_/g, ' ')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export function sanitizeFilename(value: string): string {
    const base = slugify(value.replace(/\.pdf$/i, '')).slice(0, 96) || 'paper';
    return `${base}.pdf`;
}

export function extractFirstAuthorLastName(authors: string[]): string | null {
    const firstAuthor = authors.find((author) => author.trim().length > 0);

    if (!firstAuthor) {
        return null;
    }

    const normalized = normalizeWhitespace(firstAuthor);
    const suffixes = new Set(['jr', 'sr', 'ii', 'iii', 'iv']);

    if (normalized.includes(',')) {
        const leadingSegment = normalized
            .split(',')
            .map((part) => normalizeWhitespace(part))
            .find(Boolean);
        const leadingParts = leadingSegment?.split(/\s+/).filter(Boolean) || [];
        const leadingLastName = leadingParts
            .filter((part) => !suffixes.has(part.toLowerCase()))
            .at(-1);

        if (leadingLastName) {
            return slugify(leadingLastName) || null;
        }
    }

    const parts = normalized
        .replace(/[.,]/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .filter((part) => !suffixes.has(part.toLowerCase()));

    if (parts.length === 0) {
        return null;
    }

    const nonInitialParts = parts.filter((part) => !/^[A-Z]$/i.test(part));
    const lastName = nonInitialParts.at(-1) || parts.at(-1);

    return lastName ? slugify(lastName) || null : null;
}

export function buildCleanFilename(
    metadata: PaperMetadataSeed,
    fallbackTitle: string
): string {
    const safeTitle = metadata.title?.trim() || fallbackTitle.trim() || 'research-paper';
    const titleTokens = safeTitle
        .replace(/[^A-Za-z0-9\s-]/g, ' ')
        .split(/\s+/)
        .map((token) => token.toLowerCase())
        .filter((token) => token && !STOP_WORDS.has(token))
        .slice(0, 8);

    const parts = [
        extractFirstAuthorLastName(metadata.authors ?? []) || null,
        metadata.year ? String(metadata.year) : null,
        titleTokens.length > 0 ? titleTokens.join('-') : slugify(safeTitle).slice(0, 52) || null
    ].filter((part): part is string => Boolean(part));

    return sanitizeFilename(parts.join('-') || safeTitle);
}

export function ensurePdfExtension(value: string): string {
    return value.toLowerCase().endsWith('.pdf') ? value : `${value}.pdf`;
}

export function uniqueFilename(baseFileName: string): string {
    const base = baseFileName.replace(/\.pdf$/i, '');
    const suffix = randomBytes(2).toString('hex');
    return `${base}-${suffix}.pdf`;
}

export function hashPdfBuffer(buffer: Uint8Array): string {
    return createHash('sha256').update(buffer).digest('hex');
}

export function getSourceLabel(
    source: UploadSource,
    sourceUrl: string | null
): string {
    if (source === 'file') {
        return 'Uploaded PDF';
    }

    if (!sourceUrl) {
        return 'Imported paper link';
    }

    try {
        const url = new URL(sourceUrl);
        return `Imported from ${url.hostname.replace(/^www\./, '')}`;
    } catch (_error) {
        return 'Imported paper link';
    }
}

export function extractYear(value: string): number | null {
    const match = value.match(/(?:19|20)\d{2}/);
    if (!match) {
        return null;
    }

    const year = Number(match[0]);
    return Number.isFinite(year) ? year : null;
}

export function buildDownloadUrl(
    paperId: string,
    variant: 'original' | 'clean'
): string {
    return `/api/paper-renamer/papers/${paperId}/download?variant=${variant}`;
}

export function buildPrintTitle(summary: PaperInsightSummary | null, title: string): string {
    if (!summary) {
        return title;
    }

    return `${title} Summary`;
}

export function compressText(value: string, maxLength: number): string {
    const normalized = normalizeWhitespace(value);
    if (normalized.length <= maxLength) {
        return normalized;
    }

    return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

export function pickBestSnippet(
    text: string,
    maxLength = 340
): string {
    const normalized = normalizeWhitespace(text);
    if (!normalized) {
        return '';
    }

    const sentenceMatch = normalized.match(/[^.!?]+[.!?]+/g);
    if (sentenceMatch?.length) {
        const combined = sentenceMatch.slice(0, 2).join(' ').trim();
        return compressText(combined, maxLength);
    }

    return compressText(normalized, maxLength);
}

export function mergeProvenance(items: PageProvenance[]): PageProvenance[] {
    const seen = new Map<string, PageProvenance>();

    for (const item of items) {
        const key = `${item.pageNumber}:${item.extractionType}`;
        if (!seen.has(key)) {
            seen.set(key, item);
        }
    }

    return Array.from(seen.values()).sort((left, right) => left.pageNumber - right.pageNumber);
}

export function stripReferenceSection(text: string): string {
    const match = text.search(/\n(?:references|bibliography)\n/i);
    if (match === -1) {
        return text;
    }

    return text.slice(0, match).trim();
}

export function inferTitleFromFilename(fileName: string): string {
    const cleaned = fileName.replace(/\.pdf$/i, '').replace(/[._-]+/g, ' ');
    return toReadableTitle(cleaned);
}
