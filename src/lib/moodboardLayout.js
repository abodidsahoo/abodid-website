const OVERLAP_LIMIT = 0.22;
const EDGE_PADDING = 18;
export const TOP_PADDING = 12;
export const BOTTOM_PADDING = 24;

const SIZE_PRESETS = [
    { scale: 0.24, weight: 0.06 },
    { scale: 0.34, weight: 0.1 },
    { scale: 0.46, weight: 0.13 },
    { scale: 0.6, weight: 0.16 },
    { scale: 0.74, weight: 0.17 },
    { scale: 0.88, weight: 0.13 },
    { scale: 1.02, weight: 0.1 },
    { scale: 1.16, weight: 0.08 },
    { scale: 1.34, weight: 0.05 },
    { scale: 1.52, weight: 0.02 },
];

export const FLOATING_IMAGE_SIZE_PRESETS = Object.freeze({
    small: Object.freeze({ sizeMultiplier: 1, minScale: 0.24 }),
    medium: Object.freeze({ sizeMultiplier: 1.425, minScale: 0.445 }),
    large: Object.freeze({ sizeMultiplier: 1.85, minScale: 0.65 }),
});

export function getFloatingImageSizePreset(value = 'medium') {
    return FLOATING_IMAGE_SIZE_PRESETS[value] || FLOATING_IMAGE_SIZE_PRESETS.medium;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export function hashString(value) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

export function createSeededRandom(seed) {
    let state = seed >>> 0;
    return () => {
        state += 0x6d2b79f5;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function overlapRatio(boxA, boxB) {
    const xOverlap = Math.max(
        0,
        Math.min(boxA.left + boxA.width, boxB.left + boxB.width) - Math.max(boxA.left, boxB.left),
    );
    const yOverlap = Math.max(
        0,
        Math.min(boxA.top + boxA.height, boxB.top + boxB.height) - Math.max(boxA.top, boxB.top),
    );

    if (xOverlap === 0 || yOverlap === 0) return 0;

    const intersection = xOverlap * yOverlap;
    const smallerArea = Math.min(boxA.width * boxA.height, boxB.width * boxB.height);
    if (!smallerArea) return 0;

    return intersection / smallerArea;
}

function pickSizeScale(random) {
    const roll = random();
    let cumulative = 0;

    for (const preset of SIZE_PRESETS) {
        cumulative += preset.weight;
        if (roll <= cumulative) return preset.scale;
    }

    return 1;
}

export function resolveLaneCount(width, sizeMultiplier = 1.0) {
    const scale = Math.max(1.0, sizeMultiplier);
    if (width < 720 * scale) return 2;
    if (width < 1040 * scale) return 3;
    if (width < 1360 * scale) return 4;
    if (width < 1760 * scale) return 5;
    return 6;
}

export function getFloatingStageSize({
    width,
    viewportHeight,
    itemCount,
    sizeMultiplier = 1.0,
    spacingMultiplier = 1.0,
}) {
    const laneCount = resolveLaneCount(width, sizeMultiplier);
    const referenceSquare = clamp(width * 0.2 * sizeMultiplier, 170 * sizeMultiplier, 360 * sizeMultiplier);
    const rowCount = Math.ceil(Math.max(itemCount, 1) / laneCount);
    const densityScale =
        rowCount <= 2
            ? 0.84
            : rowCount <= 4
                ? 0.94
                : rowCount <= 6
                    ? 1.02
                    : 1.08;
    const rowSpan = clamp(referenceSquare * densityScale, 144 * sizeMultiplier * spacingMultiplier, 336 * sizeMultiplier * spacingMultiplier);
    const height = Math.max(
        viewportHeight * 0.9,
        TOP_PADDING + BOTTOM_PADDING + rowCount * rowSpan + viewportHeight * 0.3,
    );

    return { width, height, viewportHeight };
}

function getBalancedCardSize(width, ratio, random, sizeMultiplier = 1.0, minScale = 0.24) {
    const baseSquare = clamp(width * 0.17 * sizeMultiplier, 150 * sizeMultiplier, 310 * sizeMultiplier);
    const scaleToken = Math.max(minScale, pickSizeScale(random));
    const baseLongSide = baseSquare * scaleToken;

    let cardWidth = ratio >= 1 ? baseLongSide : baseLongSide * ratio;
    let cardHeight = ratio >= 1 ? baseLongSide / ratio : baseLongSide;

    const maxWidth = clamp(width * 0.31 * sizeMultiplier, 190 * sizeMultiplier, 470 * sizeMultiplier);
    const maxHeight = clamp(width * 0.34 * sizeMultiplier, 190 * sizeMultiplier, 490 * sizeMultiplier);
    const downScale = Math.min(maxWidth / cardWidth, maxHeight / cardHeight, 1);

    cardWidth *= downScale;
    cardHeight *= downScale;

    const minEdge = (width < 720 ? 62 : 76) * sizeMultiplier;
    const upScale = Math.max(minEdge / cardWidth, minEdge / cardHeight, 1);

    cardWidth *= upScale;
    cardHeight *= upScale;

    return {
        width: cardWidth,
        height: cardHeight,
    };
}

export function computeFloatingLayout(items, width, height, seedSalt = 0, sizeMultiplier = 1.0, spacingMultiplier = 1.0, minScale = 0.24) {
    const layout = new Map();
    if (!items.length || width <= 0 || height <= 0) return layout;

    const placed = [];
    const topInset = TOP_PADDING + 8;
    const bottomInset = BOTTOM_PADDING + 8;
    const laneCount = resolveLaneCount(width, sizeMultiplier);
    const targetRows = Math.max(1, Math.ceil(items.length / laneCount));
    const usableWidth = width - EDGE_PADDING * 2;
    const laneWidth = usableWidth / laneCount;
    const laneHeights = Array.from({ length: laneCount }, (_, lane) => topInset + lane * 10);
    const depthCompression =
        targetRows <= 2
            ? 0.9
            : targetRows <= 4
                ? 0.94
                : targetRows <= 6
                    ? 0.98
                    : 1;

    items.forEach((item) => {
        const random = createSeededRandom(hashString(`${item.id}:${seedSalt}`));
        const ratio = item.type === 'text' ? 1.1 : clamp(item.aspectRatio || 1, 0.35, 2.85);
        let dimensions = getBalancedCardSize(width, ratio, random, sizeMultiplier, minScale);
        if (item.type === 'text') {
            let targetWidth, targetHeight;
            if (laneCount > 2) {
                targetWidth = clamp(width * 0.35, 300, 420);
                targetHeight = clamp(width * 0.35, 260, 400);
            } else {
                targetWidth = clamp(width * 0.82, 280, 460);
                targetHeight = clamp(width * 0.45, 200, 320);
            }
            dimensions = { width: targetWidth, height: targetHeight };
        }
        const targetWidth = dimensions.width;
        const targetHeight = dimensions.height;
        const maxTopForCard = Math.max(topInset, height - bottomInset - targetHeight);
        const compressedMaxTop = topInset + (maxTopForCard - topInset) * depthCompression;

        const laneIndices = Array.from({ length: laneCount }, (_, lane) => lane);
        laneIndices.sort((a, b) => laneHeights[a] - laneHeights[b]);

        let bestCandidate = null;
        let bestScore = Infinity;

        let forcedLane = -1;
        if (item.id === 'text-block-1') {
            forcedLane = laneCount > 2 ? 0 : 0;
        } else if (item.id === 'text-block-2') {
            forcedLane = laneCount > 2 ? 2 : 0;
        }

        let minTopLimit = 0;
        if (item.id === 'text-block-2') {
            const block1 = placed.find(p => p.itemId === 'text-block-1');
            if (block1) {
                minTopLimit = block1.top + (laneCount > 2 ? 160 : 380);
            }
        }

        for (let laneRank = 0; laneRank < laneIndices.length; laneRank += 1) {
            const lane = laneIndices[laneRank];
            if (forcedLane !== -1 && lane !== forcedLane) continue;

            const laneBaseX = EDGE_PADDING + lane * laneWidth;

            for (let attempt = 0; attempt < 3; attempt += 1) {
                const centerX = laneBaseX + laneWidth * 0.5;
                const crossLanePull = (random() - 0.5) * laneWidth * 0.42;
                const laneBias = (lane % 2 === 0 ? -1 : 1) * laneWidth * (0.02 + random() * 0.06);
                const left = clamp(
                    centerX - targetWidth / 2 + crossLanePull + laneBias,
                    EDGE_PADDING,
                    width - EDGE_PADDING - targetWidth,
                );

                const verticalOverlap = targetHeight * (0.02 + random() * 0.05);
                const verticalJitter = (random() - 0.5) * Math.min(20, targetHeight * 0.11);
                const top = clamp(
                    laneHeights[lane] - verticalOverlap + verticalJitter,
                    topInset,
                    compressedMaxTop,
                );

                let topVal = top;
                if (item.id === 'text-block-2' && topVal < minTopLimit) {
                    topVal = minTopLimit;
                }

                let leftVal = left;
                if (laneCount > 2) {
                    if (item.id === 'text-block-1') {
                        leftVal = clamp(leftVal + laneWidth * 0.16, EDGE_PADDING + 24, width - EDGE_PADDING - targetWidth - 24);
                    } else if (item.id === 'text-block-2') {
                        leftVal = clamp(leftVal - laneWidth * 0.16, EDGE_PADDING + 24, width - EDGE_PADDING - targetWidth - 24);
                    }
                } else {
                    leftVal = clamp((width - targetWidth) / 2, EDGE_PADDING, width - EDGE_PADDING - targetWidth);
                }

                const candidate = {
                    left: leftVal,
                    top: topVal,
                    width: targetWidth,
                    height: targetHeight,
                    lane,
                };

                let highestOverlap = 0;
                let overlapPenalty = 0;
                for (
                    let previousIndex = Math.max(0, placed.length - 14);
                    previousIndex < placed.length;
                    previousIndex += 1
                ) {
                    const overlap = overlapRatio(candidate, placed[previousIndex]);
                    highestOverlap = Math.max(highestOverlap, overlap);
                    if (overlap > OVERLAP_LIMIT) {
                        overlapPenalty += (overlap - OVERLAP_LIMIT) * 1600;
                    }
                    if (overlap > OVERLAP_LIMIT + 0.14) break;
                }

                const lanePenalty = laneRank * 18;
                const depthPenalty = candidate.top * 0.02;
                const score = overlapPenalty + lanePenalty + depthPenalty;

                if (score < bestScore) {
                    bestScore = score;
                    bestCandidate = candidate;
                }
            }
        }

        if (!bestCandidate) return;
        const position = { ...bestCandidate, itemId: item.id };
        placed.push(position);

        let laneAdvance = targetHeight * (0.86 + random() * 0.26) * spacingMultiplier;
        if (random() < 0.16) {
            laneAdvance += targetHeight * (0.12 + random() * 0.12) * spacingMultiplier;
        }
        laneHeights[position.lane] = Math.max(
            laneHeights[position.lane],
            position.top + laneAdvance,
        );

        if (item.customSpacingAfter) {
            for (let l = 0; l < laneCount; l++) {
                laneHeights[l] = Math.max(
                    laneHeights[l],
                    position.top + targetHeight + item.customSpacingAfter
                );
            }
        }

        // bleed nearby lane heights to break coherent side-by-side bands
        if (position.lane > 0) {
            laneHeights[position.lane - 1] = Math.max(
                laneHeights[position.lane - 1],
                position.top + targetHeight * (0.42 + random() * 0.2) * spacingMultiplier,
            );
        }
        if (position.lane < laneCount - 1) {
            laneHeights[position.lane + 1] = Math.max(
                laneHeights[position.lane + 1],
                position.top + targetHeight * (0.42 + random() * 0.2) * spacingMultiplier,
            );
        }

        const leftRoom = Math.max(0, position.left - EDGE_PADDING);
        const rightRoom = Math.max(0, width - EDGE_PADDING - (position.left + position.width));
        const topRoom = Math.max(0, position.top - topInset);
        const bottomRoom = Math.max(0, height - bottomInset - (position.top + position.height));

        const motionTierRoll = random();
        const motionTierMultiplier =
            motionTierRoll < 0.24 ? 2.18 : motionTierRoll < 0.66 ? 1.5 : 1.04;
        const breathDirection = random() < 0.82 ? 1 : -1; // majority cohort moves together

        const rawDriftX = (0.9 + random() * 3.8) * (0.8 + random() * 0.55);
        const rawDriftY = (7.8 + random() * 12.2) * motionTierMultiplier;
        const driftX = Math.max(0.7, Math.min(rawDriftX, leftRoom * 0.72, rightRoom * 0.72));
        const driftY = Math.max(3, Math.min(rawDriftY, topRoom * 0.78, bottomRoom * 0.78));
        const driftXDirection = random() < 0.5 ? -1 : 1;
        const scrollStagger = (position.top / Math.max(height, 1)) * 0.14;
        const horizontalStagger = (position.left / Math.max(width, 1)) * 0.04;
        const baseDuration = clamp(
            6.45 +
            random() * 0.62 +
            (motionTierRoll < 0.24 ? -0.18 : motionTierRoll < 0.66 ? -0.04 : 0.11),
            6.1,
            7.2,
        );
        const phaseJitter = random() * 0.14;
        const motionDelay = phaseJitter;

        layout.set(item.id, {
            ...position,
            driftX: driftX * driftXDirection,
            driftY,
            breathDirection,
            breathScale:
                (0.011 + random() * 0.015) *
                (motionTierRoll < 0.22 ? 1.55 : motionTierRoll < 0.58 ? 1.2 : 1),
            duration: baseDuration,
            motionDelay,
            appearDelay: clamp(0.02 + scrollStagger + horizontalStagger, 0.02, 0.22),
            zIndex: item.type === 'text' ? 550 : (() => {
                const layerRoll = random();

                if (layerRoll < 0.3) return 10 + Math.floor(random() * 28);
                if (layerRoll < 0.8) return 46 + Math.floor(random() * 84);
                return 134 + Math.floor(random() * 92);
            })(),
        });
    });

    return layout;
}
