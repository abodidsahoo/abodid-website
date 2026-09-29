const clampCount = (value, max = 10_000) => Math.max(0, Math.min(max, Number(value) || 0));

export const HUMAN_CONFIDENCE_TIERS = Object.freeze({
    FILTERED: 'filtered',
    MEANINGFUL: 'meaningful',
    HIGH_INTENT: 'high_intent',
    EXCEPTIONAL: 'exceptional',
});

/**
 * A deliberately small, deterministic scoring model. It runs once per batched
 * session snapshot, performs no network work, and does not use AI or fingerprinting.
 */
export const calculateHumanConfidence = ({
    activeSeconds = 0,
    pageViews = 1,
    scrollCount = 0,
    maxScrollDepth = 0,
    genuineClicks = 0,
    pointerSamples = 0,
    touchInteractions = 0,
    keyInteractions = 0,
    contentInteractions = 0,
    formSubmitted = false,
    knownBot = false,
    spamRejected = false,
} = {}) => {
    const signals = {
        activeSeconds: clampCount(activeSeconds, 86_400),
        pageViews: clampCount(pageViews, 100),
        scrollCount: clampCount(scrollCount, 1_000),
        maxScrollDepth: Math.max(0, Math.min(1, Number(maxScrollDepth) || 0)),
        genuineClicks: clampCount(genuineClicks, 1_000),
        pointerSamples: clampCount(pointerSamples, 10_000),
        touchInteractions: clampCount(touchInteractions, 1_000),
        keyInteractions: clampCount(keyInteractions, 1_000),
        contentInteractions: clampCount(contentInteractions, 1_000),
        formSubmitted: Boolean(formSubmitted),
    };

    if (knownBot || spamRejected) {
        return {
            score: 0,
            tier: HUMAN_CONFIDENCE_TIERS.FILTERED,
            qualified: false,
            reasons: [knownBot ? 'known_bot' : 'spam_rejected'],
            signals,
        };
    }

    let score = 0;
    const reasons = [];
    const add = (points, reason) => {
        score += points;
        reasons.push(reason);
    };

    if (signals.activeSeconds >= 5) add(10, 'active_5s');
    if (signals.activeSeconds >= 15) add(10, 'active_15s');
    if (signals.activeSeconds >= 30) add(15, 'active_30s');
    if (signals.activeSeconds >= 60) add(10, 'active_60s');
    if (signals.scrollCount >= 1 && signals.maxScrollDepth >= 0.12) add(12, 'meaningful_scroll');
    if (signals.maxScrollDepth >= 0.5) add(8, 'deep_scroll');
    if (signals.genuineClicks >= 1) add(18, 'genuine_click');
    if (signals.genuineClicks >= 2) add(7, 'multiple_clicks');
    if (signals.pointerSamples >= 2) add(5, 'pointer_movement');
    if (signals.touchInteractions >= 1 || signals.keyInteractions >= 1) add(5, 'direct_input');
    if (signals.pageViews >= 2) add(10, 'multiple_pages');
    if (signals.contentInteractions >= 1) add(10, 'content_interaction');
    if (signals.formSubmitted) add(10, 'unverified_form_signal');

    score = Math.min(100, score);

    const hasHumanInput = signals.pointerSamples >= 2 || signals.touchInteractions >= 1 || signals.keyInteractions >= 1;
    const hasBaselineHumanJourney = signals.activeSeconds >= 5 &&
        signals.scrollCount >= 1 &&
        signals.maxScrollDepth >= 0.12 &&
        signals.genuineClicks >= 1 &&
        hasHumanInput;
    // Browser-reported form events are deliberately not a qualification
    // bypass. The form endpoints promote only server-validated submissions.
    const qualified = hasBaselineHumanJourney && score >= 45;

    let tier = HUMAN_CONFIDENCE_TIERS.FILTERED;
    if (qualified) tier = HUMAN_CONFIDENCE_TIERS.MEANINGFUL;
    if (qualified && signals.activeSeconds >= 30 &&
        (signals.contentInteractions >= 1 || signals.pageViews >= 2 || signals.genuineClicks >= 2)) {
        tier = HUMAN_CONFIDENCE_TIERS.HIGH_INTENT;
    }
    if (qualified && signals.activeSeconds >= 60 &&
        (signals.contentInteractions >= 1 || signals.pageViews >= 2)) {
        tier = HUMAN_CONFIDENCE_TIERS.EXCEPTIONAL;
    }

    return { score, tier, qualified, reasons, signals };
};

export const isHumanConfidenceTier = (value) => (
    value === HUMAN_CONFIDENCE_TIERS.MEANINGFUL ||
    value === HUMAN_CONFIDENCE_TIERS.HIGH_INTENT ||
    value === HUMAN_CONFIDENCE_TIERS.EXCEPTIONAL
);
