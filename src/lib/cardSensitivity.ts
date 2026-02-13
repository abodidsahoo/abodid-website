const clamp = (value: number, min: number, max: number): number => {
    return Math.min(max, Math.max(min, value));
};

const lerp = (start: number, end: number, t: number): number => {
    return start + (end - start) * t;
};

export type CardSensitivityProfile = {
    normalized: number;
    unstackThreshold: number;
    restackThreshold: number;
    wheelCooldownMs: number;
    mouseThreshold: number;
    spawnCooldownMs: number;
    gestureThreshold: number;
    gestureCooldownMs: number;
};

export const buildCardSensitivityProfile = (rawSensitivity = 0.55): CardSensitivityProfile => {
    const normalizedInput = Number.isFinite(rawSensitivity) ? rawSensitivity : 0.55;
    const normalized = clamp(normalizedInput, 0, 1);

    // Lower sensitivity means larger movement required + slower repeat spawning.
    const pushDistanceMultiplier = lerp(1.9, 0.58, normalized);
    const spawnRateMultiplier = lerp(1.75, 0.62, normalized);

    const unstackThreshold = Math.round(clamp(35 * pushDistanceMultiplier, 16, 95));
    const restackThreshold = Math.round(clamp(300 * pushDistanceMultiplier, 130, 660));
    const wheelCooldownMs = Math.round(clamp(250 * spawnRateMultiplier, 120, 430));
    const mouseThreshold = Math.round(clamp(150 * pushDistanceMultiplier, 60, 320));
    const spawnCooldownMs = Math.round(clamp(100 * spawnRateMultiplier, 45, 280));
    const gestureThreshold = Math.round(clamp(150 * pushDistanceMultiplier, 55, 320));
    const gestureCooldownMs = Math.round(clamp(130 * spawnRateMultiplier, 60, 330));

    return {
        normalized,
        unstackThreshold,
        restackThreshold,
        wheelCooldownMs,
        mouseThreshold,
        spawnCooldownMs,
        gestureThreshold,
        gestureCooldownMs,
    };
};
