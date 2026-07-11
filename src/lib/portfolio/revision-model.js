export function createRevisionState(initialDraft) {
  return { draft: structuredClone(initialDraft), published: null, history: [], lockVersion: 0 };
}

export function autosaveRevision(state, nextDraft, expectedLockVersion) {
  if (expectedLockVersion !== state.lockVersion) {
    const error = new Error("PORTFOLIO_CONFLICT");
    error.code = "PORTFOLIO_CONFLICT";
    throw error;
  }
  return { ...state, draft: structuredClone(nextDraft), lockVersion: state.lockVersion + 1 };
}

export function publishRevision(state) {
  const snapshot = Object.freeze(structuredClone(state.draft));
  return { ...state, published: snapshot, history: [...state.history, snapshot] };
}

export function restoreRevision(state, historyIndex) {
  const source = state.history[historyIndex];
  if (!source) throw new Error("PORTFOLIO_REVISION_NOT_FOUND");
  return { ...state, draft: structuredClone(source), lockVersion: 0 };
}

