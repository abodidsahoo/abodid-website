import { z } from 'zod';

const RESERVED_QUESTION_IDS = new Set([
    'name', 'email', 'website', 'newsletter_consent', 'submission_key', 'form_version',
    'action', 'method', 'submit', 'reset', 'elements', 'length',
]);

export const questionSchema = z.object({
    id: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/)
        .refine((id) => !RESERVED_QUESTION_IDS.has(id), 'This question ID is reserved for the submission form.'),
    label: z.string().min(1).max(300),
    shortLabel: z.string().max(100).optional(),
    type: z.enum(['textarea', 'text', 'choice', 'rating']).default('textarea'),
    placeholder: z.string().max(500).optional(),
    required: z.boolean().default(false),
    options: z.array(z.string().min(1).max(180)).min(2).max(30).optional(),
}).superRefine((question, context) => {
    if (question.type === 'choice' && !question.options) {
        context.addIssue({ code: 'custom', message: 'Choice questions need options.' });
    }
});

export const questionsSchema = z.array(questionSchema).min(1).max(30)
    .refine((questions) => new Set(questions.map((q) => q.id)).size === questions.length,
        'Question IDs must be unique within a form.');

const httpsUrl = z.string().url().refine((url) => new URL(url).protocol === 'https:');
export const contentSchema = z.object({
    kicker: z.string(),
    heading: z.string(),
    note: z.string(),
    thanks: z.string(),
    resourceNote: z.string(),
    formNote: z.string(),
    successNote: z.string(),
    resourceInstructions: z.string().optional(),
    resourceEmailEnabled: z.boolean().optional(),
    resourceNotice: z.object({ title: z.string(), text: z.string() }).optional(),
    resources: z.array(z.object({ label: z.string(), url: httpsUrl, description: z.string().optional() })),
    image: z.string().startsWith('/').optional(),
    legacyStorageKey: z.string().optional(),
});

export type FeedbackQuestion = z.infer<typeof questionSchema>;
export type FeedbackContent = z.infer<typeof contentSchema>;
export type FeedbackForm = {
    id: string;
    slug: string;
    institution_slug: string;
    institution_name: string;
    event_slug: string;
    event_title: string;
    event_date: string | null;
    form_version: number;
    is_open: boolean;
    responses_public: boolean;
    questions: FeedbackQuestion[];
    content: FeedbackContent;
};

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class FeedbackValidationError extends Error {}

export function validateAnswers(questions: FeedbackQuestion[], data: FormData) {
    const answers: Record<string, string> = {};
    for (const question of questions) {
        const raw = data.get(question.id);
        if (raw !== null && typeof raw !== 'string') throw new FeedbackValidationError('Please enter text answers.');
        const value = typeof raw === 'string' ? raw.trim().replace(/\r\n/g, '\n') : '';
        const maxLength = question.type === 'text' ? 180 : 8000;
        if (value.length > maxLength) throw new FeedbackValidationError(`Please shorten your answer to “${question.label}”.`);
        if (!value && question.required) throw new FeedbackValidationError(`Please answer “${question.label}”.`);
        if (!value) continue;
        if (question.type === 'choice' && !question.options?.includes(value)) {
            throw new FeedbackValidationError(`Please choose an available answer for “${question.label}”.`);
        }
        if (question.type === 'rating' && !/^[1-5]$/.test(value)) {
            throw new FeedbackValidationError('Please choose a rating from 1 to 5.');
        }
        answers[question.id] = value;
    }
    if (!Object.keys(answers).length) throw new FeedbackValidationError('Please add at least one feedback response.');
    return answers;
}

export function formPath(slug: string) {
    if (slug === 'photography-album-thoughts') return '/photo-album-feedback';
    if (slug === 'delhi-university-ethnographic-filmmaking') return '/du-workshop-feedback';
    if (slug === 'nift-bhubaneswar-space-materiality-2026-11-03') return '/nift-workshop-feedback';
    return `/feedback/${encodeURIComponent(slug)}`;
}

export function responsesPath(slug: string) {
    if (slug === 'delhi-university-ethnographic-filmmaking') return '/du-workshop-responses';
    if (slug === 'nift-bhubaneswar-space-materiality-2026-11-03') return '/nift-workshop-responses';
    return `/feedback/${encodeURIComponent(slug)}/responses`;
}
