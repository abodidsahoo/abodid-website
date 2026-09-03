import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setMaxListeners } from "node:events";
import { setImmediate } from "node:timers/promises";
import vm from "node:vm";
import test from "node:test";

const component = readFileSync(new URL("../../src/components/VaultAskSection.astro", import.meta.url), "utf8");
const script = component.match(/<script>([\s\S]*?)<\/script>/)[1]
  .replace(/import \{ marked \} from "marked";/, "");

// Exercise the real component script with a small DOM adapter. Rendering is
// checked in the browser; these tests isolate navigation and request lifecycle.
class Element extends EventTarget {
  constructor() {
    super();
    this.dataset = {};
    this.style = {};
    this.attributes = new Map();
    this.hidden = true;
    this.disabled = false;
    this.value = "";
    this.textContent = "";
    this.scrollHeight = 100;
    this.clientHeight = 100;
    this.children = [];
    const classes = new Set();
    this.classList = {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      toggle: (name, force = !classes.has(name)) => {
        if (force) classes.add(name);
        else classes.delete(name);
        return force;
      },
    };
  }
  setAttribute(name, value) { this.attributes.set(name, value); }
  querySelectorAll() { return []; }
  replaceChildren(...children) { this.children = children; }
  appendChild(child) { this.children.push(child); }
  focus() { this.focused = true; }
}

function createRoot() {
  const root = new Element();
  const elements = new Map();
  for (const name of ["form", "input", "submit", "status", "error", "result", "answer", "answer-text", "answer-toggle", "sources", "source-list", "citation-popover"]) {
    elements.set(`[data-vault-${name}]`, new Element());
  }
  root.querySelector = (selector) => elements.get(selector) || null;
  root.get = (name) => elements.get(`[data-vault-${name}]`);
  root.get("submit").disabled = true;
  return root;
}

function setup({ url = "http://localhost/research/obsidian-vault", fetchImpl, blockStorage = false } = {}) {
  let root = createRoot();
  const document = new EventTarget();
  document.querySelectorAll = () => root ? [root] : [];
  document.createElement = () => {
    const element = new Element();
    element.content = new Element();
    return element;
  };
  document.createTreeWalker = () => ({ nextNode: () => null });
  const window = new EventTarget();
  window.location = new URL(url);
  window.scrollY = 0;
  window.requestAnimationFrame = (callback) => callback();
  window.scrollTo = () => {};
  window.crypto = { randomUUID: () => "test-search-id" };
  window.history = {
    state: { index: 2, __astro: true },
    pushState(state, _title, nextUrl) { this.state = state; window.location = new URL(nextUrl); },
    replaceState(state, _title, nextUrl) { this.state = state; window.location = new URL(nextUrl); },
  };
  const stored = new Map();
  const calls = [];
  class TestAbortController extends AbortController {
    constructor() { super(); setMaxListeners(0, this.signal); }
  }
  const context = vm.createContext({
    document,
    window,
    URL,
    URLSearchParams,
    AbortController: TestAbortController,
    Error,
    NodeFilter: { SHOW_TEXT: 4 },
    marked: { parse: (text) => text },
    sessionStorage: {
      getItem: (key) => stored.get(key) || null,
      setItem: (key, value) => {
        if (blockStorage) throw new Error("Storage blocked");
        stored.set(key, value);
      },
    },
    fetch: async (...args) => {
      calls.push(args);
      return fetchImpl ? fetchImpl(...args) : { ok: true, json: async () => ({ answer: "A useful vault answer.", sources: [] }) };
    },
  });
  vm.runInContext(script, context);
  return {
    document, window, calls,
    get root() { return root; },
    navigate(nextRoot, nextUrl = "http://localhost/research/obsidian-vault") {
      document.dispatchEvent(new Event("astro:before-swap"));
      root = nextRoot;
      window.location = new URL(nextUrl);
      document.dispatchEvent(new Event("astro:page-load"));
    },
    submit(question = "Tell me more about grief.\n") {
      root.get("input").value = question;
      const event = new Event("submit", { cancelable: true });
      root.get("form").dispatchEvent(event);
      return event;
    },
  };
}

test("initial form is disabled until initialized and mounts only once", async () => {
  assert.match(component, /data-vault-submit[^>]*disabled/);
  const app = setup();
  assert.equal(app.root.get("submit").disabled, false);
  app.document.dispatchEvent(new Event("astro:page-load"));
  assert.equal(app.submit().defaultPrevented, true);
  await setImmediate();
  assert.equal(app.calls.length, 1);
  assert.equal(app.calls[0][0], "/api/vault-chat");
  assert.equal(app.calls[0][1].method, "POST");
});

test("Vault → note → Vault remounts and submits grief via the API, not native GET", async () => {
  const app = setup();
  const oldRoot = app.root;
  app.navigate(null, "http://localhost/research/obsidian-vault/example-note");
  assert.equal(oldRoot.get("submit").disabled, true);
  assert.equal(oldRoot.dataset.initialized, undefined);
  app.navigate(createRoot());
  assert.equal(app.root.dataset.initialized, "true");
  assert.equal(app.submit().defaultPrevented, true);
  await setImmediate();
  assert.equal(JSON.parse(app.calls[0][1].body).question, "Tell me more about grief.");
  assert.equal(app.root.get("result").hidden, false);
  assert.equal(app.window.location.searchParams.has("question"), false);
  assert.equal(app.window.location.searchParams.get("vaultSearch"), "test-search-id");
  assert.equal(app.window.history.state.__astro, true);
});

test("navigation aborts an in-flight request and ignores any late answer", async () => {
  let finish;
  const app = setup({ fetchImpl: () => new Promise((resolve) => { finish = resolve; }) });
  app.submit();
  app.submit();
  assert.equal(app.calls.length, 1, "duplicate submits are ignored while busy");
  app.navigate(null, "http://localhost/research/obsidian-vault/example-note");
  assert.equal(app.calls[0][1].signal.aborted, true);
  finish({ ok: true, json: async () => ({ answer: "Late answer", sources: [] }) });
  await setImmediate();
  assert.equal(app.window.location.pathname, "/research/obsidian-vault/example-note");
  assert.equal(app.window.location.search, "");
});

test("blocked browser storage does not hide or report a successful answer as failed", async () => {
  const app = setup({ blockStorage: true });
  app.submit();
  await setImmediate();
  assert.equal(app.root.get("result").hidden, false);
  assert.equal(app.root.get("error").hidden, true);
  assert.equal(app.root.get("submit").disabled, false);
});

test("legacy question URLs restore the draft without automatically spending an API request", () => {
  const app = setup({ url: "http://localhost/research/obsidian-vault?question=Tell+me+more+about+grief.%0A" });
  assert.equal(app.root.get("input").value, "Tell me more about grief.");
  assert.equal(app.window.location.search, "");
  assert.equal(app.calls.length, 0);
});

test("API errors remain visible and re-enable the Ask button", async () => {
  const app = setup({ fetchImpl: async () => ({ ok: false, json: async () => ({ error: "Please try again shortly." }) }) });
  app.submit();
  await setImmediate();
  assert.equal(app.root.get("error").hidden, false);
  assert.equal(app.root.get("error").textContent, "Please try again shortly.");
  assert.equal(app.root.get("submit").disabled, false);
});

test("returning to a saved search restores the answer without repeating the API call", async () => {
  const app = setup();
  app.submit();
  await setImmediate();
  const searchUrl = app.window.location.href;
  app.navigate(null, "http://localhost/research/obsidian-vault/example-note");
  app.navigate(createRoot(), searchUrl);
  assert.equal(app.root.get("input").value, "Tell me more about grief.");
  assert.equal(app.root.get("result").hidden, false);
  assert.equal(app.calls.length, 1);
});
