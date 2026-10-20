import type { APIRoute } from 'astro';
import {
    extractOpportunityFromInput,
    OpportunityInputExtractionError,
} from '../../../lib/opportunities/inputExtractionService';
import { authorizeOpportunityRequest, opportunityJson } from '../../../lib/opportunities/userAuth';

export const prerender = false;
export const maxDuration = 90;

export const POST: APIRoute = async ({ request }) => {
    const authorization = await authorizeOpportunityRequest(request);
    if (!authorization.ok) return authorization.response;

    try {
        const formData = await request.formData();
        const capturedAt = typeof formData.get('captured_at') === 'string'
            ? String(formData.get('captured_at'))
            : new Date().toISOString();
        const captureTimezone = typeof formData.get('capture_timezone') === 'string'
            ? String(formData.get('capture_timezone'))
            : undefined;
        const submittedText = typeof formData.get('text') === 'string' ? String(formData.get('text')) : '';
        const legacyFile = formData.get('file');
        const attachments = [
            ...formData.getAll('files'),
            ...(legacyFile instanceof File ? [legacyFile] : []),
        ].filter((entry): entry is File => entry instanceof File && entry.size > 0);
        const mode = formData.get('mode') === 'note' ? 'note' as const : 'text' as const;

        const result = await extractOpportunityFromInput({
            userId: authorization.user.id,
            serviceClient: authorization.serviceClient,
            text: submittedText,
            attachments,
            capturedAt,
            captureTimezone,
            mode,
        });
        return opportunityJson({ success: true, model: result.model, extraction: result.draft });
    } catch (error) {
        console.error('Opportunity input extraction failed', {
            error: error instanceof Error ? error.name : 'UnknownError',
            message: error instanceof Error ? error.message.slice(0, 300) : 'Unknown extraction failure',
        });
        if (error instanceof OpportunityInputExtractionError) {
            const response = opportunityJson({ error: error.message, code: error.code }, error.status);
            if (error.retryAfter) response.headers.set('Retry-After', String(error.retryAfter));
            return response;
        }
        return opportunityJson({
            error: 'The opportunity details could not be extracted. Review the input and try again.',
        }, 502);
    }
};
