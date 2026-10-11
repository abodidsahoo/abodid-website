import sharp from "sharp";

export type MoodboardPaletteData = {
    dominantHex: string;
    dominantLab: [number, number, number];
    dominantHsl: [number, number, number];
    paletteHex: string[];
    paletteLab: [number, number, number][];
    paletteHsl: [number, number, number][];
    isDark: boolean;
};

type LabColor = [number, number, number];
type Cluster = { lab: LabColor; count: number };

const rgbToLab = (red: number, green: number, blue: number): LabColor => {
    let r = red / 255;
    let g = green / 255;
    let b = blue / 255;

    r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
    g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
    b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

    const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) * 100;
    const y = (r * 0.2126 + g * 0.7152 + b * 0.0722) * 100;
    const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) * 100;

    let normalizedX = x / 95.047;
    let normalizedY = y / 100;
    let normalizedZ = z / 108.883;

    normalizedX = normalizedX > 0.008856
        ? Math.pow(normalizedX, 1 / 3)
        : 7.787 * normalizedX + 16 / 116;
    normalizedY = normalizedY > 0.008856
        ? Math.pow(normalizedY, 1 / 3)
        : 7.787 * normalizedY + 16 / 116;
    normalizedZ = normalizedZ > 0.008856
        ? Math.pow(normalizedZ, 1 / 3)
        : 7.787 * normalizedZ + 16 / 116;

    return [
        Number(((116 * normalizedY) - 16).toFixed(2)),
        Number((500 * (normalizedX - normalizedY)).toFixed(2)),
        Number((200 * (normalizedY - normalizedZ)).toFixed(2)),
    ];
};

const labToRgb = (lightness: number, a: number, b: number): [number, number, number] => {
    let y = (lightness + 16) / 116;
    let x = a / 500 + y;
    let z = y - b / 200;

    x = Math.pow(x, 3) > 0.008856 ? Math.pow(x, 3) : (x - 16 / 116) / 7.787;
    y = Math.pow(y, 3) > 0.008856 ? Math.pow(y, 3) : (y - 16 / 116) / 7.787;
    z = Math.pow(z, 3) > 0.008856 ? Math.pow(z, 3) : (z - 16 / 116) / 7.787;

    x *= 95.047;
    y *= 100;
    z *= 108.883;

    let red = (x * 3.2406 + y * -1.5372 + z * -0.4986) / 100;
    let green = (x * -0.9689 + y * 1.8758 + z * 0.0415) / 100;
    let blue = (x * 0.0557 + y * -0.204 + z * 1.057) / 100;

    red = red > 0.0031308 ? 1.055 * Math.pow(red, 1 / 2.4) - 0.055 : 12.92 * red;
    green = green > 0.0031308 ? 1.055 * Math.pow(green, 1 / 2.4) - 0.055 : 12.92 * green;
    blue = blue > 0.0031308 ? 1.055 * Math.pow(blue, 1 / 2.4) - 0.055 : 12.92 * blue;

    return [red, green, blue].map((value) => (
        Math.max(0, Math.min(255, Math.round(value * 255)))
    )) as [number, number, number];
};

const rgbToHex = (red: number, green: number, blue: number) => {
    const component = (value: number) => value.toString(16).padStart(2, "0");
    return `#${component(red)}${component(green)}${component(blue)}`;
};

const rgbToHsl = (red: number, green: number, blue: number): [number, number, number] => {
    let r = red / 255;
    let g = green / 255;
    let b = blue / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let hue = 0;
    let saturation = 0;
    const lightness = (max + min) / 2;

    if (max !== min) {
        const delta = max - min;
        saturation = lightness > 0.5
            ? delta / (2 - max - min)
            : delta / (max + min);
        if (max === r) hue = (g - b) / delta + (g < b ? 6 : 0);
        else if (max === g) hue = (b - r) / delta + 2;
        else hue = (r - g) / delta + 4;
        hue /= 6;
    }

    return [Math.round(hue * 360), Math.round(saturation * 100), Math.round(lightness * 100)];
};

const deltaE = (first: LabColor, second: LabColor) => {
    const deltaLightness = first[0] - second[0];
    const deltaA = first[1] - second[1];
    const deltaB = first[2] - second[2];
    return Math.sqrt(deltaLightness ** 2 + deltaA ** 2 + deltaB ** 2);
};

const clusterPixels = (pixels: LabColor[], clusterCount = 6, iterations = 6): Cluster[] => {
    const scoredPixels = pixels.map((lab) => {
        const chroma = Math.sqrt(lab[1] ** 2 + lab[2] ** 2);
        let angle = Math.atan2(lab[2], lab[1]) * (180 / Math.PI);
        if (angle < 0) angle += 360;
        return { lab, score: chroma * (angle > 10 && angle < 95 ? 1.25 : 1) };
    }).sort((first, second) => second.score - first.score);

    const seeds: typeof scoredPixels = [];
    for (const pixel of scoredPixels) {
        if (seeds.length >= Math.min(3, clusterCount)) break;
        if (seeds.every((seed) => deltaE(seed.lab, pixel.lab) > 12)) seeds.push(pixel);
    }

    const centroids: [number, number, number, number][] = seeds.map(({ lab }) => [
        lab[0], lab[1], lab[2], 1,
    ]);
    const required = clusterCount - centroids.length;
    const step = Math.max(1, Math.floor(pixels.length / Math.max(1, required)));
    for (let index = 0; index < required; index += 1) {
        const pixel = pixels[Math.min(pixels.length - 1, index * step)];
        centroids.push([pixel[0], pixel[1], pixel[2], 1]);
    }

    const labels = new Int32Array(pixels.length);
    for (let iteration = 0; iteration < iterations; iteration += 1) {
        for (let pixelIndex = 0; pixelIndex < pixels.length; pixelIndex += 1) {
            let nearest = 0;
            let nearestDistance = Number.POSITIVE_INFINITY;
            for (let centroidIndex = 0; centroidIndex < clusterCount; centroidIndex += 1) {
                const centroid = centroids[centroidIndex];
                const distance = deltaE(pixels[pixelIndex], [centroid[0], centroid[1], centroid[2]]);
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearest = centroidIndex;
                }
            }
            labels[pixelIndex] = nearest;
        }

        const sums = Array.from({ length: clusterCount }, () => [0, 0, 0, 0]);
        for (let pixelIndex = 0; pixelIndex < pixels.length; pixelIndex += 1) {
            const sum = sums[labels[pixelIndex]];
            const pixel = pixels[pixelIndex];
            sum[0] += pixel[0];
            sum[1] += pixel[1];
            sum[2] += pixel[2];
            sum[3] += 1;
        }

        for (let centroidIndex = 0; centroidIndex < clusterCount; centroidIndex += 1) {
            const sum = sums[centroidIndex];
            if (sum[3] > 0) {
                centroids[centroidIndex] = [
                    sum[0] / sum[3],
                    sum[1] / sum[3],
                    sum[2] / sum[3],
                    sum[3],
                ];
            }
        }
    }

    return centroids.map((centroid) => ({
        lab: [
            Number(centroid[0].toFixed(2)),
            Number(centroid[1].toFixed(2)),
            Number(centroid[2].toFixed(2)),
        ],
        count: centroid[3],
    }));
};

export const isMoodboardPaletteData = (value: unknown): value is MoodboardPaletteData => {
    if (!value || typeof value !== "object") return false;
    const palette = value as Partial<MoodboardPaletteData>;
    return typeof palette.dominantHex === "string"
        && Array.isArray(palette.dominantLab)
        && palette.dominantLab.length === 3
        && Array.isArray(palette.paletteLab)
        && palette.paletteLab.length > 0
        && Array.isArray(palette.paletteHex)
        && Array.isArray(palette.paletteHsl)
        && typeof palette.isDark === "boolean";
};

export const extractMoodboardPalette = async (
    sourceBytes: Uint8Array | Buffer,
): Promise<MoodboardPaletteData> => {
    const { data, info } = await sharp(sourceBytes)
        .rotate()
        .resize(100, 100, { fit: "cover" })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const pixels: LabColor[] = [];
    const channels = info.channels;
    for (let offset = 0; offset < data.length; offset += channels * 2) {
        if (data[offset + 3] < 128) continue;
        pixels.push(rgbToLab(data[offset], data[offset + 1], data[offset + 2]));
    }
    if (!pixels.length) throw new Error("The image does not contain extractable color data.");

    const clusters = clusterPixels(pixels).filter((cluster) => cluster.count > 0);
    for (let first = 0; first < clusters.length; first += 1) {
        for (let second = first + 1; second < clusters.length; second += 1) {
            if (deltaE(clusters[first].lab, clusters[second].lab) < 12) {
                clusters[first].count += clusters[second].count;
                clusters.splice(second, 1);
                second -= 1;
            }
        }
    }

    const enriched = clusters.map((cluster) => ({
        ...cluster,
        percentage: cluster.count / pixels.length,
        chroma: Math.sqrt(cluster.lab[1] ** 2 + cluster.lab[2] ** 2),
    }));
    if (!enriched.length) throw new Error("Color clustering produced an empty palette.");

    const dominant = enriched.reduce((best, candidate) => (
        best.percentage > candidate.percentage ? best : candidate
    ));
    const secondaryCandidates = enriched.filter((cluster) => (
        cluster !== dominant && deltaE(cluster.lab, dominant.lab) > 14
    ));
    const secondary = secondaryCandidates.length
        ? secondaryCandidates.reduce((best, candidate) => (
            best.percentage > candidate.percentage ? best : candidate
        ))
        : dominant;
    const accentCandidates = enriched.filter((cluster) => (
        cluster !== dominant && cluster !== secondary && cluster.percentage < 0.25
    ));
    const accent = (accentCandidates.length ? accentCandidates : enriched).reduce((best, candidate) => (
        best.chroma > candidate.chroma ? best : candidate
    ));
    const texturalCandidates = enriched.filter((cluster) => (
        cluster !== dominant && cluster !== secondary && cluster !== accent
    ));
    const textural = texturalCandidates.length
        ? texturalCandidates.reduce((best, candidate) => (
            best.percentage > candidate.percentage ? best : candidate
        ))
        : secondary;

    const paletteLab = [dominant, secondary, textural, accent].map(({ lab }) => lab);
    const paletteRgb = paletteLab.map((lab) => labToRgb(...lab));
    const dominantRgb = paletteRgb[0];

    return {
        dominantHex: rgbToHex(...dominantRgb),
        dominantLab: dominant.lab,
        dominantHsl: rgbToHsl(...dominantRgb),
        paletteHex: paletteRgb.map((rgb) => rgbToHex(...rgb)),
        paletteLab,
        paletteHsl: paletteRgb.map((rgb) => rgbToHsl(...rgb)),
        isDark: dominant.lab[0] < 50,
    };
};
