import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const iconsDir = path.resolve('extension/icons');
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
}

// SVG with pop editorial yellow background, dark border, and bold letter 'O'
const generateSvg = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${Math.floor(size * 0.2)}" fill="#ffe44f" stroke="#15130f" stroke-width="${Math.max(1, Math.floor(size * 0.08))}"/>
  <text x="50%" y="54%" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="${Math.floor(size * 0.58)}" fill="#15130f" text-anchor="middle" dominant-baseline="central">O</text>
</svg>
`;

async function main() {
    const sizes = [16, 48, 128];
    for (const size of sizes) {
        const svgBuffer = Buffer.from(generateSvg(size));
        const outPath = path.join(iconsDir, `icon-${size}.png`);
        await sharp(svgBuffer).png().toFile(outPath);
        console.log(`Generated ${outPath}`);
    }
}

main().catch(console.error);
