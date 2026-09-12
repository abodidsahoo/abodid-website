const samples = [
  {
    label: "Showreel 2025",
    kind: "video",
    supabase:
      "https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/films/videos/Showreel%202025%20compressed.mp4",
    cloudflare: "https://assets.abodid.com/videos/showreel-2025-compressed.mp4",
  },
  {
    label: "Obsidian Timelapse",
    kind: "video",
    supabase:
      "https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/misc/video-clips/Obsidian_Timelapse.mp4",
    cloudflare: "https://assets.abodid.com/videos/obsidian-timelapse.mp4",
  },
  {
    label: "Siri article thumbnail",
    kind: "image",
    supabase:
      "https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/blog/articles/if-siri-finally-becomes-a-good-listener-the-future-is-bright/apple-events/siri-app-actions-mac.jpg",
    cloudflare:
      "https://assets.abodid.com/documents/thumbnails/siri-app-actions-mac.jpg",
  },
  {
    label: "Punctum research thumbnail",
    kind: "image",
    supabase:
      "https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/research/covers/1769636977430_msh94w5fk.jpg",
    cloudflare:
      "https://assets.abodid.com/documents/thumbnails/research-1769636977430-msh94w5fk.jpg",
  },
  {
    label: "Research cover thumbnail",
    kind: "image",
    supabase:
      "https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/research/covers/1769634589720_dz93s7tr8.jpg",
    cloudflare:
      "https://assets.abodid.com/documents/thumbnails/research-1769634589720-dz93s7tr8.jpg",
  },
  {
    label: "Page preview thumbnail",
    kind: "image",
    supabase:
      "https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/page-assets/og-images/1768884087671_0himmkhnc.jpg",
    cloudflare:
      "https://assets.abodid.com/documents/thumbnails/page-preview-1768884087671-0himmkhnc.jpg",
  },
];

const rounds = 3;
const results = [];

async function measure(sample, provider, round) {
  const headers = sample.kind === "video" ? { Range: "bytes=0-4194303" } : {};
  const started = performance.now();
  const response = await fetch(sample[provider], { headers });
  const headersReceived = performance.now();
  const payload = await response.arrayBuffer();
  const completed = performance.now();

  if (!response.ok) {
    throw new Error(`${response.status} ${sample.label} via ${provider}`);
  }

  return {
    label: sample.label,
    kind: sample.kind,
    provider,
    round,
    status: response.status,
    cache: response.headers.get("cf-cache-status") || "UNKNOWN",
    bytes: payload.byteLength,
    ttfbMs: Number((headersReceived - started).toFixed(1)),
    totalMs: Number((completed - started).toFixed(1)),
    throughputMbps: Number(
      ((payload.byteLength * 8) / ((completed - headersReceived) / 1000) / 1_000_000).toFixed(2),
    ),
  };
}

for (let round = 1; round <= rounds; round += 1) {
  for (const sample of samples) {
    const providerOrder = round % 2 === 0
      ? ["cloudflare", "supabase"]
      : ["supabase", "cloudflare"];
    for (const provider of providerOrder) {
      results.push(await measure(sample, provider, round));
    }
  }
}

const summary = ["supabase", "cloudflare"].map((provider) => {
  const providerResults = results.filter((result) => result.provider === provider);
  const warmResults = providerResults.filter((result) => result.round > 1);
  const average = (values) =>
    values.reduce((total, value) => total + value, 0) / values.length;

  return {
    provider,
    requests: providerResults.length,
    cacheStatuses: providerResults.reduce((counts, result) => {
      counts[result.cache] = (counts[result.cache] || 0) + 1;
      return counts;
    }, {}),
    averageTtfbMs: Number(
      average(providerResults.map((result) => result.ttfbMs)).toFixed(1),
    ),
    averageWarmTtfbMs: Number(
      average(warmResults.map((result) => result.ttfbMs)).toFixed(1),
    ),
    averageTotalMs: Number(
      average(providerResults.map((result) => result.totalMs)).toFixed(1),
    ),
  };
});

console.log(JSON.stringify({ summary, results }, null, 2));
