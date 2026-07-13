import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(
    root,
    'photography-webp-migration-2026-07-13',
    'conversion-manifest.json',
);
const outputPath = path.join(
    root,
    'src',
    'data',
    'photographyImageDimensions.generated.json',
);

const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
const dimensions = Object.fromEntries(
    manifest.objects.map((image) => [
        image.webp_path,
        { width: image.webp_width, height: image.webp_height },
    ]),
);

await fs.writeFile(outputPath, `${JSON.stringify(dimensions, null, 2)}\n`);
console.log(`Wrote ${Object.keys(dimensions).length} photography image dimensions.`);
