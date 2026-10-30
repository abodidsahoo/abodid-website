import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('Production extension build guards', () => {
    const rejectBuild = (overrides: Record<string, string>) => {
        try {
            execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--config', 'extension/vite.config.mjs'], {
                env: {
                    ...process.env, BROWSER_TARGET: 'chrome',
                    PUBLIC_SUPABASE_URL: 'https://fixture.supabase.co',
                    PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_nonsecret_fixture',
                    OPPORTUNITIES_APP_ORIGIN: 'https://abodid.com', ...overrides,
                },
                encoding: 'utf8', stdio: 'pipe',
            });
            return '';
        } catch (error) {
            return String((error as { stderr?: string }).stderr || '');
        }
    };
    it.each(['http://localhost:4321', 'https://abodid.com/api', 'https://user:password@abodid.com'])(
        'rejects a development or malformed app origin before writing the build: %s', (origin) => {
            expect(rejectBuild({ OPPORTUNITIES_APP_ORIGIN: origin })).toContain('Production requires');
        },
    );
    it.each([
        'sb_secret_nonsecret_test_fixture',
        `test.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.test`,
    ])('rejects a privileged credential type before bundling', (key) => {
        expect(rejectBuild({ PUBLIC_SUPABASE_ANON_KEY: key })).toContain('Only a public Supabase');
    });
});
