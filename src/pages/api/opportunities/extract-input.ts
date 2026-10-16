import type { APIRoute } from 'astro';
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
const MAX_TEXT_CHARS = 100_000;
const MAX_PDF_PAGES = 30;
const PDF_PAGES_TO_READ = 6;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const TEXT_TYPES = new Set(['text/plain', 'text/markdown']);

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

        let readableText = '';
        let pageTitle = '';
        let imageDataUrls: string[] = [];

        if (mode === 'text') {
            const submittedText = typeof formData.get('text') === 'string' ? String(formData.get('text')).trim() : '';
            if (submittedText.length < 50) {
                return opportunityJson({ error: 'Paste a little more opportunity text before analysing it.' }, 400);
            }
            readableText = prioritizeOpportunityText(submittedText.slice(0, MAX_TEXT_CHARS), MAX_TEXT_CHARS);
            pageTitle = 'Pasted opportunity text';
        } else if (mode === 'file') {
            const file = formData.get('file');
            if (!(file instanceof File) || file.size === 0) {
                return opportunityJson({ error: 'Choose a PDF, image, or text file first.' }, 400);
            }
            if (file.size > MAX_FILE_BYTES) {
                return opportunityJson({ error: 'Choose a file smaller than 10 MB.' }, 413);
            }

            pageTitle = file.name.slice(0, 500);
            if (isPdfFile(file)) {
                readableText = await readPdfText(file);
                if (readableText.trim().length < 50) {
                    return opportunityJson({
                        error: 'This PDF does not contain enough readable text. Upload the relevant pages as JPG or PNG images for OCR.',
                    }, 422);
                }
            } else if (isTextFile(file)) {
                readableText = prioritizeOpportunityText((await file.text()).slice(0, MAX_TEXT_CHARS), MAX_TEXT_CHARS);
            } else if (isImageFile(file)) {
                readableText = 'Read the uploaded opportunity image carefully and extract only details visibly supported by it.';
                imageDataUrls = [await toDataUrl(file)];
            } else {
                return opportunityJson({ error: 'Use a PDF, TXT, JPG, PNG, or WebP file.' }, 415);
            }
        } else {
            return opportunityJson({ error: 'Choose pasted text or a file to analyse.' }, 400);
        }

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
            : 'The opportunity details could not be extracted. Try again or add them manually.';
        return opportunityJson({ error: message }, 502);
    }
};
