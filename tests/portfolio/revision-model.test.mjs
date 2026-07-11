import test from "node:test";
import assert from "node:assert/strict";
import { autosaveRevision, createRevisionState, publishRevision, restoreRevision } from "../../src/lib/portfolio/revision-model.js";

test("autosave changes draft without changing the published snapshot", () => {
  let state = createRevisionState({ title: "Version one", blocks: [] });
  state = publishRevision(state);
  state = autosaveRevision(state, { title: "Version two", blocks: [] }, 0);
  assert.equal(state.draft.title, "Version two");
  assert.equal(state.published.title, "Version one");
});

test("stale autosave is rejected", () => {
  let state = createRevisionState({ title: "A" });
  state = autosaveRevision(state, { title: "B" }, 0);
  assert.throws(() => autosaveRevision(state, { title: "C" }, 0), /PORTFOLIO_CONFLICT/);
});

test("publishing creates recoverable immutable history", () => {
  let state = createRevisionState({ title: "One", blocks: [{ id: 1 }] });
  state = publishRevision(state);
  state = autosaveRevision(state, { title: "Two", blocks: [] }, 0);
  state = publishRevision(state);
  const restored = restoreRevision(state, 0);
  assert.equal(restored.draft.title, "One");
  assert.equal(state.published.title, "Two");
  assert.equal(state.history.length, 2);
});

