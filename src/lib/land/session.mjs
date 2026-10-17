import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto';

export const LAND_COOKIE_NAME = 'abodid_land_session';
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map();

const env = (name) => (import.meta.env?.[name] || process.env[name] || '').trim();
const safeEqual = (first, second) => {
  const a = Buffer.from(first);
  const b = Buffer.from(second);
  return a.length === b.length && timingSafeEqual(a, b);
};

const sign = (payload) => createHmac('sha256', env('LAND_SESSION_SECRET')).update(payload).digest('base64url');

const getClientKey = (request) => {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip') || 'local';
};

export const rateLimitStatus = (request) => {
  const key = getClientKey(request);
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || now - current.first > WINDOW_MS) {
    attempts.set(key, { count: 0, first: now, blockedUntil: 0 });
    return { blocked: false, retryAfter: 0, key };
  }
  return {
    blocked: current.blockedUntil > now,
    retryAfter: Math.max(0, Math.ceil((current.blockedUntil - now) / 1000)),
    key,
  };
};

export const recordLoginResult = (key, success) => {
  if (success) {
    attempts.delete(key);
    return;
  }
  const now = Date.now();
  const current = attempts.get(key) || { count: 0, first: now, blockedUntil: 0 };
  current.count += 1;
  if (current.count >= MAX_ATTEMPTS) {
    const exponent = Math.min(5, current.count - MAX_ATTEMPTS);
    current.blockedUntil = now + (60_000 * (2 ** exponent));
  }
  attempts.set(key, current);
};

export const verifyViewerPassword = (password) => {
  const stored = env('LAND_VIEWER_PASSWORD_HASH');
  const [algorithm, salt, expected] = stored.split(stored.includes(':') ? ':' : '$');
  if (algorithm !== 'scrypt' || !salt || !expected) return false;
  const actual = scryptSync(password, salt, 64).toString('hex');
  return safeEqual(actual, expected);
};

export const createViewerSession = (remember) => {
  const now = Math.floor(Date.now() / 1000);
  const maxAge = remember ? 30 * 24 * 60 * 60 : 12 * 60 * 60;
  const payload = Buffer.from(JSON.stringify({ role: 'viewer', iat: now, exp: now + maxAge })).toString('base64url');
  return { token: `${payload}.${sign(payload)}`, maxAge };
};

export const verifyViewerSessionToken = (token) => {
  if (!token || !env('LAND_SESSION_SECRET')) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature || !safeEqual(sign(payload), signature)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return parsed.role === 'viewer' && Number(parsed.exp) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
};

export const viewerCookieOptions = (request, maxAge) => ({
  httpOnly: true,
  secure: new URL(request.url).protocol === 'https:',
  sameSite: 'strict',
  path: '/',
  maxAge,
});

