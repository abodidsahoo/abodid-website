/** Mulberry32 is tiny, fast, and guarantees identical sequences for a 32-bit seed. */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashNumber(seed: number, index: number): number {
  const random = createSeededRandom((seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0);
  return random();
}

export function randomBetween(random: () => number, min: number, max: number): number {
  return min + (max - min) * random();
}

export function nextSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

