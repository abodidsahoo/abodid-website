import sharp from 'sharp';

export type PaletteData = {
  bg: string;
  isDark: boolean;
  textColor: string;
  subtextColor: string;
};

const rgbToLab = (r: number, g: number, b: number): [number, number, number] => {
  r /= 255; g /= 255; b /= 255;
  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
  r *= 100; g *= 100; b *= 100;

  const x = r * 0.4124 + g * 0.3576 + b * 0.1805;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = r * 0.0193 + g * 0.1192 + b * 0.9505;

  let lX = x / 95.047;
  let lY = y / 100.000;
  let lZ = z / 108.883;

  lX = lX > 0.008856 ? Math.pow(lX, 1 / 3) : (7.787 * lX) + 16 / 116;
  lY = lY > 0.008856 ? Math.pow(lY, 1 / 3) : (7.787 * lY) + 16 / 116;
  lZ = lZ > 0.008856 ? Math.pow(lZ, 1 / 3) : (7.787 * lZ) + 16 / 116;

  return [(116 * lY) - 16, 500 * (lX - lY), 200 * (lY - lZ)];
};

const labToRgb = (l: number, a: number, b: number): [number, number, number] => {
  let y = (l + 16) / 116;
  let x = a / 500 + y;
  let z = y - b / 200;

  x = Math.pow(x, 3) > 0.008856 ? Math.pow(x, 3) : (x - 16 / 116) / 7.787;
  y = Math.pow(y, 3) > 0.008856 ? Math.pow(y, 3) : (y - 16 / 116) / 7.787;
  z = Math.pow(z, 3) > 0.008856 ? Math.pow(z, 3) : (z - 16 / 116) / 7.787;

  x *= 95.047; y *= 100.000; z *= 108.883;

  let r = x * 3.2406 + y * -1.5372 + z * -0.4986;
  let g = x * -0.9689 + y * 1.8758 + z * 0.0415;
  let bVal = x * 0.0557 + y * -0.2040 + z * 1.0570;

  r /= 100; g /= 100; bVal /= 100;
  r = r > 0.0031308 ? 1.055 * Math.pow(r, 1 / 2.4) - 0.055 : 12.92 * r;
  g = g > 0.0031308 ? 1.055 * Math.pow(g, 1 / 2.4) - 0.055 : 12.92 * g;
  bVal = bVal > 0.0031308 ? 1.055 * Math.pow(bVal, 1 / 2.4) - 0.055 : 12.92 * bVal;

  return [
    Math.max(0, Math.min(255, Math.round(r * 255))),
    Math.max(0, Math.min(255, Math.round(g * 255))),
    Math.max(0, Math.min(255, Math.round(bVal * 255)))
  ];
};

const deltaE = (lab1: [number, number, number], lab2: [number, number, number]): number => {
  const dL = lab1[0] - lab2[0];
  const da = lab1[1] - lab2[1];
  const db = lab1[2] - lab2[2];
  return Math.sqrt(dL * dL + da * da + db * db);
};

const kMeansClustering = (pixels: [number, number, number][], k: number, iterations = 6) => {
  const pixelsWithScore = pixels.map(p => {
    const chroma = Math.sqrt(p[1] * p[1] + p[2] * p[2]);
    let angle = Math.atan2(p[2], p[1]) * (180 / Math.PI);
    if (angle < 0) angle += 360;
    const humanBonus = (angle > 10 && angle < 95) ? 1.25 : 1.0;
    return { lab: p, score: chroma * humanBonus };
  });

  pixelsWithScore.sort((a, b) => b.score - a.score);

  const seeds: { lab: [number, number, number]; score: number }[] = [];
  for (const p of pixelsWithScore) {
    if (seeds.length >= 3) break;
    if (seeds.every(s => deltaE(s.lab, p.lab) > 10)) {
      seeds.push(p);
    }
  }

  const centroids: number[][] = seeds.map(s => [...s.lab]);
  const needed = k - centroids.length;
  const step = Math.floor(pixels.length / needed);
  for (let i = 0; i < needed; i++) {
    const idx = Math.floor(i * step);
    if (idx < pixels.length) {
      centroids.push([...pixels[idx]]);
    }
  }

  const labels = new Array(pixels.length);
  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < pixels.length; i++) {
      let minDist = Infinity;
      let label = 0;
      for (let j = 0; j < k; j++) {
        const dist = deltaE(pixels[i], centroids[j] as [number, number, number]);
        if (dist < minDist) { minDist = dist; label = j; }
      }
      labels[i] = label;
    }

    const sums: number[][] = Array.from({ length: k }, () => [0, 0, 0, 0]);
    for (let i = 0; i < pixels.length; i++) {
      const l = labels[i];
      sums[l][0] += pixels[i][0];
      sums[l][1] += pixels[i][1];
      sums[l][2] += pixels[i][2];
      sums[l][3]++;
    }

    for (let j = 0; j < k; j++) {
      if (sums[j][3] > 0) {
        centroids[j] = [
          sums[j][0] / sums[j][3],
          sums[j][1] / sums[j][3],
          sums[j][2] / sums[j][3],
          sums[j][3]
        ];
      }
    }
  }

  return centroids.map(c => ({
    lab: [c[0], c[1], c[2]] as [number, number, number],
    count: c[3]
  }));
};

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [Math.round(h * 360), s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360 / 360;
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function adjustToEditorialPalette(r: number, g: number, b: number): [number, number, number] {
  let [h, s, l] = rgbToHsl(r, g, b);
  // High-saturation pop color, toned down just a tad from neon (0.72 - 0.80)
  const popS = Math.max(0.72, Math.min(0.80, Math.max(s, 0.74)));
  // Luminous pop lightness, toned down just a bit (0.58 - 0.63)
  const popL = Math.max(0.58, Math.min(0.63, Math.max(l, 0.59)));
  return hslToRgb(h, popS, popL);
}

const paletteCache = new Map<string, PaletteData>();

export async function extractPaletteFromServerImage(imageUrl: string): Promise<PaletteData> {
  if (paletteCache.has(imageUrl)) {
    return paletteCache.get(imageUrl)!;
  }

  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());

    const { data } = await sharp(buf)
      .resize(100, 100, { fit: 'inside' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const labPixels: [number, number, number][] = [];
    for (let i = 0; i < data.length; i += 16) {
      if (data[i + 3] < 128) continue;
      labPixels.push(rgbToLab(data[i], data[i + 1], data[i + 2]));
    }

    if (labPixels.length === 0) throw new Error('No pixels parsed');

    const clusters = kMeansClustering(labPixels, 14);
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        if (deltaE(clusters[i].lab, clusters[j].lab) < 12) {
          clusters[i].count += clusters[j].count;
          clusters.splice(j, 1);
          j--;
        }
      }
    }

    const enrich = clusters.map(c => {
      const chroma = Math.sqrt(c.lab[1] ** 2 + c.lab[2] ** 2);
      const percentage = c.count / labPixels.length;
      return { lab: c.lab, count: percentage, chroma, L: c.lab[0] };
    });

    if (enrich.length === 0) throw new Error('No clusters');

    // Polaroids 4-pillar selection logic:
    // 1. Dominant background cluster
    const background = enrich.reduce((a, b) => (a.count > b.count ? a : b));
    // 2. Distinct secondary cluster
    const candidate2 = enrich.filter(c => c !== background && deltaE(c.lab, background.lab) > 15);
    const secondary = candidate2.length > 0 ? candidate2.reduce((a, b) => (a.count > b.count ? a : b)) : background;
    // 3. High-chroma accent cluster (Polaroids palette[3])
    const candidate3 = enrich.filter(c => c !== background && c !== secondary && c.count < 0.25);
    const accent = candidate3.length > 0
      ? candidate3.reduce((a, b) => (a.chroma > b.chroma ? a : b))
      : enrich.reduce((a, b) => (a.chroma > b.chroma ? a : b));
    // 4. Smart dominant background scoring with human tone bonus (10° to 95°)
    const candidates = [background, secondary, accent];
    const smartBg = candidates.reduce((prev, current) => {
      const getScore = (c: typeof current) => {
        let angle = Math.atan2(c.lab[2], c.lab[1]) * (180 / Math.PI);
        if (angle < 0) angle += 360;
        const bonus = (angle > 10 && angle < 95) ? 1.25 : 1.0;
        return c.chroma * bonus;
      };
      return getScore(current) > getScore(prev) ? current : prev;
    }, background);

    // If accent has high chroma, prioritize accent (Polaroids palette[3]); otherwise smartBg
    const chosen = (accent && accent.chroma > 18) ? accent : smartBg;

    const rawRgb = labToRgb(...chosen.lab);
    const [popR, popG, popB] = adjustToEditorialPalette(rawRgb[0], rawRgb[1], rawRgb[2]);

    const result: PaletteData = {
      bg: `rgb(${popR},${popG},${popB})`,
      isDark: false,
      textColor: '#141414',
      subtextColor: 'rgba(20,20,20,0.68)'
    };

    paletteCache.set(imageUrl, result);
    return result;
  } catch (err) {
    const fallback: PaletteData = {
      bg: 'rgb(226,204,192)',
      isDark: false,
      textColor: '#141414',
      subtextColor: 'rgba(20,20,20,0.68)'
    };
    return fallback;
  }
}
