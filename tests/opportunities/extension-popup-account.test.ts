import { readFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const harness = vi.hoisted(() => ({ changed: null as any, send: vi.fn() }));
vi.mock('../../extension/src/browser', () => ({
    getActiveTab: async () => ({ id: 2, url: 'https://example.org/call', title: 'Example call' }),
    requestSafariAppAccess: async () => true,
    sendRuntimeMessage: (...args: any[]) => harness.send(...args),
    webext: { storage: { local: { get: async () => ({}) }, onChanged: { addListener: (fn: any) => { harness.changed = fn; } } } },
}));
const element = (initial = ''): any => {
    const tokens = new Set(initial.split(/\s+/));
    return { textContent: '', className: '', children: [], listeners: {} as any,
        classList: { add: (x: string) => tokens.add(x), remove: (x: string) => tokens.delete(x), contains: (x: string) => tokens.has(x), toggle: (x: string, force: boolean) => force ? tokens.add(x) : tokens.delete(x) },
        setAttribute: vi.fn(), append(...items: any[]) { this.children.push(...items); },
        replaceChildren(...items: any[]) { this.children = items; },
        addEventListener(name: string, fn: any) { this.listeners[name] = fn; },
    };
};
let nodes: Record<string, any>;
const flush = async () => { for (let i = 0; i < 100; i++) await Promise.resolve(); };
beforeEach(async () => {
    vi.resetModules(); vi.clearAllMocks();
    nodes = {};
    const html = await readFile(new URL('../../extension/popup.html', import.meta.url), 'utf8');
    for (const match of html.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)) nodes[match[1]] = element(match[0].match(/class="([^"]*)"/)?.[1]);
    let ready: any;
    vi.stubGlobal('document', { getElementById: (id: string) => nodes[id], createElement: () => element(), addEventListener: (_event: string, fn: any) => { ready = fn; } });
    harness.send.mockImplementation(async ({ type }: any) => type === 'AUTH_STATE'
        ? { ok: true, data: { signedIn: true, userId: 'account-a', profile: { display_name: 'A', username: 'a' } } }
        : { ok: true, data: null });
    await import('../../extension/src/popup');
    ready(); await flush();
});
afterEach(() => vi.unstubAllGlobals());
describe('Popup account-bound receipts', () => {
    it('shows a failed handoff rather than discarding its optimistic receipt', async () => {
        harness.send.mockImplementation(async () => { throw new Error('Worker unavailable'); });
        await nodes['save-btn'].listeners.click();
        expect(nodes['result-processing-detail'].textContent).toBe('Worker unavailable');
        expect(nodes['result-box'].classList.contains('hidden')).toBe(false);
        expect(nodes['save-btn'].classList.contains('hidden')).toBe(false);
    });
    it('does not render a receipt from a different account', async () => {
        harness.changed({ 'opportunity-capture-state-v1': { newValue: { id: 'private', userId: 'account-b', status: 'error', startedAt: Date.now(), error: 'Other account private text' } } }, 'local');
        expect(nodes['result-processing-detail'].textContent).not.toContain('Other account private text');
        expect(nodes['result-box'].classList.contains('hidden')).toBe(true);
    });
});
