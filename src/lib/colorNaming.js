import namedColorsData from '../data/namedColors.json';

export function parseColorToRgb(str) {
    if (!str || typeof str !== 'string') return [128, 128, 128];
    const trimmed = str.trim();

    if (trimmed.startsWith('#')) {
        let clean = trimmed.replace('#', '');
        if (clean.length === 3) {
            clean = clean.split('').map((c) => c + c).join('');
        }
        const num = parseInt(clean, 16);
        if (!isNaN(num)) {
            return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
        }
    }

    if (trimmed.startsWith('rgb')) {
        const match = trimmed.match(/\(([^)]+)\)/);
        if (match && match[1]) {
            const parts = match[1].split(',').map((p) => parseFloat(p.trim()));
            if (parts.length >= 3 && !parts.slice(0, 3).some(isNaN)) {
                return [
                    Math.max(0, Math.min(255, Math.round(parts[0]))),
                    Math.max(0, Math.min(255, Math.round(parts[1]))),
                    Math.max(0, Math.min(255, Math.round(parts[2]))),
                ];
            }
        }
    }

    return [128, 128, 128];
}

export function srgbToLinear(c) {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function rgbToOklab(r, g, b) {
    const lr = srgbToLinear(r);
    const lg = srgbToLinear(g);
    const lb = srgbToLinear(b);

    const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
    const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
    const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);

    return [
        0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
    ];
}

export function getClosestNamedColor(rOrColor, g, b) {
    let rVal = 128;
    let gVal = 128;
    let bVal = 128;

    if (typeof rOrColor === 'string') {
        [rVal, gVal, bVal] = parseColorToRgb(rOrColor);
    } else if (typeof rOrColor === 'number') {
        rVal = rOrColor;
        gVal = typeof g === 'number' ? g : 128;
        bVal = typeof b === 'number' ? b : 128;
    }

    const oklab = rgbToOklab(rVal, gVal, bVal);
    let bestMatch = namedColorsData[0];
    let minDistance = Infinity;

    for (let i = 0; i < namedColorsData.length; i++) {
        const item = namedColorsData[i];
        const [targetL, targetA, targetB] = item.oklab;
        const dL = oklab[0] - targetL;
        const da = oklab[1] - targetA;
        const db = oklab[2] - targetB;
        const dist = dL * dL + da * da + db * db;
        if (dist < minDistance) {
            minDistance = dist;
            bestMatch = item;
        }
    }

    return bestMatch ? bestMatch.name : 'Color Tone';
}

export { namedColorsData };
