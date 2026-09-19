import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const publicDir = path.resolve('public');
const iconsDir = path.join(publicDir, 'icons');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

const svgBuffer = fs.readFileSync(path.join(publicDir, 'favicon.svg'));

async function generateIcons() {
  console.log('Generating PWA icons from favicon.svg...');

  // 1. Standard 192x192
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(iconsDir, 'icon-192.png'));
  console.log('✓ Created public/icons/icon-192.png');

  // 2. Standard 512x512
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(iconsDir, 'icon-512.png'));
  console.log('✓ Created public/icons/icon-512.png');

  // 3. Apple Touch Icon 180x180
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(iconsDir, 'apple-touch-icon.png'));
  console.log('✓ Created public/icons/apple-touch-icon.png');

  // Also write to public/apple-touch-icon.png for iOS root scraper fallback
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('✓ Created public/apple-touch-icon.png');

  // 4. Maskable icons (with 15% inner padding for safe zone)
  const createMaskable = async (size, filename) => {
    const innerSize = Math.round(size * 0.75);
    const innerIcon = await sharp(svgBuffer)
      .resize(innerSize, innerSize)
      .toBuffer();

    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    })
    .composite([{ input: innerIcon, gravity: 'center' }])
    .png()
    .toFile(path.join(iconsDir, filename));
    console.log(`✓ Created public/icons/${filename}`);
  };

  await createMaskable(192, 'icon-maskable-192.png');
  await createMaskable(512, 'icon-maskable-512.png');

  console.log('All icons generated successfully!');
}

generateIcons().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
