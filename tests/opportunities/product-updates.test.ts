import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OpportunityProductUpdatesOptIn } from '../../src/components/opportunities/OpportunityProductUpdatesOptIn';
import {
    completeProductUpdatesSignIn, discardProductUpdatesSignIn, prepareProductUpdatesSignIn,
    PRODUCT_UPDATES_CONSENT_VERSION, PRODUCT_UPDATES_INTENT_KEY,
} from '../../src/lib/opportunities/productUpdates';

const setup = () => {
    const values = new Map<string, string>();
    const storage = {
        getItem: (key: string) => values.get(key) || null,
        setItem: (key: string, value: string) => { values.set(key, value); },
        removeItem: (key: string) => { values.delete(key); },
    };
    const callback = new URL('https://abodid.com/opportunities/auth/callback?next=/opportunities/example');
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 200 }));
    return { storage, callback, fetchMock };
};

describe('Optional product-update consent during Google sign-in', () => {
    it('renders a labeled native checkbox without selecting or requiring it', () => {
        const html = renderToStaticMarkup(React.createElement(OpportunityProductUpdatesOptIn, { checked: false, onChange: () => {} }));
        expect(html).toContain('type="checkbox"');
        expect(html).toContain('Optional.');
        expect(html).toContain('Abodid &amp; Co.');
        expect(html).not.toMatch(/checked=|required=/);
    });

    it('does not subscribe an unchecked user or reuse an earlier opt-in', async () => {
        const { storage, callback, fetchMock } = setup();
        prepareProductUpdatesSignIn(callback, true, () => storage, 1000);
        prepareProductUpdatesSignIn(callback, false, () => storage, 1001);
        expect(callback.searchParams.has('updates_intent')).toBe(false);
        expect(storage.getItem(PRODUCT_UPDATES_INTENT_KEY)).toBeNull();
        expect(await completeProductUpdatesSignIn('token', callback.searchParams, () => storage, fetchMock, 1100)).toBe('none');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('binds affirmative consent to one OAuth attempt and saves it only after sign-in', async () => {
        const { storage, callback, fetchMock } = setup();
        prepareProductUpdatesSignIn(callback, true, () => storage, 1000);
        expect(callback.searchParams.get('next')).toBe('/opportunities/example');
        expect(fetchMock).not.toHaveBeenCalled();
        expect(await completeProductUpdatesSignIn('verified-token', callback.searchParams, () => storage, fetchMock, 1100)).toBe('saved');
        const [, request] = fetchMock.mock.calls[0];
        expect(request?.headers).toMatchObject({ Authorization: 'Bearer verified-token' });
        expect(JSON.parse(request?.body as string)).toEqual({ opt_in: true, source: 'onboarding', consent_version: PRODUCT_UPDATES_CONSENT_VERSION });
        expect(storage.getItem(PRODUCT_UPDATES_INTENT_KEY)).toBeNull();
        await completeProductUpdatesSignIn('verified-token', callback.searchParams, () => storage, fetchMock, 1200);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it.each([
        { createdAt: 0 },
        { createdAt: 9_000_000 },
        { version: 'old-version' },
        { optedIn: 'true' },
    ])('rejects stale or invalid intent data: %j', async (patch) => {
        const { storage, callback, fetchMock } = setup();
        prepareProductUpdatesSignIn(callback, true, () => storage, 4_000_000);
        const intent = JSON.parse(storage.getItem(PRODUCT_UPDATES_INTENT_KEY)!);
        storage.setItem(PRODUCT_UPDATES_INTENT_KEY, JSON.stringify({ ...intent, ...patch }));
        expect(await completeProductUpdatesSignIn('token', callback.searchParams, () => storage, fetchMock, 4_000_100)).toBe('none');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('does not treat a callback URL or a different sign-in attempt as consent', async () => {
        const { storage, callback, fetchMock } = setup();
        callback.searchParams.set('updates_intent', 'untrusted');
        await completeProductUpdatesSignIn('token', callback.searchParams, () => storage, fetchMock);
        prepareProductUpdatesSignIn(callback, true, () => storage, 1000);
        const currentNonce = callback.searchParams.get('updates_intent');
        callback.searchParams.set('updates_intent', 'different-attempt');
        await completeProductUpdatesSignIn('token', callback.searchParams, () => storage, fetchMock, 1100);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(JSON.parse(storage.getItem(PRODUCT_UPDATES_INTENT_KEY)!).nonce).toBe(currentNonce);
    });

    it('clears consent when its sign-in attempt fails or is cancelled', () => {
        const { storage, callback } = setup();
        prepareProductUpdatesSignIn(callback, true, () => storage);
        discardProductUpdatesSignIn(callback, () => storage);
        expect(storage.getItem(PRODUCT_UPDATES_INTENT_KEY)).toBeNull();
    });

    it('keeps authentication possible when browser storage is blocked', () => {
        const { callback } = setup();
        const blocked = () => { throw new Error('Storage blocked'); };
        expect(() => prepareProductUpdatesSignIn(callback, true, blocked)).not.toThrow();
        expect(callback.searchParams.get('updates_notice')).toBe('not-saved');
        expect(() => prepareProductUpdatesSignIn(callback, false, blocked)).not.toThrow();
        expect(callback.searchParams.has('updates_notice')).toBe(false);
    });

    it('reports optional subscription failure without throwing or retrying on another login', async () => {
        const { storage, callback, fetchMock } = setup();
        prepareProductUpdatesSignIn(callback, true, () => storage, 1000);
        fetchMock.mockRejectedValue(new Error('Offline'));
        expect(await completeProductUpdatesSignIn('token', callback.searchParams, () => storage, fetchMock, 1100)).toBe('not-saved');
        expect(storage.getItem(PRODUCT_UPDATES_INTENT_KEY)).toBeNull();
    });
});
