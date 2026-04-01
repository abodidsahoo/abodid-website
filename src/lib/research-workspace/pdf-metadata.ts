import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import {
    normalizeWhitespace,
    pickBestSnippet,
    sanitizeFilename,
    toReadableTitle
} from './paper-utils';

const execFileAsync = promisify(execFile);
const RIGHTS_MESSAGE =
    'Curated by Abodid for reference purposes only. Not for resale or commercial use.';

let exiftoolAvailablePromise: Promise<boolean> | null = null;

type CuratedPdfMetadataInput = {
    displayTitle?: string | null;
    preferredFileName?: string | null;
    cleanFileName?: string | null;
    originalFileName: string;
    authors: string[];
    abstract: string | null;
    journal: string | null;
    doi: string | null;
    extractedPaper?: unknown;
    metadata?: unknown;
};

export type CuratedPdfMetadataPreview = {
    publisher: string | null;
    authorsLine: string | null;
    doi: string | null;
    abstract: string | null;
    rightsMessage: string;
};

export function buildCuratedPdfMetadataPreview(
    input: CuratedPdfMetadataInput
): CuratedPdfMetadataPreview {
    const publisher = extractPublisher(input);
    const authorsLine = input.authors
        .map((author) => normalizeWhitespace(author))
        .filter(Boolean)
        .join(', ') || null;
    const abstract = normalizeWhitespace(input.abstract || '') || null;

    return {
        publisher,
        authorsLine,
        doi: input.doi || null,
        abstract,
        rightsMessage: RIGHTS_MESSAGE
    };
}

export async function rewritePdfDownloadMetadata(
    buffer: Uint8Array,
    input: CuratedPdfMetadataInput,
    targetFileName: string
): Promise<Uint8Array> {
    if (!(await hasExiftool())) {
        return buffer;
    }

    const preview = buildCuratedPdfMetadataPreview(input);
    const title =
        normalizeWhitespace(input.displayTitle || '') ||
        toReadableTitle(
            input.preferredFileName ||
                input.cleanFileName ||
                input.originalFileName
        ) ||
        'Paper';
    const abstractText =
        preview.abstract ||
        buildCuratedSummary({
        title,
        abstract: input.abstract,
        extractedPaper: input.extractedPaper
    });
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'paper-renamer-metadata-'));
    const tempPath = path.join(
        tempDir,
        sanitizeFilename(targetFileName || input.preferredFileName || input.originalFileName)
    );

    try {
        await fs.writeFile(tempPath, buffer);

        const args = [
            '-overwrite_original',
            `-Title=${title}`,
            `-Author=${preview.authorsLine || ''}`,
            '-Subject=Abstract',
            `-Description=${abstractText}`,
            `-Comment=${preview.rightsMessage}`,
            `-Publisher=${preview.publisher || ''}`,
            `-Identifier=${input.doi || ''}`,
            `-UsageRightsMessage=${preview.rightsMessage}`,
            tempPath
        ];

        await execFileAsync('exiftool', args, {
            timeout: 20000,
            maxBuffer: 1024 * 1024
        });

        return new Uint8Array(await fs.readFile(tempPath));
    } catch (error) {
        console.error('[paper-renamer/pdf-metadata] rewrite failed:', error);
        return buffer;
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
}

async function hasExiftool(): Promise<boolean> {
    if (!exiftoolAvailablePromise) {
        exiftoolAvailablePromise = execFileAsync('which', ['exiftool'], {
            timeout: 5000
        })
            .then(({ stdout }) => Boolean(stdout.trim()))
            .catch(() => false);
    }

    return exiftoolAvailablePromise;
}

function buildCuratedSummary(input: {
    title: string;
    abstract: string | null;
    extractedPaper?: unknown;
}): string {
    const abstractSummary = input.abstract
        ? pickBestSnippet(normalizeWhitespace(input.abstract), 320)
        : null;
    const conclusionSummary = readSectionSummary(input.extractedPaper, 'conclusion');
    const conclusionSnippet = conclusionSummary
        ? pickBestSnippet(conclusionSummary, 220)
        : null;

    if (abstractSummary && conclusionSnippet && !isNearDuplicate(abstractSummary, conclusionSnippet)) {
        return normalizeWhitespace(`${abstractSummary} ${conclusionSnippet}`);
    }

    if (abstractSummary) {
        return abstractSummary;
    }

    if (conclusionSnippet) {
        return conclusionSnippet;
    }

    return `Curated research paper focused on ${input.title}.`;
}

function readSectionSummary(
    extractedPaper: unknown,
    field: 'abstract' | 'conclusion'
): string | null {
    const record = asRecord(extractedPaper);
    if (!record) {
        return null;
    }

    if (field === 'abstract') {
        return asString(record.abstract);
    }

    const section = asRecord(record.conclusion);
    if (!section) {
        return null;
    }

    return cleanSectionText(asString(section.summary));
}

function cleanSectionText(value: string | null): string | null {
    if (!value) {
        return null;
    }

    return normalizeWhitespace(value.replace(/\[Page\s+\d+\]\s*/gi, ' '));
}

function extractPublisher(input: CuratedPdfMetadataInput): string | null {
    if (input.journal?.trim()) {
        return normalizeWhitespace(input.journal);
    }

    const metadata = asRecord(input.metadata);
    const linkMetadata = asRecord(metadata?.linkMetadata);
    return asString(linkMetadata?.journal);
}

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }

    return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }

    const normalized = normalizeWhitespace(value);
    return normalized || null;
}

function isNearDuplicate(left: string, right: string): boolean {
    const leftKey = left.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const rightKey = right.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

    return leftKey === rightKey || leftKey.includes(rightKey) || rightKey.includes(leftKey);
}
