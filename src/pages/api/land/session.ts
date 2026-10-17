import type { APIRoute } from 'astro';
import {
  LAND_COOKIE_NAME,
  createViewerSession,
  rateLimitStatus,
  recordLoginResult,
  verifyViewerPassword,
  verifyViewerSessionToken,
  viewerCookieOptions,
} from '../../../lib/land/session.mjs';

export const prerender = false;

const json = (body: unknown, status = 200, extraHeaders: Record<string, string> = {}) => new Response(
  JSON.stringify(body),
  {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      ...extraHeaders,
    },
  },
);

export const GET: APIRoute = async ({ cookies }) => json({
  authenticated: verifyViewerSessionToken(cookies.get(LAND_COOKIE_NAME)?.value),
  role: verifyViewerSessionToken(cookies.get(LAND_COOKIE_NAME)?.value) ? 'viewer' : null,
});

export const POST: APIRoute = async ({ request, cookies }) => {
  const rate = rateLimitStatus(request);
  if (rate.blocked) {
    return json(
      { error: 'Too many attempts. Please wait and try again.', error_od: 'ବହୁତ ଥର ଚେଷ୍ଟା ହୋଇଛି। କିଛି ସମୟ ପରେ ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।' },
      429,
      { 'Retry-After': String(rate.retryAfter) },
    );
  }

  let body: { password?: unknown; remember?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  const password = typeof body.password === 'string' ? body.password : '';
  const accepted = verifyViewerPassword(password);
  recordLoginResult(rate.key, accepted);
  if (!accepted) {
    return json(
      { error: 'The password was not accepted.', error_od: 'ପାସୱାର୍ଡ ଠିକ୍ ନୁହେଁ। ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।' },
      401,
    );
  }

  const session = createViewerSession(body.remember === true);
  cookies.set(
    LAND_COOKIE_NAME,
    session.token,
    viewerCookieOptions(request, session.maxAge) as Parameters<typeof cookies.set>[2],
  );
  return json({ ok: true, role: 'viewer' });
};

export const DELETE: APIRoute = async ({ request, cookies }) => {
  cookies.delete(
    LAND_COOKIE_NAME,
    viewerCookieOptions(request, 0) as Parameters<typeof cookies.delete>[1],
  );
  return json({ ok: true });
};

