import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');

describe('Safari extension authentication handoff', () => {
    it('requests the callback origin as an optional Safari host permission', async () => {
        const manifest = JSON.parse(await source('../../extension/manifests/safari.json'));

        expect(manifest.host_permissions).not.toContain('https://abodid.com/*');
        expect(manifest.optional_host_permissions).toContain('https://abodid.com/*');
        expect(manifest.content_scripts).toEqual(expect.arrayContaining([
            expect.objectContaining({
                matches: ['https://abodid.com/opportunities/extension/callback*'],
                js: ['safari-callback.js'],
            }),
        ]));
    });

    it('asks for Safari site access before starting OAuth', async () => {
        const popup = await source('../../extension/src/popup.ts');
        const signInHandler = popup.slice(popup.indexOf("signInButton.addEventListener('click'"));

        expect(signInHandler.indexOf('await requestSafariAppAccess()')).toBeGreaterThan(-1);
        expect(signInHandler.indexOf("sendRuntimeMessage<any>({ type: 'AUTH_LOGIN' })"))
            .toBeGreaterThan(signInHandler.indexOf('await requestSafariAppAccess()'));
    });

    it('keeps callback retries bounded and validates the exact sender route', async () => {
        const [callback, background, auth] = await Promise.all([
            source('../../extension/src/safari-callback.ts'),
            source('../../extension/src/background.ts'),
            source('../../extension/src/auth.ts'),
        ]);

        expect(callback).toContain('CALLBACK_ATTEMPTS = 3');
        expect(callback).toContain('CALLBACK_TIMEOUT_MS = 10_000');
        expect(background).toContain("actual.pathname === '/opportunities/extension/callback'");
        expect(background).not.toContain("sender?.url?.startsWith(`${__APP_ORIGIN__}/opportunities/extension/callback`)");
        expect(auth.indexOf('exchangeCodeForSession(code)'))
            .toBeLessThan(auth.lastIndexOf('remove(SAFARI_STATE_KEY)'));
    });
});
