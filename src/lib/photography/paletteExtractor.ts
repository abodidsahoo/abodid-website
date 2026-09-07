// Photographic Palette Extraction Engine using Lab Color Space & k-Means Clustering
// Extracted from Polaroid experiment

export interface ExtractedPalette {
  bg: string;
  palette: string[];
  isDark: boolean;
  textColor: string;
  subtextColor: string;
}

const cache = new Map<string, ExtractedPalette>();

// Route through same-origin proxy for cross-origin images (avoids canvas CORS taint)
const toProxyUrl = (url: string): string => {
  if (typeof window === 'undefined') return url;
  const origin = window.location.origin;
  if (url.startsWith(origin)) return url; // already same-origin
  return `${origin}/photography-portfolio/palette-proxy?url=${encodeURIComponent(url)}`;
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

const deltaE = (lab1: [number, number, number], lab2: [number, number, number]) => {
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
    let humanBonus = 1.0;
    if (angle > 10 && angle < 95) humanBonus = 1.25;

    return { lab: p, score: chroma * humanBonus };
  });

  pixelsWithScore.sort((a, b) => b.score - a.score);

  const seeds: typeof pixelsWithScore = [];
  for (const p of pixelsWithScore) {
    if (seeds.length >= 3) break;
    if (seeds.every(s => deltaE(s.lab, p.lab) > 10)) {
      seeds.push(p);
    }
  }

  const centroids: [number, number, number, number][] = seeds.map(s => [s.lab[0], s.lab[1], s.lab[2], 1]);

  const needed = k - centroids.length;
  const step = Math.floor(pixels.length / needed);
  for (let i = 0; i < needed; i++) {
    const idx = Math.floor(i * step);
    if (idx < pixels.length) {
      centroids.push([pixels[idx][0], pixels[idx][1], pixels[idx][2], 1]);
    }
  }

  const labels = new Array<number>(pixels.length);

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < pixels.length; i++) {
      let minDist = Infinity;
      let label = 0;
      for (let j = 0; j < k; j++) {
        const dist = deltaE(pixels[i], [centroids[j][0], centroids[j][1], centroids[j][2]]);
        if (dist < minDist) { minDist = dist; label = j; }
      }
      labels[i] = label;
    }

    const sums = Array.from({ length: k }, () => [0, 0, 0, 0]);
    for (let i = 0; i < pixels.length; i++) {
      const l = labels[i];
      sums[l][0] += pixels[i][0];
      sums[l][1] += pixels[i][1];
      sums[l][2] += pixels[i][2];
      sums[l][3]++;
    }

    for (let j = 0; j < k; j++) {
      if (sums[j][3] > 0) {
        centroids[j] = [sums[j][0] / sums[j][3], sums[j][1] / sums[j][3], sums[j][2] / sums[j][3], sums[j][3]];
      }
    }
  }
  return centroids.map(c => ({ lab: [c[0], c[1], c[2]] as [number, number, number], count: c[3] }));
};

export const extractPalette = async (imageUrl: string): Promise<ExtractedPalette> => {
  if (cache.has(imageUrl)) {
    return cache.get(imageUrl)!;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = toProxyUrl(imageUrl);

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('No canvas context');

        const size = 100;
        canvas.width = size;
        canvas.height = size;
        ctx.drawImage(img, 0, 0, size, size);

        const data = ctx.getImageData(0, 0, size, size).data;
        const labPixels: [number, number, number][] = [];
        for (let i = 0; i < data.length; i += 16) {
          labPixels.push(rgbToLab(data[i], data[i + 1], data[i + 2]));
        }

        if (labPixels.length === 0) throw new Error('No image data');

        const clusters = kMeansClustering(labPixels, 12);

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
          return { lab: c.lab, count: percentage, chroma };
        });

        const background = enrich.reduce((a, b) => (a.count > b.count ? a : b));
        const candidate2 = enrich.filter(c => c !== background && deltaE(c.lab, background.lab) > 15);
        const secondary = candidate2.length > 0 ? candidate2.reduce((a, b) => (a.count > b.count ? a : b)) : background;
        const candidate3 = enrich.filter(c => c !== background && c !== secondary && c.count < 0.2);
        const accent = candidate3.length > 0 ? candidate3.reduce((a, b) => (a.chroma > b.chroma ? a : b)) : enrich.reduce((a, b) => (a.chroma > b.chroma ? a : b));
        const candidate4 = enrich.filter(c => c !== background && c !== secondary && c !== accent);
        const textural = candidate4.length > 0 ? candidate4.reduce((a, b) => (a.count > b.count ? a : b)) : secondary;

        // Pick bg: prefer high-chroma cluster over plain dominant count
        // Score = chroma * sqrt(percentage) — rewards vivid colours that have real presence
        const bgCandidate = enrich.reduce((best, c) => {
          const score = c.chroma * Math.sqrt(c.count);
          const bestScore = best.chroma * Math.sqrt(best.count);
          return score > bestScore ? c : best;
        }, enrich[0]);

        // Pull L toward dramatic range: dark images → L 8-22, light → L 88-96
        const rawBgRgb = labToRgb(...bgCandidate.lab);
        const brightness = (rawBgRgb[0] * 299 + rawBgRgb[1] * 587 + rawBgRgb[2] * 114) / 1000;
        const isDark = brightness < 140;

        // Rebuild bg in Lab: keep hue, reduce chroma 20%, push L to edge
        const targetL = isDark ? Math.min(bgCandidate.lab[0], 20) : Math.max(bgCandidate.lab[0], 88);
        const scaledA = bgCandidate.lab[1] * 0.8;
        const scaledB = bgCandidate.lab[2] * 0.8;
        const finalBgRgb = labToRgb(targetL, scaledA, scaledB);
        const bgString = `rgb(${finalBgRgb[0]}, ${finalBgRgb[1]}, ${finalBgRgb[2]})`;

        const textColor = isDark ? 'rgba(255, 255, 255, 0.94)' : 'rgba(18, 18, 18, 0.94)';
        const subtextColor = isDark ? 'rgba(255, 255, 255, 0.65)' : 'rgba(18, 18, 18, 0.65)';

        const topFour = [...enrich].sort((a, b) => b.count - a.count).slice(0, 4);
        const palette = topFour.map(c => {
          const rgb = labToRgb(...c.lab);
          return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
        });

        const result: ExtractedPalette = {
          bg: bgString,
          palette,
          isDark,
          textColor,
          subtextColor
        };

        cache.set(imageUrl, result);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = (e) => reject(e);
  });
};
