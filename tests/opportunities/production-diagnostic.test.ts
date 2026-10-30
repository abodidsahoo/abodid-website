import { afterEach, expect, it, vi } from 'vitest';
import { GET } from '../../src/pages/api/test-openrouter';
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it('does not let a public diagnostic GET spend credits in production', async () => {
    vi.stubEnv('PROD', true);
    const provider = vi.fn();
    vi.stubGlobal('fetch', provider);
    const response = await GET({ request: new Request('https://abodid.com/api/test-openrouter') } as any);
    expect(response.status).toBe(404);
    expect(provider).not.toHaveBeenCalled();
});
