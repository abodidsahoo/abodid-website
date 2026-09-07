import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import snapshot from '../../data/photographyR2.generated.json';
import metadata from '../../data/photographyMetadata.json';
import { buildCatalog, DEFAULT_FOLDERS } from './catalog.mjs';

export type PortfolioPhoto = {
  id: string; key: string; category: string; series: string; title: string;
  label: string; location: string; story: string; alt: string; camera: string;
  width: number; height: number; original: string; small: string; large: string;
};
const env = (name: string) => process.env[name] || import.meta.env[name] || '';
const TTL = 5 * 60_000;
let cache: { photos: PortfolioPhoto[]; expires: number } | undefined;
let pending: Promise<PortfolioPhoto[]> | undefined;
const fallback = () => buildCatalog(snapshot, metadata) as PortfolioPhoto[];

async function refresh(): Promise<PortfolioPhoto[]> {
  const account = env('R2_ACCOUNT_ID').match(/[a-f0-9]{32}/i)?.[0];
  if (!account || !env('R2_ACCESS_KEY_ID') || !env('R2_SECRET_ACCESS_KEY')) return fallback();
  const client = new S3Client({
    region: 'auto', forcePathStyle: true, maxAttempts: 1,
    endpoint: `https://${account}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env('R2_ACCESS_KEY_ID'), secretAccessKey: env('R2_SECRET_ACCESS_KEY') },
  });
  const objects: { key: string; etag?: string }[] = [];
  const signal = AbortSignal.timeout(10000);
  try {
    for (const type of ['originals', 'variants']) {
      let token: string | undefined;
      do {
        const result = await client.send(new ListObjectsV2Command({
          Bucket: env('PHOTOGRAPHY_R2_BUCKET') || 'assets',
          Prefix: `photos/${type}/`, ContinuationToken: token,
        }), { abortSignal: signal });
        objects.push(...(result.Contents || []).filter(x => x.Key).map(x => ({ key: x.Key!, etag: x.ETag })));
        token = result.IsTruncated ? result.NextContinuationToken : undefined;
      } while (token);
    }
    return buildCatalog(objects, metadata) as PortfolioPhoto[];
  } finally { client.destroy(); }
}
export async function getPortfolioPhotos(): Promise<PortfolioPhoto[]> {
  if (cache && cache.expires > Date.now()) return cache.photos;
  if (!cache) cache = { photos: fallback(), expires: 0 };
  if (!pending) pending = refresh().then(photos => {
    cache = { photos, expires: Date.now() + TTL };
    return photos;
  }).catch(() => {
    console.warn('[photography] Live catalog unavailable; using last verified catalog.');
    const photos = cache?.photos || fallback();
    cache = { photos, expires: Date.now() + 60_000 };
    return photos;
  }).finally(() => { pending = undefined; });
  return cache.photos;
}
export function groupPortfolio(photos: PortfolioPhoto[]) {
  const order = ['outernet', 'ting', 'into-the-flux', 'digital-direction', 'hidden', 'truman-brewery', 'breathe-variations', 'print', 'mres'];
  const covers: Record<string, string> = { outernet: '-18', ting: '-9', 'into-the-flux': 'london88', 'digital-direction': '-146', hidden: '-35', 'truman-brewery': '-97', 'breathe-variations': '-12' };
  const groups = new Map<string, PortfolioPhoto[]>();
  for (const photo of photos) {
    const key = photo.series;
    groups.set(key, [...(groups.get(key) || []), photo]);
  }
  return [...groups.entries()].map(([id, images]) => {
    const first = images.find(x => x.id.endsWith(covers[x.series] || '\0')) || images[0];
    return { id, title: first.title, category: first.category, label: first.label, cover: first, images: [first, ...images.filter(x => x !== first)] };
  }).sort((a, b) => (order.indexOf(a.cover.series) < 0 ? 99 : order.indexOf(a.cover.series)) - (order.indexOf(b.cover.series) < 0 ? 99 : order.indexOf(b.cover.series)));
}
