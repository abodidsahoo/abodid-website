import crypto from 'node:crypto';

const cleanSecret = (value: unknown) =>
    typeof value === 'string' && value.trim() ? value.trim().replace(/^['"]|['"]$/g, '') : null;

export const getCronSecret = () =>
    cleanSecret(import.meta.env.OPPORTUNITIES_CRON_SECRET) ||
    cleanSecret(process.env.OPPORTUNITIES_CRON_SECRET) ||
    cleanSecret(import.meta.env.CRON_SECRET) ||
    cleanSecret(process.env.CRON_SECRET);

const safeCompare = (provided: string, expected: string) => {
    const providedBuffer = Buffer.from(provided);
    const expectedBuffer = Buffer.from(expected);
    return providedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(providedBuffer, expectedBuffer);
};

/** Scheduled jobs fail closed. User/admin credentials are never accepted as a
 * cron credential and there is no hard-coded fallback secret. */
export const isCronAuthenticated = (request: Request) => {
    const expected = getCronSecret();
    if (!expected) return false;

    const authorization = request.headers.get('authorization') || '';
    const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    const header = request.headers.get('x-cron-secret')?.trim() || '';
    return (bearer && safeCompare(bearer, expected)) || (header && safeCompare(header, expected));
};
