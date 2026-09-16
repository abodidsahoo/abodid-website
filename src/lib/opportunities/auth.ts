import type { APIContext, AstroCookies } from 'astro';
import crypto from 'node:crypto';

export const COOKIE_NAME = 'opp_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecretKey(): string {
    return (
        import.meta.env.OPPORTUNITIES_SESSION_SECRET ||
        process.env.OPPORTUNITIES_SESSION_SECRET ||
        import.meta.env.OPPORTUNITIES_PASSWORD ||
        process.env.OPPORTUNITIES_PASSWORD ||
        'fallback-opportunities-secret-key-2026'
    );
}

export function getExpectedPassword(): string | null {
    return (
        import.meta.env.OPPORTUNITIES_PASSWORD ||
        process.env.OPPORTUNITIES_PASSWORD ||
        (import.meta.env.DEV ? 'admin' : null)
    );
}

export function getCronSecret(): string | null {
    return (
        import.meta.env.OPPORTUNITIES_CRON_SECRET ||
        process.env.OPPORTUNITIES_CRON_SECRET ||
        import.meta.env.CRON_SECRET ||
        process.env.CRON_SECRET ||
        null
    );
}

/**
 * Creates an HMAC signed session token containing timestamp and entropy.
 */
export function createSessionToken(): string {
    const issuedAt = Date.now();
    const entropy = crypto.randomBytes(16).toString('hex');
    const payload = `${issuedAt}:${entropy}`;
    const hmac = crypto.createHmac('sha256', getSecretKey()).update(payload).digest('hex');
    return `${payload}.${hmac}`;
}

/**
 * Verifies if an HMAC signed session token is valid and unexpired.
 */
export function verifySessionToken(token: string | null | undefined): boolean {
    if (!token || typeof token !== 'string') return false;
    const parts = token.split('.');
    if (parts.length !== 2) return false;

    const [payload, signature] = parts;
    const expectedSignature = crypto.createHmac('sha256', getSecretKey()).update(payload).digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        return false;
    }

    const [issuedAtStr] = payload.split(':');
    const issuedAt = Number(issuedAtStr);
    if (!Number.isFinite(issuedAt)) return false;

    const ageSeconds = (Date.now() - issuedAt) / 1000;
    return ageSeconds >= 0 && ageSeconds <= SESSION_TTL_SECONDS;
}

/**
 * Validates a plain password against the server environment variable in constant time.
 */
export function verifyPassword(inputPassword: string | null | undefined): boolean {
    const expected = getExpectedPassword();
    if (!expected || !inputPassword || typeof inputPassword !== 'string') {
        return false;
    }

    const inputBuf = Buffer.from(inputPassword.trim());
    const expectedBuf = Buffer.from(expected.trim());

    if (inputBuf.length !== expectedBuf.length) {
        return false;
    }

    return crypto.timingSafeEqual(inputBuf, expectedBuf);
}

/**
 * Checks if a request is authenticated via cookie, header password, or Bearer token.
 */
export function isRequestAuthenticated(request: Request, cookies?: AstroCookies): boolean {
    // 1. Check HttpOnly cookie
    if (cookies) {
        const cookieToken = cookies.get(COOKIE_NAME)?.value;
        if (verifySessionToken(cookieToken)) {
            return true;
        }
    }

    // 2. Check Cookie header directly if AstroCookies was not provided
    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
        const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
        if (match && verifySessionToken(match[1])) {
            return true;
        }
    }

    // 3. Check Authorization header (Bearer token or Bearer <password>)
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const tokenOrPassword = authHeader.slice(7).trim();
        if (verifySessionToken(tokenOrPassword) || verifyPassword(tokenOrPassword)) {
            return true;
        }
    }

    // 4. Check x-opportunities-key header
    const customHeader = request.headers.get('x-opportunities-key');
    if (customHeader) {
        if (verifySessionToken(customHeader) || verifyPassword(customHeader)) {
            return true;
        }
    }

    return false;
}

/**
 * Verifies cron secret for scheduled tasks.
 */
export function isCronAuthenticated(request: Request): boolean {
    const expected = getCronSecret();
    if (!expected) {
        // Fallback to checking normal admin authentication
        return isRequestAuthenticated(request);
    }

    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7).trim();
        if (token === expected) return true;
    }

    const cronHeader = request.headers.get('x-cron-secret');
    if (cronHeader && cronHeader.trim() === expected) {
        return true;
    }

    return isRequestAuthenticated(request);
}

/**
 * Sets authenticated session cookie on response / context.
 */
export function setAuthCookie(cookies: AstroCookies, token: string) {
    const isSecure = process.env.NODE_ENV === 'production';
    cookies.set(COOKIE_NAME, token, {
        path: '/',
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        maxAge: SESSION_TTL_SECONDS,
    });
}

/**
 * Clears authenticated session cookie.
 */
export function clearAuthCookie(cookies: AstroCookies) {
    cookies.delete(COOKIE_NAME, {
        path: '/',
    });
}

/**
 * In-memory sliding rate limiter for capture endpoint.
 */
const rateLimitMap = new Map<string, number[]>();

export function checkRateLimit(key: string, limit = 20, windowMs = 60 * 1000): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const timestamps = rateLimitMap.get(key) || [];
    const valid = timestamps.filter((t) => now - t < windowMs);

    if (valid.length >= limit) {
        rateLimitMap.set(key, valid);
        return { allowed: false, remaining: 0 };
    }

    valid.push(now);
    rateLimitMap.set(key, valid);
    return { allowed: true, remaining: limit - valid.length };
}
