const POPUP_STATE_KEY = "newsletter_popup_state_v2";
const LEGACY_DISMISSED_KEY = "newsletter_popup_dismissed";
const FOOTER_FORM_SESSION_KEY = "newsletter_popup_footer_form_session_v1";
const DISMISS_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

const emptyState = () => ({
    dismissedAt: "",
    subscribedAt: "",
    lastShownSessionId: "",
});

const canUseLocalStorage = () =>
    typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const canUseSessionStorage = () =>
    typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";

const safeParse = (value) => {
    if (!value) return null;

    try {
        return JSON.parse(value);
    } catch (_error) {
        return null;
    }
};

const cleanString = (value) =>
    typeof value === "string" ? value.trim() : "";

const normalizeState = (value) => {
    const source = value && typeof value === "object" ? value : {};

    return {
        dismissedAt: cleanString(source.dismissedAt),
        subscribedAt: cleanString(source.subscribedAt),
        lastShownSessionId: cleanString(source.lastShownSessionId),
    };
};

const persistState = (state) => {
    if (!canUseLocalStorage()) return state;

    try {
        window.localStorage.setItem(POPUP_STATE_KEY, JSON.stringify(state));
    } catch (_error) {
        // no-op
    }

    return state;
};

export const readNewsletterPopupState = () => {
    if (!canUseLocalStorage()) return emptyState();

    const parsed = safeParse(window.localStorage.getItem(POPUP_STATE_KEY));
    const normalized = normalizeState(parsed);

    if (
        !normalized.dismissedAt &&
        !normalized.subscribedAt &&
        window.localStorage.getItem(LEGACY_DISMISSED_KEY)
    ) {
        normalized.dismissedAt = new Date().toISOString();
        persistState(normalized);
    }

    return normalized;
};

export const writeNewsletterPopupState = (partialState) => {
    const currentState = readNewsletterPopupState();
    const nextState = normalizeState({ ...currentState, ...partialState });
    return persistState(nextState);
};

export const markNewsletterPopupDismissed = () => {
    const dismissedAt = new Date().toISOString();
    const nextState = writeNewsletterPopupState({ dismissedAt });

    if (canUseLocalStorage()) {
        try {
            window.localStorage.setItem(LEGACY_DISMISSED_KEY, "true");
        } catch (_error) {
            // no-op
        }
    }

    return nextState;
};

export const markNewsletterPopupSubscribed = () => {
    const subscribedAt = new Date().toISOString();
    const nextState = writeNewsletterPopupState({ subscribedAt });

    if (canUseLocalStorage()) {
        try {
            window.localStorage.setItem(LEGACY_DISMISSED_KEY, "true");
        } catch (_error) {
            // no-op
        }
    }

    return nextState;
};

export const markNewsletterPopupShownForSession = (sessionId) => {
    if (!cleanString(sessionId)) return readNewsletterPopupState();

    return writeNewsletterPopupState({
        lastShownSessionId: sessionId,
    });
};

export const shouldSuppressNewsletterPopup = (
    popupState,
    sessionId,
    now = Date.now(),
) => {
    const state = normalizeState(popupState);

    if (state.subscribedAt) return true;

    if (state.dismissedAt) {
        const dismissedAtMs = Date.parse(state.dismissedAt);
        if (Number.isFinite(dismissedAtMs) && now - dismissedAtMs < DISMISS_COOLDOWN_MS) {
            return true;
        }
    }

    if (cleanString(sessionId) && state.lastShownSessionId === cleanString(sessionId)) {
        return true;
    }

    return false;
};

export const markFooterFormSessionSuppressed = (sessionId) => {
    if (!canUseSessionStorage()) return;

    try {
        window.sessionStorage.setItem(
            FOOTER_FORM_SESSION_KEY,
            cleanString(sessionId) || "engaged",
        );
    } catch (_error) {
        // no-op
    }
};

export const isFooterFormSessionSuppressed = (sessionId) => {
    if (!canUseSessionStorage()) return false;

    try {
        const storedValue = cleanString(
            window.sessionStorage.getItem(FOOTER_FORM_SESSION_KEY),
        );

        if (!storedValue) return false;
        if (storedValue === "engaged") return true;

        return cleanString(sessionId) === storedValue;
    } catch (_error) {
        return false;
    }
};

export {
    DISMISS_COOLDOWN_MS,
    FOOTER_FORM_SESSION_KEY,
    LEGACY_DISMISSED_KEY,
    POPUP_STATE_KEY,
};
