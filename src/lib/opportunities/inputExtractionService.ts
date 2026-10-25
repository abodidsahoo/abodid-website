import { OpportunityInputExtractionError, OPPORTUNITY_CAPTURE_MAX_TEXT_CHARS, validateOpportunityInputAttachments, isOpportunityPdfFile, isOpportunityTextFile, isOpportunityImageFile, isOpportunityVideoFile } from './attachmentValidation';
export * from './attachmentValidation';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
    extractOpportunityWithLLM,
    parseEventDate,
    resolveOpportunityDeadline,
} from './extractor';
import { consumeOpportunityAiLimit } from './rateLimit';
import { prioritizeOpportunityText } from './scraper';
import type { OpportunityInputDraft } from './unifiedInput';
import { formatOpportunityTitle } from './ui-helpers';

const MAX_PDF_PAGES = 30;
const PDF_PAGES_TO_READ = 6;
let unpdfPromise: Promise<typeof import('unpdf')> | undefined;
let ffmpegPathPromise: Promise<string | null> | undefined;

const loadUnpdf = () => {
    unpdfPromise ??= import('unpdf');
    return unpdfPromise;
};

const loadFfmpegPath = () => {
    ffmpegPathPromise ??= import('ffmpeg-static').then((module) => module.default);
    return ffmpegPathPromise;
};

const toDataUrl = async (file: File) => {
    const bytes = Buffer.from(await file.arrayBuffer());
    return `data:${file.type};base64,${bytes.toString('base64')}`;
};

const readPdfText = async (file: File) => {
    const { extractText, getDocumentProxy } = await loadUnpdf();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const pdf = await getDocumentProxy(bytes);
    try {
        if (pdf.numPages > MAX_PDF_PAGES) {
            throw new OpportunityInputExtractionError(
                `This PDF has ${pdf.numPages} pages. Please upload a PDF with ${MAX_PDF_PAGES} pages or fewer.`,
                422,
                'PDF_TOO_LONG',
            );
        }
        const { text } = await extractText(pdf);
        return prioritizeOpportunityText(
            text.slice(0, PDF_PAGES_TO_READ).join('\n\n'),
            OPPORTUNITY_CAPTURE_MAX_TEXT_CHARS,
        );
    } finally {
        await pdf.destroy().catch(() => undefined);
    }
};

const runFfmpeg = async (args: string[]) => {
    const ffmpegPath = await loadFfmpegPath();
    if (!ffmpegPath) {
        throw new OpportunityInputExtractionError(
            'Video analysis is temporarily unavailable.',
            503,
            'VIDEO_ANALYSIS_UNAVAILABLE',
        );
    }
    const executable = ffmpegPath;
    await new Promise<void>((resolve, reject) => {
        const process = spawn(executable, args, { stdio: ['ignore', 'ignore', 'pipe'] });
        let stderr = '';
        process.stderr.on('data', (chunk: Buffer) => {
            stderr = `${stderr}${chunk.toString()}`.slice(-4_000);
        });
        process.on('error', reject);
        process.on('close', (code: number | null) => {
            if (code === 0) resolve();
            else reject(new Error(stderr.trim() || 'The video could not be read.'));
        });
    });
};

const readVideoFrames = async (file: File) => {
    const directory = await mkdtemp(join(tmpdir(), 'opportunity-video-'));
    const extension = ['mp4', 'webm', 'mov'].includes(fileExtension(file.name))
        ? fileExtension(file.name)
        : 'mp4';
    const inputPath = join(directory, `input.${extension}`);
    const outputPattern = join(directory, 'frame-%02d.jpg');
    try {
        await writeFile(inputPath, new Uint8Array(await file.arrayBuffer()));
        await runFfmpeg([
            '-y', '-i', inputPath, '-an', '-vf',
            'fps=1/8,scale=1280:-2:force_original_aspect_ratio=decrease',
            '-frames:v', '3', '-q:v', '4', outputPattern,
        ]);
        const frameNames = (await readdir(directory))
            .filter((name) => name.startsWith('frame-') && name.endsWith('.jpg'))
            .sort()
            .slice(0, 3);
        if (frameNames.length === 0) {
            throw new OpportunityInputExtractionError(
                'The video did not contain a readable frame.',
                422,
                'VIDEO_FRAMES_UNREADABLE',
            );
        }
        return Promise.all(frameNames.map(async (name) => (
            `data:image/jpeg;base64,${(await readFile(join(directory, name))).toString('base64')}`
        )));
    } finally {
        await rm(directory, { recursive: true, force: true }).catch(() => undefined);
    }
};

export const extractOpportunityFromInput = async ({
    userId,
    serviceClient,
    text,
    attachments,
    capturedAt = new Date().toISOString(),
    captureTimezone,
    mode,
}: {
    userId: string;
    serviceClient: SupabaseClient;
    text: string;
    attachments: File[];
    capturedAt?: string;
    captureTimezone?: string;
    mode?: 'note' | 'text';
}): Promise<{ model: string; draft: OpportunityInputDraft }> => {
    const submittedText = text.trim().slice(0, OPPORTUNITY_CAPTURE_MAX_TEXT_CHARS);
    validateOpportunityInputAttachments(attachments);
    if (submittedText.length < 3 && attachments.length === 0) {
        throw new OpportunityInputExtractionError(
            'Add a link, note, description, or attachment first.',
            400,
            'EMPTY_CAPTURE',
        );
    }

    const readableSections: string[] = [];
    const sourceNames: string[] = [];
    let imageDataUrls: string[] = [];
    if (submittedText) readableSections.push(`USER-SUPPLIED TEXT:\n${submittedText}`);

    for (const file of attachments) {
        sourceNames.push(file.name.slice(0, 160));
        if (isOpportunityPdfFile(file)) {
            const pdfText = await readPdfText(file);
            if (pdfText.trim().length < 50) {
                throw new OpportunityInputExtractionError(
                    `${file.name} does not contain enough readable text. Upload the relevant pages as images for OCR.`,
                    422,
                    'PDF_TEXT_INSUFFICIENT',
                );
            }
            readableSections.push(`DOCUMENT ${file.name}:\n${pdfText}`);
        } else if (isOpportunityTextFile(file)) {
            readableSections.push(`DOCUMENT ${file.name}:\n${(await file.text()).slice(0, OPPORTUNITY_CAPTURE_MAX_TEXT_CHARS)}`);
        } else if (isOpportunityImageFile(file)) {
            imageDataUrls.push(await toDataUrl(file));
        } else if (isOpportunityVideoFile(file)) {
            imageDataUrls.push(...await readVideoFrames(file));
        }
    }

    imageDataUrls = imageDataUrls.slice(0, 4);
    if (imageDataUrls.length > 0) {
        readableSections.push('Review the supplied image or video frames and extract only visibly supported details.');
    }
    const readableText = prioritizeOpportunityText(
        readableSections.join('\n\n').slice(0, OPPORTUNITY_CAPTURE_MAX_TEXT_CHARS),
        OPPORTUNITY_CAPTURE_MAX_TEXT_CHARS,
    );
    const pageTitle = sourceNames.length > 0
        ? `Opportunity attachments: ${sourceNames.join(', ')}`.slice(0, 500)
        : submittedText.length < 50 || mode === 'note'
            ? 'Short personal opportunity note'
            : 'Pasted opportunity text';

    const aiLimit = await consumeOpportunityAiLimit(serviceClient, userId);
    if (!aiLimit.allowed) {
        if (aiLimit.unavailable) {
            throw new OpportunityInputExtractionError(
                'Analysis is temporarily unavailable. Please try again shortly.',
                503,
                'CAPTURE_QUOTA_UNAVAILABLE',
            );
        }
        const retryMinutes = Math.max(1, Math.ceil(aiLimit.retryAfter / 60));
        throw new OpportunityInputExtractionError(
            `Analysis limit reached. Try again in ${retryMinutes} minute${retryMinutes === 1 ? '' : 's'}.`,
            429,
            'CAPTURE_LIMIT_REACHED',
            aiLimit.retryAfter,
        );
    }

    try {
        const { data: extracted, model } = await extractOpportunityWithLLM(readableText, pageTitle, {
            capturedAt,
            timezone: captureTimezone,
            imageDataUrls,
        });
        const deadline = resolveOpportunityDeadline(extracted.deadline, extracted.timezone, readableText);
        const eventDate = parseEventDate(extracted.event_date, capturedAt, extracted.timezone || captureTimezone);
        return {
            model,
            draft: {
                title: formatOpportunityTitle(extracted.title || '').slice(0, 240),
                organisation: extracted.organisation || '',
                category: extracted.category || 'other',
                deadline: deadline.deadline_at?.slice(0, 10) || '',
                timezone: deadline.deadline_timezone || extracted.timezone || '',
                event_date: eventDate,
                location: extracted.location || '',
                requirements: Array.isArray(extracted.requirements) ? extracted.requirements.slice(0, 50) : [],
                next_action: extracted.next_action || '',
                application_url: extracted.application_url || '',
                fee_or_funding: extracted.fee_or_funding || '',
                application_fee: extracted.application_fee || '',
                summary: extracted.summary || '',
            },
        };
    } catch (error) {
        if (error instanceof OpportunityInputExtractionError) throw error;
        throw new OpportunityInputExtractionError(
            'The opportunity details could not be extracted. Review the input and try again.',
            502,
            'INPUT_EXTRACTION_FAILED',
        );
    }
};
