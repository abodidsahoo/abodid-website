import { readFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const harness = vi.hoisted(() => ({ changed: null as any, send: vi.fn(), tab: vi.fn(), stored: {} as Record<string, any> }));
vi.mock('../../extension/src/browser', () => ({
    getActiveTab: () => harness.tab(),
    requestSafariAppAccess: async () => true,
    sendRuntimeMessage: (...args: any[]) => harness.send(...args),
    webext: { storage: { local: { get: async () => harness.stored }, onChanged: { addListener: (fn: any) => { harness.changed = fn; } } } },
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
const openPopup = async () => {
    vi.resetModules();
    nodes = {};
    const html = await readFile(new URL('../../extension/popup.html', import.meta.url), 'utf8');
    for (const match of html.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)) nodes[match[1]] = element(match[0].match(/class="([^"]*)"/)?.[1]);
    let ready: any;
    vi.stubGlobal('document', { getElementById: (id: string) => nodes[id], createElement: () => element(), addEventListener: (_event: string, fn: any) => { ready = fn; } });
    await import('../../extension/src/popup');
    ready(); await flush();
};
beforeEach(async () => {
    vi.useFakeTimers(); vi.clearAllMocks();
    harness.stored = {};
    harness.tab.mockResolvedValue({ id: 2, url: 'https://example.org/call', title: 'Example call' });
    harness.send.mockImplementation(async ({ type }: any) => type === 'AUTH_STATE'
        ? { ok: true, data: { signedIn: true, userId: 'account-a', profile: { display_name: 'A', username: 'a' } } }
        : { ok: true, data: null });
    await openPopup();
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const capture = (overrides: Record<string, any> = {}) => ({
    id: 'latest', userId: 'account-a', status: 'success', startedAt: Date.now(),
    url: 'https://example.org/call', title: 'Saved call', ...overrides,
});
const updateCapture = (state: any) => harness.changed({ 'opportunity-capture-state-v1': { newValue: state } }, 'local');
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
    it.each([
        { status: 'success' },
        { status: 'success', result: { is_duplicate: true } },
        { status: 'error', error: 'Previous page failed' },
    ])('hides an unrelated final receipt: %j', (overrides) => {
        updateCapture(capture({ ...overrides, url: 'https://example.org/previous-call' }));
        expect(nodes['result-box'].classList.contains('hidden')).toBe(true);
        expect(nodes['capture-progress'].classList.contains('hidden')).toBe(true);
        expect(nodes['save-btn'].classList.contains('hidden')).toBe(false);
        expect(nodes['save-btn'].disabled).toBe(false);
    });
    it.each(['success', 'error'])('keeps the current page %s receipt, ignoring fragment changes', (status) => {
        updateCapture(capture({ status, url: 'https://example.org/call#apply', error: 'Try this page again' }));
        expect(nodes['result-box'].classList.contains('hidden')).toBe(false);
        expect(nodes['save-btn'].classList.contains('hidden')).toBe(status === 'success');
    });
    it('treats different query parameters as different opportunities', () => {
        updateCapture(capture({ url: 'https://example.org/call?id=another' }));
        expect(nodes['result-box'].classList.contains('hidden')).toBe(true);
    });
    it('clears an unrelated queued receipt when its completion arrives', () => {
        const state = capture({ status: 'queued', url: 'https://example.org/previous-call' });
        updateCapture(state);
        expect(nodes['result-box'].classList.contains('hidden')).toBe(false);
        expect(nodes['result-source'].textContent).toBe('Saved call');
        expect(nodes['save-btn'].classList.contains('hidden')).toBe(true);
        updateCapture({ ...state, status: 'success' });
        expect(nodes['result-box'].classList.contains('hidden')).toBe(true);
        expect(nodes['save-btn'].classList.contains('hidden')).toBe(false);
        expect(vi.getTimerCount()).toBe(0);
    });
    it('hides the top-left status badge while queued to avoid duplicate processing labels', () => {
        updateCapture(capture({ status: 'queued', url: 'https://example.org/call' }));
        expect(nodes['result-box'].classList.contains('hidden')).toBe(false);
        expect(nodes['result-success-badge'].classList.contains('hidden')).toBe(true);
        expect(nodes['result-processing-title'].textContent).toBe('Processing opportunity');
    });
    it('restores sending progress from another page', () => {
        updateCapture(capture({ status: 'capturing', url: 'https://example.org/previous-call' }));
        expect(nodes['capture-progress'].classList.contains('hidden')).toBe(false);
        expect(nodes['save-btn'].classList.contains('hidden')).toBe(true);
    });
    it('does not show the previous saved card when reopened on a new page', async () => {
        const previous = capture({ url: 'https://example.org/previous-call' });
        harness.stored = {
            'opportunity-auth-cache-v1': { signedIn: true, userId: 'account-a' },
            'opportunity-capture-state-v1': previous,
        };
        harness.send.mockImplementation(async ({ type }: any) => ({
            ok: true, data: type === 'AUTH_STATE' ? { signedIn: true, userId: 'account-a' } : previous,
        }));
        await openPopup();
        expect(nodes['page-title'].textContent).toBe('Example call');
        expect(nodes['result-box'].classList.contains('hidden')).toBe(true);
        expect(nodes['save-btn'].classList.contains('hidden')).toBe(false);
    });
    it('renders the matching receipt after a slow current-tab lookup', async () => {
        let resolveTab: (tab: any) => void = () => {};
        harness.tab.mockImplementation(() => new Promise((resolve) => { resolveTab = resolve; }));
        harness.send.mockImplementation(async ({ type }: any) => ({
            ok: true, data: type === 'AUTH_STATE' ? { signedIn: true, userId: 'account-a' } : capture(),
        }));
        await openPopup();
        expect(nodes['result-box'].classList.contains('hidden')).toBe(true);
        resolveTab({ id: 2, url: 'https://example.org/call', title: 'Example call' });
        await flush();
        expect(nodes['result-box'].classList.contains('hidden')).toBe(false);
        expect(nodes['save-btn'].classList.contains('hidden')).toBe(true);
    });
    it('keeps the save control unavailable and hides old receipts on a restricted tab', async () => {
        harness.tab.mockResolvedValue({ id: 2, title: 'Chrome settings' });
        await openPopup();
        updateCapture(capture());
        expect(nodes['result-box'].classList.contains('hidden')).toBe(true);
        expect(nodes['save-btn'].disabled).toBe(true);
    });
    it('saves the new current page after hiding the previous saved receipt', async () => {
        updateCapture(capture({ url: 'https://example.org/previous-call' }));
        harness.send.mockResolvedValue({ ok: true, data: capture({ id: 'new-job', status: 'queued', startedAt: Date.now() + 1 }) });
        await nodes['save-btn'].listeners.click();
        expect(harness.send).toHaveBeenCalledWith({
            type: 'START_CAPTURE', tabId: 2, url: 'https://example.org/call', title: 'Example call',
        });
        expect(nodes['result-success-badge'].classList.contains('hidden')).toBe(true);
        expect(nodes['result-processing-title'].textContent).toBe('Processing opportunity');
        expect(nodes['result-source'].classList.contains('hidden')).toBe(true);
    });
});
