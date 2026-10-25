export const OPPORTUNITY_CAPTURE_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const OPPORTUNITY_CAPTURE_MAX_VIDEO_BYTES = 25 * 1024 * 1024;
export const OPPORTUNITY_CAPTURE_MAX_TOTAL_BYTES = 30 * 1024 * 1024;
export const OPPORTUNITY_CAPTURE_MAX_ATTACHMENTS = 4;
export const OPPORTUNITY_CAPTURE_MAX_TEXT_CHARS = 100_000;

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const TEXT_TYPES = new Set(['text/plain', 'text/markdown']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

export class OpportunityInputExtractionError extends Error {
    constructor(
        message: string,
        readonly status: number,
        readonly code = 'INPUT_EXTRACTION_FAILED',
        readonly retryAfter?: number,
    ) {
        super(message);
        this.name = 'OpportunityInputExtractionError';
    }
}

type OpportunityAttachmentMetadata = Pick<File, 'name' | 'type' | 'size'>;

const fileExtension = (name: string) => name.toLowerCase().split('.').pop() || '';

export const isOpportunityPdfFile = (file: Pick<File, 'name' | 'type'>) => (
    file.type === 'application/pdf' || fileExtension(file.name) === 'pdf'
);

export const isOpportunityTextFile = (file: Pick<File, 'name' | 'type'>) => (
    TEXT_TYPES.has(file.type)
    || ['txt', 'md', 'markdown'].includes(fileExtension(file.name))
);

export const isOpportunityImageFile = (file: Pick<File, 'name' | 'type'>) => (
    IMAGE_TYPES.has(file.type)
    || ['jpg', 'jpeg', 'png', 'webp'].includes(fileExtension(file.name))
);

export const isOpportunityVideoFile = (file: Pick<File, 'name' | 'type'>) => (
    VIDEO_TYPES.has(file.type)
    || ['mp4', 'webm', 'mov'].includes(fileExtension(file.name))
);

export const validateOpportunityAttachmentMetadata = (attachments: OpportunityAttachmentMetadata[]) => {
    if (attachments.length > OPPORTUNITY_CAPTURE_MAX_ATTACHMENTS) {
        throw new OpportunityInputExtractionError(
            `Choose up to ${OPPORTUNITY_CAPTURE_MAX_ATTACHMENTS} attachments at a time.`,
            400,
            'TOO_MANY_ATTACHMENTS',
        );
    }
    if (attachments.reduce((total, file) => total + file.size, 0) > OPPORTUNITY_CAPTURE_MAX_TOTAL_BYTES) {
        throw new OpportunityInputExtractionError(
            'Keep the combined attachment size below 30 MB.',
            413,
            'ATTACHMENTS_TOO_LARGE',
        );
    }
    for (const file of attachments) {
        if (!file.name.trim() || !Number.isFinite(file.size) || file.size <= 0) {
            throw new OpportunityInputExtractionError(
                'Each attachment must have a name and contain data.',
                400,
                'INVALID_ATTACHMENT',
            );
        }
        const maximumSize = isOpportunityVideoFile(file)
            ? OPPORTUNITY_CAPTURE_MAX_VIDEO_BYTES
            : OPPORTUNITY_CAPTURE_MAX_FILE_BYTES;
        if (file.size > maximumSize) {
            throw new OpportunityInputExtractionError(
                `${file.name} is too large. Videos may be up to 25 MB; other files up to 10 MB.`,
                413,
                'ATTACHMENT_TOO_LARGE',
            );
        }
        if (!isOpportunityPdfFile(file)
            && !isOpportunityTextFile(file)
            && !isOpportunityImageFile(file)
            && !isOpportunityVideoFile(file)) {
            throw new OpportunityInputExtractionError(
                `Unsupported attachment: ${file.name}.`,
                415,
                'UNSUPPORTED_ATTACHMENT',
            );
        }
    }
};

export const validateOpportunityInputAttachments = (attachments: File[]) => (
    validateOpportunityAttachmentMetadata(attachments)
);

