import type { APIRoute } from 'astro';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import { extractText, getDocumentProxy } from 'unpdf';
import {
    extractOpportunityWithLLM,
    parseEventDate,
    resolveOpportunityDeadline,
} from '../../../lib/opportunities/extractor';
import { prioritizeOpportunityText } from '../../../lib/opportunities/scraper';
import { formatOpportunityTitle } from '../../../lib/opportunities/ui-helpers';
import { consumeOpportunityAiLimit } from '../../../lib/opportunities/rateLimit';
import { authorizeOpportunityRequest, opportunityJson } from '../../../lib/opportunities/userAuth';

export const prerender = false;
export const maxDuration = 90;

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
const MAX_TOTAL_BYTES = 30 * 1024 * 1024;
const MAX_ATTACHMENTS = 4;
const MAX_TEXT_CHARS = 100_000;
const MAX_PDF_PAGES = 30;
const PDF_PAGES_TO_READ = 6;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const TEXT_TYPES = new Set(['text/plain', 'text/markdown']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

const fileExtension = (name: string) => name.toLowerCase().split('.').pop() || '';

const isPdfFile = (file: File) => file.type === 'application/pdf' || fileExtension(file.name) === 'pdf';

const isTextFile = (file: File) => (
    TEXT_TYPES.has(file.type)
    || ['txt', 'md', 'markdown'].includes(fileExtension(file.name))
);

const isImageFile = (file: File) => (
    IMAGE_TYPES.has(file.type)
    || ['jpg', 'jpeg', 'png', 'webp'].includes(fileExtension(file.name))
);

const isVideoFile = (file: File) => (
    VIDEO_TYPES.has(file.type)
    || ['mp4', 'webm', 'mov'].includes(fileExtension(file.name))
);

const toDataUrl = async (file: File) => {
    const bytes = Buffer.from(await file.arrayBuffer());
    return `data:${file.type};base64,${bytes.toString('base64')}`;
};

const readPdfText = async (file: File) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const pdf = await getDocumentProxy(bytes);

    try {
        if (pdf.numPages > MAX_PDF_PAGES) {
            throw new Error(`This PDF has ${pdf.numPages} pages. Please upload a PDF with ${MAX_PDF_PAGES} pages or fewer.`);
        }

        const { text } = await extractText(pdf);
        const initialPages = text.slice(0, PDF_PAGES_TO_READ).join('\n\n');
        return prioritizeOpportunityText(initialPages, MAX_TEXT_CHARS);
    } finally {
        await pdf.destroy().catch(() => undefined);
    }
};

const runFfmpeg = async (args: string[]) => {
    if (!ffmpegPath) throw new Error('Video analysis is temporarily unavailable.');

    await new Promise<void>((resolve, reject) => {
        const process = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
        let stderr = '';
        process.stderr.on('data', (chunk) => {
            stderr = `${stderr}${chunk.toString()}`.slice(-4_000);
        });
        process.on('error', reject);
        process.on('close', (code) => {
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
        if (frameNames.length === 0) throw new Error('The video did not contain a readable frame.');
        return Promise.all(frameNames.map(async (name) => (
            `data:image/jpeg;base64,${(await readFile(join(directory, name))).toString('base64')}`
        )));
    } finally {
        await rm(directory, { recursive: true, force: true }).catch(() => undefined);
    }
};

export const POST: APIRoute = async ({ request }) => {
    const authorization = await authorizeOpportunityRequest(request);
    if (!authorization.ok) return authorization.response;

    try {
        const formData = await request.formData();
        const mode = formData.get('mode');
        const capturedAt = typeof formData.get('captured_at') === 'string'
            ? String(formData.get('captured_at'))
            : new Date().toISOString();
        const captureTimezone = typeof formData.get('capture_timezone') === 'string'
            ? String(formData.get('capture_timezone'))
            : undefined;

        const submittedText = typeof formData.get('text') === 'string' ? String(formData.get('text')).trim() : '';
        const legacyFile = formData.get('file');
        const attachments = [
            ...formData.getAll('files'),
            ...(legacyFile instanceof File ? [legacyFile] : []),
        ].filter((entry): entry is File => entry instanceof File && entry.size > 0);

        if (attachments.length > MAX_ATTACHMENTS) {
            return opportunityJson({ error: `Choose up to ${MAX_ATTACHMENTS} attachments at a time.` }, 400);
        }
        if (attachments.reduce((total, file) => total + file.size, 0) > MAX_TOTAL_BYTES) {
            return opportunityJson({ error: 'Keep the combined attachment size below 30 MB.' }, 413);
        }
        if (submittedText.length < 3 && attachments.length === 0) {
            return opportunityJson({ error: 'Add a link, note, description, or attachment first.' }, 400);
        }

        const readableSections: string[] = [];
        const sourceNames: string[] = [];
        let imageDataUrls: string[] = [];

        if (submittedText) {
            readableSections.push(`USER-SUPPLIED TEXT:\n${submittedText.slice(0, MAX_TEXT_CHARS)}`);
        }

        for (const file of attachments) {
            sourceNames.push(file.name.slice(0, 160));
            const maximumSize = isVideoFile(file) ? MAX_VIDEO_BYTES : MAX_FILE_BYTES;
            if (file.size > maximumSize) {
                return opportunityJson({
                    error: `${file.name} is too large. Videos may be up to 25 MB; other files up to 10 MB.`,
                }, 413);
            }

            if (isPdfFile(file)) {
                const pdfText = await readPdfText(file);
                if (pdfText.trim().length < 50) {
                    return opportunityJson({
                        error: `${file.name} does not contain enough readable text. Upload the relevant pages as images for OCR.`,
                    }, 422);
                }
                readableSections.push(`DOCUMENT ${file.name}:\n${pdfText}`);
            } else if (isTextFile(file)) {
                readableSections.push(`DOCUMENT ${file.name}:\n${(await file.text()).slice(0, MAX_TEXT_CHARS)}`);
            } else if (isImageFile(file)) {
                imageDataUrls.push(await toDataUrl(file));
            } else if (isVideoFile(file)) {
                imageDataUrls.push(...await readVideoFrames(file));
            } else {
                return opportunityJson({ error: `Unsupported attachment: ${file.name}.` }, 415);
            }
        }

        imageDataUrls = imageDataUrls.slice(0, 4);
        if (imageDataUrls.length > 0) {
            readableSections.push('Review the supplied image or video frames and extract only visibly supported details.');
        }
        const readableText = prioritizeOpportunityText(
            readableSections.join('\n\n').slice(0, MAX_TEXT_CHARS),
            MAX_TEXT_CHARS,
        );
        const pageTitle = sourceNames.length > 0
            ? `Opportunity attachments: ${sourceNames.join(', ')}`.slice(0, 500)
            : submittedText.length < 50 || mode === 'note'
                ? 'Short personal opportunity note'
                : 'Pasted opportunity text';

        const aiLimit = await consumeOpportunityAiLimit(authorization.serviceClient, authorization.user.id);
        if (!aiLimit.allowed) {
            if (aiLimit.unavailable) {
                return opportunityJson({ error: 'Analysis is temporarily unavailable. Please try again shortly.' }, 503);
            }

            const retryMinutes = Math.max(1, Math.ceil(aiLimit.retryAfter / 60));
            const response = opportunityJson({
                error: `Analysis limit reached. Try again in ${retryMinutes} minute${retryMinutes === 1 ? '' : 's'}.`,
            }, 429);
            response.headers.set('Retry-After', String(aiLimit.retryAfter));
            return response;
        }

        const { data: extracted, model } = await extractOpportunityWithLLM(readableText, pageTitle, {
            capturedAt,
            timezone: captureTimezone,
            imageDataUrls,
        });
        const deadline = resolveOpportunityDeadline(extracted.deadline, extracted.timezone, readableText);
        const eventDate = parseEventDate(extracted.event_date, capturedAt, extracted.timezone || captureTimezone);

        return opportunityJson({
            success: true,
            model,
            extraction: {
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
        });
    } catch (error) {
        console.error('Opportunity input extraction failed', {
            error: error instanceof Error ? error.name : 'UnknownError',
            message: error instanceof Error ? error.message.slice(0, 300) : 'Unknown extraction failure',
        });
        const message = error instanceof Error && error.message.startsWith('This PDF')
            ? error.message
            : 'The opportunity details could not be extracted. Review the input and try again.';
        return opportunityJson({ error: message }, 502);
    }
};
