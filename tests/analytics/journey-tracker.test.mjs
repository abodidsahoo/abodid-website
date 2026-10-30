import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { calculateHumanConfidence } from '../../src/lib/analytics/human-confidence.js';

const fullScript = readFileSync(new URL('../../public/scripts/journey-tracker.js', import.meta.url), 'utf8');
const script = fullScript.slice(fullScript.lastIndexOf('\n(function () {'));

function browserFixture({ webdriver = false } = {}) {
    let now = 1_000_000;
    let nextTimer = 0;
    const timers = new Map();
    const listeners = new Map();
    const storage = new Map();
    const payloads = [];
    const on = (surface) => (name, callback) => {
        const key = `${surface}:${name}`;
        listeners.set(key, [...(listeners.get(key) || []), callback]);
    };
    const root = { scrollHeight: 3000, clientHeight: 800, clientWidth: 1200 };
    const document = { documentElement: root, visibilityState: 'visible', cookie: '', referrer: 'https://google.com/', title: 'Work', hasFocus: () => true, addEventListener: on('document') };
    const window = {
        location: { hostname: 'abodid.com', pathname: '/work', search: '', port: '' }, crypto: webcrypto,
        innerHeight: 800, scrollY: 0, addEventListener: on('window'),
        setTimeout: (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, due: now + delay }); return id; },
        setInterval: (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, due: now + delay, interval: delay }); return id; },
        fetch: async (_url, options) => { payloads.push(JSON.parse(options.body)); },
    };
    const localStorage = { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), key: index => [...storage.keys()][index], get length() { return storage.size; } };
    class ClockDate extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
    vm.runInNewContext(script, { window, document, navigator: { webdriver, userAgent: 'Macintosh' }, localStorage, Date: ClockDate, performance: { now: () => now }, URLSearchParams, Blob, console });
    const emit = (surface, name, props = {}) => { for (const callback of listeners.get(`${surface}:${name}`) || []) callback({ isTrusted: true, target: document, ...props }); };
    const advance = (milliseconds) => {
        const end = now + milliseconds;
        for (;;) {
            const ready = [...timers].filter(([, timer]) => timer.due <= end).sort((a, b) => a[1].due - b[1].due)[0];
            if (!ready) break;
            now = ready[1].due;
            if (ready[1].interval) ready[1].due += ready[1].interval; else timers.delete(ready[0]);
            ready[1].callback();
        }
        now = end;
    };
    return { window, document, payloads, emit, advance, last: () => payloads.at(-1) };
}

test('idle time is capped and returning interaction never bridges the idle gap', () => {
    const b = browserFixture();
    b.advance(120000);
    b.emit('window', 'pagehide');
    assert.equal(b.last().engagedSeconds, 60);
    b.emit('window', 'pointermove', { clientX: 10, clientY: 10 });
    b.advance(1000);
    b.emit('window', 'pagehide');
    assert.equal(b.last().engagedSeconds, 61);
});

test('programmatic scrolls and synthetic pointer events do not produce human evidence', () => {
    const b = browserFixture();
    b.emit('window', 'pointermove', { isTrusted: false, clientX: 100, clientY: 100 });
    b.window.scrollY = 300;
    b.emit('window', 'scroll');
    b.advance(200);
    b.window.scrollY = 600;
    b.emit('window', 'scroll');
    b.advance(4000);
    b.emit('window', 'pagehide');
    const signals = b.last().humanSignals;
    assert.equal(signals.pointerSamples, 0);
    assert.equal(signals.intentionalScrollSamples, 0);
    assert.equal(calculateHumanConfidence({ ...signals, activeSeconds: b.last().engagedSeconds }).qualified, false);
});

test('input-linked scrolling qualifies a short session and emits no raw movement trail', () => {
    const b = browserFixture();
    b.emit('window', 'wheel', { deltaY: 100 });
    b.window.scrollY = 100;
    b.emit('window', 'scroll');
    b.advance(200);
    b.emit('window', 'wheel', { deltaY: 100 });
    b.window.scrollY = 200;
    b.emit('window', 'scroll');
    b.advance(1500);
    b.emit('window', 'pagehide');
    const payload = b.last();
    assert.ok(payload.engagedSeconds < 5);
    assert.equal(payload.humanSignals.intentionalScrollSamples, 2);
    assert.equal(calculateHumanConfidence({ ...payload.humanSignals, activeSeconds: payload.engagedSeconds }).qualified, true);
    assert.deepEqual(Object.keys(payload.humanSignals).filter(key => /clientX|clientY|trajectory|keyValue/.test(key)), []);
});

test('varied pointer motion is sampled, aggregated and transmitted before five seconds', () => {
    const b = browserFixture();
    for (const [x, y] of [[0, 0], [20, 0], [45, 20], [25, 60], [80, 70], [110, 20], [90, 90]]) {
        b.emit('window', 'pointermove', { clientX: x, clientY: y });
        b.advance(100);
    }
    b.advance(1000);
    const payload = b.last();
    assert.equal(payload.humanSignals.pointerSamples, 7);
    assert.ok(payload.humanSignals.pointerDirectionChanges >= 1);
    assert.ok(payload.engagedSeconds < 5);
    assert.equal(calculateHumanConfidence({ ...payload.humanSignals, activeSeconds: payload.engagedSeconds }).qualified, true);
});

test('known webdriver sessions remain excluded from collection', () => {
    const b = browserFixture({ webdriver: true });
    b.advance(120000);
    b.emit('window', 'pagehide');
    assert.equal(b.payloads.length, 0);
});
