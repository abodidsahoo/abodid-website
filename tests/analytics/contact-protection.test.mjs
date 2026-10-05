import assert from 'node:assert/strict';
import test from 'node:test';
import {
    CONTACT_RATE_LIMIT_MAX,
    CONTACT_RATE_LIMIT_WINDOW_SECONDS,
    consumeContactRateLimit,
    contactRateLimitKey,
    getContactClientIp,
    verifyContactTurnstile,
} from '../../src/lib/contact-protection.js';

const requestFor = (headers = {}, url = 'https://abodid.com/api/contact') =>
    new Request(url, { headers });

test('uses Vercel client headers and stores only a stable HMAC key', () => {
    const request = requestFor({
        'x-vercel-forwarded-for': '203.0.113.42',
        'x-forwarded-for': '198.51.100.10',
    });

    assert.equal(getContactClientIp(request), '203.0.113.42');
    const key = contactRateLimitKey(request, 'test-secret');
    assert.match(key, /^[a-f0-9]{64}$/);
    assert.equal(key, contactRateLimitKey(request, 'test-secret'));
    assert.equal(key.includes('203.0.113.42'), false);
});

test('validates the Turnstile action, hostname, and remote IP', async () => {
    let submitted;
    const result = await verifyContactTurnstile({
        request: requestFor({ 'x-vercel-forwarded-for': '203.0.113.42' }),
        token: 'verified-token',
        secret: 'test-secret',
        fetchImpl: async (_url, options) => {
            submitted = options.body;
            return Response.json({ success: true, action: 'contact', hostname: 'abodid.com' });
        },
    });

    assert.equal(result.success, true);
    assert.equal(submitted.get('response'), 'verified-token');
    assert.equal(submitted.get('remoteip'), '203.0.113.42');
    assert.ok(submitted.get('idempotency_key'));
});

test('rejects tokens issued for another action or hostname', async () => {
    const wrongAction = await verifyContactTurnstile({
        request: requestFor(),
        token: 'verified-token',
        secret: 'test-secret',
        fetchImpl: async () => Response.json({ success: true, action: 'login', hostname: 'abodid.com' }),
    });
    const wrongHostname = await verifyContactTurnstile({
        request: requestFor(),
        token: 'verified-token',
        secret: 'test-secret',
        fetchImpl: async () => Response.json({ success: true, action: 'contact', hostname: 'attacker.example' }),
    });

    assert.equal(wrongAction.success, false);
    assert.equal(wrongHostname.success, false);
});

test('uses the durable database rate limit and preserves contact availability during migration', async () => {
    let rpcArgs;
    const limited = await consumeContactRateLimit({
        request: requestFor({ 'x-vercel-forwarded-for': '203.0.113.42' }),
        secret: 'test-secret',
        supabase: {
            rpc: async (_name, args) => {
                rpcArgs = args;
                return { data: [{ allowed: false, retry_after_seconds: 90 }], error: null };
            },
        },
    });

    assert.deepEqual(limited, { allowed: false, retryAfter: 90, enforced: true });
    assert.equal(rpcArgs.p_limit, CONTACT_RATE_LIMIT_MAX);
    assert.equal(rpcArgs.p_window_seconds, CONTACT_RATE_LIMIT_WINDOW_SECONDS);
    assert.match(rpcArgs.p_key_hash, /^[a-f0-9]{64}$/);

    const originalConsoleError = console.error;
    console.error = () => {};
    try {
        const fallback = await consumeContactRateLimit({
            request: requestFor({ 'x-vercel-forwarded-for': '203.0.113.42' }),
            secret: 'test-secret',
            supabase: { rpc: async () => ({ data: null, error: { message: 'function missing' } }) },
        });
        assert.deepEqual(fallback, { allowed: true, retryAfter: 0, enforced: false });
    } finally {
        console.error = originalConsoleError;
    }
});
