const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const MAX_TARGETED_RECIPIENTS = 500;

export class AudienceSelectionError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AudienceSelectionError';
    }
}

/**
 * @param {{ isTest?: boolean, audienceMode?: string | null, recipientIds?: unknown[] }} [options]
 */
export const resolveNewsletterAudience = ({
    isTest = false,
    audienceMode = 'all',
    recipientIds,
} = {}) => {
    if (isTest) {
        return { mode: 'test', recipientIds: [] };
    }

    if (audienceMode === 'all' || audienceMode == null) {
        return { mode: 'all', recipientIds: [] };
    }

    if (audienceMode !== 'selected') {
        throw new AudienceSelectionError('Invalid audience mode.');
    }

    if (!Array.isArray(recipientIds)) {
        throw new AudienceSelectionError('Select at least one active subscriber.');
    }

    if (recipientIds.length > MAX_TARGETED_RECIPIENTS) {
        throw new AudienceSelectionError(
            `You can select up to ${MAX_TARGETED_RECIPIENTS} subscribers at a time.`,
        );
    }

    const uniqueIds = [];
    const seenIds = new Set();

    for (const value of recipientIds) {
        if (typeof value !== 'string' || !UUID_PATTERN.test(value.trim())) {
            throw new AudienceSelectionError('The selected subscriber list is invalid.');
        }

        const normalizedId = value.trim().toLowerCase();
        if (!seenIds.has(normalizedId)) {
            seenIds.add(normalizedId);
            uniqueIds.push(normalizedId);
        }
    }

    if (uniqueIds.length === 0) {
        throw new AudienceSelectionError('Select at least one active subscriber.');
    }

    return { mode: 'selected', recipientIds: uniqueIds };
};
