import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import * as cheerio from 'cheerio';
import { z } from 'zod';
import type {
    ExtractedPage,
    UploadSource
} from './contracts';
import {
    buildCleanFilename,
    compressText,
    ensurePdfExtension,
    extractYear,
    inferTitleFromFilename,
    normalizeWhitespace,
    pickBestSnippet,
    stripReferenceSection
} from './paper-utils';

const execFileAsync = promisify(execFile);

const DOI_REGEX = /10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i;
const MAX_PDF_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_OCR_PAGES = 12;
const AUTHOR_LINE_STOP_PATTERN =
    /\b(abstract|keywords?|introduction|doi|received|accepted|published|copyright|license|university|department|faculty|school|institute|hospital|correspondence|email|@|http|www)\b/i;
const AUTHOR_SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv']);
const AUTHOR_NAME_PARTICLES = new Set([
    'al',
    'bin',
    'da',
    'de',
    'del',
    'den',
    'der',
    'di',
    'la',
    'le',
    'van',
    'von'
]);
const IDENTITY_MODEL_CANDIDATES = parseModelEnv(
    import.meta.env.OPENROUTER_PAPER_IDENTITY_MODELS ||
        import.meta.env.OPENROUTER_PAPER_RENAMER_MODELS ||
        import.meta.env.OPENROUTER_RESEARCH_MODELS,
    [
        'openai/gpt-5.2',
        'anthropic/claude-3.5-sonnet',
        'google/gemini-1.5-pro',
        'openrouter/auto',
        'openai/gpt-4o-mini'
    ]
);

const paperIdentityResponseSchema = z.object({
    title: z.string().nullable().default(null),
    authors: z.array(z.string()).default([]),
    year: z.number().int().nullable().default(null),
    journal: z.string().nullable().default(null)
});

type LinkMetadata = {
    title: string | null;
    authors: string[];
    year: number | null;
    journal: string | null;
    abstract: string | null;
    doi: string | null;
};

type PdfInfoMetadata = {
    title: string | null;
    author: string | null;
    subject: string | null;
    creator: string | null;
    creationDate: string | null;
    pages: number | null;
    raw: string;
};

type PreparedPaperImport = {
    sourceType: UploadSource;
    sourceUrl: string | null;
    linkResolvedFrom: string | null;
    originalFileName: string;
    contentType: string;
    buffer: Uint8Array;
    metadata: LinkMetadata;
};

export type ProcessedPaper = {
    sourceType: UploadSource;
    sourceUrl: string | null;
    linkResolvedFrom: string | null;
    originalFileName: string;
    contentType: string;
    buffer: Uint8Array;
    displayTitle: string;
    cleanFileName: string;
    preferredFileName: string;
    doi: string | null;
    authors: string[];
    year: number | null;
    journal: string | null;
    abstract: string | null;
    metadata: Record<string, unknown>;
    pageMap: ExtractedPage[];
    extractedPaper: Record<string, unknown>;
    warnings: string[];
    extractedWithOcr: boolean;
    ocrStatus: 'not_needed' | 'used' | 'partial';
};

type ResolvedPaperIdentity = {
    title: string | null;
    authors: string[];
    year: number | null;
    journal: string | null;
    modelLabel: string;
};

const commandAvailability = new Map<string, Promise<boolean>>();

export async function preparePaperFromUpload(file: File): Promise<ProcessedPaper> {
    const originalFileName = ensurePdfExtension(file.name || 'uploaded-paper.pdf');
    const contentType = file.type || 'application/pdf';

    if (!originalFileName.toLowerCase().endsWith('.pdf') || contentType === 'text/plain') {
        throw new Error('This file is not a supported PDF.');
    }

    const buffer = new Uint8Array(await file.arrayBuffer());
    validatePdfBytes(buffer);

    return processPdfImport({
        sourceType: 'file',
        sourceUrl: null,
        linkResolvedFrom: null,
        originalFileName,
        contentType: 'application/pdf',
        buffer,
        metadata: {
            title: null,
            authors: [],
            year: null,
            journal: null,
            abstract: null,
            doi: null
        }
    });
}

export async function preparePaperFromLink(sourceUrl: string): Promise<ProcessedPaper> {
    const prepared = await resolveLinkImport(sourceUrl);
    return processPdfImport(prepared);
}

async function processPdfImport(prepared: PreparedPaperImport): Promise<ProcessedPaper> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'research-workspace-'));
    const tempPdfPath = path.join(tempDir, path.basename(prepared.originalFileName));
    const warnings: string[] = [];

    try {
        await fs.writeFile(tempPdfPath, prepared.buffer);

        const pdfInfo = await readPdfInfo(tempPdfPath);
        const pageMap = await extractPages(tempPdfPath, pdfInfo.pages ?? 1, warnings);
        const combinedText = stripReferenceSection(
            pageMap
                .map((page) => `[Page ${page.pageNumber}]\n${page.text}`)
                .join('\n\n')
        );

        const firstPageText = pageMap[0]?.text || '';
        const titleCandidates = dedupeStrings([
            prepared.metadata.title || '',
            normalizeCandidateTitle(pdfInfo.title) || '',
            detectTitleFromPage(firstPageText) || '',
            inferTitleFromFilename(prepared.originalFileName)
        ]);
        const heuristicDisplayTitle =
            titleCandidates[0] || inferTitleFromFilename(prepared.originalFileName);

        const heuristicAuthors =
            firstNonEmptyList(
                normalizeAuthorList(prepared.metadata.authors),
                normalizeAuthorList(splitAuthors(pdfInfo.author)),
                detectAuthorsFromPage(firstPageText, heuristicDisplayTitle)
            );

        const heuristicYear =
            prepared.metadata.year ||
            extractYear(pdfInfo.creationDate || '') ||
            detectYearFromText(firstPageText);

        const heuristicJournal =
            prepared.metadata.journal ||
            normalizeCandidateText(pdfInfo.subject) ||
            null;

        const abstract =
            prepared.metadata.abstract ||
            detectAbstractFromPages(pageMap) ||
            null;

        const doi =
            normalizeDoi(prepared.metadata.doi) ||
            detectDoiFromText(combinedText) ||
            null;
        const identityResolution = await resolvePaperIdentityWithOpenRouter({
            originalFileName: prepared.originalFileName,
            linkMetadata: prepared.metadata,
            pdfInfo,
            heuristicTitle: heuristicDisplayTitle,
            heuristicAuthors,
            heuristicYear,
            heuristicJournal,
            doi,
            firstPageText,
            secondPageText: pageMap[1]?.text || '',
            abstract
        });
        const displayTitle = identityResolution?.title || heuristicDisplayTitle;
        const authors =
            identityResolution?.authors.length
                ? identityResolution.authors
                : heuristicAuthors;
        const year = identityResolution?.year || heuristicYear;
        const journal = identityResolution?.journal || heuristicJournal;

        if (!displayTitle || displayTitle === inferTitleFromFilename(prepared.originalFileName)) {
            warnings.push(
                'We could not detect a full title confidently, so the clean name uses a shorter fallback.'
            );
        }

        if (authors.length === 0) {
            warnings.push('Author metadata was not clearly found.');
        }

        if (!year) {
            warnings.push('Publication year was not clearly found.');
        }

        if (!abstract) {
            warnings.push('Abstract was not clearly found.');
        }

        if (pageMap.every((page) => page.text.length < 120)) {
            warnings.push('We could not read enough text from this file for strong insights.');
        }

        const cleanFileName = buildCleanFilename(
            {
                title: displayTitle,
                authors,
                year
            },
            displayTitle
        );

        const weakPages = pageMap
            .filter((page) => !page.text || isWeakPageText(page.text))
            .map((page) => page.pageNumber);
        const extractedWithOcr = pageMap.some((page) => page.extractionType !== 'native');
        const extractedPaper = buildStructuredPaperData({
            displayTitle,
            titleCandidates,
            doi,
            authors,
            year,
            abstract,
            journal,
            pageMap
        });
        const ocrStatus =
            extractedWithOcr && weakPages.length > 0
                ? 'partial'
                : extractedWithOcr
                    ? 'used'
                    : 'not_needed';

        return {
            sourceType: prepared.sourceType,
            sourceUrl: prepared.sourceUrl,
            linkResolvedFrom: prepared.linkResolvedFrom,
            originalFileName: prepared.originalFileName,
            contentType: prepared.contentType,
            buffer: prepared.buffer,
            displayTitle,
            cleanFileName,
            preferredFileName: cleanFileName,
            doi,
            authors,
            year,
            journal,
            abstract,
            metadata: {
                linkMetadata: prepared.metadata,
                pdfInfo,
                identityResolution: identityResolution
                    ? {
                        usedOpenRouter: true,
                        modelLabel: identityResolution.modelLabel,
                        title: identityResolution.title,
                        authors: identityResolution.authors,
                        year: identityResolution.year,
                        journal: identityResolution.journal
                    }
                    : {
                        usedOpenRouter: false,
                        modelLabel: null
                    },
                textPreview: pickBestSnippet(combinedText, 480),
                weakPages,
                titleCandidates
            },
            pageMap,
            extractedPaper,
            warnings: dedupeStrings(warnings),
            extractedWithOcr,
            ocrStatus
        };
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
    }
}

async function resolveLinkImport(sourceUrl: string): Promise<PreparedPaperImport> {
    let parsedUrl: URL;

    try {
        parsedUrl = new URL(sourceUrl.trim());
    } catch (_error) {
        throw new Error('We could not access that paper link.');
    }

    const response = await fetch(parsedUrl.toString(), {
        redirect: 'follow',
        headers: {
            Accept: 'application/pdf,text/html;q=0.9,*/*;q=0.8',
            'User-Agent': 'Abodid Paper Renamer/1.0'
        }
    });

    if (!response.ok) {
        throw new Error('We could not access that paper link.');
    }

    const finalUrl = response.url || parsedUrl.toString();
    const contentType = response.headers.get('content-type') || '';

    if (isPdfResponse(finalUrl, contentType)) {
        const buffer = new Uint8Array(await response.arrayBuffer());
        validatePdfBytes(buffer);

        return {
            sourceType: 'link',
            sourceUrl: sourceUrl.trim(),
            linkResolvedFrom: finalUrl !== sourceUrl.trim() ? finalUrl : null,
            originalFileName: getFilenameFromResponse(response, finalUrl),
            contentType: 'application/pdf',
            buffer,
            metadata: {
                title: null,
                authors: [],
                year: null,
                journal: null,
                abstract: null,
                doi: null
            }
        };
    }

    const html = await response.text();
    const { metadata, pdfUrl } = extractMetadataAndPdfUrl(html, finalUrl);
    const resolvedPdfUrl = resolvePdfUrl(parsedUrl.toString(), finalUrl, pdfUrl);

    if (!resolvedPdfUrl) {
        throw new Error('We could not access that paper link.');
    }

    const pdfResponse = await fetch(resolvedPdfUrl, {
        redirect: 'follow',
        headers: {
            Accept: 'application/pdf,*/*',
            'User-Agent': 'Abodid Paper Renamer/1.0'
        }
    });

    if (!pdfResponse.ok) {
        throw new Error('We could not access that paper link.');
    }

    const pdfContentType = pdfResponse.headers.get('content-type') || '';
    if (!isPdfResponse(pdfResponse.url || resolvedPdfUrl, pdfContentType)) {
        throw new Error('No downloadable PDF was confirmed for this link.');
    }

    const buffer = new Uint8Array(await pdfResponse.arrayBuffer());
    validatePdfBytes(buffer);

    return {
        sourceType: 'link',
        sourceUrl: sourceUrl.trim(),
        linkResolvedFrom:
            (pdfResponse.url || resolvedPdfUrl) !== sourceUrl.trim()
                ? pdfResponse.url || resolvedPdfUrl
                : finalUrl !== sourceUrl.trim()
                    ? finalUrl
                    : null,
        originalFileName: getFilenameFromResponse(pdfResponse, pdfResponse.url || resolvedPdfUrl),
        contentType: 'application/pdf',
        buffer,
        metadata
    };
}

function extractMetadataAndPdfUrl(
    html: string,
    pageUrl: string
): {
    metadata: LinkMetadata;
    pdfUrl: string | null;
} {
    const $ = cheerio.load(html);

    const meta = (name: string): string | null => {
        const selectors = [
            `meta[name="${name}"]`,
            `meta[property="${name}"]`
        ];

        for (const selector of selectors) {
            const value = $(selector).attr('content')?.trim();
            if (value) {
                return value;
            }
        }

        return null;
    };

    const authorValues = [
        ...$('meta[name="citation_author"]')
            .map((_, element) => $(element).attr('content')?.trim() || '')
            .get(),
        ...$('meta[name="dc.creator"]')
            .map((_, element) => $(element).attr('content')?.trim() || '')
            .get()
    ].filter(Boolean);

    const publicationDate =
        meta('citation_publication_date') ||
        meta('dc.date') ||
        meta('article:published_time');

    const pdfCandidate =
        meta('citation_pdf_url') ||
        $('link[type="application/pdf"]').attr('href') ||
        $('a[href$=".pdf"]').first().attr('href') ||
        (pageUrl.includes('arxiv.org/abs/')
            ? pageUrl.replace('/abs/', '/pdf/') + '.pdf'
            : null);

    return {
        metadata: {
            title:
                meta('citation_title') ||
                meta('dc.title') ||
                meta('og:title') ||
                $('title').text().trim() ||
                null,
            authors: authorValues,
            year: publicationDate ? extractYear(publicationDate) : null,
            journal:
                meta('citation_journal_title') ||
                meta('citation_conference_title') ||
                meta('og:site_name') ||
                null,
            abstract:
                meta('citation_abstract') ||
                meta('description') ||
                meta('og:description') ||
                null,
            doi:
                normalizeDoi(meta('citation_doi')) ||
                normalizeDoi(meta('dc.identifier')) ||
                normalizeDoi(meta('citation_arxiv_id'))
        },
        pdfUrl: pdfCandidate || null
    };
}

function resolvePdfUrl(
    sourceUrl: string,
    pageUrl: string,
    pdfUrl: string | null
): string | null {
    if (!pdfUrl) {
        return null;
    }

    try {
        return new URL(pdfUrl, pageUrl).toString();
    } catch (_error) {
        try {
            return new URL(pdfUrl, sourceUrl).toString();
        } catch (_nextError) {
            return null;
        }
    }
}

async function extractPages(
    pdfPath: string,
    pageCount: number,
    warnings: string[]
): Promise<ExtractedPage[]> {
    const totalPages = Math.max(1, Math.min(pageCount, 300));
    const pages: ExtractedPage[] = [];
    let ocrPageCount = 0;

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
        const nativeText = await extractNativePageText(pdfPath, pageNumber);
        const shouldUseOcr =
            isWeakPageText(nativeText) &&
            ocrPageCount < MAX_OCR_PAGES &&
            (await hasCommand('pdftoppm')) &&
            (await hasCommand('tesseract'));

        let ocrText = '';
        if (shouldUseOcr) {
            ocrText = await extractOcrPageText(pdfPath, pageNumber).catch(() => '');
            if (ocrText) {
                ocrPageCount += 1;
            }
        }

        const finalText = chooseBestPageText(nativeText, ocrText);
        const extractionType =
            nativeText && ocrText
                ? 'mixed'
                : ocrText
                    ? 'ocr'
                    : 'native';

        pages.push({
            pageNumber,
            extractionType,
            confidence: scorePageConfidence(finalText),
            text: finalText,
            nativeLength: nativeText.length,
            ocrLength: ocrText.length,
            wasOcrAttempted: shouldUseOcr
        });
    }

    if (ocrPageCount > 0) {
        warnings.push('OCR was used on image-heavy or weak pages.');
    }

    if (ocrPageCount >= MAX_OCR_PAGES) {
        warnings.push('Some scanned pages were difficult to interpret, so OCR was capped.');
    }

    return pages;
}

async function readPdfInfo(pdfPath: string): Promise<PdfInfoMetadata> {
    if (!(await hasCommand('pdfinfo'))) {
        return {
            title: null,
            author: null,
            subject: null,
            creator: null,
            creationDate: null,
            pages: null,
            raw: ''
        };
    }

    const { stdout } = await execFileAsync('pdfinfo', [pdfPath], {
        timeout: 20000,
        maxBuffer: 1024 * 1024
    });

    const readField = (label: string): string | null => {
        const match = stdout.match(new RegExp(`^${label}:\\s*(.+)$`, 'im'));
        return match?.[1]?.trim() || null;
    };

    return {
        title: readField('Title'),
        author: readField('Author'),
        subject: readField('Subject'),
        creator: readField('Creator'),
        creationDate: readField('CreationDate') || readField('ModDate'),
        pages: Number(readField('Pages')) || null,
        raw: stdout
    };
}

async function extractNativePageText(pdfPath: string, pageNumber: number): Promise<string> {
    if (!(await hasCommand('pdftotext'))) {
        return '';
    }

    const outputPath = path.join(
        os.tmpdir(),
        `research-page-${pageNumber}-${Date.now()}.txt`
    );

    try {
        await execFileAsync(
            'pdftotext',
            ['-f', String(pageNumber), '-l', String(pageNumber), '-layout', pdfPath, outputPath],
            {
                timeout: 20000,
                maxBuffer: 2 * 1024 * 1024
            }
        );

        const value = await fs.readFile(outputPath, 'utf8').catch(() => '');
        return normalizeWhitespace(value);
    } catch (_error) {
        return '';
    } finally {
        await fs.rm(outputPath, { force: true }).catch(() => undefined);
    }
}

async function extractOcrPageText(pdfPath: string, pageNumber: number): Promise<string> {
    const basePath = path.join(
        os.tmpdir(),
        `research-page-${pageNumber}-${Date.now()}`
    );
    const imagePath = `${basePath}.png`;

    try {
        await execFileAsync(
            'pdftoppm',
            ['-f', String(pageNumber), '-l', String(pageNumber), '-singlefile', '-png', pdfPath, basePath],
            {
                timeout: 20000,
                maxBuffer: 4 * 1024 * 1024
            }
        );

        const { stdout } = await execFileAsync(
            'tesseract',
            [imagePath, 'stdout', '--dpi', '200'],
            {
                timeout: 30000,
                maxBuffer: 4 * 1024 * 1024
            }
        );

        return normalizeWhitespace(stdout);
    } finally {
        await fs.rm(imagePath, { force: true }).catch(() => undefined);
    }
}

async function hasCommand(command: string): Promise<boolean> {
    if (!commandAvailability.has(command)) {
        commandAvailability.set(
            command,
            execFileAsync('which', [command], {
                timeout: 5000
            })
                .then(({ stdout }) => Boolean(stdout.trim()))
                .catch(() => false)
        );
    }

    return commandAvailability.get(command)!;
}

function validatePdfBytes(buffer: Uint8Array) {
    if (buffer.byteLength === 0) {
        throw new Error('This file is not a supported PDF.');
    }

    if (buffer.byteLength > MAX_PDF_SIZE_BYTES) {
        throw new Error('This PDF is too large. Please upload a file under 25MB.');
    }

    const signature = Buffer.from(buffer.slice(0, 4)).toString('utf8');
    if (signature !== '%PDF') {
        throw new Error('This file is not a supported PDF.');
    }
}

function detectTitleFromPage(firstPageText: string): string | null {
    const lines = normalizeWhitespace(firstPageText)
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length >= 18 && line.length <= 180)
        .slice(0, 14);

    let best: { score: number; value: string } | null = null;

    for (const line of lines) {
        const lower = line.toLowerCase();
        if (
            /^(abstract|keywords|introduction|doi|author information|received|accepted)/i.test(lower)
        ) {
            continue;
        }

        const words = line.split(/\s+/);
        const titleCaseWords = words.filter((word) => /^[A-Z][a-z]/.test(word)).length;
        const score =
            words.length * 1.8 +
            titleCaseWords * 1.5 -
            (line.includes('@') ? 8 : 0) -
            (/\b(university|department|journal|volume|issue)\b/i.test(line) ? 6 : 0);

        if (!best || score > best.score) {
            best = { score, value: line };
        }
    }

    return best ? normalizeCandidateTitle(best.value) : null;
}

function detectAuthorsFromPage(
    firstPageText: string,
    title: string
): string[] {
    const lines = normalizeWhitespace(firstPageText)
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 24);

    const titleIndex = lines.findIndex((line) => line === title || line.includes(title));
    const fallbackStart = titleIndex >= 0 ? titleIndex + 1 : 1;
    const candidateLines = lines.slice(fallbackStart, Math.min(lines.length, fallbackStart + 8));
    const block: string[] = [];

    for (const line of candidateLines) {
        if (/^(abstract|keywords?|introduction)\b/i.test(line)) {
            break;
        }

        if (isLikelyAuthorLine(line)) {
            block.push(line);
            continue;
        }

        if (block.length > 0) {
            break;
        }
    }

    const blockAuthors = normalizeAuthorList(splitAuthors(block.join('; ')));
    if (blockAuthors.length > 0 && blockAuthors.length <= 8) {
        return blockAuthors;
    }

    for (const line of candidateLines) {
        const authors = normalizeAuthorList(splitAuthors(line));
        if (authors.length > 0 && authors.length <= 8) {
            return authors;
        }
    }

    return [];
}

function detectAbstractFromPages(pageMap: ExtractedPage[]): string | null {
    const previewText = pageMap
        .slice(0, 3)
        .map((page) => page.text)
        .join('\n\n');

    const match = previewText.match(
        /abstract[\s:\n]+([\s\S]{80,2200}?)(?:\n(?:keywords?|1\.?\s+introduction|introduction)\b)/i
    );

    if (!match?.[1]) {
        return null;
    }

    return compressText(normalizeWhitespace(match[1]), 1800);
}

function detectDoiFromText(value: string): string | null {
    const match = value.match(DOI_REGEX);
    return normalizeDoi(match?.[0] || null);
}

function detectYearFromText(value: string): number | null {
    const matches = Array.from(value.matchAll(/\b(?:19|20)\d{2}\b/g))
        .map((match) => Number(match[0]))
        .filter((year) => isValidPublicationYear(year));

    if (matches.length === 0) {
        return null;
    }

    const preferred = matches.find((year) =>
        new RegExp(
            `\\b(?:published|publication|copyright|accepted|received|conference|journal|proceedings|©)\\b[^\\n]{0,48}\\b${year}\\b`,
            'i'
        ).test(value)
    );

    return preferred || matches[0] || null;
}

function buildStructuredPaperData(input: {
    displayTitle: string;
    titleCandidates: string[];
    doi: string | null;
    authors: string[];
    year: number | null;
    abstract: string | null;
    journal: string | null;
    pageMap: ExtractedPage[];
}): Record<string, unknown> {
    const objective = extractSectionCandidate(
        input.pageMap,
        /\b(objective|aim|purpose|research question|we ask|this study examines|this paper examines)\b/i,
        2
    );
    const methods = extractSectionCandidate(
        input.pageMap,
        /\b(method|methods|methodology|participants|procedure|materials)\b/i,
        3
    );
    const sample = extractSectionCandidate(
        input.pageMap,
        /\b(sample|participants|n\s*=|interviewees|respondents|subjects)\b/i,
        2
    );
    const results = extractSectionCandidate(
        input.pageMap,
        /\b(results|findings|we found|shows that|reveals that|suggests that)\b/i,
        3
    );
    const conclusion = extractSectionCandidate(
        input.pageMap,
        /\b(conclusion|conclusions|we conclude|in summary|implications)\b/i,
        3
    );
    const quoteCandidates = collectQuoteCandidates(input.pageMap);

    return {
        title: input.displayTitle,
        titleCandidates: input.titleCandidates,
        doi: input.doi,
        authors: input.authors,
        year: input.year,
        journal: input.journal,
        abstract: input.abstract,
        objective,
        methods,
        sample,
        results,
        conclusion,
        quoteCandidates,
        pages: input.pageMap.map((page) => ({
            pageNumber: page.pageNumber,
            extractionType: page.extractionType,
            confidence: page.confidence,
            weak: !page.text || isWeakPageText(page.text)
        }))
    };
}

function extractSectionCandidate(
    pageMap: ExtractedPage[],
    pattern: RegExp,
    maxPages: number
): { summary: string; pageNumbers: number[] } | null {
    const matchingPages = pageMap
        .filter((page) => pattern.test(page.text))
        .slice(0, maxPages);

    if (matchingPages.length === 0) {
        return null;
    }

    return {
        summary: compressText(
            matchingPages
                .map((page) => `[Page ${page.pageNumber}] ${normalizeWhitespace(page.text)}`)
                .join('\n\n'),
            1800
        ),
        pageNumbers: matchingPages.map((page) => page.pageNumber)
    };
}

function collectQuoteCandidates(pageMap: ExtractedPage[]): Array<{
    text: string;
    pageNumber: number;
}> {
    return pageMap.flatMap((page) => {
        const matches = normalizeWhitespace(page.text).match(/["“][^"”]{30,220}["”]/g) || [];

        return matches.slice(0, 3).map((text) => ({
            text,
            pageNumber: page.pageNumber
        }));
    }).slice(0, 8);
}

function splitAuthors(value: string | null): string[] {
    if (!value) {
        return [];
    }

    const normalized = value
        .replace(/\s+(?:and|&)\s+/gi, ';')
        .replace(/\n+/g, ';');
    const semicolonParts = normalized
        .split(';')
        .map((part) => cleanAuthorCandidate(part))
        .filter(Boolean);

    if (semicolonParts.length > 1) {
        return semicolonParts;
    }

    const commaParts = normalized
        .split(',')
        .map((part) => cleanAuthorCandidate(part))
        .filter(Boolean);

    if (commaParts.length > 1 && commaParts.every((part) => part.split(/\s+/).length >= 2)) {
        return commaParts;
    }

    const single = cleanAuthorCandidate(normalized);
    return single ? [single] : [];
}

function normalizeAuthorList(value: string[] | null): string[] {
    if (!value || value.length === 0) {
        return [];
    }

    return dedupeStrings(
        value
            .map((author) => cleanAuthorCandidate(author))
            .filter((author): author is string => Boolean(author))
    );
}

function isLikelyAuthorLine(value: string): boolean {
    const cleaned = cleanAuthorCandidate(value);
    if (!cleaned) {
        return false;
    }

    const names = splitAuthors(cleaned);
    return names.length > 0 && names.length <= 8;
}

function cleanAuthorCandidate(value: string): string | null {
    const cleaned = normalizeWhitespace(
        value
            .replace(/\([^)]*\)/g, ' ')
            .replace(/[*†‡§¶‖‣•◊]+/g, ' ')
            .replace(/\b\d+(?:,\d+)*\b/g, ' ')
            .replace(/\s+/g, ' ')
    )
        .replace(/^[,;:\-]+|[,;:\-]+$/g, '')
        .trim();

    if (!cleaned || cleaned.length > 80) {
        return null;
    }

    if (AUTHOR_LINE_STOP_PATTERN.test(cleaned) || DOI_REGEX.test(cleaned)) {
        return null;
    }

    const words = cleaned.split(/\s+/).filter(Boolean);
    if (words.length < 2 || words.length > 6) {
        return null;
    }

    const validWords = words.filter((word) => isLikelyNameToken(word)).length;
    if (validWords < Math.max(2, words.length - 1)) {
        return null;
    }

    return words.join(' ');
}

function isLikelyNameToken(value: string): boolean {
    const normalized = value.replace(/[.,]/g, '');
    if (!normalized) {
        return false;
    }

    if (AUTHOR_SUFFIXES.has(normalized.toLowerCase())) {
        return true;
    }

    if (AUTHOR_NAME_PARTICLES.has(normalized.toLowerCase())) {
        return true;
    }

    return /^[A-Z][A-Za-z'’.-]*$/.test(normalized) || /^[A-Z]{1,3}$/.test(normalized);
}

function normalizeCandidateTitle(value: string | null): string | null {
    const candidate = normalizeCandidateText(value);
    if (!candidate) {
        return null;
    }

    if (/^(untitled|microsoft word|untitled document)$/i.test(candidate)) {
        return null;
    }

    return compressText(candidate, 180);
}

function normalizeCandidateText(value: string | null): string | null {
    if (!value) {
        return null;
    }

    const normalized = normalizeWhitespace(value);
    return normalized || null;
}

function normalizeDoi(value: string | null): string | null {
    if (!value) {
        return null;
    }

    const match = value.match(DOI_REGEX);
    if (!match?.[0]) {
        return null;
    }

    return `https://doi.org/${match[0].replace(/^https?:\/\/doi\.org\//i, '')}`;
}

async function resolvePaperIdentityWithOpenRouter(input: {
    originalFileName: string;
    linkMetadata: LinkMetadata;
    pdfInfo: PdfInfoMetadata;
    heuristicTitle: string;
    heuristicAuthors: string[];
    heuristicYear: number | null;
    heuristicJournal: string | null;
    doi: string | null;
    firstPageText: string;
    secondPageText: string;
    abstract: string | null;
}): Promise<ResolvedPaperIdentity | null> {
    const apiKey = import.meta.env.OPENROUTER_API_KEY;

    if (!apiKey) {
        return null;
    }

    const topLines = input.firstPageText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 18)
        .join('\n');
    const context = [
        `Original filename: ${input.originalFileName}`,
        `Heuristic title: ${input.heuristicTitle}`,
        `Heuristic authors: ${input.heuristicAuthors.join(', ') || 'Unknown'}`,
        `Heuristic year: ${input.heuristicYear ?? 'Unknown'}`,
        `Heuristic journal: ${input.heuristicJournal ?? 'Unknown'}`,
        `Link metadata title: ${input.linkMetadata.title ?? 'Unknown'}`,
        `Link metadata authors: ${input.linkMetadata.authors.join(', ') || 'Unknown'}`,
        `Link metadata year: ${input.linkMetadata.year ?? 'Unknown'}`,
        `Link metadata journal: ${input.linkMetadata.journal ?? 'Unknown'}`,
        `Embedded PDF title: ${input.pdfInfo.title ?? 'Unknown'}`,
        `Embedded PDF author: ${input.pdfInfo.author ?? 'Unknown'}`,
        `Embedded PDF subject: ${input.pdfInfo.subject ?? 'Unknown'}`,
        `Embedded PDF creation date: ${input.pdfInfo.creationDate ?? 'Unknown'}`,
        `DOI: ${input.doi ?? 'Unknown'}`,
        `Abstract preview: ${input.abstract ? compressText(input.abstract, 900) : 'Not clearly found'}`,
        '',
        'First-page top lines:',
        topLines || 'Not clearly found',
        '',
        'First-page excerpt:',
        compressText(input.firstPageText, 2200) || 'Not clearly found',
        '',
        'Second-page excerpt:',
        compressText(input.secondPageText, 1600) || 'Not clearly found'
    ].join('\n');

    for (const model of IDENTITY_MODEL_CANDIDATES) {
        try {
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer':
                        import.meta.env.PUBLIC_SITE_URL ||
                        import.meta.env.SITE ||
                        'https://abodidsahoo.com',
                    'X-Title':
                        import.meta.env.PUBLIC_SITE_NAME ||
                        'Abodid Paper Renamer'
                },
                body: JSON.stringify({
                    model,
                    response_format: { type: 'json_object' },
                    temperature: 0.05,
                    max_tokens: 550,
                    messages: [
                        {
                            role: 'system',
                            content:
                                'You identify bibliographic metadata for an academic paper using only the provided evidence. Prefer the visible first-page title and author order. Never mistake DOI strings, URLs, affiliations, departments, institutions, journal names, copyright lines, or emails for author names. Prefer the publication year over a generic file creation year when the evidence supports it. If a field is unclear, return null or an empty array instead of guessing.'
                        },
                        {
                            role: 'user',
                            content: `${context}\n\nReturn valid JSON like ${JSON.stringify({
                                title: 'Readable paper title or null',
                                authors: ['First Author', 'Second Author'],
                                year: 2024,
                                journal: 'Journal or conference name or null'
                            })}`
                        }
                    ]
                })
            });

            if (!response.ok) {
                continue;
            }

            const payload = await response.json();
            const content = payload?.choices?.[0]?.message?.content;

            if (!content || typeof content !== 'string') {
                continue;
            }

            const cleaned = content.replace(/```json|```/g, '').trim();
            const parsed = paperIdentityResponseSchema.parse(JSON.parse(cleaned));
            const title = normalizeCandidateTitle(parsed.title);
            const authors = normalizeAuthorList(parsed.authors);
            const year = isValidPublicationYear(parsed.year) ? parsed.year : null;
            const journal = normalizeCandidateText(parsed.journal);

            if (!title && authors.length === 0 && !year && !journal) {
                continue;
            }

            return {
                title,
                authors,
                year,
                journal,
                modelLabel: model
            };
        } catch (_error) {
            continue;
        }
    }

    return null;
}

function isValidPublicationYear(value: number | null | undefined): value is number {
    if (!value || !Number.isFinite(value)) {
        return false;
    }

    const currentYear = new Date().getUTCFullYear() + 1;
    return value >= 1900 && value <= currentYear;
}

function chooseBestPageText(nativeText: string, ocrText: string): string {
    const normalizedNative = normalizeWhitespace(nativeText);
    const normalizedOcr = normalizeWhitespace(ocrText);

    if (!normalizedNative && !normalizedOcr) {
        return '';
    }

    if (!normalizedNative) {
        return normalizedOcr;
    }

    if (!normalizedOcr) {
        return normalizedNative;
    }

    if (normalizedOcr.length > normalizedNative.length * 1.3) {
        return `${normalizedNative}\n\n${normalizedOcr}`.trim();
    }

    return normalizedNative;
}

function isWeakPageText(value: string): boolean {
    const normalized = normalizeWhitespace(value);
    if (normalized.length < 120) {
        return true;
    }

    const alphaCharacters = (normalized.match(/[A-Za-z]/g) || []).length;
    const ratio = alphaCharacters / Math.max(1, normalized.length);
    return ratio < 0.35;
}

function scorePageConfidence(value: string): number | null {
    const normalized = normalizeWhitespace(value);
    if (!normalized) {
        return null;
    }

    const alphaCharacters = (normalized.match(/[A-Za-z]/g) || []).length;
    const alphaRatio = alphaCharacters / Math.max(1, normalized.length);
    const lengthScore = Math.min(normalized.length / 600, 1);
    return Number(Math.max(0.2, Math.min(0.98, (alphaRatio + lengthScore) / 2)).toFixed(2));
}

function isPdfResponse(url: string, contentType: string): boolean {
    return /\.pdf(?:$|[?#])/i.test(url) || contentType.toLowerCase().includes('pdf');
}

function getFilenameFromResponse(response: Response, url: string): string {
    const disposition = response.headers.get('content-disposition') || '';
    const fileNameMatch = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
    if (fileNameMatch?.[1]) {
        return ensurePdfExtension(decodeURIComponent(fileNameMatch[1]));
    }

    try {
        const parsed = new URL(url);
        const segment = parsed.pathname.split('/').filter(Boolean).pop();
        if (segment) {
            return ensurePdfExtension(segment);
        }
    } catch (_error) {
        return 'linked-paper.pdf';
    }

    return 'linked-paper.pdf';
}

function dedupeStrings(values: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const value of values) {
        const normalized = value.trim();
        const key = normalized.toLowerCase();
        if (!normalized || seen.has(key)) {
            continue;
        }

        seen.add(key);
        result.push(normalized);
    }

    return result;
}

function firstNonEmptyList<T>(...lists: T[][]): T[] {
    for (const list of lists) {
        if (list.length > 0) {
            return list;
        }
    }

    return [];
}

function parseModelEnv(value: string | undefined, fallback: string[]): string[] {
    if (!value) {
        return fallback;
    }

    return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}
