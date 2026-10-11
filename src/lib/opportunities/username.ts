export const OPPORTUNITY_RESERVED_USERNAMES = new Set([
    'settings', 'login', 'logout', 'auth', 'api', 'admin', 'new',
    'extension', 'extensions', 'public', 'private', 'me', 'account',
    'support', 'help', 'terms', 'privacy',
]);

export const normalizeOpportunityUsername = (value: unknown): string =>
    String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 24);

export const isValidOpportunityUsername = (value: unknown): value is string => {
    const username = String(value || '');
    return /^[a-z0-9_]{3,24}$/.test(username) && !OPPORTUNITY_RESERVED_USERNAMES.has(username);
};
